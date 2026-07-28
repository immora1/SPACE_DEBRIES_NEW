import {
  ACTION_TYPE,
  CHECKPOINT,
  PRODUCT_MODULE,
  STORY_EXPIRY_MS,
  STORY_STATUS,
  TASK_TYPE,
  TOTAL_CLEANUP_PAIRS,
  TOTAL_ORBITAL_EVENTS,
  StoryError,
  assertStory,
} from './constants.js'
import {
  CreateStoryRequestSchema,
  StoryActionRequestSchema,
  StoryUserInputSchema,
} from './schemas.js'
import {
  applyFixedNarrativeEffect,
  applyStoryStatePatch,
  applyTechnicalMetrics,
  cloneState,
  createInitialGameState,
  normalizeStoryState,
} from './state-reducer.js'
import { buildStageContract } from './stage-contract.js'
import { toPublicStoryDTO } from './public-dto.js'
import {
  MATERIAL_COMPONENTS,
  getMaterialOption,
} from './config/materials.js'
import { getMission } from './config/missions.js'
import { getOrbitalEventOption } from './config/orbital-events.js'
import { getCleanupPair } from './config/cleanup-pairs.js'

function id() {
  return globalThis.crypto.randomUUID()
}

function parse(schema, value, code = 'INVALID_INPUT') {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  throw new StoryError(code, 'Request validation failed.', 400, parsed.error.issues)
}

function publicAction(module, sourceId, actionId, label) {
  return {
    module,
    source_id: sourceId,
    action_id: actionId,
    label,
  }
}

function aggregateMaterialRisk(options) {
  const risks = new Set(options.map((item) => item.technical_effect.reentry_risk))
  if (risks.size === 1) return [...risks][0]
  return 'mixed'
}

function fixedEffectSummary(technicalEffect, narrativeEffect) {
  return {
    technical_effect: technicalEffect,
    narrative_effect: narrativeEffect,
  }
}

function validateCheckpoint(story, checkpoint) {
  assertStory(
    story.current_checkpoint === checkpoint,
    'INVALID_CHECKPOINT',
    `Action is not valid at checkpoint ${story.current_checkpoint}.`,
    409,
  )
}

function resolveMaterials(story, request) {
  validateCheckpoint(story, CHECKPOINT.MATERIALS)
  assertStory(request.source_id === 'satellite_build', 'INVALID_SOURCE', 'Invalid material source.')
  assertStory(request.action_id === 'materials_commit', 'INVALID_ACTION', 'Invalid material action.')
  const selections = request.payload.selections
  assertStory(selections && typeof selections === 'object' && !Array.isArray(selections), 'INVALID_MATERIALS', 'Material selections are required.')

  const selectedOptions = MATERIAL_COMPONENTS.map((componentId) => {
    const selected = getMaterialOption(componentId, selections[componentId])
    assertStory(selected, 'INVALID_ACTION', `Invalid material for ${componentId}.`)
    return selected
  })
  assertStory(
    Object.keys(selections).every((key) => MATERIAL_COMPONENTS.includes(key)),
    'INVALID_MATERIALS',
    'Unknown material component.',
  )

  const gameState = cloneState(story.game_state)
  gameState.satellite_build.materials = Object.fromEntries(
    selectedOptions.map((item) => [item.component_id, item.option_id]),
  )
  gameState.technical_metrics.reentry_risk = aggregateMaterialRisk(selectedOptions)

  const action = publicAction(
    PRODUCT_MODULE.MATERIALS,
    request.source_id,
    request.action_id,
    selectedOptions.map((item) => item.label).join('、'),
  )
  let storyState = cloneState(story.story_state)
  for (const item of selectedOptions) {
    storyState = applyFixedNarrativeEffect(storyState, item.narrative_effect, action)
  }
  const technicalEffect = selectedOptions.map((item) => ({
    component_id: item.component_id,
    option_id: item.option_id,
    ...item.technical_effect,
  }))
  const narrativeEffect = selectedOptions.map((item) => item.narrative_effect)

  return {
    taskType: TASK_TYPE.CONTINUE,
    nextCheckpoint: CHECKPOINT.MISSION,
    gameState,
    storyState,
    action,
    interaction: {
      module: PRODUCT_MODULE.MATERIALS,
      source_id: request.source_id,
      action_id: request.action_id,
      label: action.label,
      technical_effect: technicalEffect,
      narrative_effect: narrativeEffect,
    },
    fixedEffect: fixedEffectSummary(technicalEffect, narrativeEffect),
  }
}

