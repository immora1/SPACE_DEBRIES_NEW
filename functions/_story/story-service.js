import {
  ACTION_TYPE,
  CHECKPOINT,
  PRODUCT_MODULE,
  STORY_EXPIRY_MS,
  STORY_GENERATION_METADATA,
  STORY_SPEC_VERSION,
  STORY_STATUS,
  StoryError,
  TASK_TYPE,
  assertStory,
} from './constants.js'
import {
  CanonicalStoryUserInputSchema,
  CreateStoryRequestSchema,
  StoryArtifactGenerationSnapshotSchema,
  StoryActionRequestSchema,
  StoryUserInputSchema,
} from './schemas.js'
import {
  applyNarrativeOutput,
  applyOpeningOutput,
  applyStoryOption,
  appendUniqueFacts,
  cloneState,
  createInitialGameState,
  createRuntimeStoryState,
  storyMetrics,
} from './state-reducer.js'
import { toPublicStoryDTO } from './public-dto.js'
import {
  STORY_OPENING_SPEC_VERSION,
  stableStringify,
} from './spec-assets.js'
import {
  validateKnowledgeReveal,
  validateStoryContinue,
  validateStoryEnding,
  validateStoryOpening,
  validateStoryOutline,
  validateStorySchema,
} from './validators.js'
import { resolveOptionsForNode } from './config/story-options.js'
import {
  buildContinueContext,
  buildEndingContext,
  buildKnowledgeContext,
  buildOpeningContext,
  buildSiteInteractionContinueContext,
  buildArtifactContinueContext,
  findOutlineNode,
  latestContinuityHandoff,
} from './story-context.js'
import { selectEnding } from './ending-selector.js'
import { resolveProductAction } from './product-actions.js'
import {
  cleanupKnowledgeResult,
  ensureCleanupTargetSet,
  freezeCleanupMatchSnapshots,
  resolveCleanupMatchUpdate,
} from './cleanup-matching.js'
import { resolveSiteInteractionCommit } from './site-interactions.js'
import {
  resolveNodeInteractionConfig,
  STORY_INTERACTION_MODE,
} from './config/node-interactions.js'
import {
  ORBITAL_GAME_MODULE_ID,
  ORBITAL_STORY_STAGE_COUNT,
  orbitalAnswerControlId,
  resolveGameAnswerStoryBinding,
  resolveGameStoryStage,
  resolveQuestionForStoryNode,
} from './config/game-story-bindings.js'
import {
  artifactSequence,
  M6_COMPLETE_LOOKAHEAD_BINDING,
  prerequisiteArtifact,
  resolveLookaheadBinding,
  STORY_ARTIFACT_TYPE,
  STORY_FLOW_VERSION,
  storyStageNumber,
} from './config/lookahead-bindings.js'

function id() {
  return globalThis.crypto.randomUUID()
}

function timingNow() {
  return globalThis.performance?.now?.() ?? Date.now()
}

function timingElapsed(startedAt) {
  return Math.max(0, timingNow() - startedAt)
}

function retryCode(reason) {
  return String(reason || '').split(':', 1)[0].trim().slice(0, 80) || null
}

function sumTiming(attempts, field) {
  return attempts.reduce((total, attempt) => (
    total + (Number.isFinite(attempt[field]) ? attempt[field] : 0)
  ), 0)
}

function sumNullable(attempts, field) {
  const values = attempts
    .map((attempt) => attempt[field])
    .filter(Number.isFinite)
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

function aggregateGenerationTimings(attempts) {
  const last = attempts.at(-1) || {}
  return {
    request_prepare_duration_ms: sumTiming(attempts, 'request_prepare_duration_ms'),
    prompt_load_duration_ms: sumTiming(attempts, 'prompt_load_duration_ms'),
    schema_load_duration_ms: sumTiming(attempts, 'schema_load_duration_ms'),
    prompt_render_duration_ms: sumTiming(attempts, 'prompt_render_duration_ms'),
    context_serialize_duration_ms: sumTiming(attempts, 'context_serialize_duration_ms'),
    provider_request_duration_ms: sumTiming(attempts, 'provider_request_duration_ms'),
    first_response_duration_ms: null,
    response_parse_duration_ms: sumTiming(attempts, 'response_parse_duration_ms'),
    schema_validation_duration_ms: sumTiming(attempts, 'schema_validation_duration_ms'),
    business_validation_duration_ms: sumTiming(attempts, 'business_validation_duration_ms'),
    response_validation_duration_ms:
      sumTiming(attempts, 'schema_validation_duration_ms')
      + sumTiming(attempts, 'business_validation_duration_ms'),
    model_duration_ms: sumTiming(attempts, 'total_model_duration_ms'),
    first_attempt_duration_ms: attempts[0]?.attempt_total_duration_ms ?? 0,
    retry_duration_ms: attempts.slice(1).reduce(
      (total, attempt) => total + (attempt.attempt_total_duration_ms || 0),
      0,
    ),
    retry_count: Math.max(0, attempts.length - 1),
    retry_reason_codes: attempts.slice(1)
      .map((attempt) => attempt.retry_reason_code)
      .filter(Boolean),
    input_json_bytes: attempts[0]?.input_json_bytes ?? null,
    input_character_count: attempts[0]?.input_character_count ?? null,
    output_character_count: last.output_character_count ?? null,
    input_tokens: sumNullable(attempts, 'input_tokens'),
    output_tokens: sumNullable(attempts, 'output_tokens'),
    cold_request: Boolean(attempts[0]?.cold_request),
    attempt_metrics: attempts,
  }
}

function parse(schema, value, code = 'INVALID_INPUT') {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  throw new StoryError(code, 'Request validation failed.', 400, parsed.error.issues)
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)
  return value
}

function canonicalInputFromRequest(request) {
  return CanonicalStoryUserInputSchema.parse({
    important_event: {
      people: [request.nickname],
      time: '',
      location: '',
      description: request.important_event,
    },
  })
}

function errorPrefix(taskType) {
  return {
    [TASK_TYPE.OUTLINE]: 'OUTLINE_',
    [TASK_TYPE.OPENING]: 'OPENING_',
    [TASK_TYPE.CONTINUE]: 'CONTINUE_',
    [TASK_TYPE.BRANCH]: 'CONTINUE_',
    [TASK_TYPE.ENDING]: 'ENDING_',
    [TASK_TYPE.KNOWLEDGE_REVEAL]: 'KNOWLEDGE_',
  }[taskType]
}

function isRetryableOutputError(error, taskType) {
  if (!(error instanceof StoryError)) return false
  const prefix = errorPrefix(taskType)
  if (prefix && error.code.startsWith(prefix)) return error.status >= 500
  return [
    'AI_RESPONSE_PARSE_FAILED',
    'AI_EMPTY_OUTPUT',
    'AI_OUTPUT_TRUNCATED',
  ].includes(error.code)
}

function retryReason(error) {
  if (error.code === 'OUTLINE_ENDING_UNREACHABLE') {
    const detail = Array.isArray(error.details) ? error.details[0] : null
    const ranges = detail?.reachable_metric_ranges
    const ids = detail?.unreachable_ending_ids
    const guidance = detail?.ending_rule_guidance
    if (
      ranges
      && Array.isArray(ids)
      && ids.length > 0
      && Array.isArray(guidance)
      && guidance.length > 0
    ) {
      const exactRules = stableStringify(Object.fromEntries(
        guidance.map(({ ending_id: endingId, metrics }) => [
          endingId,
          {
            conditions: [
              { metric: 'event_integrity', operator: 'eq', value: metrics.event_integrity },
              { metric: 'relationship_connection', operator: 'eq', value: metrics.relationship_connection },
              { metric: 'uncertainty', operator: 'eq', value: metrics.uncertainty },
            ],
            required_consequence_ids: [],
            forbidden_consequence_ids: [],
            fallback: false,
          },
        ]),
      ))
      return [
        `OUTLINE_ENDING_UNREACHABLE: ${ids.join(',')} 在全部真实选项路径中都不会被选中。`,
        `本故事可达范围为 event_integrity ${ranges.event_integrity.min}-${ranges.event_integrity.max}、`,
        `relationship_connection ${ranges.relationship_connection.min}-${ranges.relationship_connection.max}、`,
        `uncertainty ${ranges.uncertainty.min}-${ranges.uncertainty.max}。`,
        `只替换对应结局的 state_rule（priority 保持唯一），精确使用 ${exactRules}；`,
        '节点、outcome 与 fallback 结局保持不变。',
      ].join('')
    }
  }
  if ([
    'OPENING_STORY_TEXT_INVALID',
    'CONTINUE_STORY_TEXT_INVALID',
  ].includes(error.code)) {
    const detail = Array.isArray(error.details) ? error.details[0] : null
    const expected = detail?.expected
    if (
      Number.isFinite(detail?.paragraphs)
      && Number.isFinite(detail?.chinese_characters)
      && Number.isFinite(expected?.min_paragraphs)
      && Number.isFinite(expected?.max_paragraphs)
      && Number.isFinite(expected?.min_chinese_characters)
      && Number.isFinite(expected?.max_chinese_characters)
    ) {
      return [
        `${error.code}: 上一次 story_text 为 ${detail.chinese_characters} 个中文字符、${detail.paragraphs} 段；`,
        `必须为 ${expected.min_chinese_characters}-${expected.max_chinese_characters} 个中文字符、`,
        `${expected.min_paragraphs}-${expected.max_paragraphs} 段并使用第二人称“你”。`,
        '请完整重写 story_text，并写到 480-520 个汉字（只统计汉字，不计标点、数字和空格）；',
        '其他 JSON 字段仍须完整返回。',
      ].join('')
    }
  }
  if (error.code === 'KNOWLEDGE_TEXT_INVALID') {
    const detail = Array.isArray(error.details) ? error.details[0] : null
    if (Number.isFinite(detail?.chinese_characters)) {
      const isTooShort = detail.chinese_characters < 300
      return [
        `KNOWLEDGE_TEXT_INVALID: 上一次全部字段合计为 ${detail.chinese_characters} 个中文字符，`,
        isTooShort
          ? '篇幅不足；必须扩写到 360-440 个中文字符。'
          : '篇幅过长；必须压缩到 360-440 个中文字符。',
        '只输出3个精简 causal_chain、2个 material_insights、1个 mission_insights、1个 cleanup_insights。',
        '每个标题不超过8个汉字；story_connection 和 reality_note 各不超过40个汉字；',
        isTooShort
          ? '3个 causal、2个 material 和1个 mission 的正文各写35-45个汉字，cleanup 正文写45-60个汉字。'
          : '每个 causal/material/mission 正文不超过30个汉字，cleanup 正文不超过45个汉字。',
        isTooShort
          ? '补充输入事实允许的因果机制和现实取舍，不得新增异常；所有 JSON 字段和真实 ID 必须完整保留。'
          : '删除重复背景与修饰语，但所有 JSON 字段和真实 ID 必须完整保留。',
      ].join('')
    }
  }
  const details = Array.isArray(error.details) && error.details.length > 0
    ? ` details=${stableStringify(error.details)}`
    : ''
  return `${error.code}: ${error.message}${details}`.replace(/\s+/g, ' ').slice(0, 320)
}

function publicIdentityAction(userInput) {
  return {
    module: PRODUCT_MODULE.IDENTITY,
    source_id: 'identity_form',
    action_id: 'create_story',
    label: `${userInput.nickname}提交了一件重要的事`,
  }
}

function choiceAction(request, option) {
  return {
    node_id: request.node_id,
    option_id: option.option_id,
    client_action_id: request.client_action_id,
  }
}

function publicChoiceAction(request, option) {
  return {
    module: 'STORY_CHOICE',
    source_id: request.node_id,
    action_id: option.option_id,
    label: option.label,
  }
}

function siteInteractionActionId(request, interactionMode) {
  return `site:${request.module_id.toLocaleLowerCase()}:${interactionMode.toLocaleLowerCase()}`
}

function publicSiteInteractionAction(request, resolution) {
  return {
    module: request.module_id,
    source_id: request.node_id,
    action_id: siteInteractionActionId(request, resolution.nodeConfig.interaction_mode),
    label: `已完成${resolution.snapshots.length}项网站操作`,
  }
}

function nextNodeId(nodeId) {
  const number = Number.parseInt(nodeId.slice(-2), 10)
  return `node_${String(number + 1).padStart(2, '0')}`
}

function narrativeStage({
  story,
  stageIndex,
  taskType,
  nodeId,
  inputAction,
  displayContent,
  knownToUserAdditions = [],
  continuityHandoff = null,
  modelMetadata,
  summary,
  stateBefore,
  stateAfter,
  createdAt,
}) {
  return {
    stage_id: id(),
    story_id: story.story_id,
    stage_index: stageIndex,
    task_type: taskType,
    node_id: nodeId,
    checkpoint: story.current_checkpoint,
    input_action: inputAction,
    display_content: displayContent,
    story_text: displayContent.story_text || '',
    known_to_user_additions: cloneState(knownToUserAdditions),
    continuity_handoff: continuityHandoff ? cloneState(continuityHandoff) : null,
    model_metadata: cloneState(modelMetadata),
    stage_summary: summary,
    state_before: cloneState(stateBefore),
    state_after: cloneState(stateAfter),
    created_at_ms: createdAt,
  }
}

function knowledgeDisplay(output) {
  const chain = output.causal_chain
    .map((point) => `${point.point_title}：${point.point_text}`)
    .join('\n')
  const materialInsights = output.material_insights
    .map((insight) => `${insight.insight_title}：${insight.insight_text}`)
    .join('\n')
  const missionInsights = output.mission_insights
    .map((insight) => `${insight.insight_title}：${insight.insight_text}`)
    .join('\n')
  const cleanupInsights = output.cleanup_insights
    .map((insight) => `${insight.insight_title}：${insight.insight_text}`)
    .join('\n')
  return {
    ...cloneState(output),
    story_text: [
      output.knowledge_title,
      output.story_connection,
      chain,
      materialInsights,
      missionInsights,
      cleanupInsights,
      output.reality_note,
    ].filter(Boolean).join('\n\n'),
  }
}

const ZERO_STORY_DELTA = Object.freeze({
  event_integrity: 0,
  relationship_connection: 0,
  uncertainty: 0,
})

