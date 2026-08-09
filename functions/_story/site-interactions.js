import {
  StoryError,
  assertStory,
} from './constants.js'
import {
  getMaterialOption,
} from './config/materials.js'
import { getMission } from './config/missions.js'
import {
  materialControlId,
  resolveMaterialStoryBinding,
} from './config/material-story-bindings.js'
import {
  MISSION_CANDIDATE_SECTION_ID,
  missionControlId,
  resolveMissionStoryBinding,
} from './config/mission-story-bindings.js'
import {
  resolveNodeInteractionConfig,
  STORY_INTERACTION_MODE,
} from './config/node-interactions.js'
import {
  applySiteInteraction,
  cloneState,
} from './state-reducer.js'
import { StoryStateDeltaSchema } from './schemas.js'

function zeroDelta() {
  return {
    event_integrity: 0,
    relationship_connection: 0,
    uncertainty: 0,
  }
}

function aggregateDeltas(bindings) {
  return StoryStateDeltaSchema.parse(bindings.reduce((total, binding) => ({
    event_integrity: total.event_integrity + binding.state_delta.event_integrity,
    relationship_connection:
      total.relationship_connection + binding.state_delta.relationship_connection,
    uncertainty: total.uncertainty + binding.state_delta.uncertainty,
  }), zeroDelta()))
}

export function aggregateSiteConsequences(bindings) {
  const add = new Set(bindings.flatMap((binding) => binding.add_consequence_ids))
  const resolve = new Set(bindings.flatMap((binding) => binding.resolve_consequence_ids))
  const conflicts = [...add].filter((consequenceId) => resolve.has(consequenceId))
  if (conflicts.length > 0) {
    throw new StoryError(
      'SITE_INTERACTION_CONFIG_CONFLICT',
      'A site interaction cannot add and resolve the same consequence.',
      500,
      [{ consequence_ids: conflicts }],
    )
  }
  return {
    add: [...add],
    resolve: [...resolve],
  }
}

function aggregateMaterialRisk(materials) {
  const risks = new Set(materials.map((material) => material.technical_effect.reentry_risk))
  return risks.size === 1 ? [...risks][0] : 'mixed'
}

function resolveMaterialInteractions(request, nodeConfig) {
  assertStory(
    request.module_id === nodeConfig.module_id,
    'INVALID_NODE_INTERACTION_MODE',
    `Node ${request.node_id} does not accept interactions from ${request.module_id}.`,
    409,
  )
  const expectedSections = nodeConfig.required_sections
  const receivedSections = request.interactions.map((item) => item.section_id)
  if (new Set(receivedSections).size !== receivedSections.length) {
    throw new StoryError(
      'SITE_SECTION_DUPLICATED',
      'Each required site section may be submitted only once.',
      400,
    )
  }
  const missingSections = expectedSections.filter(
    (sectionId) => !receivedSections.includes(sectionId),
  )
  if (missingSections.length > 0 || request.interactions.length !== expectedSections.length) {
    throw new StoryError(
      'SITE_SECTION_MISSING',
      'The site interaction does not cover every required section.',
      400,
      [{ missing_sections: missingSections, expected_sections: expectedSections }],
    )
  }
  const bySection = Object.fromEntries(
    request.interactions.map((item) => [item.section_id, item]),
  )
  return expectedSections.map((sectionId) => {
    const item = bySection[sectionId]
    const material = getMaterialOption(sectionId, item.option_id)
    if (!material) {
      throw new StoryError(
        'SITE_OPTION_NOT_IN_SECTION',
        `${item.option_id} does not belong to ${sectionId}.`,
        400,
      )
    }
    if (item.control_id !== materialControlId(sectionId, item.option_id)) {
      throw new StoryError(
        'SITE_CONTROL_NOT_FOUND',
        `No site control matches ${item.control_id}.`,
        400,
      )
    }
    const binding = resolveMaterialStoryBinding({
      moduleId: request.module_id,
      sectionId,
      controlId: item.control_id,
      optionId: item.option_id,
    })
    if (!binding) {
      throw new StoryError(
        'SITE_INTERACTION_CONFIG_CONFLICT',
        `No story binding exists for ${sectionId}/${item.option_id}.`,
        500,
      )
    }
    return { binding, material }
  })
}

function resolveMissionInteractions(request, nodeConfig) {
  assertStory(
    request.module_id === nodeConfig.module_id,
    'INVALID_NODE_INTERACTION_MODE',
    `Node ${request.node_id} does not accept interactions from ${request.module_id}.`,
    409,
  )
  if (request.interactions.length !== 1) {
    throw new StoryError(
      'TASK_SELECTION_REQUIRED',
      'Exactly one mission candidate must be selected.',
      400,
    )
  }
  const [item] = request.interactions
  if (
    item.section_id !== MISSION_CANDIDATE_SECTION_ID
    || !nodeConfig.required_sections.includes(item.section_id)
  ) {
    throw new StoryError(
      'TASK_NOT_IN_CANDIDATE_GROUP',
      'The submitted task is not in the configured mission candidate group.',
      400,
    )
  }
  const mission = getMission(item.option_id)
  if (!mission) {
    throw new StoryError('TASK_NOT_FOUND', 'The selected mission does not exist.', 400)
  }
  if (item.control_id !== missionControlId(mission.action_id)) {
    throw new StoryError(
      'TASK_CONTROL_MISMATCH',
      'The mission control does not match the selected task.',
      400,
    )
  }
  const binding = resolveMissionStoryBinding({
    moduleId: request.module_id,
    sectionId: item.section_id,
    controlId: item.control_id,
    taskId: item.option_id,
  })
  if (!binding) {
    throw new StoryError(
      'SITE_INTERACTION_CONFIG_CONFLICT',
      `No story binding exists for mission ${item.option_id}.`,
      500,
    )
  }
  return [{ binding, mission }]
}