function resolveMission(story, request) {
  validateCheckpoint(story, CHECKPOINT.MISSION)
  assertStory(request.source_id === 'mission', 'INVALID_SOURCE', 'Invalid mission source.')
  const mission = getMission(request.action_id)
  assertStory(mission, 'INVALID_ACTION', 'Unknown mission.')

  const gameState = cloneState(story.game_state)
  gameState.mission = {
    mission_id: mission.mission_id,
    action_id: mission.action_id,
  }
  const action = publicAction(
    PRODUCT_MODULE.MISSION,
    request.source_id,
    request.action_id,
    mission.label,
  )
  const narrativeEffect = {
    add_confirmed_fact: `卫星的主任务被确定为${mission.label}。`,
    add_story_tag: `mission_${mission.action_id}`,
    add_hidden_fact: `故事异常机制受${mission.anomaly_type}约束。`,
  }
  const storyState = applyFixedNarrativeEffect(story.story_state, narrativeEffect, action)
  const technicalEffect = {
    mission_id: mission.mission_id,
    anomaly_type: mission.anomaly_type,
    orbit: mission.orbit,
  }

  return {
    taskType: TASK_TYPE.OPENING,
    nextCheckpoint: CHECKPOINT.ORBITAL_EVENTS,
    gameState,
    storyState,
    action,
    interaction: {
      module: PRODUCT_MODULE.MISSION,
      source_id: request.source_id,
      action_id: request.action_id,
      label: mission.label,
      technical_effect: technicalEffect,
      narrative_effect: narrativeEffect,
    },
    fixedEffect: fixedEffectSummary(technicalEffect, narrativeEffect),
  }
}

function resolveOrbitalEvent(story, request) {
  validateCheckpoint(story, CHECKPOINT.ORBITAL_EVENTS)
  const resolved = getOrbitalEventOption(request.source_id, request.action_id)
  assertStory(resolved, 'INVALID_ACTION', 'Unknown orbital event option.')
  assertStory(
    !story.game_state.orbital_events.resolved.some((item) => item.event_id === request.source_id),
    'ACTION_ALREADY_RESOLVED',
    'This orbital event was already resolved.',
    409,
  )

  let gameState = applyTechnicalMetrics(story.game_state, resolved.option.technical_effect)
  gameState.orbital_events.resolved.push({
    event_id: resolved.event.id,
    action_id: resolved.option.id,
    outcome: resolved.option.outcome,
  })
  const action = publicAction(
    PRODUCT_MODULE.ORBITAL_EVENTS,
    request.source_id,
    request.action_id,
    `${resolved.event.title}：${resolved.option.label}`,
  )
  const storyState = applyFixedNarrativeEffect(
    story.story_state,
    resolved.option.narrative_effect,
    action,
  )
  const complete = gameState.orbital_events.resolved.length >= TOTAL_ORBITAL_EVENTS

  return {
    taskType: TASK_TYPE.CONTINUE,
    nextCheckpoint: complete ? CHECKPOINT.CLEANUP : CHECKPOINT.ORBITAL_EVENTS,
    gameState,
    storyState,
    action,
    interaction: {
      module: PRODUCT_MODULE.ORBITAL_EVENTS,
      source_id: request.source_id,
      action_id: request.action_id,
      label: action.label,
      technical_effect: resolved.option.technical_effect,
      narrative_effect: resolved.option.narrative_effect,
    },
    fixedEffect: fixedEffectSummary(
      resolved.option.technical_effect,
      resolved.option.narrative_effect,
    ),
  }
}