function artifactRecord({
  storyId,
  artifactType,
  generatedFromNodeId = null,
  generatedFromActionId = null,
  generationStatus,
  revealStatus = 'HIDDEN',
  payload = null,
  knownToUserAdditions = [],
  continuityHandoff = null,
  modelMetadata = null,
  stateBefore = null,
  stateAfter = null,
  createdAt,
  completedAt = null,
  revealRequestedAt = null,
  revealedAt = null,
}) {
  return {
    artifact_id: id(),
    story_id: storyId,
    artifact_type: artifactType,
    sequence: artifactSequence(artifactType),
    generated_from_node_id: generatedFromNodeId,
    generated_from_action_id: generatedFromActionId,
    generation_status: generationStatus,
    reveal_status: revealStatus,
    payload: cloneState(payload),
    known_to_user_additions: cloneState(knownToUserAdditions),
    continuity_handoff: continuityHandoff ? cloneState(continuityHandoff) : null,
    model_metadata: modelMetadata ? cloneState(modelMetadata) : null,
    state_before: stateBefore ? cloneState(stateBefore) : null,
    state_after: stateAfter ? cloneState(stateAfter) : null,
    reveal_requested_at_ms: revealRequestedAt,
    revealed_at_ms: revealedAt,
    created_at_ms: createdAt,
    completed_at_ms: completedAt,
    updated_at_ms: completedAt || createdAt,
  }
}

function artifactGenerationSnapshot({
  nodeId,
  sourceActionId,
  interactionVersion,
  stateBefore,
  stateDelta,
  stateAfter,
  interactionSnapshot,
  selectedEnding = undefined,
}) {
  return StoryArtifactGenerationSnapshotSchema.parse({
    generated_from_node_id: nodeId,
    source_action_id: sourceActionId,
    interaction_version: interactionVersion,
    state_before: cloneState(stateBefore),
    state_delta: cloneState(stateDelta),
    state_after: cloneState(stateAfter),
    active_consequences_after: cloneState(stateAfter.active_consequences),
    key_outcomes_available: cloneState(stateAfter.key_outcomes),
    interaction_snapshot: cloneState(interactionSnapshot),
    ...(selectedEnding ? { selected_ending: cloneState(selectedEnding) } : {}),
  })
}

function artifactJob({
  storyId,
  artifact,
  nodeId,
  sourceActionId,
  snapshot,
  prerequisiteStatus,
  createdAt,
}) {
  const prerequisite = prerequisiteArtifact(artifact.artifact_type)
  const status = !prerequisite || prerequisiteStatus === 'READY'
    ? 'QUEUED'
    : 'WAITING_PREREQUISITE'
  return {
    job_id: id(),
    story_id: storyId,
    artifact_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    generated_from_node_id: nodeId,
    source_action_id: sourceActionId,
    prerequisite_artifact: prerequisite,
    status,
    attempt_count: 0,
    snapshot: cloneState(snapshot),
    metrics: null,
    created_at_ms: createdAt,
    started_at_ms: null,
    completed_at_ms: null,
    last_error_code: null,
    last_error_detail: null,
    updated_at_ms: createdAt,
  }
}

function artifactEffectSummary(snapshot) {
  const interaction = snapshot.interaction_snapshot || {}
  if (interaction.effect_summary) return interaction.effect_summary
  if (Array.isArray(interaction.selections)) {
    return interaction.selections
      .map((selection) => selection.effect_summary)
      .filter(Boolean)
      .join('；')
  }
  if (interaction.interaction_type === 'INITIAL_BOOTSTRAP') {
    return '承接开场已确认的事实与异常，不预判后续网站选择。'
  }
  return ''
}

function artifactInputAction(job) {
  return {
    module: job.snapshot?.interaction_snapshot?.module_id || 'STORY_LOOKAHEAD',
    source_id: job.generated_from_node_id,
    action_id: job.source_action_id,
    label: `${job.generated_from_node_id} 的网站操作已确认`,
  }
}

function storyChoiceInteraction({
  story,
  request,
  option,
  transition,
  idempotencyKey,
  now,
}) {
  return {
    interaction_id: id(),
    story_id: story.story_id,
    module: 'STORY_CHOICE',
    source_id: request.node_id,
    action_id: option.option_id,
    label: option.label,
    technical_effect: {
      state_transition: {
        before: transition.before,
        delta: transition.delta,
        after: transition.after,
      },
      add_consequence_ids: option.add_consequence_ids,
      resolve_consequence_ids: option.resolve_consequence_ids,
    },
    narrative_effect: {
      effect_summary: option.effect_summary,
      key_outcome: option.key_outcome,
    },
    client_action_id: request.client_action_id,
    idempotency_key: idempotencyKey,
    state_before: transition.before,
    state_delta: transition.delta,
    state_after: transition.after,
    add_consequence_ids: option.add_consequence_ids,
    resolve_consequence_ids: option.resolve_consequence_ids,
    key_outcome: option.key_outcome,
    created_at_ms: now,
  }
}

function siteStoryInteraction({
  story,
  request,
  resolution,
  idempotencyKey,
  now,
}) {
  const { transition } = resolution
  return {
    interaction_id: id(),
    story_id: story.story_id,
    module: request.module_id,
    source_id: request.node_id,
    action_id: siteInteractionActionId(request, resolution.nodeConfig.interaction_mode),
    label: `已完成${resolution.snapshots.length}项网站操作`,
    technical_effect: {
      interaction_mode: resolution.nodeConfig.interaction_mode,
      site_interactions: cloneState(resolution.snapshots),
      item_deltas: cloneState(transition.item_deltas),
      combined_delta: cloneState(transition.combined_delta),
      state_transition: {
        before: transition.before,
        after: transition.after,
      },
      add_consequence_ids: cloneState(resolution.add_consequence_ids),
      resolve_consequence_ids: cloneState(resolution.resolve_consequence_ids),
    },
    narrative_effect: {
      site_outcomes: cloneState(resolution.outcomes),
    },
    client_action_id: request.client_action_id,
    idempotency_key: idempotencyKey,
    state_before: transition.before,
    state_delta: transition.combined_delta,
    state_after: transition.after,
    add_consequence_ids: cloneState(resolution.add_consequence_ids),
    resolve_consequence_ids: cloneState(resolution.resolve_consequence_ids),
    key_outcome: '',
    site_interactions: cloneState(resolution.snapshots),
    item_deltas: cloneState(transition.item_deltas),
    combined_delta: cloneState(transition.combined_delta),
    site_outcomes: cloneState(resolution.outcomes),
    created_at_ms: now,
  }
}

function gameAnswerOption(snapshot) {
  return {
    option_id: snapshot.answer_id,
    label: snapshot.answer_name,
    effect_summary: snapshot.effect_summary,
    state_delta: cloneState(snapshot.state_delta),
    add_consequence_ids: cloneState(snapshot.add_consequence_ids),
    resolve_consequence_ids: cloneState(snapshot.resolve_consequence_ids),
    key_outcome: snapshot.key_outcome || '',
  }
}

function gameAnswerSiteSnapshot(snapshot) {
  return {
    binding_id: snapshot.binding_id,
    module_id: snapshot.game_module_id,
    section_id: snapshot.question_id,
    section_name: `轨道事件第${snapshot.question_order}题`,
    control_id: snapshot.control_id,
    option_id: snapshot.answer_id,
    option_name: snapshot.answer_name,
    target_node_id: snapshot.target_node_id,
    effect_summary: snapshot.effect_summary,
    state_delta: cloneState(snapshot.state_delta),
    add_consequence_ids: cloneState(snapshot.add_consequence_ids),
    resolve_consequence_ids: cloneState(snapshot.resolve_consequence_ids),
    key_outcome: snapshot.key_outcome || '',
    knowledge_profile: cloneState(snapshot.knowledge_profile),
    selected_at: snapshot.confirmed_at,
    question_id: snapshot.question_id,
    question_order: snapshot.question_order,
  }
}

function gameAnswerInteraction({ story, job, snapshot, transition, now }) {
  const siteSnapshot = gameAnswerSiteSnapshot(snapshot)
  const outcomes = snapshot.key_outcome
    ? [{
        module_id: snapshot.game_module_id,
        section_id: snapshot.question_id,
        control_id: snapshot.control_id,
        option_id: snapshot.answer_id,
        option_name: snapshot.answer_name,
        outcome: snapshot.key_outcome,
      }]
    : []
  return {
    interaction_id: id(),
    story_id: story.story_id,
    module: snapshot.game_module_id,
    source_id: snapshot.target_node_id,
    action_id: snapshot.answer_id,
    label: `${snapshot.question_title}：${snapshot.answer_name}`,
    technical_effect: {
      interaction_mode: STORY_INTERACTION_MODE.SITE_GAME_RESULT,
      site_interactions: [siteSnapshot],
      item_deltas: [{
        section_id: snapshot.question_id,
        option_id: snapshot.answer_id,
        delta: cloneState(transition.delta),
      }],
      combined_delta: cloneState(transition.delta),
      state_transition: { before: transition.before, after: transition.after },
    },
    narrative_effect: { site_outcomes: outcomes },
    client_action_id: snapshot.client_action_id,
    idempotency_key: job.source_action_id,
    state_before: transition.before,
    state_delta: transition.delta,
    state_after: transition.after,
    add_consequence_ids: cloneState(snapshot.add_consequence_ids),
    resolve_consequence_ids: cloneState(snapshot.resolve_consequence_ids),
    key_outcome: snapshot.key_outcome || '',
    site_interactions: [siteSnapshot],
    item_deltas: [{
      section_id: snapshot.question_id,
      option_id: snapshot.answer_id,
      delta: cloneState(transition.delta),
    }],
    combined_delta: cloneState(transition.delta),
    site_outcomes: outcomes,
    created_at_ms: now,
  }
}

function knowledgeJobFromCleanup({ story, completionId, clientActionId, snapshots, now }) {
  const jobId = id()
  const cleanupGameResult = cleanupKnowledgeResult(snapshots)
  const configSnapshot = {
    source_module_id: cleanupGameResult.module_id,
    source_completion_id: completionId,
    selected_ending_id: story.final_story.selected_ending_id,
    cleanup_snapshot_ids: snapshots.map((snapshot) => snapshot.snapshot_id),
    cleanup_game_result: cleanupGameResult,
  }
  return {
    job_id: jobId,
    story_id: story.story_id,
    source_action_id: `${story.story_id}:m6:${completionId}`,
    client_action_id: clientActionId,
    request_fingerprint: stableStringify({
      story_id: story.story_id,
      source_completion_id: completionId,
      selected_ending_id: story.final_story.selected_ending_id,
      cleanup_game_result: cleanupGameResult,
      target_node_id: 'node_10',
    }),
    question_id: 'm6_cleanup_knowledge',
    answer_id: completionId,
    target_node_id: 'node_10',
    generation_stage: 'KNOWLEDGE',
    status: 'QUEUED',
    sequence: ORBITAL_STORY_STAGE_COUNT + 1,
    attempt_count: 0,
    config_snapshot: configSnapshot,
    metrics: {
      stage: 'KNOWLEDGE',
      node_id: 'node_10',
      story_id: story.story_id,
      job_id: jobId,
      answer_ack_duration_ms: null,
      m6_completion_commit_duration_ms: null,
    },
    created_at_ms: now,
    started_at_ms: null,
    completed_at_ms: null,
    last_error_code: null,
    updated_at_ms: now,
  }
}

export class StoryService {
  constructor({
    repository,
    generateOutput,
    generateStage,
    clock = () => Date.now(),
    recordPerformance = () => {},
  }) {
    this.repository = repository
    this.generateOutput = generateOutput || generateStage
    this.clock = clock
    this.recordPerformance = recordPerformance
  }

  reportPerformance(metrics) {
    try {
      const pending = this.recordPerformance(cloneState(metrics))
      if (pending && typeof pending.catch === 'function') pending.catch(() => {})
    } catch {
      // Performance reporting must never change story transaction semantics.
    }
  }

  async toPublicStory(story) {
    const [stages, jobs, artifacts, artifactJobs] = await Promise.all([
      this.repository.getStages(story.story_id),
      this.repository.getStoryJobs(story.story_id),
      this.repository.getArtifacts(story.story_id),
      this.repository.getArtifactJobs(story.story_id),
    ])
    return toPublicStoryDTO(story, stages, jobs, artifacts, artifactJobs)
  }

  async commitQueuedStoryJobResult({
    storyId,
    sessionId,
    sourceStory,
    generatedStory,
    interaction,
    stages,
    job,
    metrics,
    nextStoryJob = null,
  }) {
    let lastConflict = null
    for (let attempt = 0; attempt < ORBITAL_STORY_STAGE_COUNT + 2; attempt += 1) {
      const latest = await this.repository.getStory(storyId, sessionId)
      assertStory(
        latest?.status === STORY_STATUS.IN_PROGRESS
          && latest.current_node_id === sourceStory.current_node_id,
        'STORY_JOB_SEQUENCE_BLOCKED',
        'The story node changed while the queued generation was running.',
        409,
      )
      const rebasedStory = cloneState(generatedStory)
      rebasedStory.game_state = cloneState(latest.game_state)
      rebasedStory.current_checkpoint = generatedStory.status === STORY_STATUS.COMPLETED
        ? generatedStory.current_checkpoint
        : latest.current_checkpoint
      if (
        resolveNodeInteractionConfig(rebasedStory.current_node_id)?.interaction_mode
        === STORY_INTERACTION_MODE.SITE_MATCHING_GAME
      ) {
        rebasedStory.game_state = ensureCleanupTargetSet(rebasedStory)
      }
      rebasedStory.version = latest.version + 1
      rebasedStory.last_generation_id = job.job_id
      rebasedStory.last_activity_at_ms = this.clock()
      try {
        await this.repository.commitAdvance({
          story: rebasedStory,
          expectedVersion: latest.version,
          interaction,
          stages,
          storyJob: job,
          jobMetrics: metrics,
          nextStoryJob,
        })
        return rebasedStory
      } catch (error) {
        if (error?.code !== 'VERSION_CONFLICT') throw error
        lastConflict = error
      }
    }
    throw lastConflict || new StoryError(
      'VERSION_CONFLICT',
      'The story was repeatedly updated while generation was committing.',
      409,
    )
  }

