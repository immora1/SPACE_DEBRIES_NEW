import {
  ACTION_TYPE,
  CHECKPOINT,
  PRODUCT_MODULE,
  TOTAL_CLEANUP_PAIRS,
  TOTAL_ORBITAL_EVENTS,
  StoryError,
  assertStory,
} from './constants.js'
import {
  MATERIAL_COMPONENTS,
  getMaterialOption,
} from './config/materials.js'
import { getMission } from './config/missions.js'
import { getOrbitalEventOption } from './config/orbital-events.js'
import { getCleanupPair } from './config/cleanup-pairs.js'
import {
  applyTechnicalMetrics,
  cloneState,
} from './state-reducer.js'

function validateCheckpoint(story, checkpoint) {
  assertStory(
    story.current_checkpoint === checkpoint,
    'INVALID_CHECKPOINT',
    `Action is not valid at checkpoint ${story.current_checkpoint}.`,
    409,
  )
}

function aggregateMaterialRisk(options) {
  const risks = new Set(options.map((item) => item.technical_effect.reentry_risk))
  return risks.size === 1 ? [...risks][0] : 'mixed'
}

function interaction(module, sourceId, actionId, label, technicalEffect, narrativeEffect) {
  return {
    module,
    source_id: sourceId,
    action_id: actionId,
    label,
    technical_effect: technicalEffect,
    narrative_effect: narrativeEffect,
    client_action_id: null,
    idempotency_key: null,
    state_before: null,
    state_delta: null,
    state_after: null,
    add_consequence_ids: [],
    resolve_consequence_ids: [],
    key_outcome: '',
  }
}

function resolveMaterials(story, request) {
  validateCheckpoint(story, CHECKPOINT.MATERIALS)
  assertStory(request.source_id === 'satellite_build', 'INVALID_SOURCE', 'Invalid material source.')
  assertStory(request.action_id === 'materials_commit', 'INVALID_ACTION', 'Invalid material action.')
  const selections = request.payload.selections
  assertStory(
    selections && typeof selections === 'object' && !Array.isArray(selections),
    'INVALID_MATERIALS',
    'Material selections are required.',
  )
  const selected = MATERIAL_COMPONENTS.map((componentId) => {
    const material = getMaterialOption(componentId, selections[componentId])
    assertStory(material, 'INVALID_ACTION', `Invalid material for ${componentId}.`)
    return material
  })
  assertStory(
    Object.keys(selections).every((key) => MATERIAL_COMPONENTS.includes(key)),
    'INVALID_MATERIALS',
    'Unknown material component.',
  )
  const gameState = cloneState(story.game_state)
  gameState.satellite_build.materials = Object.fromEntries(
    selected.map((item) => [item.component_id, item.option_id]),
  )
  gameState.technical_metrics.reentry_risk = aggregateMaterialRisk(selected)
  const technicalEffect = selected.map((item) => ({
    component_id: item.component_id,
    option_id: item.option_id,
    ...item.technical_effect,
  }))
  return {
    gameState,
    nextCheckpoint: CHECKPOINT.MISSION,
    interaction: interaction(
      PRODUCT_MODULE.MATERIALS,
      request.source_id,
      request.action_id,
      selected.map((item) => item.label).join('、'),
      technicalEffect,
      selected.map((item) => item.narrative_effect),
    ),
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
  return {
    gameState,
    nextCheckpoint: CHECKPOINT.ORBITAL_EVENTS,
    interaction: interaction(
      PRODUCT_MODULE.MISSION,
      request.source_id,
      request.action_id,
      mission.label,
      {
        mission_id: mission.mission_id,
        anomaly_type: mission.anomaly_type,
        orbit: mission.orbit,
      },
      null,
    ),
  }
}

function resolveOrbitalEvent(story, request) {
  validateCheckpoint(story, CHECKPOINT.ORBITAL_EVENTS)
  const resolved = getOrbitalEventOption(request.source_id, request.action_id)
  assertStory(resolved, 'INVALID_ACTION', 'Unknown orbital event option.')
  assertStory(
    !story.game_state.orbital_events.resolved.some(
      (item) => item.event_id === request.source_id,
    ),
    'ACTION_ALREADY_RESOLVED',
    'This orbital event was already resolved.',
    409,
  )
  const gameState = applyTechnicalMetrics(
    story.game_state,
    resolved.option.technical_effect,
  )
  gameState.orbital_events.resolved.push({
    event_id: resolved.event.id,
    action_id: resolved.option.id,
    outcome: resolved.option.outcome,
  })
  const complete = gameState.orbital_events.resolved.length >= TOTAL_ORBITAL_EVENTS
  return {
    gameState,
    nextCheckpoint: complete ? CHECKPOINT.CLEANUP : CHECKPOINT.ORBITAL_EVENTS,
    interaction: interaction(
      PRODUCT_MODULE.ORBITAL_EVENTS,
      request.source_id,
      request.action_id,
      `${resolved.event.title}：${resolved.option.label}`,
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
    !story.game_state.cleanup_test.matches.some(
      (item) => item.target_id === pair.target_id,
    ),
    'ACTION_ALREADY_RESOLVED',
    'This cleanup target was already resolved.',
    409,
  )
  const gameState = cloneState(story.game_state)
  gameState.cleanup_test.matches.push({
    target_id: pair.target_id,
    method_id: pair.method_id,
  })
  const complete = gameState.cleanup_test.matches.length >= TOTAL_CLEANUP_PAIRS
  return {
    gameState,
    nextCheckpoint: complete ? CHECKPOINT.COMPLETED : CHECKPOINT.CLEANUP,
    interaction: interaction(
      PRODUCT_MODULE.CLEANUP,
      pair.target_id,
      pair.method_id,
      `${pair.method_label} → ${pair.target_label}`,
      pair.technical_effect,
      pair.narrative_effect,
    ),
  }
}

export function resolveProductAction(story, request) {
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
      throw new StoryError('INVALID_ACTION_TYPE', 'Unsupported product action.')
  }
}