function resolveCleanupPair(story, request) {
  validateCheckpoint(story, CHECKPOINT.CLEANUP)
  const pair = getCleanupPair(
    request.source_id,
    request.action_id,
    request.payload.ui_target_id,
  )
  assertStory(pair, 'INVALID_ACTION', 'Cleanup method does not match this target.')
  assertStory(
    !story.game_state.cleanup_test.matches.some((item) => item.target_id === pair.target_id),
    'ACTION_ALREADY_RESOLVED',
    'This cleanup target was already resolved.',
    409,
  )

  const gameState = cloneState(story.game_state)
  gameState.cleanup_test.matches.push({
    target_id: pair.target_id,
    method_id: pair.method_id,
  })
  const action = publicAction(
    PRODUCT_MODULE.CLEANUP,
    pair.target_id,
    pair.method_id,
    `${pair.method_label} → ${pair.target_label}`,
  )
  const storyState = applyFixedNarrativeEffect(story.story_state, pair.narrative_effect, action)

  return {
    taskType: TASK_TYPE.CONTINUE,
    nextCheckpoint: CHECKPOINT.CLEANUP,
    gameState,
    storyState,
    action,
    cleanupComplete: gameState.cleanup_test.matches.length >= TOTAL_CLEANUP_PAIRS,
    interaction: {
      module: PRODUCT_MODULE.CLEANUP,
      source_id: pair.target_id,
      action_id: pair.method_id,
      label: action.label,
      technical_effect: pair.technical_effect,
      narrative_effect: pair.narrative_effect,
    },
    fixedEffect: fixedEffectSummary(pair.technical_effect, pair.narrative_effect),
  }
}

function resolveAction(story, request) {
  switch (request.action_type) {
    case ACTION_TYPE.MATERIALS_COMMIT:
      return resolveMaterials(story, request)
    case ACTION_TYPE.MISSION_SELECT:
      return resolveMission(story, request)
    case ACTION_TYPE.ORBITAL_EVENT_RESOLVE:
      return resolveOrbitalEvent(story, request)
    case ACTION_TYPE.CLEANUP_PAIR_SUBMIT:
      return resolveCleanupPair(story, request)
    default:
      throw new StoryError('INVALID_ACTION_TYPE', 'Unsupported action type.')
  }
}

function createStage({
  story,
  output,
  inputAction,
  stateBefore,
  stateAfter,
  createdAt,
}) {
  return {
    stage_id: id(),
    story_id: story.story_id,
    stage_index: story.current_stage_index + 1,
    task_type: output.task_type,
    node_id: output.node_id,
    checkpoint: output.checkpoint,
    input_action: inputAction,
    display_content: output.display_content,
    stage_summary: output.stage_summary,
    state_before: stateBefore,
    state_after: stateAfter,
    created_at_ms: createdAt,
  }
}

export class StoryService {
  constructor({ repository, generateStage, clock = () => Date.now() }) {
    this.repository = repository
    this.generateStage = generateStage
    this.clock = clock
  }

  async createStory(rawRequest) {
    const request = parse(CreateStoryRequestSchema, rawRequest)
    const now = this.clock()
    await this.repository.cleanupExpiredStories(now)

    const storyId = id()
    const sessionId = request.session_id || id()
    const userInput = StoryUserInputSchema.parse({
      nickname: request.nickname,
      city: request.city,
      important_event: request.important_event,
      submitted_at_ms: now,
    })
    const gameState = createInitialGameState({
      satellite: request.satellite,
      damageLevel: request.game_context.damage_level,
    })
    const outlineContract = {
      task_type: TASK_TYPE.OUTLINE,
      story_id: storyId,
      language: request.language,
      user_input: {
        nickname: userInput.nickname,
        important_event: userInput.important_event,
      },
      satellite: request.satellite,
      game_context: request.game_context,
    }
    const outlineOutput = await this.generateStage(TASK_TYPE.OUTLINE, outlineContract)
    const storyState = normalizeStoryState(outlineOutput.initial_story_state)
    const firstNode = outlineOutput.story_outline.nodes[0]
    const outlineStage = {
      stage_id: id(),
      story_id: storyId,
      stage_index: 0,
      task_type: TASK_TYPE.OUTLINE,
      node_id: firstNode.id,
      checkpoint: CHECKPOINT.MATERIALS,
      input_action: publicAction(
        PRODUCT_MODULE.IDENTITY,
        'identity_form',
        'create_story',
        `${userInput.nickname}提交了一件重要的事`,
      ),
      display_content: {
        story_text: `故事坐标已经建立：${outlineOutput.story_outline.extracted_event.core_event}`,
        choices: [],
      },
      stage_summary: `已提取用户重要事件并建立${outlineOutput.story_outline.nodes.length}个叙事节点。`,
      state_before: storyState,
      state_after: storyState,
      created_at_ms: now,
    }
    const story = {
      story_id: storyId,
      session_id: sessionId,
      display_label: userInput.nickname,
      version: 0,
      status: STORY_STATUS.IN_PROGRESS,
      current_stage_index: 0,
      current_node_id: firstNode.id,
      current_checkpoint: CHECKPOINT.MATERIALS,
      user_input: userInput,
      story_outline: outlineOutput.story_outline,
      story_state: storyState,
      game_state: gameState,
      final_story: null,
      created_at_ms: now,
      last_activity_at_ms: now,
      expires_at_ms: now + STORY_EXPIRY_MS,
      completed_at_ms: null,
    }

    await this.repository.createStory(story, [outlineStage])
    return toPublicStoryDTO(story, [outlineStage])
  }