function resolveItems(request, nodeConfig) {
  if (nodeConfig.interaction_mode === STORY_INTERACTION_MODE.SITE_COMPOSITE) {
    return resolveMaterialInteractions(request, nodeConfig)
  }
  if (nodeConfig.interaction_mode === STORY_INTERACTION_MODE.SITE_GROUP_SINGLE) {
    return resolveMissionInteractions(request, nodeConfig)
  }
  throw new StoryError(
    'INVALID_NODE_INTERACTION_MODE',
    `Interaction mode ${nodeConfig.interaction_mode} is not supported by this resolver.`,
    409,
  )
}

function applyBusinessGameState(story, nodeConfig, resolvedItems) {
  const gameState = cloneState(story.game_state)
  if (nodeConfig.interaction_mode === STORY_INTERACTION_MODE.SITE_COMPOSITE) {
    const materials = resolvedItems.map((item) => item.material)
    gameState.satellite_build.materials = Object.fromEntries(
      materials.map((material) => [material.component_id, material.option_id]),
    )
    gameState.technical_metrics.reentry_risk = aggregateMaterialRisk(materials)
    return gameState
  }
  if (nodeConfig.interaction_mode === STORY_INTERACTION_MODE.SITE_GROUP_SINGLE) {
    const [{ mission }] = resolvedItems
    gameState.mission = {
      mission_id: mission.mission_id,
      action_id: mission.action_id,
    }
    return gameState
  }
  return gameState
}

export function resolveSiteInteractionCommit(story, request, now) {
  const nodeConfig = resolveNodeInteractionConfig(story.current_node_id)
  assertStory(
    nodeConfig?.interaction_mode?.startsWith('SITE_'),
    'INVALID_NODE_INTERACTION_MODE',
    `Node ${story.current_node_id} does not accept a site interaction.`,
    409,
  )
  assertStory(
    story.current_node_id === request.node_id,
    'NODE_CONFLICT',
    `The current story node is ${story.current_node_id}.`,
    409,
  )
  assertStory(
    story.current_checkpoint === nodeConfig.checkpoint,
    'INVALID_CHECKPOINT',
    `Action is not valid at checkpoint ${story.current_checkpoint}.`,
    409,
  )

  const resolvedItems = resolveItems(request, nodeConfig)
  const bindings = resolvedItems.map((item) => item.binding)
  const selectedAt = new Date(now).toISOString()
  const snapshots = bindings.map((binding) => ({
    binding_id: binding.binding_id,
    module_id: binding.module_id,
    section_id: binding.section_id,
    section_name: binding.display_snapshot.section_name,
    control_id: binding.control_id,
    option_id: binding.option_id,
    option_name: binding.display_snapshot.option_name,
    ...(binding.task_id ? {
      task_id: binding.task_id,
      task_name: binding.task_name,
    } : {}),
    target_node_id: binding.target_node_id,
    effect_summary: binding.effect_summary,
    state_delta: cloneState(binding.state_delta),
    add_consequence_ids: cloneState(binding.add_consequence_ids),
    resolve_consequence_ids: cloneState(binding.resolve_consequence_ids),
    key_outcome: binding.key_outcome || '',
    knowledge_profile: cloneState(binding.knowledge_profile),
    ...(binding.task_profile ? { task_profile: cloneState(binding.task_profile) } : {}),
    selected_at: selectedAt,
  }))
  const outcomes = snapshots
    .filter((snapshot) => snapshot.key_outcome)
    .map((snapshot) => ({
      module_id: snapshot.module_id,
      section_id: snapshot.section_id,
      control_id: snapshot.control_id,
      option_id: snapshot.option_id,
      option_name: snapshot.option_name,
      outcome: snapshot.key_outcome,
    }))
  const combinedDelta = aggregateDeltas(bindings)
  const consequences = aggregateSiteConsequences(bindings)
  const action = {
    node_id: request.node_id,
    module_id: request.module_id,
    interaction_mode: nodeConfig.interaction_mode,
    client_action_id: request.client_action_id,
  }
  const transition = applySiteInteraction({
    runtimeState: story.story_state,
    snapshots,
    combinedDelta,
    addConsequenceIds: consequences.add,
    resolveConsequenceIds: consequences.resolve,
    outcomes,
    action,
  })
  const gameState = applyBusinessGameState(story, nodeConfig, resolvedItems)

  return {
    nodeConfig,
    snapshots,
    outcomes,
    transition,
    add_consequence_ids: consequences.add,
    resolve_consequence_ids: consequences.resolve,
    gameState,
    nextCheckpoint: nodeConfig.next_checkpoint,
  }
}
