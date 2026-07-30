import { StoryError } from './constants.js'
import {
  GameStateSchema,
  RuntimeStoryStateSchema,
  StoryMetricsSchema,
  StoryOptionSchema,
  StoryStateDeltaSchema,
} from './schemas.js'

export function cloneState(value) {
  return structuredClone(value)
}

export function clampMetric(value) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

function normalizedFact(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

export function appendUniqueFacts(existing, additions) {
  const seen = new Set(existing.map(normalizedFact))
  const merged = [...existing]
  for (const addition of additions) {
    const normalized = normalizedFact(addition)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    merged.push(addition.trim())
  }
  return merged
}

export function createRuntimeStoryState(initialStoryState) {
  return RuntimeStoryStateSchema.parse({
    ...cloneState(initialStoryState),
    key_outcomes: [],
  })
}

export function applyOpeningOutput(runtimeState, validatedAdditions) {
  const before = RuntimeStoryStateSchema.parse(cloneState(runtimeState))
  if (before.current_node_id !== 'node_01') {
    throw new StoryError(
      'OPENING_STATE_INVALID',
      'Opening can only be applied while current_node_id is node_01.',
      409,
    )
  }

  const after = RuntimeStoryStateSchema.parse({
    ...cloneState(before),
    known_to_user: appendUniqueFacts(before.known_to_user, validatedAdditions),
    current_node_id: 'node_02',
  })

  for (const field of [
    'confirmed_facts',
    'hidden_facts',
    'event_integrity',
    'relationship_connection',
    'uncertainty',
    'active_consequences',
    'key_outcomes',
    'last_user_action',
  ]) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      throw new StoryError(
        'OPENING_STATE_MUTATION_INVALID',
        `Opening must not modify story_state.${field}.`,
        500,
      )
    }
  }

  return { before, after }
}

export function storyMetrics(storyState) {
  return StoryMetricsSchema.parse({
    event_integrity: storyState.event_integrity,
    relationship_connection: storyState.relationship_connection,
    uncertainty: storyState.uncertainty,
  })
}

export function applyStateDelta(before, rawDelta) {
  const metrics = StoryMetricsSchema.parse(cloneState(before))
  const delta = StoryStateDeltaSchema.parse(cloneState(rawDelta))
  return StoryMetricsSchema.parse({
    event_integrity: clampMetric(metrics.event_integrity + delta.event_integrity),
    relationship_connection: clampMetric(
      metrics.relationship_connection + delta.relationship_connection,
    ),
    uncertainty: clampMetric(metrics.uncertainty + delta.uncertainty),
  })
}

function updateConsequenceIds(activeIds, addIds, resolveIds) {
  const resolved = new Set(resolveIds)
  return [...new Set([
    ...activeIds.filter((consequenceId) => !resolved.has(consequenceId)),
    ...addIds,
  ])]
}

export function applyStoryOption(runtimeState, rawOption, action) {
  const beforeState = RuntimeStoryStateSchema.parse(cloneState(runtimeState))
  const option = StoryOptionSchema.parse(cloneState(rawOption))
  const before = storyMetrics(beforeState)
  const after = applyStateDelta(before, option.state_delta)
  const next = RuntimeStoryStateSchema.parse({
    ...cloneState(beforeState),
    ...after,
    active_consequences: updateConsequenceIds(
      beforeState.active_consequences,
      option.add_consequence_ids,
      option.resolve_consequence_ids,
    ),
    key_outcomes: option.key_outcome
      ? appendUniqueFacts(beforeState.key_outcomes, [option.key_outcome])
      : beforeState.key_outcomes,
    last_user_action: cloneState(action),
  })

  return {
    before,
    delta: cloneState(option.state_delta),
    after,
    state: next,
  }
}

export function applyNarrativeOutput(runtimeState, additions, nextNodeId) {
  const before = RuntimeStoryStateSchema.parse(cloneState(runtimeState))
  return RuntimeStoryStateSchema.parse({
    ...cloneState(before),
    known_to_user: appendUniqueFacts(before.known_to_user, additions),
    current_node_id: nextNodeId,
  })
}

export function createInitialGameState({ satellite, damageLevel = 0 }) {
  return GameStateSchema.parse({
    satellite_build: {
      satellite: satellite || {},
      materials: {},
    },
    mission: {
      mission_id: null,
      action_id: null,
    },
    orbital_events: {
      resolved: [],
    },
    cleanup_test: {
      matches: [],
    },
    technical_metrics: {
      armor: clampMetric(Math.max(45, Math.round(100 - Number(damageLevel || 0) * 0.7))),
      fuel: 100,
      mission_progress: 0,
      reentry_risk: 'mixed',
    },
  })
}

export function applyTechnicalMetrics(gameState, technicalEffect) {
  const next = cloneState(gameState)
  next.technical_metrics.armor = clampMetric(
    next.technical_metrics.armor + Number(technicalEffect?.armor_delta || 0),
  )
  next.technical_metrics.fuel = clampMetric(
    next.technical_metrics.fuel + Number(technicalEffect?.fuel_delta || 0),
  )
  next.technical_metrics.mission_progress = clampMetric(
    next.technical_metrics.mission_progress + Number(technicalEffect?.mission_progress_delta || 0),
  )
  return GameStateSchema.parse(next)
}