  async getStory(storyId, sessionId) {
    const now = this.clock()
    await this.repository.cleanupExpiredStories(now)
    const story = await this.repository.getStory(storyId, sessionId)
    assertStory(story, 'STORY_NOT_FOUND', 'Story not found.', 404)
    const stages = await this.repository.getStages(storyId)
    return toPublicStoryDTO(story, stages)
  }

  async generateAndApply({
    story,
    taskType,
    action,
    fixedEffect,
    nextCheckpoint,
    createdAt,
  }) {
    const stateBefore = cloneState(story.story_state)
    const stageContract = buildStageContract({
      story,
      taskType,
      action,
      fixedEffect,
      nextCheckpoint,
    })
    const output = await this.generateStage(taskType, stageContract)
    assertStory(
      output.checkpoint === nextCheckpoint,
      'AI_INVALID_OUTPUT',
      'AI returned an invalid checkpoint.',
      502,
    )
    const stateAfter = applyStoryStatePatch(story.story_state, output.story_state_patch)
    const stage = createStage({
      story,
      output,
      inputAction: action,
      stateBefore,
      stateAfter,
      createdAt,
    })
    story.story_state = stateAfter
    story.current_stage_index = stage.stage_index
    story.current_node_id = output.next_node_id || output.node_id
    story.current_checkpoint = nextCheckpoint
    return stage
  }

  async advanceStory(storyId, rawRequest) {
    const request = parse(StoryActionRequestSchema, rawRequest)
    const now = this.clock()
    await this.repository.cleanupExpiredStories(now)
    const current = await this.repository.getStory(storyId, request.session_id)
    assertStory(current, 'STORY_NOT_FOUND', 'Story not found.', 404)
    assertStory(current.status === STORY_STATUS.IN_PROGRESS, 'STORY_NOT_ACTIVE', 'Story is not active.', 409)
    assertStory(
      current.version === request.version,
      'VERSION_CONFLICT',
      'The story was updated by another request.',
      409,
    )

    const actionResolution = resolveAction(current, request)
    const story = cloneState(current)
    story.game_state = actionResolution.gameState
    story.story_state = actionResolution.storyState
    const stages = []
    stages.push(await this.generateAndApply({
      story,
      taskType: actionResolution.taskType,
      action: actionResolution.action,
      fixedEffect: actionResolution.fixedEffect,
      nextCheckpoint: actionResolution.nextCheckpoint,
      createdAt: now,
    }))

    if (actionResolution.cleanupComplete) {
      stages.push(await this.generateAndApply({
        story,
        taskType: TASK_TYPE.ENDING,
        action: actionResolution.action,
        fixedEffect: {
          phase: 'ending',
          cumulative_game_state: story.game_state,
        },
        nextCheckpoint: CHECKPOINT.CLEANUP,
        createdAt: now + 1,
      }))
      stages.push(await this.generateAndApply({
        story,
        taskType: TASK_TYPE.KNOWLEDGE_REVEAL,
        action: actionResolution.action,
        fixedEffect: {
          phase: 'knowledge_reveal',
          cumulative_game_state: story.game_state,
        },
        nextCheckpoint: CHECKPOINT.COMPLETED,
        createdAt: now + 2,
      }))
      story.status = STORY_STATUS.COMPLETED
      story.completed_at_ms = now
      story.expires_at_ms = null
      story.final_story = {
        ending_stage_id: stages.at(-2).stage_id,
        knowledge_reveal_stage_id: stages.at(-1).stage_id,
      }
    } else {
      story.expires_at_ms = now + STORY_EXPIRY_MS
    }

    story.version = current.version + 1
    story.last_activity_at_ms = now
    const interaction = {
      interaction_id: id(),
      story_id: story.story_id,
      ...actionResolution.interaction,
      created_at_ms: now,
    }

    await this.repository.commitAdvance({
      story,
      expectedVersion: current.version,
      interaction,
      stages,
    })
    const previousStages = await this.repository.getStages(storyId)
    return toPublicStoryDTO(story, previousStages)
  }
}
