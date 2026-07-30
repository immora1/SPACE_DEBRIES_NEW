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
  StoryActionRequestSchema,
  StoryUserInputSchema,
} from './schemas.js'
import {
  applyNarrativeOutput,
  applyOpeningOutput,
  applyStoryOption,
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
} from './validators.js'
import { resolveOptionsForNode } from './config/story-options.js'
import {
  buildContinueContext,
  buildEndingContext,
  buildKnowledgeContext,
  findOutlineNode,
  latestContinuityHandoff,
} from './story-context.js'
import { selectEnding } from './ending-selector.js'
import { resolveProductAction } from './product-actions.js'

function id() {
  return globalThis.crypto.randomUUID()
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
    if (ranges && Array.isArray(ids) && ids.length > 0) {
      return [
        `OUTLINE_ENDING_UNREACHABLE: ${ids.join(',')} 在全部真实选项路径中都不会被选中。`,
        `本故事可达范围为 event_integrity ${ranges.event_integrity.min}-${ranges.event_integrity.max}、`,
        `relationship_connection ${ranges.relationship_connection.min}-${ranges.relationship_connection.max}、`,
        `uncertainty ${ranges.uncertainty.min}-${ranges.uncertainty.max}。`,
        '只重写 state_rule：删除不可能的阈值或 consequence 组合，并避免被更高 priority 规则完全遮蔽；节点与 outcome 保持不变。',
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
        '请完整重写 story_text，并写到 420-500 个汉字（只统计汉字，不计标点、数字和空格）；',
        '其他 JSON 字段仍须完整返回。',
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
  return {
    ...cloneState(output),
    story_text: [
      output.knowledge_title,
      output.story_connection,
      chain,
      output.reality_note,
    ].join('\n\n'),
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

export class StoryService {
  constructor({ repository, generateOutput, generateStage, clock = () => Date.now() }) {
    this.repository = repository
    this.generateOutput = generateOutput || generateStage
    this.clock = clock
  }

  async generateValidated(taskType, input, validate) {
    let previousError = null
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const output = await this.generateOutput(taskType, input, {
          attempt,
          retryReason: previousError ? retryReason(previousError) : '',
        })
        return {
          data: validate(output),
          attempts: attempt,
          providerMetadata: output?.[STORY_GENERATION_METADATA] || null,
        }
      } catch (error) {
        if (attempt === 2 || !isRetryableOutputError(error, taskType)) throw error
        previousError = error
      }
    }
    throw new StoryError('AI_INVALID_OUTPUT', 'Story output validation failed.', 502)
  }

  async generateStoryOutline(rawInput) {
    const input = parse(
      CanonicalStoryUserInputSchema,
      rawInput,
      'STORY_USER_INPUT_INVALID',
    )
    const generated = await this.generateValidated(
      TASK_TYPE.OUTLINE,
      input,
      validateStoryOutline,
    )
    return {
      outline: deepFreeze(cloneState(generated.data)),
      attempts: generated.attempts,
      providerMetadata: generated.providerMetadata,
    }
  }

  async generateStoryOpening(outline, runtimeState) {
    validateStoryOutline(outline)
    const generated = await this.generateValidated(
      TASK_TYPE.OPENING,
      outline,
      (output) => validateStoryOpening(output, runtimeState),
    )
    return {
      opening: generated.data.output,
      additions: generated.data.additions,
      attempts: generated.attempts,
      providerMetadata: generated.providerMetadata,
    }
  }

  createRuntimeStoryState(initialStoryState) {
    return createRuntimeStoryState(initialStoryState)
  }

  async createStory(rawRequest) {
    const request = parse(CreateStoryRequestSchema, rawRequest)
    const now = this.clock()
    await this.repository.cleanupExpiredStories(now)

    const sessionId = request.session_id || id()
    const requestFingerprint = stableStringify(request)
    const existing = await this.repository.getStoryBySessionId(sessionId)
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
    } = await this.generateStoryOutline(canonicalInput)
    const initialRuntimeState = this.createRuntimeStoryState(outline.initial_story_state)
    const {
      opening,
      additions,
      attempts: openingAttempts,
      providerMetadata: openingProviderMetadata,
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
        opening_spec_version: STORY_OPENING_SPEC_VERSION,
        prompt_mode: 'code_managed',
      },
      final_story: null,
      last_generation_id: null,
      created_at_ms: now,
      last_activity_at_ms: now,
      expires_at_ms: now + STORY_EXPIRY_MS,
      completed_at_ms: null,
    }

    try {
      await this.repository.createStory(story, [stage])
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
      )
    }
    return toPublicStoryDTO(story, [stage])
  }

  async getStory(storyId, sessionId) {
    const now = this.clock()
    await this.repository.cleanupExpiredStories(now)
    const story = await this.repository.getStory(storyId, sessionId)
    assertStory(story, 'STORY_NOT_FOUND', 'Story not found.', 404)
    return toPublicStoryDTO(story, await this.repository.getStages(storyId))
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
      current.version === request.version,
      'VERSION_CONFLICT',
      'The story was updated by another request.',
      409,
    )
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

  async advanceStoryOption(storyId, request, now) {
    const current = await this.repository.getStory(storyId, request.session_id)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    const requestFingerprint = stableStringify({
      story_id: storyId,
      node_id: request.node_id,
      option_id: request.option_id,
      client_action_id: request.client_action_id,
      version: request.version,
    })
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
      'This older story has no validated numeric-state rules and cannot be continued.',
      409,
    )
    assertStory(
      current.version === request.version,
      'VERSION_CONFLICT',
      'The story was updated by another request.',
      409,
    )
    assertStory(
      current.current_node_id === request.node_id,
      'NODE_CONFLICT',
      `The current story node is ${current.current_node_id}.`,
      409,
    )

    const options = resolveOptionsForNode(current, current.current_node_id)
    const option = options.find((item) => item.option_id === request.option_id)
    assertStory(option, 'OPTION_NOT_FOUND', 'The option is not valid for the current node.', 400)
    const action = choiceAction(request, option)
    const transition = applyStoryOption(current.story_state, option, action)
    const idempotencyKey = [
      storyId,
      request.node_id,
      request.option_id,
      request.client_action_id,
    ].join(':')
    const generationRecord = {
      generation_id: id(),
      idempotency_key: idempotencyKey,
      story_id: storyId,
      node_id: request.node_id,
      option_id: request.option_id,
      client_action_id: request.client_action_id,
      request_fingerprint: requestFingerprint,
      expected_version: request.version,
      status: 'pending',
      state_before: transition.before,
      option_snapshot: option,
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

    try {
      const existingStages = await this.repository.getStages(storyId)
      const previousHandoff = latestContinuityHandoff(existingStages)
      const currentNode = findOutlineNode(current.story_outline, current.current_node_id)
      const continueContext = buildContinueContext({
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
      const publicAction = publicChoiceAction(request, option)
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
        })
        const knowledgeGenerated = await this.generateValidated(
          TASK_TYPE.KNOWLEDGE_REVEAL,
          knowledgeContext,
          validateKnowledgeReveal,
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
      const interaction = storyChoiceInteraction({
        story,
        request,
        option,
        transition,
        idempotencyKey,
        now,
      })
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
    if (request.action_type === ACTION_TYPE.STORY_OPTION_SELECT) {
      return this.advanceStoryOption(storyId, request, now)
    }
    return this.advanceProductAction(storyId, request, now)
  }
}