  async generateValidated(
    taskType,
    input,
    validate,
    { maxAttempts = 2, initialRetryReason = '' } = {},
  ) {
    let previousError = initialRetryReason
      ? new StoryError(initialRetryReason, initialRetryReason, 502)
      : null
    const attemptMetrics = []
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = timingNow()
      const attemptRetryReason = previousError ? retryReason(previousError) : ''
      let output = null
      let schemaValidationDurationMs = 0
      let businessValidationDurationMs = 0
      try {
        output = await this.generateOutput(taskType, input, {
          attempt,
          retryReason: attemptRetryReason,
        })
        const providerMetadata = output?.[STORY_GENERATION_METADATA] || null
        const schemaValidationStartedAt = timingNow()
        try {
          validateStorySchema(taskType, output)
        } finally {
          schemaValidationDurationMs = timingElapsed(schemaValidationStartedAt)
        }
        const businessValidationStartedAt = timingNow()
        let data
        try {
          data = validate(output)
        } finally {
          businessValidationDurationMs = timingElapsed(businessValidationStartedAt)
        }
        attemptMetrics.push({
          attempt,
          success: true,
          error_code: null,
          retry_reason_code: retryCode(attemptRetryReason),
          ...(providerMetadata?.timings || {}),
          schema_validation_duration_ms: schemaValidationDurationMs,
          business_validation_duration_ms: businessValidationDurationMs,
          input_tokens: providerMetadata?.input_tokens ?? null,
          output_tokens: providerMetadata?.output_tokens ?? null,
          model: providerMetadata?.model ?? null,
          reasoning_effort: providerMetadata?.reasoning_effort ?? null,
          verbosity: providerMetadata?.verbosity ?? null,
          attempt_total_duration_ms: timingElapsed(attemptStartedAt),
        })
        return {
          data,
          attempts: attempt,
          providerMetadata,
          timings: aggregateGenerationTimings(attemptMetrics),
        }
      } catch (error) {
        const providerMetadata = output?.[STORY_GENERATION_METADATA]
          || error?.[STORY_GENERATION_METADATA]
          || null
        attemptMetrics.push({
          attempt,
          success: false,
          error_code: error?.code || 'UNKNOWN',
          retry_reason_code: retryCode(attemptRetryReason),
          ...(providerMetadata?.timings || {}),
          schema_validation_duration_ms: schemaValidationDurationMs,
          business_validation_duration_ms: businessValidationDurationMs,
          input_tokens: providerMetadata?.input_tokens ?? null,
          output_tokens: providerMetadata?.output_tokens ?? null,
          model: providerMetadata?.model ?? null,
          reasoning_effort: providerMetadata?.reasoning_effort ?? null,
          verbosity: providerMetadata?.verbosity ?? null,
          attempt_total_duration_ms: timingElapsed(attemptStartedAt),
        })
        if (attempt === maxAttempts || !isRetryableOutputError(error, taskType)) throw error
        previousError = error
      }
    }
    throw new StoryError('AI_INVALID_OUTPUT', 'Story output validation failed.', 502)
  }

  async generateStoryOutline(rawInput) {
    const prepareStartedAt = timingNow()
    const input = parse(
      CanonicalStoryUserInputSchema,
      rawInput,
      'STORY_USER_INPUT_INVALID',
    )
    const backendPrepareDurationMs = timingElapsed(prepareStartedAt)
    const generated = await this.generateValidated(
      TASK_TYPE.OUTLINE,
      input,
      validateStoryOutline,
    )
    return {
      outline: deepFreeze(cloneState(generated.data)),
      attempts: generated.attempts,
      providerMetadata: generated.providerMetadata,
      timings: {
        ...generated.timings,
        backend_request_prepare_duration_ms: backendPrepareDurationMs,
        total_stage_duration_ms:
          backendPrepareDurationMs
          + generated.timings.model_duration_ms
          + generated.timings.response_validation_duration_ms,
      },
    }
  }

  async generateStoryOpening(outline, runtimeState) {
    const contextStartedAt = timingNow()
    validateStoryOutline(outline)
    const openingContext = buildOpeningContext(outline)
    const contextBuildDurationMs = timingElapsed(contextStartedAt)
    const generated = await this.generateValidated(
      TASK_TYPE.OPENING,
      openingContext,
      (output) => validateStoryOpening(output, runtimeState),
    )
    return {
      context: openingContext,
      opening: generated.data.output,
      additions: generated.data.additions,
      attempts: generated.attempts,
      providerMetadata: generated.providerMetadata,
      timings: {
        ...generated.timings,
        context_build_duration_ms: contextBuildDurationMs,
        total_stage_duration_ms:
          contextBuildDurationMs
          + generated.timings.model_duration_ms
          + generated.timings.response_validation_duration_ms,
      },
    }
  }

  createRuntimeStoryState(initialStoryState) {
    return createRuntimeStoryState(initialStoryState)
  }

  async createStory(rawRequest) {
    const createStartedAt = timingNow()
    const requestPrepareStartedAt = timingNow()
    const request = parse(CreateStoryRequestSchema, rawRequest)
    const createRequestPrepareDurationMs = timingElapsed(requestPrepareStartedAt)
    const now = this.clock()
    const dbReadStartedAt = timingNow()
    await this.repository.cleanupExpiredStories(now)

    const sessionId = request.session_id || id()
    const requestFingerprint = stableStringify(request)
    const existing = await this.repository.getStoryBySessionId(sessionId)
    const dbReadDurationMs = timingElapsed(dbReadStartedAt)
    if (existing) {
      assertStory(
        existing.request_fingerprint === requestFingerprint,
        'IDEMPOTENCY_KEY_REUSED',
        'The session_id was already used with a different request.',
        409,
      )
      return toPublicStoryDTO(
        existing,
        await this.repository.getStages(existing.story_id),
        await this.repository.getStoryJobs(existing.story_id),
        await this.repository.getArtifacts(existing.story_id),
        await this.repository.getArtifactJobs(existing.story_id),
      )
    }

    const userInput = StoryUserInputSchema.parse({
      nickname: request.nickname,
      city: request.city,
      important_event: request.important_event,
      submitted_at_ms: now,
    })
    const canonicalInput = canonicalInputFromRequest(request)
    const {
      outline,
      attempts: outlineAttempts,
      providerMetadata: outlineProviderMetadata,
      timings: outlineTimings,
    } = await this.generateStoryOutline(canonicalInput)
    const initialRuntimeState = this.createRuntimeStoryState(outline.initial_story_state)
    const {
      opening,
      additions,
      attempts: openingAttempts,
      providerMetadata: openingProviderMetadata,
      timings: openingTimings,
    } = await this.generateStoryOpening(outline, initialRuntimeState)
    const stateTransition = applyOpeningOutput(initialRuntimeState, additions)

    const storyId = id()
    const gameState = createInitialGameState({
      satellite: request.satellite,
      damageLevel: request.game_context.damage_level,
    })
    const openingAction = publicIdentityAction(userInput)
    const stage = narrativeStage({
      story: {
        story_id: storyId,
        current_checkpoint: CHECKPOINT.MATERIALS,
      },
      stageIndex: 1,
      taskType: TASK_TYPE.OPENING,
      nodeId: 'node_01',
      inputAction: openingAction,
      displayContent: {
        story_text: opening.story_text,
        choices: [],
      },
      knownToUserAdditions: opening.known_to_user_additions,
      continuityHandoff: opening.continuity_handoff,
      modelMetadata: {
        spec_version: STORY_SPEC_VERSION,
        opening_spec_version: STORY_OPENING_SPEC_VERSION,
        outline_attempts: outlineAttempts,
        opening_attempts: openingAttempts,
        outline_provider: cloneState(outlineProviderMetadata),
        opening_provider: cloneState(openingProviderMetadata),
        performance: {
          outline: cloneState(outlineTimings),
          opening: cloneState(openingTimings),
          create_story: {
            request_prepare_duration_ms: createRequestPrepareDurationMs,
            db_read_duration_ms: dbReadDurationMs,
            db_commit_duration_ms: null,
            total_stage_duration_ms: null,
          },
        },
      },
      summary: 'node_01 故事开场已生成，运行时节点由后端推进至 node_02。',
      stateBefore: stateTransition.before,
      stateAfter: stateTransition.after,
      createdAt: now,
    })
    const story = {
      story_id: storyId,
      session_id: sessionId,
      request_fingerprint: requestFingerprint,
      display_label: userInput.nickname,
      version: 1,
      interaction_version: 1,
      artifact_generation_version: 2,
      status: STORY_STATUS.IN_PROGRESS,
      current_stage_index: 1,
      current_node_id: 'node_02',
      current_checkpoint: CHECKPOINT.MATERIALS,
      user_input: userInput,
      story_outline: cloneState(outline),
      story_state: stateTransition.after,
      game_state: gameState,
      prompt_metadata: {
        spec_version: STORY_SPEC_VERSION,
        story_flow_version: STORY_FLOW_VERSION,
        opening_spec_version: STORY_OPENING_SPEC_VERSION,
        prompt_mode: 'code_managed',
      },
      final_story: null,
      last_generation_id: null,
      last_confirmed_node: 'node_01',
      last_ready_artifact: STORY_ARTIFACT_TYPE.OPENING,
      last_revealed_artifact: STORY_ARTIFACT_TYPE.OPENING,
      created_at_ms: now,
      last_activity_at_ms: now,
      expires_at_ms: now + STORY_EXPIRY_MS,
      completed_at_ms: null,
    }

    const bootstrapActionId = `${storyId}:node_01:create_story`
    const outlineArtifact = artifactRecord({
      storyId,
      artifactType: STORY_ARTIFACT_TYPE.OUTLINE,
      generatedFromNodeId: 'node_01',
      generatedFromActionId: bootstrapActionId,
      generationStatus: 'READY',
      payload: outline,
      modelMetadata: {
        spec_version: STORY_SPEC_VERSION,
        provider: cloneState(outlineProviderMetadata),
        attempts: outlineAttempts,
        performance: cloneState(outlineTimings),
      },
      stateBefore: initialRuntimeState,
      stateAfter: initialRuntimeState,
      createdAt: now,
      completedAt: now,
    })
    const openingArtifact = artifactRecord({
      storyId,
      artifactType: STORY_ARTIFACT_TYPE.OPENING,
      generatedFromNodeId: 'node_01',
      generatedFromActionId: bootstrapActionId,
      generationStatus: 'READY',
      revealStatus: 'REVEALED',
      payload: {
        story_text: opening.story_text,
        choices: [],
      },
      knownToUserAdditions: opening.known_to_user_additions,
      continuityHandoff: opening.continuity_handoff,
      modelMetadata: {
        spec_version: STORY_SPEC_VERSION,
        provider: cloneState(openingProviderMetadata),
        attempts: openingAttempts,
        performance: cloneState(openingTimings),
      },
      stateBefore: stateTransition.before,
      stateAfter: stateTransition.after,
      revealRequestedAt: now,
      revealedAt: now,
      createdAt: now,
      completedAt: now,
    })
    const commitStartedAt = timingNow()
    try {
      await this.repository.createStory(
        story,
        [stage],
        [outlineArtifact, openingArtifact],
        [],
      )
    } catch (error) {
      if (error?.code !== 'STORY_EXISTS') throw error
      const concurrent = await this.repository.getStoryBySessionId(sessionId)
      if (!concurrent) throw error
      assertStory(
        concurrent.request_fingerprint === requestFingerprint,
        'IDEMPOTENCY_KEY_REUSED',
        'The session_id was already used with a different request.',
        409,
      )
      return toPublicStoryDTO(
        concurrent,
        await this.repository.getStages(concurrent.story_id),
        await this.repository.getStoryJobs(concurrent.story_id),
        await this.repository.getArtifacts(concurrent.story_id),
        await this.repository.getArtifactJobs(concurrent.story_id),
      )
    }
    const commitDurationMs = timingElapsed(commitStartedAt)
    const createStoryPerformance = {
      request_prepare_duration_ms: createRequestPrepareDurationMs,
      db_read_duration_ms: dbReadDurationMs,
      db_commit_duration_ms: commitDurationMs,
      total_stage_duration_ms: timingElapsed(createStartedAt),
    }
    stage.model_metadata.performance.create_story = createStoryPerformance
    this.reportPerformance({
      stage: 'CREATE_STORY',
      story_id: storyId,
      outline: outlineTimings,
      opening: openingTimings,
      create_story: createStoryPerformance,
    })
    return toPublicStoryDTO(
      story,
      [stage],
      [],
      [outlineArtifact, openingArtifact],
      [],
    )
  }

  async getStory(storyId, sessionId) {
    const now = this.clock()
    await this.repository.cleanupExpiredStories(now)
    const story = await this.repository.getStory(storyId, sessionId)
    assertStory(story, 'STORY_NOT_FOUND', 'Story not found.', 404)
    return this.toPublicStory(story)
  }

  async commitLookaheadSiteInteraction(storyId, request, now, current) {
    const requestStartedAt = this.clock()
    const requestFingerprint = stableStringify({ story_id: storyId, ...request })
    const sourceActionId = `${storyId}:${request.client_action_id}`
    const existingJob = await this.repository.getArtifactJobBySourceAction(
      storyId,
      sourceActionId,
    )
    if (existingJob) {
      assertStory(
        existingJob.snapshot?.interaction_snapshot?.request_fingerprint
          === requestFingerprint,
        'CLIENT_ACTION_ID_REUSED',
        'client_action_id was already used for a different site interaction.',
        409,
      )
      return this.toPublicStory(current)
    }
    assertStory(current.status === STORY_STATUS.IN_PROGRESS, 'STORY_NOT_ACTIVE', 'Story is not active.', 409)
    assertStory(current.version === request.version, 'STALE_STORY_VERSION', 'The story version is stale.', 409)
    assertStory(current.current_node_id === request.node_id, 'NODE_CONFLICT', `The current story node is ${current.current_node_id}.`, 409)
    const binding = resolveLookaheadBinding(request.node_id)
    assertStory(
      binding?.generation_stage === 'CONTINUE'
        && ['node_02', 'node_03'].includes(request.node_id),
      'LOOKAHEAD_BINDING_INVALID',
      'This site interaction is not bound to a Continue artifact.',
      500,
    )
    const resolution = resolveSiteInteractionCommit(current, request, now)
    const nextNode = nextNodeId(request.node_id)
    const stateAfterAction = applyNarrativeOutput(resolution.transition.state, [], nextNode)
    const story = cloneState(current)
    story.story_state = stateAfterAction
    story.game_state = cloneState(resolution.gameState)
    story.current_node_id = nextNode
    story.current_checkpoint = resolution.nextCheckpoint
    story.version = current.version + 1
    story.interaction_version = (current.interaction_version ?? current.version) + 1
    story.last_confirmed_node = request.node_id
    story.last_revealed_artifact = binding.reveal_artifact
    story.last_activity_at_ms = now
    story.expires_at_ms = now + STORY_EXPIRY_MS

    const interaction = siteStoryInteraction({
      story: current,
      request,
      resolution,
      idempotencyKey: sourceActionId,
      now,
    })
    const interactionSnapshot = {
      interaction_type: binding.interaction_type,
      module_id: request.module_id,
      selections: resolution.snapshots.map((snapshot) => ({
        section_id: snapshot.section_id,
        option_id: snapshot.option_id,
        effect_summary: snapshot.effect_summary,
      })),
      combined_delta: cloneState(resolution.transition.combined_delta),
      request_fingerprint: requestFingerprint,
    }
    const snapshot = artifactGenerationSnapshot({
      nodeId: request.node_id,
      sourceActionId,
      interactionVersion: story.interaction_version,
      stateBefore: current.story_state,
      stateDelta: resolution.transition.combined_delta,
      stateAfter: stateAfterAction,
      interactionSnapshot,
    })
    const prerequisite = await this.repository.getArtifact(
      storyId,
      prerequisiteArtifact(binding.generate_artifact),
    )
    const artifact = artifactRecord({
      storyId,
      artifactType: binding.generate_artifact,
      generatedFromNodeId: request.node_id,
      generatedFromActionId: sourceActionId,
      generationStatus: prerequisite?.generation_status === 'READY'
        ? 'QUEUED'
        : 'WAITING_PREREQUISITE',
      stateBefore: snapshot.state_before,
      stateAfter: snapshot.state_after,
      createdAt: now,
      revealStatus: 'REVEALED',
      revealRequestedAt: now,
    })
    const job = artifactJob({
      storyId,
      artifact,
      nodeId: request.node_id,
      sourceActionId,
      snapshot,
      prerequisiteStatus: prerequisite?.generation_status,
      createdAt: now,
    })
    artifact.generation_status = job.status
    await this.repository.commitLookaheadInteraction({
      story,
      expectedVersion: current.version,
      interaction,
      artifact,
      artifactJob: job,
      revealArtifactType: null,
      revealRequestedAt: null,
    })
    const dto = await this.toPublicStory(story)
    const interactionAckMs = Math.max(0, this.clock() - requestStartedAt)
    dto.action_confirmation = {
      accepted: true,
      idempotent_replay: false,
      interaction_ack_ms: interactionAckMs,
      revealed_artifact: binding.reveal_artifact,
      queued_artifact: binding.generate_artifact,
      artifact_job_status: job.status,
    }
    const prefetchHit = false
    this.reportPerformance({
      stage: 'LOOKAHEAD_INTERACTION',
      story_id: storyId,
      interaction_node_id: request.node_id,
      reveal_artifact: binding.reveal_artifact,
      generate_artifact: binding.generate_artifact,
      interaction_version: story.interaction_version,
      interaction_ack_ms: interactionAckMs,
      interaction_to_artifact_visible_ms: prefetchHit ? 0 : null,
      artifact_reveal_wait_ms: prefetchHit ? 0 : null,
      prefetch_start_delay_ms: null,
      queue_wait_ms: null,
      context_build_ms: null,
      model_duration_ms: null,
      artifact_total_generation_ms: null,
      prefetch_hit: prefetchHit,
      prefetch_miss: !prefetchHit,
    })
    return dto
  }

  async confirmLookaheadGameAnswer(storyId, request, now, current) {
    const requestStartedAt = this.clock()
    const requestFingerprint = stableStringify({ story_id: storyId, ...request })
    const sourceActionId = `${storyId}:${request.client_action_id}`
    const existingInteraction = await this.repository.getInteractionByClientAction(
      storyId,
      request.client_action_id,
    )
    if (existingInteraction) {
      assertStory(
        existingInteraction.source_id === request.question_id
          && existingInteraction.action_id === request.answer_id,
        'CLIENT_ACTION_ID_REUSED',
        'client_action_id was already used for a different game answer.',
        409,
      )
      const dto = await this.toPublicStory(current)
      const existingJob = await this.repository.getArtifactJobBySourceAction(
        storyId,
        sourceActionId,
      )
      dto.action_confirmation = {
        accepted: true,
        idempotent_replay: true,
        question_id: request.question_id,
        answer_id: request.answer_id,
        queued_artifact: existingJob?.artifact_type || null,
        artifact_job_status: existingJob?.status || null,
      }
      return dto
    }
    assertStory(current.status === STORY_STATUS.IN_PROGRESS, 'STORY_NOT_ACTIVE', 'Story is not active.', 409)
    assertStory(current.version === request.version, 'STALE_STORY_VERSION', 'The story version is stale.', 409)
    assertStory(current.current_node_id === request.node_id, 'NODE_CONFLICT', `The current story node is ${current.current_node_id}.`, 409)
    assertStory(current.current_checkpoint === CHECKPOINT.ORBITAL_EVENTS, 'INVALID_CHECKPOINT', `Action is not valid at checkpoint ${current.current_checkpoint}.`, 409)
    assertStory(request.game_module_id === ORBITAL_GAME_MODULE_ID, 'INVALID_GAME_STORY_STAGE', 'The game module does not match the orbital story binding.', 400)

    const stageBinding = resolveGameStoryStage(request.question_id)
    const answered = current.game_state.orbital_events.resolved.length
    assertStory(stageBinding?.question_order === answered + 1, 'GAME_QUESTION_OUT_OF_ORDER', `Question ${answered + 1} must be confirmed next.`, 409)
    assertStory(stageBinding.target_node_id === request.node_id, 'STORY_STAGE_MAPPING_INVALID', 'The submitted story node does not match the configured question stage.', 400)
    const answerBinding = resolveGameAnswerStoryBinding(request.question_id, request.answer_id)
    assertStory(answerBinding, 'GAME_ANSWER_NOT_FOUND', 'The orbital answer was not found.', 400)
    assertStory(request.control_id === orbitalAnswerControlId(request.question_id, request.answer_id), 'GAME_CONTROL_MISMATCH', 'The answer control does not match the selected answer.', 400)
    const lookahead = resolveLookaheadBinding('node_04')
    assertStory(lookahead?.generate_artifact === STORY_ARTIFACT_TYPE.STAGE_3, 'LOOKAHEAD_BINDING_INVALID', 'The orbital stage has no five-stage artifact binding.', 500)

    const resolution = resolveProductAction(current, {
      action_type: ACTION_TYPE.ORBITAL_EVENT_RESOLVE,
      source_id: request.question_id,
      action_id: request.answer_id,
      payload: {},
    })
    const confirmedAt = new Date(now).toISOString()
    const configSnapshot = {
      binding_id: answerBinding.binding_id,
      game_module_id: answerBinding.game_module_id,
      question_id: answerBinding.question_id,
      question_order: answerBinding.question_order,
      question_title: answerBinding.question_title,
      answer_id: answerBinding.answer_id,
      answer_name: answerBinding.answer_name,
      control_id: answerBinding.control_id,
      target_node_id: answerBinding.target_node_id,
      effect_summary: answerBinding.effect_summary,
      state_delta: cloneState(answerBinding.state_delta),
      add_consequence_ids: cloneState(answerBinding.add_consequence_ids),
      resolve_consequence_ids: cloneState(answerBinding.resolve_consequence_ids),
      key_outcome: answerBinding.key_outcome || '',
      knowledge_profile: cloneState(answerBinding.knowledge_profile),
      technical_effect: cloneState(answerBinding.technical_effect),
      client_action_id: request.client_action_id,
      confirmed_at: confirmedAt,
    }
    const option = gameAnswerOption(configSnapshot)
    const transition = applyStoryOption(current.story_state, option, {
      node_id: request.node_id,
      module_id: request.game_module_id,
      question_id: request.question_id,
      answer_id: request.answer_id,
      client_action_id: request.client_action_id,
    })
    const isFirstQuestion = answerBinding.question_order === 1
    const isGameComplete = answerBinding.question_order === ORBITAL_STORY_STAGE_COUNT
    const nextNode = isGameComplete ? 'node_05' : 'node_04'
    const stateAfterAction = applyNarrativeOutput(transition.state, [], nextNode)
    const story = cloneState(current)
    story.story_state = stateAfterAction
    story.game_state = resolution.gameState
    story.current_node_id = nextNode
    story.current_checkpoint = resolution.nextCheckpoint
    story.version = current.version + 1
    story.interaction_version = (current.interaction_version ?? current.version) + 1
    story.last_confirmed_node = request.node_id
    if (isGameComplete) story.last_revealed_artifact = STORY_ARTIFACT_TYPE.STAGE_3
    story.last_activity_at_ms = now
    story.expires_at_ms = now + STORY_EXPIRY_MS

    let selectedEnding = null
    if (isGameComplete) {
      const selected = selectEnding({
        reachableEndings: story.story_outline.reachable_endings,
        storyState: storyMetrics(stateAfterAction),
        activeConsequenceIds: stateAfterAction.active_consequences,
      })
      selectedEnding = {
        ending_id: selected.ending.ending_id,
        outcome: selected.ending.outcome,
      }
      story.final_story = {
        selected_ending_id: selectedEnding.ending_id,
        ending_artifact_id: null,
        knowledge_reveal_artifact_id: null,
      }
      story.game_state = ensureCleanupTargetSet(story)
    }

    const interactionSnapshot = {
      interaction_type: isFirstQuestion ? lookahead.interaction_type : `ORBIT_GAME_Q${answerBinding.question_order}`,
      module_id: request.game_module_id,
      question_id: request.question_id,
      question_order: answerBinding.question_order,
      answer_id: request.answer_id,
      effect_summary: answerBinding.effect_summary,
      technical_effect: cloneState(answerBinding.technical_effect),
      request_fingerprint: requestFingerprint,
    }
    const artifactType = isFirstQuestion
      ? STORY_ARTIFACT_TYPE.STAGE_3
      : isGameComplete
        ? STORY_ARTIFACT_TYPE.ENDING
        : null
    let artifact = null
    let job = null
    let prerequisite = null
    if (artifactType) {
      const snapshot = artifactGenerationSnapshot({
        nodeId: isGameComplete ? 'node_05' : 'node_04',
        sourceActionId,
        interactionVersion: story.interaction_version,
        stateBefore: current.story_state,
        stateDelta: transition.delta,
        stateAfter: stateAfterAction,
        interactionSnapshot,
        ...(selectedEnding ? { selectedEnding } : {}),
      })
      prerequisite = await this.repository.getArtifact(
        storyId,
        prerequisiteArtifact(artifactType),
      )
      artifact = artifactRecord({
        storyId,
        artifactType,
        generatedFromNodeId: isGameComplete ? 'node_05' : 'node_04',
        generatedFromActionId: sourceActionId,
        generationStatus: prerequisite?.generation_status === 'READY'
          ? 'QUEUED'
          : 'WAITING_PREREQUISITE',
        stateBefore: snapshot.state_before,
        stateAfter: snapshot.state_after,
        createdAt: now,
        revealStatus: isGameComplete ? 'REVEALED' : 'HIDDEN',
        revealRequestedAt: isGameComplete ? now : null,
      })
      job = artifactJob({
        storyId,
        artifact,
        nodeId: isGameComplete ? 'node_05' : 'node_04',
        sourceActionId,
        snapshot,
        prerequisiteStatus: prerequisite?.generation_status,
        createdAt: now,
      })
      artifact.generation_status = job.status
    }
    const interaction = gameAnswerInteraction({
      story: current,
      job: { source_action_id: sourceActionId },
      snapshot: configSnapshot,
      transition,
      now,
    })
    await this.repository.commitLookaheadInteraction({
      story,
      expectedVersion: current.version,
      interaction,
      artifact,
      artifactJob: job,
      revealArtifactType: isGameComplete ? STORY_ARTIFACT_TYPE.STAGE_3 : null,
      revealRequestedAt: isGameComplete ? now : null,
    })
    const dto = await this.toPublicStory(story)
    const interactionAckMs = Math.max(0, this.clock() - requestStartedAt)
    dto.action_confirmation = {
      accepted: true,
      idempotent_replay: false,
      question_id: request.question_id,
      answer_id: request.answer_id,
      interaction_ack_ms: interactionAckMs,
      revealed_artifact: isGameComplete ? STORY_ARTIFACT_TYPE.STAGE_3 : null,
      queued_artifact: artifactType,
      artifact_job_status: job?.status || null,
      game_progress: {
        answered: story.game_state.orbital_events.resolved.length,
        total: ORBITAL_STORY_STAGE_COUNT,
      },
    }
    const prefetchHit = isGameComplete
      ? prerequisite?.generation_status === 'READY'
      : null
    this.reportPerformance({
      stage: 'LOOKAHEAD_INTERACTION',
      story_id: storyId,
      interaction_node_id: request.node_id,
      reveal_artifact: isGameComplete ? STORY_ARTIFACT_TYPE.STAGE_3 : null,
      generate_artifact: artifactType,
      interaction_version: story.interaction_version,
      interaction_ack_ms: interactionAckMs,
      interaction_to_artifact_visible_ms: prefetchHit === true ? 0 : null,
      artifact_reveal_wait_ms: prefetchHit === true ? 0 : null,
      prefetch_start_delay_ms: null,
      queue_wait_ms: null,
      context_build_ms: null,
      model_duration_ms: null,
      artifact_total_generation_ms: null,
      prefetch_hit: prefetchHit,
      prefetch_miss: prefetchHit === null ? null : !prefetchHit,
    })
    return dto
  }

  async confirmGameAnswer(storyId, request, now) {
    const lookaheadStory = await this.repository.getStory(storyId, request.session_id)
    assertStory(lookaheadStory, 'STORY_NOT_FOUND', 'Story not found.', 404)
    if (lookaheadStory.prompt_metadata?.spec_version === STORY_SPEC_VERSION) {
      return this.confirmLookaheadGameAnswer(
        storyId,
        request,
        now,
        lookaheadStory,
      )
    }
    const requestFingerprint = stableStringify({ story_id: storyId, ...request })
    const existingJob = await this.repository.getStoryJobByClientAction(
      storyId,
      request.client_action_id,
    )
    if (existingJob) {
      assertStory(
        existingJob.request_fingerprint === requestFingerprint,
        'CLIENT_ACTION_ID_REUSED',
        'client_action_id was already used for another game answer.',
        409,
      )
      const existingStory = await this.repository.getStory(storyId, request.session_id)
      assertStory(existingStory, 'STORY_NOT_FOUND', 'Story not found.', 404)
      const dto = toPublicStoryDTO(
        existingStory,
        await this.repository.getStages(storyId),
        await this.repository.getStoryJobs(storyId),
      )
      dto.action_confirmation = {
        accepted: true,
        idempotent_replay: true,
        question_id: existingJob.question_id,
        answer_id: existingJob.answer_id,
        story_job: {
          target_node_id: existingJob.target_node_id,
          status: existingJob.status,
        },
      }
      return dto
    }

    const current = await this.repository.getStory(storyId, request.session_id)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    assertStory(current.status === STORY_STATUS.IN_PROGRESS, 'STORY_NOT_ACTIVE', 'Story is not active.', 409)
    assertStory(
      current.prompt_metadata?.spec_version === STORY_SPEC_VERSION,
      'STORY_VERSION_NOT_CONTINUABLE',
      'This older story is read-only under the current interaction contract.',
      409,
    )
    assertStory(
      current.version === request.version,
      'STALE_STORY_VERSION',
      'The story version is stale.',
      409,
    )
    assertStory(
      current.current_checkpoint === CHECKPOINT.ORBITAL_EVENTS,
      'INVALID_CHECKPOINT',
      `Action is not valid at checkpoint ${current.current_checkpoint}.`,
      409,
    )
    assertStory(
      request.game_module_id === ORBITAL_GAME_MODULE_ID,
      'INVALID_GAME_STORY_STAGE',
      'The game module does not match the orbital story binding.',
      400,
    )

    const stageBinding = resolveGameStoryStage(request.question_id)
    assertStory(stageBinding, 'GAME_QUESTION_NOT_FOUND', 'The orbital question was not found.', 400)
    const answered = current.game_state.orbital_events.resolved.length
    const expectedOrder = answered + 1
    assertStory(
      stageBinding.question_order === expectedOrder,
      'GAME_QUESTION_OUT_OF_ORDER',
      `Question ${expectedOrder} must be confirmed next.`,
      409,
    )
    assertStory(
      stageBinding.target_node_id === request.node_id,
      'STORY_STAGE_MAPPING_INVALID',
      'The submitted story node does not match the configured question stage.',
      400,
    )
    const binding = resolveGameAnswerStoryBinding(request.question_id, request.answer_id)
    assertStory(binding, 'GAME_ANSWER_NOT_FOUND', 'The orbital answer was not found.', 400)
    assertStory(
      request.control_id === orbitalAnswerControlId(request.question_id, request.answer_id),
      'GAME_CONTROL_MISMATCH',
      'The answer control does not match the selected answer.',
      400,
    )
    assertStory(
      binding.question_id === request.question_id,
      'GAME_ANSWER_NOT_IN_QUESTION',
      'The selected answer does not belong to this question.',
      400,
    )

    const resolution = resolveProductAction(current, {
      action_type: ACTION_TYPE.ORBITAL_EVENT_RESOLVE,
      source_id: request.question_id,
      action_id: request.answer_id,
      payload: {},
    })
    const confirmedAt = new Date(now).toISOString()
    const configSnapshot = {
      binding_id: binding.binding_id,
      game_module_id: binding.game_module_id,
      question_id: binding.question_id,
      question_order: binding.question_order,
      question_title: binding.question_title,
      answer_id: binding.answer_id,
      answer_name: binding.answer_name,
      control_id: binding.control_id,
      target_node_id: binding.target_node_id,
      generation_stage: binding.generation_stage,
      effect_summary: binding.effect_summary,
      state_delta: cloneState(binding.state_delta),
      add_consequence_ids: cloneState(binding.add_consequence_ids),
      resolve_consequence_ids: cloneState(binding.resolve_consequence_ids),
      key_outcome: binding.key_outcome || '',
      knowledge_profile: cloneState(binding.knowledge_profile),
      original_game_outcome: binding.original_game_outcome,
      technical_effect: cloneState(binding.technical_effect),
      client_action_id: request.client_action_id,
      confirmed_at: confirmedAt,
    }
    const story = cloneState(current)
    story.game_state = resolution.gameState
    story.current_checkpoint = resolution.nextCheckpoint
    story.version = current.version + 1
    story.last_activity_at_ms = now
    story.expires_at_ms = now + STORY_EXPIRY_MS
    const job = {
      job_id: id(),
      story_id: storyId,
      source_action_id: `${storyId}:${request.client_action_id}`,
      client_action_id: request.client_action_id,
      request_fingerprint: requestFingerprint,
      question_id: request.question_id,
      answer_id: request.answer_id,
      target_node_id: stageBinding.target_node_id,
      generation_stage: stageBinding.generation_stage,
      status: 'QUEUED',
      sequence: stageBinding.question_order,
      attempt_count: 0,
      config_snapshot: configSnapshot,
      metrics: {
        stage: stageBinding.generation_stage,
        node_id: stageBinding.target_node_id,
        story_id: storyId,
        job_id: null,
        answer_ack_duration_ms: Math.max(0, this.clock() - now),
      },
      created_at_ms: now,
      started_at_ms: null,
      completed_at_ms: null,
      last_error_code: null,
      updated_at_ms: now,
    }
    job.metrics.job_id = job.job_id
    await this.repository.confirmGameAnswer({ story, expectedVersion: current.version, job })
    const jobs = await this.repository.getStoryJobs(storyId)
    const dto = toPublicStoryDTO(story, await this.repository.getStages(storyId), jobs)
    dto.action_confirmation = {
      accepted: true,
      idempotent_replay: false,
      question_id: request.question_id,
      answer_id: request.answer_id,
      story_job: { target_node_id: job.target_node_id, status: 'QUEUED' },
      next_question_id: jobs.length < ORBITAL_STORY_STAGE_COUNT
        ? resolveQuestionForStoryNode(`node_${String(jobs.length + 4).padStart(2, '0')}`)?.question_id || null
        : null,
      game_progress: { answered: jobs.length, total: ORBITAL_STORY_STAGE_COUNT },
      story_progress: dto.game_story_sync,
    }
    return dto
  }

  async updateCleanupMatch(storyId, request, now) {
    const requestStartedAt = this.clock()
    const requestFingerprint = stableStringify({ story_id: storyId, ...request })
    const existing = await this.repository.getInteractionByClientAction(
      storyId,
      request.client_action_id,
    )
    if (existing) {
      assertStory(
        existing.technical_effect?.request_fingerprint === requestFingerprint,
        'CLIENT_ACTION_ID_REUSED',
        'client_action_id was already used for a different M6 match.',
        409,
      )
      const current = await this.repository.getStory(storyId, request.session_id)
      assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
      const dto = toPublicStoryDTO(
        current,
        await this.repository.getStages(storyId),
        await this.repository.getStoryJobs(storyId),
        await this.repository.getArtifacts(storyId),
        await this.repository.getArtifactJobs(storyId),
      )
      dto.action_confirmation = {
        accepted: true,
        idempotent_replay: true,
        cleanup_match: cloneState(existing.narrative_effect.cleanup_match),
        feedback: existing.narrative_effect.feedback,
        m6_interaction_ack_duration_ms: Math.max(0, this.clock() - requestStartedAt),
      }
      return dto
    }

    const current = await this.repository.getStory(storyId, request.session_id)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    assertStory(current.status === STORY_STATUS.IN_PROGRESS, 'STORY_NOT_ACTIVE', 'Story is not active.', 409)
    assertStory(current.version === request.version, 'STALE_STORY_VERSION', 'The story version is stale.', 409)
    const nodeConfig = resolveNodeInteractionConfig(current.current_node_id)
    assertStory(
      nodeConfig?.interaction_mode === STORY_INTERACTION_MODE.SITE_MATCHING_GAME
        && nodeConfig.module_id === request.module_id,
      'INVALID_NODE_INTERACTION_MODE',
      'The current node is not bound to the M6 matching game.',
      409,
    )
    const stages = await this.repository.getStages(storyId)
    if (current.prompt_metadata?.spec_version !== STORY_SPEC_VERSION) {
      assertStory(
        stages.some((stage) => stage.task_type === TASK_TYPE.ENDING && stage.node_id === 'node_09'),
        'M6_BEFORE_ENDING',
        'M6 matching requires a successfully committed node_09 Ending.',
        409,
      )
    }
    const resolution = resolveCleanupMatchUpdate(current, request)
    const story = cloneState(current)
    story.game_state = resolution.gameState
    story.version = current.version + 1
    story.interaction_version = (current.interaction_version ?? current.version) + 1
    story.last_confirmed_node = 'node_05'
    story.last_activity_at_ms = now
    story.expires_at_ms = now + STORY_EXPIRY_MS
    const metrics = storyMetrics(current.story_state)
    const interactionAckDurationMs = Math.max(0, this.clock() - requestStartedAt)
    const interaction = {
      interaction_id: id(),
      story_id: storyId,
      module: request.module_id,
      source_id: request.cleanup_target_id,
      action_id: resolution.evaluation.method.cleanup_method_id,
      label: `${resolution.evaluation.method.cleanup_method_name} → ${resolution.evaluation.target.cleanup_target_name}`,
      technical_effect: {
        request_fingerprint: requestFingerprint,
        is_allowed_match: resolution.match.is_allowed_match,
        is_preferred_match: resolution.match.is_preferred_match,
        m6_interaction_ack_duration_ms: interactionAckDurationMs,
      },
      narrative_effect: {
        cleanup_match: cloneState(resolution.match),
        feedback: resolution.feedback,
      },
      client_action_id: request.client_action_id,
      idempotency_key: `${storyId}:m6-match:${request.client_action_id}`,
      state_before: metrics,
      state_delta: { event_integrity: 0, relationship_connection: 0, uncertainty: 0 },
      state_after: metrics,
      add_consequence_ids: [],
      resolve_consequence_ids: [],
      key_outcome: '',
      site_interactions: [],
      item_deltas: [],
      combined_delta: null,
      site_outcomes: [],
      created_at_ms: now,
    }
    await this.repository.commitAdvance({
      story,
      expectedVersion: current.version,
      interaction,
      stages: [],
    })
    const dto = await this.toPublicStory(story)
    dto.action_confirmation = {
      accepted: true,
      idempotent_replay: false,
      cleanup_match: cloneState(resolution.match),
      feedback: resolution.feedback,
      m6_interaction_ack_duration_ms: interactionAckDurationMs,
    }
    return dto
  }

  async completeCleanupMatching(storyId, request, now) {
    const lookaheadStory = await this.repository.getStory(storyId, request.session_id)
    assertStory(lookaheadStory, 'STORY_NOT_FOUND', 'Story not found.', 404)
    if (lookaheadStory.prompt_metadata?.spec_version === STORY_SPEC_VERSION) {
      return this.completeLookaheadCleanup(
        storyId,
        request,
        now,
        lookaheadStory,
      )
    }
    const requestStartedAt = this.clock()
    const existingJobs = await this.repository.getStoryJobs(storyId)
    const existingByCompletion = existingJobs.find(
      (job) => job.config_snapshot?.source_completion_id === request.completion_id,
    )
    const existingByClientAction = existingJobs.find(
      (job) => job.client_action_id === request.client_action_id,
    )
    if (existingByCompletion || existingByClientAction) {
      assertStory(
        existingByCompletion?.job_id === existingByClientAction?.job_id
          || (!existingByClientAction && Boolean(existingByCompletion)),
        'CLIENT_ACTION_ID_REUSED',
        'client_action_id was already used for a different M6 completion.',
        409,
      )
      const current = await this.repository.getStory(storyId, request.session_id)
      assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
      const dto = toPublicStoryDTO(
        current,
        await this.repository.getStages(storyId),
        existingJobs,
      )
      dto.action_confirmation = {
        accepted: true,
        idempotent_replay: true,
        completion_id: request.completion_id,
        story_job: {
          job_id: (existingByCompletion || existingByClientAction).job_id,
          target_node_id: 'node_10',
          status: (existingByCompletion || existingByClientAction).status,
        },
        m6_completion_commit_duration_ms: Math.max(0, this.clock() - requestStartedAt),
      }
      return dto
    }

    const current = await this.repository.getStory(storyId, request.session_id)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    assertStory(current.status === STORY_STATUS.IN_PROGRESS, 'STORY_NOT_ACTIVE', 'Story is not active.', 409)
    assertStory(current.version === request.version, 'STALE_STORY_VERSION', 'The story version is stale.', 409)
    const nodeConfig = resolveNodeInteractionConfig(current.current_node_id)
    assertStory(
      nodeConfig?.interaction_mode === STORY_INTERACTION_MODE.SITE_MATCHING_GAME
        && nodeConfig.module_id === request.module_id,
      'INVALID_NODE_INTERACTION_MODE',
      'The current node is not bound to the M6 matching game.',
      409,
    )
    const stages = await this.repository.getStages(storyId)
    assertStory(
      stages.some((stage) => stage.task_type === TASK_TYPE.ENDING && stage.node_id === 'node_09'),
      'M6_BEFORE_ENDING',
      'M6 completion requires a successfully committed node_09 Ending.',
      409,
    )
    const confirmedAt = new Date(now).toISOString()
    assertStory(
      current.game_state.cleanup_test.matches.length > 0,
      'M6_MATCH_SET_INCOMPLETE',
      'No persisted M6 matches are available for completion.',
      409,
      { persisted_match_count: current.game_state.cleanup_test.matches.length },
    )
    const frozen = freezeCleanupMatchSnapshots(
      current,
      request.completion_id,
      confirmedAt,
      id,
    )
    const story = cloneState(current)
    story.game_state = frozen.gameState
    story.game_state.cleanup_test.completed = true
    story.game_state.cleanup_test.completion_id = request.completion_id
    story.game_state.cleanup_test.completed_at = confirmedAt
    story.game_state.cleanup_test.frozen_snapshot_ids = frozen.snapshots.map(
      (snapshot) => snapshot.snapshot_id,
    )
    story.version = current.version + 1
    story.last_activity_at_ms = now
    story.expires_at_ms = now + STORY_EXPIRY_MS
    const job = knowledgeJobFromCleanup({
      story,
      completionId: request.completion_id,
      clientActionId: request.client_action_id,
      snapshots: frozen.snapshots,
      now,
    })
    await this.repository.completeCleanupMatching({
      story,
      expectedVersion: current.version,
      snapshots: frozen.snapshots,
      job,
    })
    const duration = Math.max(0, this.clock() - requestStartedAt)
    job.metrics.m6_completion_commit_duration_ms = duration
    await this.repository.updateStoryJobMetrics(job.job_id, job.metrics, this.clock())
    const dto = toPublicStoryDTO(
      story,
      stages,
      [...existingJobs, job],
    )
    dto.action_confirmation = {
      accepted: true,
      idempotent_replay: false,
      completion_id: request.completion_id,
      snapshot_count: frozen.snapshots.length,
      story_job: { job_id: job.job_id, target_node_id: 'node_10', status: 'QUEUED' },
      m6_completion_commit_duration_ms: duration,
    }
    return dto
  }

  async completeLookaheadCleanup(storyId, request, now, current) {
    const requestStartedAt = this.clock()
    const sourceActionId = `${storyId}:m6:${request.completion_id}`
    const requestFingerprint = stableStringify({ story_id: storyId, ...request })
    const existingJob = await this.repository.getArtifactJobBySourceAction(
      storyId,
      sourceActionId,
    )
    if (existingJob) {
      assertStory(
        existingJob.snapshot?.interaction_snapshot?.request_fingerprint
          === requestFingerprint,
        'CLIENT_ACTION_ID_REUSED',
        'client_action_id was already used for a different M6 completion.',
        409,
      )
      const dto = await this.toPublicStory(current)
      dto.action_confirmation = {
        accepted: true,
        idempotent_replay: true,
        completion_id: request.completion_id,
        queued_artifact: STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL,
        artifact_job_status: existingJob.status,
      }
      return dto
    }
    assertStory(current.status === STORY_STATUS.IN_PROGRESS, 'STORY_NOT_ACTIVE', 'Story is not active.', 409)
    assertStory(current.version === request.version, 'STALE_STORY_VERSION', 'The story version is stale.', 409)
    const nodeConfig = resolveNodeInteractionConfig(current.current_node_id)
    assertStory(
      nodeConfig?.interaction_mode === STORY_INTERACTION_MODE.SITE_MATCHING_GAME
        && nodeConfig.module_id === request.module_id,
      'INVALID_NODE_INTERACTION_MODE',
      'The current node is not bound to the M6 matching game.',
      409,
    )
    assertStory(
      current.game_state.cleanup_test.matches.length > 0,
      'M6_MATCH_SET_INCOMPLETE',
      'No persisted M6 matches are available for completion.',
      409,
    )
    const confirmedAt = new Date(now).toISOString()
    const frozen = freezeCleanupMatchSnapshots(
      current,
      request.completion_id,
      confirmedAt,
      id,
    )
    const cleanupGameResult = cleanupKnowledgeResult(frozen.snapshots)
    const story = cloneState(current)
    story.game_state = frozen.gameState
    story.game_state.cleanup_test.completed = true
    story.game_state.cleanup_test.completion_id = request.completion_id
    story.game_state.cleanup_test.completed_at = confirmedAt
    story.game_state.cleanup_test.frozen_snapshot_ids = frozen.snapshots.map(
      (snapshot) => snapshot.snapshot_id,
    )
    story.version = current.version + 1
    story.interaction_version = (current.interaction_version ?? current.version) + 1
    story.last_confirmed_node = 'node_05'
    story.last_revealed_artifact = STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL
    story.last_activity_at_ms = now
    story.expires_at_ms = now + STORY_EXPIRY_MS

    const snapshot = artifactGenerationSnapshot({
      nodeId: 'node_05',
      sourceActionId,
      interactionVersion: story.interaction_version,
      stateBefore: current.story_state,
      stateDelta: ZERO_STORY_DELTA,
      stateAfter: current.story_state,
      interactionSnapshot: {
        interaction_type: M6_COMPLETE_LOOKAHEAD_BINDING.interaction_type,
        completion_id: request.completion_id,
        cleanup_game_result: cloneState(cleanupGameResult),
        request_fingerprint: requestFingerprint,
      },
    })
    const prerequisite = await this.repository.getArtifact(
      storyId,
      STORY_ARTIFACT_TYPE.ENDING,
    )
    const artifact = artifactRecord({
      storyId,
      artifactType: STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL,
      generatedFromNodeId: 'node_05',
      generatedFromActionId: sourceActionId,
      generationStatus: prerequisite?.generation_status === 'READY'
        ? 'QUEUED'
        : 'WAITING_PREREQUISITE',
      revealStatus: 'REVEALED',
      stateBefore: current.story_state,
      stateAfter: current.story_state,
      revealRequestedAt: now,
      createdAt: now,
    })
    const job = artifactJob({
      storyId,
      artifact,
      nodeId: 'node_05',
      sourceActionId,
      snapshot,
      prerequisiteStatus: prerequisite?.generation_status,
      createdAt: now,
    })
    artifact.generation_status = job.status
    const metrics = storyMetrics(current.story_state)
    const interaction = {
      interaction_id: id(),
      story_id: storyId,
      module: request.module_id,
      source_id: 'node_05',
      action_id: 'M6_MATCH_COMPLETE',
      label: '完成清理方式配对',
      technical_effect: {
        request_fingerprint: requestFingerprint,
        cleanup_snapshot_ids: frozen.snapshots.map((item) => item.snapshot_id),
      },
      narrative_effect: { cleanup_game_result: cloneState(cleanupGameResult) },
      client_action_id: request.client_action_id,
      idempotency_key: sourceActionId,
      state_before: metrics,
      state_delta: cloneState(ZERO_STORY_DELTA),
      state_after: metrics,
      add_consequence_ids: [],
      resolve_consequence_ids: [],
      key_outcome: '',
      site_interactions: [],
      item_deltas: [],
      combined_delta: cloneState(ZERO_STORY_DELTA),
      site_outcomes: [],
      created_at_ms: now,
    }
    await this.repository.commitLookaheadInteraction({
      story,
      expectedVersion: current.version,
      interaction,
      artifact,
      artifactJob: job,
      revealArtifactType: null,
      revealRequestedAt: now,
      cleanupSnapshots: frozen.snapshots,
    })
    const dto = await this.toPublicStory(story)
    dto.action_confirmation = {
      accepted: true,
      idempotent_replay: false,
      completion_id: request.completion_id,
      snapshot_count: frozen.snapshots.length,
      queued_artifact: STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL,
      artifact_job_status: job.status,
      interaction_ack_ms: Math.max(0, this.clock() - requestStartedAt),
    }
    return dto
  }

  async advanceProductAction(storyId, request, now) {
    const current = await this.repository.getStory(storyId, request.session_id)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    if (current.status === STORY_STATUS.COMPLETED) {
      return toPublicStoryDTO(current, await this.repository.getStages(storyId))
    }
    assertStory(
      current.status === STORY_STATUS.IN_PROGRESS,
      'STORY_NOT_ACTIVE',
      'Story is not active.',
      409,
    )
    assertStory(
      current.prompt_metadata?.spec_version === STORY_SPEC_VERSION,
      'STORY_VERSION_NOT_CONTINUABLE',
      'This older story is read-only under the current interaction contract.',
      409,
    )
    assertStory(
      current.version === request.version,
      'VERSION_CONFLICT',
      'The story was updated by another request.',
      409,
    )
    if ([ACTION_TYPE.MATERIALS_COMMIT, ACTION_TYPE.MISSION_SELECT].includes(request.action_type)) {
      throw new StoryError(
        'INVALID_NODE_INTERACTION_MODE',
        'Current stories must use the configured site interaction for this product action.',
        409,
      )
    }
    const resolution = resolveProductAction(current, request)
    const story = cloneState(current)
    story.game_state = resolution.gameState
    story.current_checkpoint = resolution.nextCheckpoint
    story.version = current.version + 1
    story.last_activity_at_ms = now
    story.expires_at_ms = now + STORY_EXPIRY_MS
    const interaction = {
      interaction_id: id(),
      story_id: story.story_id,
      ...resolution.interaction,
      created_at_ms: now,
    }
    await this.repository.commitAdvance({
      story,
      expectedVersion: current.version,
      interaction,
      stages: [],
    })
    return toPublicStoryDTO(story, await this.repository.getStages(storyId))
  }

  async processNextArtifactJob(storyId, sessionId) {
    const requestStartedAt = this.clock()
    const claim = await this.repository.claimNextArtifactJob(storyId, this.clock())
    if (claim.state !== 'claimed') return this.getStory(storyId, sessionId)

    const job = claim.job
    const artifact = await this.repository.getArtifact(storyId, job.artifact_type)
    const story = await this.repository.getStory(storyId, sessionId)
    assertStory(story, 'STORY_NOT_FOUND', 'Story not found.', 404)
    assertStory(
      artifact?.generation_status === 'PROCESSING',
      'ARTIFACT_JOB_STATE_INVALID',
      'The claimed job has no processing artifact.',
      500,
    )
    const snapshot = StoryArtifactGenerationSnapshotSchema.parse(job.snapshot)
    const prerequisite = job.prerequisite_artifact
      ? await this.repository.getArtifact(storyId, job.prerequisite_artifact)
      : null
    assertStory(
      !job.prerequisite_artifact || prerequisite?.generation_status === 'READY',
      'ARTIFACT_PREREQUISITE_NOT_READY',
      `${job.artifact_type} is waiting for ${job.prerequisite_artifact}.`,
      409,
    )
    const generationSnapshot = cloneState(snapshot)
    const priorArtifacts = await this.repository.getArtifacts(storyId)
    const priorKnownFacts = priorArtifacts
      .filter((item) => (
        item.sequence < artifact.sequence
        && item.generation_status === 'READY'
      ))
      .flatMap((item) => item.known_to_user_additions || [])
    generationSnapshot.state_after.known_to_user = appendUniqueFacts(
      generationSnapshot.state_after.known_to_user,
      priorKnownFacts,
    )
    const metrics = {
      story_id: storyId,
      job_id: job.job_id,
      artifact_type: job.artifact_type,
      generated_from_node_id: job.generated_from_node_id,
      interaction_version: snapshot.interaction_version,
      artifact_generation_version: story.artifact_generation_version,
      prerequisite_artifact: job.prerequisite_artifact,
      interaction_ack_ms: null,
      interaction_to_artifact_visible_ms: null,
      artifact_reveal_wait_ms: null,
      prefetch_start_delay_ms: Math.max(0, job.started_at_ms - job.created_at_ms),
      queue_wait_ms: Math.max(0, job.started_at_ms - job.created_at_ms),
      context_build_ms: 0,
      model_duration_ms: 0,
      artifact_total_generation_ms: 0,
      prefetch_hit: artifact.reveal_requested_at_ms === null ? null : false,
      prefetch_miss: artifact.reveal_requested_at_ms !== null,
      attempt_count: job.attempt_count,
    }

    try {
      const contextStartedAt = this.clock()
      const existingInteractions = await this.repository.getInteractions(storyId)
      const eligibleInteractions = existingInteractions.filter(
        (interaction) => interaction.created_at_ms <= job.created_at_ms,
      )
      let generated
      let payload
      let additions = []
      let handoff = null
      let taskType
      let sessionPatch = {}

      if (storyStageNumber(job.artifact_type)) {
        const sourceBinding = resolveLookaheadBinding(job.generated_from_node_id)
        assertStory(
          sourceBinding?.generate_artifact === job.artifact_type,
          'LOOKAHEAD_BINDING_INVALID',
          'The artifact job does not match its generation source.',
          500,
        )
        const continueContext = buildArtifactContinueContext({
          story,
          artifactType: job.artifact_type,
          source: {
            interaction_type: sourceBinding.interaction_type,
            effect_summary: artifactEffectSummary(snapshot),
          },
          snapshot: generationSnapshot,
          previousHandoff: prerequisite.continuity_handoff,
        })
        metrics.context_build_ms = this.clock() - contextStartedAt
        taskType = TASK_TYPE.CONTINUE
        generated = await this.generateValidated(
          TASK_TYPE.CONTINUE,
          continueContext,
          (output) => validateStoryContinue(output, generationSnapshot.state_after),
          {
            maxAttempts: 1,
            initialRetryReason: job.attempt_count > 1
              ? job.last_error_detail || job.last_error_code || ''
              : '',
          },
        )
        payload = {
          story_text: generated.data.output.story_text,
          choices: [],
        }
        additions = generated.data.output.known_to_user_additions
        handoff = generated.data.output.continuity_handoff
      } else if (job.artifact_type === STORY_ARTIFACT_TYPE.ENDING) {
        assertStory(
          snapshot.selected_ending,
          'ENDING_SELECTION_MISSING',
          'The backend-selected ending is missing from the immutable snapshot.',
          500,
        )
        const endingContext = buildEndingContext({
          story,
          selectedEnding: snapshot.selected_ending,
          runtimeState: generationSnapshot.state_after,
          previousHandoff: prerequisite.continuity_handoff,
          interactions: eligibleInteractions,
        })
        metrics.context_build_ms = this.clock() - contextStartedAt
        taskType = TASK_TYPE.ENDING
        generated = await this.generateValidated(
          TASK_TYPE.ENDING,
          endingContext,
          (output) => validateStoryEnding(output, {
            selectedEndingId: snapshot.selected_ending.ending_id,
            hiddenFacts: generationSnapshot.state_after.hidden_facts,
          }),
          {
            maxAttempts: 1,
            initialRetryReason: job.attempt_count > 1
              ? job.last_error_detail || job.last_error_code || ''
              : '',
          },
        )
        payload = cloneState(generated.data)
        sessionPatch = {
          final_story: {
            ...(story.final_story || {}),
            selected_ending_id: snapshot.selected_ending.ending_id,
            ending_artifact_id: artifact.artifact_id,
          },
        }
      } else if (job.artifact_type === STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL) {
        const cleanupGameResult = cloneState(
          snapshot.interaction_snapshot.cleanup_game_result,
        )
        assertStory(
          prerequisite?.payload?.selected_ending_id
            === story.final_story?.selected_ending_id,
          'KNOWLEDGE_BEFORE_ENDING',
          'Knowledge Reveal requires the backend-selected Ending artifact.',
          409,
        )
        const existingStages = await this.repository.getStages(storyId)
        const knowledgeContext = buildKnowledgeContext({
          story,
          endingOutput: prerequisite.payload,
          stages: existingStages,
          interactions: eligibleInteractions,
          cleanupGameResult,
        })
        metrics.context_build_ms = this.clock() - contextStartedAt
        taskType = TASK_TYPE.KNOWLEDGE_REVEAL
        generated = await this.generateValidated(
          TASK_TYPE.KNOWLEDGE_REVEAL,
          knowledgeContext,
          (output) => validateKnowledgeReveal(output, {
            selectedSiteOptions: knowledgeContext.selected_site_options,
            cleanupMatches: cleanupGameResult.matches,
          }),
          {
            maxAttempts: 1,
            initialRetryReason: job.attempt_count > 1
              ? job.last_error_detail || job.last_error_code || ''
              : '',
          },
        )
        payload = knowledgeDisplay(generated.data)
        const completedState = applyNarrativeOutput(story.story_state, [], null)
        sessionPatch = {
          story_state: completedState,
          status: STORY_STATUS.COMPLETED,
          current_node_id: null,
          current_checkpoint: CHECKPOINT.COMPLETED,
          final_story: {
            ...(story.final_story || {}),
            knowledge_reveal_artifact_id: artifact.artifact_id,
          },
          completed_at_ms: this.clock(),
          expires_at_ms: null,
        }
      } else {
        throw new StoryError(
          'STORY_ARTIFACT_TYPE_INVALID',
          `No generator exists for ${job.artifact_type}.`,
          500,
        )
      }

      metrics.model_duration_ms = generated.timings.model_duration_ms
      metrics.artifact_total_generation_ms = this.clock() - requestStartedAt
      if (artifact.reveal_requested_at_ms !== null) {
        metrics.artifact_reveal_wait_ms = Math.max(
          0,
          this.clock() - artifact.reveal_requested_at_ms,
        )
        metrics.interaction_to_artifact_visible_ms =
          metrics.artifact_reveal_wait_ms
      }
      const inputAction = artifactInputAction(job)
      const completedArtifact = {
        ...artifact,
        payload: cloneState(payload),
        known_to_user_additions: cloneState(additions),
        continuity_handoff: handoff ? cloneState(handoff) : null,
        model_metadata: {
          spec_version: STORY_SPEC_VERSION,
          attempts: generated.attempts,
          provider: cloneState(generated.providerMetadata),
          generation_job_id: job.job_id,
          input_action: inputAction,
          stage_summary: `${job.artifact_type} 已按冻结的 ${job.generated_from_node_id} 快照生成。`,
        },
        state_before: cloneState(snapshot.state_before),
        state_after: cloneState(snapshot.state_after),
      }
      const stage = narrativeStage({
        story,
        stageIndex: artifact.sequence,
        taskType,
        nodeId: job.artifact_type === STORY_ARTIFACT_TYPE.STAGE_1
          ? 'node_02'
          : job.artifact_type === STORY_ARTIFACT_TYPE.STAGE_2
            ? 'node_03'
            : job.artifact_type === STORY_ARTIFACT_TYPE.STAGE_3
              ? 'node_04'
              : job.artifact_type === STORY_ARTIFACT_TYPE.ENDING
                ? 'node_05'
                : null,
        inputAction,
        displayContent: payload,
        knownToUserAdditions: additions,
        continuityHandoff: handoff,
        modelMetadata: completedArtifact.model_metadata,
        summary: completedArtifact.model_metadata.stage_summary,
        stateBefore: snapshot.state_before,
        stateAfter: snapshot.state_after,
        createdAt: this.clock(),
      })
      await this.repository.completeArtifactJob({
        storyId,
        expectedArtifactGenerationVersion: story.artifact_generation_version,
        artifact: completedArtifact,
        job,
        stage,
        metrics,
        sessionPatch,
        now: this.clock(),
      })
      this.reportPerformance(metrics)
      return this.getStory(storyId, sessionId)
    } catch (error) {
      metrics.artifact_total_generation_ms = this.clock() - requestStartedAt
      const status = await this.repository.failArtifactJob(
        job.job_id,
        error?.code || 'STORY_GENERATION_FAILED',
        retryReason(error),
        metrics,
        this.clock(),
      )
      this.reportPerformance({
        ...metrics,
        status,
        error_code: error?.code || 'STORY_GENERATION_FAILED',
      })
      return this.getStory(storyId, sessionId)
    }
  }

  async processNextStoryJob(storyId, sessionId, retryJobId = null) {
    const requestStartedAt = this.clock()
    const dbReadStartedAt = this.clock()
    const current = await this.repository.getStory(storyId, sessionId)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    if (current.prompt_metadata?.spec_version === STORY_SPEC_VERSION) {
      if (retryJobId) {
        await this.repository.retryArtifactJob(storyId, retryJobId, this.clock())
      }
      return this.processNextArtifactJob(storyId, sessionId)
    }
    assertStory(
      !current.prompt_metadata?.spec_version,
      'STORY_VERSION_NOT_CONTINUABLE',
      'This older story is read-only and its generation queue cannot be resumed by the five-stage worker.',
      409,
    )
    if (retryJobId) {
      await this.repository.retryStoryJob(storyId, retryJobId, this.clock())
    }
    const claim = await this.repository.claimNextStoryJob(storyId, this.clock())
    const initialDbReadDurationMs = Math.max(0, this.clock() - dbReadStartedAt)
    if (claim.state !== 'claimed') {
      return this.getStory(storyId, sessionId)
    }

    const job = claim.job
    const metrics = {
      stage: job.generation_stage,
      node_id: job.target_node_id,
      story_id: storyId,
      job_id: job.job_id,
      answer_ack_duration_ms: job.metrics?.answer_ack_duration_ms ?? null,
      db_read_duration_ms: initialDbReadDurationMs,
      queue_wait_duration_ms: Math.max(0, job.started_at_ms - job.created_at_ms),
      context_build_duration_ms: 0,
      model_duration_ms: 0,
      response_validation_duration_ms: 0,
      commit_duration_ms: 0,
      node_total_generation_duration_ms: 0,
      retry_count: 0,
      m6_completion_commit_duration_ms:
        job.metrics?.m6_completion_commit_duration_ms ?? null,
    }

    try {
      const storyBeforeGeneration = await this.repository.getStory(storyId, sessionId)
      assertStory(
        storyBeforeGeneration?.status === STORY_STATUS.IN_PROGRESS,
        'STORY_NOT_ACTIVE',
        'Story is not active.',
        409,
      )
      assertStory(
        storyBeforeGeneration.current_node_id === job.target_node_id,
        'STORY_JOB_SEQUENCE_BLOCKED',
        `The story is waiting at ${storyBeforeGeneration.current_node_id}.`,
        409,
      )
      if (job.generation_stage === 'KNOWLEDGE') {
        const existingStages = await this.repository.getStages(storyId)
        const existingInteractions = await this.repository.getInteractions(storyId)
        const endingStage = [...existingStages]
          .reverse()
          .find((stage) => stage.task_type === TASK_TYPE.ENDING && stage.node_id === 'node_09')
        assertStory(
          endingStage && storyBeforeGeneration.final_story?.selected_ending_id,
          'KNOWLEDGE_BEFORE_ENDING',
          'Knowledge Reveal requires a successfully committed Ending stage.',
          409,
        )
        const cleanupGameResult = cloneState(job.config_snapshot?.cleanup_game_result)
        assertStory(
          cleanupGameResult?.completed === true
            && cleanupGameResult.matches?.length > 0
            && storyBeforeGeneration.game_state.cleanup_test.completed === true
            && storyBeforeGeneration.game_state.cleanup_test.completion_id
              === job.config_snapshot?.source_completion_id,
          'KNOWLEDGE_BEFORE_M6_COMPLETION',
          'Knowledge Reveal requires a frozen M6 completion snapshot.',
          409,
        )
        const contextStartedAt = this.clock()
        const knowledgeContext = buildKnowledgeContext({
          story: storyBeforeGeneration,
          endingOutput: endingStage.display_content,
          stages: existingStages,
          interactions: existingInteractions,
          cleanupGameResult,
        })
        metrics.context_build_duration_ms = this.clock() - contextStartedAt
        metrics.knowledge_context_build_duration_ms = metrics.context_build_duration_ms
        metrics.knowledge_context_size_bytes = new TextEncoder()
          .encode(stableStringify(knowledgeContext)).byteLength
        metrics.cleanup_snapshot_count = cleanupGameResult.matches.length
        const knowledgeGenerated = await this.generateValidated(
          TASK_TYPE.KNOWLEDGE_REVEAL,
          knowledgeContext,
          (output) => validateKnowledgeReveal(output, {
            selectedSiteOptions: knowledgeContext.selected_site_options,
            cleanupMatches: knowledgeContext.cleanup_game_result.matches,
          }),
        )
        Object.assign(metrics, knowledgeGenerated.timings)
        metrics.knowledge_model_duration_ms = metrics.model_duration_ms
        metrics.knowledge_validation_duration_ms = metrics.response_validation_duration_ms
        metrics.knowledge_retry_count = metrics.retry_count
        metrics.knowledge_schema_validation_succeeded = true
        metrics.cleanup_insight_count = knowledgeGenerated.data.cleanup_insights.length
        const completedState = applyNarrativeOutput(
          storyBeforeGeneration.story_state,
          [],
          null,
        )
        const knowledgeStage = narrativeStage({
          story: storyBeforeGeneration,
          stageIndex: storyBeforeGeneration.current_stage_index + 1,
          taskType: TASK_TYPE.KNOWLEDGE_REVEAL,
          nodeId: 'node_10',
          inputAction: {
            module: cleanupGameResult.module_id,
            source_id: job.config_snapshot.source_completion_id,
            action_id: 'M6_MATCH_COMPLETE',
            label: '完成清理方式配对',
          },
          displayContent: knowledgeDisplay(knowledgeGenerated.data),
          modelMetadata: {
            spec_version: STORY_SPEC_VERSION,
            attempts: knowledgeGenerated.attempts,
            provider: cloneState(knowledgeGenerated.providerMetadata),
            generation_job_id: job.job_id,
          },
          summary: 'node_10 知识揭示已根据后端冻结的 M6 配对快照完成。',
          stateBefore: storyBeforeGeneration.story_state,
          stateAfter: completedState,
          createdAt: this.clock(),
        })
        const completedStory = cloneState(storyBeforeGeneration)
        completedStory.story_state = completedState
        completedStory.current_node_id = null
        completedStory.current_checkpoint = CHECKPOINT.COMPLETED
        completedStory.current_stage_index += 1
        completedStory.status = STORY_STATUS.COMPLETED
        completedStory.completed_at_ms = this.clock()
        completedStory.expires_at_ms = null
        completedStory.final_story = {
          ...cloneState(storyBeforeGeneration.final_story),
          knowledge_reveal_stage_id: knowledgeStage.stage_id,
        }
        const commitStartedAt = this.clock()
        const committedStory = await this.commitQueuedStoryJobResult({
          storyId,
          sessionId,
          sourceStory: storyBeforeGeneration,
          generatedStory: completedStory,
          interaction: null,
          stages: [knowledgeStage],
          job,
          metrics,
        })
        metrics.commit_duration_ms = this.clock() - commitStartedAt
        metrics.knowledge_commit_duration_ms = metrics.commit_duration_ms
        metrics.node_total_generation_duration_ms = this.clock() - requestStartedAt
        metrics.total_stage_duration_ms = metrics.node_total_generation_duration_ms
        try {
          await this.repository.updateStoryJobMetrics(job.job_id, metrics, this.clock())
        } catch {
          // The story commit is authoritative; metrics persistence must not roll it back.
        }
        this.reportPerformance(metrics)
        return toPublicStoryDTO(
          committedStory,
          await this.repository.getStages(storyId),
          await this.repository.getStoryJobs(storyId),
        )
      }
      const snapshot = cloneState(job.config_snapshot)
      const option = gameAnswerOption(snapshot)
      const action = {
        node_id: snapshot.target_node_id,
        module_id: snapshot.game_module_id,
        question_id: snapshot.question_id,
        answer_id: snapshot.answer_id,
        client_action_id: snapshot.client_action_id,
      }
      const transition = applyStoryOption(storyBeforeGeneration.story_state, option, action)
      const interaction = gameAnswerInteraction({
        story: storyBeforeGeneration,
        job,
        snapshot,
        transition,
        now: this.clock(),
      })
      const existingStages = await this.repository.getStages(storyId)
      const existingInteractions = await this.repository.getInteractions(storyId)
      const previousHandoff = latestContinuityHandoff(existingStages)
      const contextStartedAt = this.clock()
      const stages = []
      const generatedStory = cloneState(storyBeforeGeneration)
      let nextStoryJob = null

      if (job.generation_stage === 'CONTINUE') {
        const siteSnapshot = gameAnswerSiteSnapshot(snapshot)
        const continueContext = buildSiteInteractionContinueContext({
          story: storyBeforeGeneration,
          snapshots: [siteSnapshot],
          transition: {
            ...transition,
            item_deltas: [{
              section_id: snapshot.question_id,
              option_id: snapshot.answer_id,
              delta: cloneState(transition.delta),
            }],
            combined_delta: cloneState(transition.delta),
          },
          previousHandoff,
        })
        metrics.context_build_duration_ms = this.clock() - contextStartedAt
        const currentNode = findOutlineNode(
          storyBeforeGeneration.story_outline,
          job.target_node_id,
        )
        const generated = await this.generateValidated(
          currentNode.task_type,
          continueContext,
          (output) => validateStoryContinue(output, transition.state),
        )
        Object.assign(metrics, generated.timings)
        const upcomingNodeId = nextNodeId(job.target_node_id)
        const runtimeState = applyNarrativeOutput(
          transition.state,
          generated.data.additions,
          upcomingNodeId,
        )
        stages.push(narrativeStage({
          story: storyBeforeGeneration,
          stageIndex: storyBeforeGeneration.current_stage_index + 1,
          taskType: currentNode.task_type,
          nodeId: currentNode.node_id,
          inputAction: {
            module: snapshot.game_module_id,
            source_id: snapshot.question_id,
            action_id: snapshot.answer_id,
            label: snapshot.answer_name,
          },
          displayContent: {
            story_text: generated.data.output.story_text,
            choices: [],
          },
          knownToUserAdditions: generated.data.output.known_to_user_additions,
          continuityHandoff: generated.data.output.continuity_handoff,
          modelMetadata: {
            spec_version: STORY_SPEC_VERSION,
            attempts: generated.attempts,
            provider: cloneState(generated.providerMetadata),
            generation_job_id: job.job_id,
          },
          summary: `${job.target_node_id} 已根据轨道事件确认结果生成。`,
          stateBefore: storyBeforeGeneration.story_state,
          stateAfter: runtimeState,
          createdAt: this.clock(),
        }))
        generatedStory.story_state = runtimeState
        generatedStory.current_node_id = upcomingNodeId
        generatedStory.current_stage_index += 1
        generatedStory.expires_at_ms = this.clock() + STORY_EXPIRY_MS
      } else {
        assertStory(
          job.target_node_id === 'node_09' && job.sequence === ORBITAL_STORY_STAGE_COUNT,
          'INVALID_GAME_STORY_STAGE',
          'Only the sixth orbital answer may generate the ending.',
          500,
        )
        const selected = selectEnding({
          reachableEndings: storyBeforeGeneration.story_outline.reachable_endings,
          storyState: storyMetrics(transition.state),
          activeConsequenceIds: transition.state.active_consequences,
        })
        const allInteractions = [...existingInteractions, interaction]
        const endingContext = buildEndingContext({
          story: storyBeforeGeneration,
          selectedEnding: selected.ending,
          runtimeState: transition.state,
          previousHandoff,
          interactions: allInteractions,
        })
        metrics.context_build_duration_ms = this.clock() - contextStartedAt
        const endingGenerated = await this.generateValidated(
          TASK_TYPE.ENDING,
          endingContext,
          (output) => validateStoryEnding(output, {
            selectedEndingId: selected.ending.ending_id,
            hiddenFacts: transition.state.hidden_facts,
          }),
        )
        Object.assign(metrics, endingGenerated.timings)
        const endingState = applyNarrativeOutput(transition.state, [], 'node_10')
        const endingStage = narrativeStage({
          story: storyBeforeGeneration,
          stageIndex: storyBeforeGeneration.current_stage_index + 1,
          taskType: TASK_TYPE.ENDING,
          nodeId: 'node_09',
          inputAction: {
            module: snapshot.game_module_id,
            source_id: snapshot.question_id,
            action_id: snapshot.answer_id,
            label: snapshot.answer_name,
          },
          displayContent: cloneState(endingGenerated.data),
          modelMetadata: {
            spec_version: STORY_SPEC_VERSION,
            attempts: endingGenerated.attempts,
            provider: cloneState(endingGenerated.providerMetadata),
            ending_evaluation_trace: selected.trace,
            generation_job_id: job.job_id,
          },
          summary: `后端规则选择 ${selected.ending.ending_id}，模型仅完成结局叙事。`,
          stateBefore: storyBeforeGeneration.story_state,
          stateAfter: endingState,
          createdAt: this.clock(),
        })
        stages.push(endingStage)
        generatedStory.story_state = endingState
        generatedStory.current_node_id = 'node_10'
        generatedStory.current_stage_index += 1
        generatedStory.expires_at_ms = this.clock() + STORY_EXPIRY_MS
        generatedStory.game_state = ensureCleanupTargetSet(generatedStory)
        generatedStory.final_story = {
          selected_ending_id: selected.ending.ending_id,
          ending_stage_id: endingStage.stage_id,
          knowledge_reveal_stage_id: null,
        }
      }

      const commitStartedAt = this.clock()
      const committedStory = await this.commitQueuedStoryJobResult({
        storyId,
        sessionId,
        sourceStory: storyBeforeGeneration,
        generatedStory,
        interaction,
        stages,
        job,
        metrics,
        nextStoryJob,
      })
      metrics.commit_duration_ms = this.clock() - commitStartedAt
      metrics.node_total_generation_duration_ms = this.clock() - requestStartedAt
      metrics.total_stage_duration_ms = metrics.node_total_generation_duration_ms
      try {
        await this.repository.updateStoryJobMetrics(job.job_id, metrics, this.clock())
      } catch {
        // The story commit is authoritative; metrics persistence must not roll it back.
      }
      this.reportPerformance(metrics)
      return toPublicStoryDTO(
        committedStory,
        await this.repository.getStages(storyId),
        await this.repository.getStoryJobs(storyId),
      )
    } catch (error) {
      metrics.node_total_generation_duration_ms = this.clock() - requestStartedAt
      metrics.total_stage_duration_ms = metrics.node_total_generation_duration_ms
      await this.repository.failStoryJob(
        job.job_id,
        error?.code || 'STORY_GENERATION_FAILED',
        metrics,
        this.clock(),
      )
      this.reportPerformance({
        ...metrics,
        error_code: error?.code || 'STORY_GENERATION_FAILED',
      })
      throw error
    }
  }

  async advanceNarrativeInteraction(storyId, request, now) {
    const current = await this.repository.getStory(storyId, request.session_id)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    if (
      current.prompt_metadata?.spec_version === STORY_SPEC_VERSION
      && request.action_type === ACTION_TYPE.SITE_INTERACTION_COMMIT
    ) {
      return this.commitLookaheadSiteInteraction(
        storyId,
        request,
        now,
        current,
      )
    }
    const siteInteraction = request.action_type === ACTION_TYPE.SITE_INTERACTION_COMMIT
    const requestFingerprint = stableStringify({ story_id: storyId, ...request })
    const existingGeneration = await this.repository.getGenerationByClientAction(
      storyId,
      request.client_action_id,
    )
    if (existingGeneration) {
      assertStory(
        existingGeneration.request_fingerprint === requestFingerprint,
        'CLIENT_ACTION_ID_REUSED',
        'client_action_id was already used for a different story choice.',
        409,
      )
      if (existingGeneration.status === 'succeeded') {
        return toPublicStoryDTO(current, await this.repository.getStages(storyId))
      }
      if (existingGeneration.status === 'pending') {
        throw new StoryError(
          'GENERATION_IN_PROGRESS',
          'This story choice is already being generated.',
          409,
        )
      }
    }
    assertStory(
      current.status === STORY_STATUS.IN_PROGRESS,
      'STORY_NOT_ACTIVE',
      'Story is not active.',
      409,
    )
    assertStory(
      current.prompt_metadata?.spec_version === STORY_SPEC_VERSION,
      'STORY_VERSION_NOT_CONTINUABLE',
      'This older story does not use the current validated interaction contract and cannot be continued.',
      409,
    )
    assertStory(
      current.version === request.version,
      siteInteraction ? 'STALE_STORY_VERSION' : 'VERSION_CONFLICT',
      'The story was updated by another request.',
      409,
    )
    if (siteInteraction && current.current_node_id !== request.node_id) {
      const interactions = await this.repository.getInteractions(storyId)
      const alreadyCommitted = interactions.some((interaction) => (
        interaction.module === request.module_id
        && interaction.source_id === request.node_id
      ))
      assertStory(
        !alreadyCommitted,
        'SITE_INTERACTION_ALREADY_COMMITTED',
        `The site interaction for ${request.node_id}/${request.module_id} was already committed.`,
        409,
      )
    }
    assertStory(
      current.current_node_id === request.node_id,
      'NODE_CONFLICT',
      `The current story node is ${current.current_node_id}.`,
      409,
    )

    const nodeInteraction = resolveNodeInteractionConfig(current.current_node_id)
    let option = null
    let siteResolution = null
    let transition
    let generationOptionId
    let generationOptionSnapshot
    let publicAction

    if (siteInteraction) {
      siteResolution = resolveSiteInteractionCommit(current, request, now)
      transition = siteResolution.transition
      generationOptionId = siteInteractionActionId(
        request,
        nodeInteraction.interaction_mode,
      )
      generationOptionSnapshot = {
        interaction_mode: nodeInteraction.interaction_mode,
        module_id: request.module_id,
        site_interactions: cloneState(siteResolution.snapshots),
        item_deltas: cloneState(transition.item_deltas),
        combined_delta: cloneState(transition.combined_delta),
        site_outcomes: cloneState(siteResolution.outcomes),
      }
      publicAction = publicSiteInteractionAction(request, siteResolution)
    } else {
      assertStory(
        nodeInteraction?.interaction_mode === STORY_INTERACTION_MODE.LEGACY_STORY_OPTION,
        'INVALID_NODE_INTERACTION_MODE',
        `Node ${current.current_node_id} no longer accepts legacy story options.`,
        409,
      )
      const options = resolveOptionsForNode(current, current.current_node_id)
      option = options.find((item) => item.option_id === request.option_id)
      assertStory(option, 'OPTION_NOT_FOUND', 'The option is not valid for the current node.', 400)
      const action = choiceAction(request, option)
      transition = applyStoryOption(current.story_state, option, action)
      generationOptionId = option.option_id
      generationOptionSnapshot = option
      publicAction = publicChoiceAction(request, option)
    }
    const idempotencyKey = [
      storyId,
      request.node_id,
      generationOptionId,
      request.client_action_id,
    ].join(':')
    const generationRecord = {
      generation_id: id(),
      idempotency_key: idempotencyKey,
      story_id: storyId,
      node_id: request.node_id,
      option_id: generationOptionId,
      client_action_id: request.client_action_id,
      request_fingerprint: requestFingerprint,
      expected_version: request.version,
      status: 'pending',
      state_before: transition.before,
      option_snapshot: generationOptionSnapshot,
      result_version: null,
      error_code: null,
      created_at_ms: now,
      updated_at_ms: now,
    }
    const pending = await this.repository.beginGeneration(generationRecord)
    if (pending.state === 'succeeded') {
      const saved = await this.repository.getStory(storyId, request.session_id)
      return toPublicStoryDTO(saved, await this.repository.getStages(storyId))
    }
    if (pending.state === 'pending') {
      throw new StoryError(
        'GENERATION_IN_PROGRESS',
        'This story choice is already being generated.',
        409,
      )
    }
    const generation = pending.generation

    const interaction = siteInteraction
      ? siteStoryInteraction({
          story: current,
          request,
          resolution: siteResolution,
          idempotencyKey,
          now,
        })
      : storyChoiceInteraction({
          story: current,
          request,
          option,
          transition,
          idempotencyKey,
          now,
        })

    try {
      const existingStages = await this.repository.getStages(storyId)
      const existingInteractions = await this.repository.getInteractions(storyId)
      const previousHandoff = latestContinuityHandoff(existingStages)
      const currentNode = findOutlineNode(current.story_outline, current.current_node_id)
      const continueContext = siteInteraction
        ? buildSiteInteractionContinueContext({
            story: current,
            snapshots: siteResolution.snapshots,
            transition,
            previousHandoff,
          })
        : buildContinueContext({
            story: current,
            option,
            transition,
            previousHandoff,
          })
      const continueGenerated = await this.generateValidated(
        currentNode.task_type,
        continueContext,
        (output) => validateStoryContinue(output, transition.state),
      )
      const upcomingNodeId = nextNodeId(current.current_node_id)
      let runtimeState = applyNarrativeOutput(
        transition.state,
        continueGenerated.data.additions,
        upcomingNodeId,
      )
      const stages = [
        narrativeStage({
          story: current,
          stageIndex: current.current_stage_index + 1,
          taskType: currentNode.task_type,
          nodeId: currentNode.node_id,
          inputAction: publicAction,
          displayContent: {
            story_text: continueGenerated.data.output.story_text,
            choices: [],
          },
          knownToUserAdditions: continueGenerated.data.output.known_to_user_additions,
          continuityHandoff: continueGenerated.data.output.continuity_handoff,
          modelMetadata: {
            spec_version: STORY_SPEC_VERSION,
            attempts: continueGenerated.attempts,
            provider: cloneState(continueGenerated.providerMetadata),
          },
          summary: `${currentNode.node_id} 已按后端确认的数值变化完成。`,
          stateBefore: current.story_state,
          stateAfter: runtimeState,
          createdAt: now,
        }),
      ]
      const story = cloneState(current)
      story.story_state = runtimeState
      story.current_node_id = upcomingNodeId
      if (siteResolution) {
        story.game_state = cloneState(siteResolution.gameState)
        story.current_checkpoint = siteResolution.nextCheckpoint
      }

      if (currentNode.node_id === 'node_08') {
        const selected = selectEnding({
          reachableEndings: story.story_outline.reachable_endings,
          storyState: storyMetrics(runtimeState),
          activeConsequenceIds: runtimeState.active_consequences,
        })
        const endingContext = buildEndingContext({
          story,
          selectedEnding: selected.ending,
          runtimeState,
          previousHandoff: continueGenerated.data.output.continuity_handoff,
          interactions: [...existingInteractions, interaction],
        })
        const endingGenerated = await this.generateValidated(
          TASK_TYPE.ENDING,
          endingContext,
          (output) => validateStoryEnding(output, {
            selectedEndingId: selected.ending.ending_id,
            hiddenFacts: runtimeState.hidden_facts,
          }),
        )
        const persistedEndingOutput = await this.repository.saveValidatedEnding(
          generation.generation_id,
          {
            storyId,
            expectedVersion: current.version,
            nodeId: current.current_node_id,
            output: endingGenerated.data,
            now: this.clock(),
          },
        )
        const endingState = applyNarrativeOutput(runtimeState, [], 'node_10')
        const endingStage = narrativeStage({
          story,
          stageIndex: current.current_stage_index + 2,
          taskType: TASK_TYPE.ENDING,
          nodeId: 'node_09',
          inputAction: publicAction,
          displayContent: cloneState(persistedEndingOutput),
          modelMetadata: {
            spec_version: STORY_SPEC_VERSION,
            attempts: endingGenerated.attempts,
            provider: cloneState(endingGenerated.providerMetadata),
            ending_evaluation_trace: selected.trace,
          },
          summary: `后端规则选择 ${selected.ending.ending_id}，模型仅完成结局叙事。`,
          stateBefore: runtimeState,
          stateAfter: endingState,
          createdAt: now + 1,
        })
        stages.push(endingStage)
        story.story_state = endingState
        story.current_node_id = 'node_10'
        const knowledgeContext = buildKnowledgeContext({
          story,
          endingOutput: persistedEndingOutput,
          stages: [...existingStages, ...stages],
          interactions: [...existingInteractions, interaction],
        })
        const knowledgeGenerated = await this.generateValidated(
          TASK_TYPE.KNOWLEDGE_REVEAL,
          knowledgeContext,
          (output) => validateKnowledgeReveal(output, {
            selectedSiteOptions: knowledgeContext.selected_site_options,
          }),
        )
        const completedState = applyNarrativeOutput(endingState, [], null)
        const knowledgeStage = narrativeStage({
          story,
          stageIndex: current.current_stage_index + 3,
          taskType: TASK_TYPE.KNOWLEDGE_REVEAL,
          nodeId: 'node_10',
          inputAction: publicAction,
          displayContent: knowledgeDisplay(knowledgeGenerated.data),
          modelMetadata: {
            spec_version: STORY_SPEC_VERSION,
            attempts: knowledgeGenerated.attempts,
            provider: cloneState(knowledgeGenerated.providerMetadata),
          },
          summary: 'node_10 知识揭示已完成，数值状态未被读取或修改。',
          stateBefore: endingState,
          stateAfter: completedState,
          createdAt: now + 2,
        })
        stages.push(knowledgeStage)
        story.story_state = completedState
        story.current_node_id = null
        story.status = STORY_STATUS.COMPLETED
        story.completed_at_ms = now
        story.expires_at_ms = null
        story.final_story = {
          selected_ending_id: selected.ending.ending_id,
          ending_stage_id: endingStage.stage_id,
          knowledge_reveal_stage_id: knowledgeStage.stage_id,
        }
      } else {
        story.expires_at_ms = now + STORY_EXPIRY_MS
      }

      story.current_stage_index = stages.at(-1).stage_index
      story.version = current.version + 1
      story.last_generation_id = generation.generation_id
      story.last_activity_at_ms = now
      await this.repository.commitAdvance({
        story,
        expectedVersion: current.version,
        interaction,
        stages,
        generation,
      })
      return toPublicStoryDTO(story, await this.repository.getStages(storyId))
    } catch (error) {
      await this.repository.markGenerationFailed(
        generation.generation_id,
        error?.code || 'STORY_GENERATION_FAILED',
        this.clock(),
      )
      throw error
    }
  }

  async advanceStory(storyId, rawRequest) {
    const request = parse(StoryActionRequestSchema, rawRequest)
    const now = this.clock()
    await this.repository.cleanupExpiredStories(now)
    if (request.action_type === ACTION_TYPE.GAME_ANSWER_CONFIRM) {
      return this.confirmGameAnswer(storyId, request, now)
    }
    if (request.action_type === ACTION_TYPE.M6_MATCH_UPDATE) {
      return this.updateCleanupMatch(storyId, request, now)
    }
    if (request.action_type === ACTION_TYPE.M6_MATCH_COMPLETE) {
      return this.completeCleanupMatching(storyId, request, now)
    }
    if (
      request.action_type === ACTION_TYPE.STORY_OPTION_SELECT
      || request.action_type === ACTION_TYPE.SITE_INTERACTION_COMMIT
    ) {
      return this.advanceNarrativeInteraction(storyId, request, now)
    }
    return this.advanceProductAction(storyId, request, now)
  }
}
