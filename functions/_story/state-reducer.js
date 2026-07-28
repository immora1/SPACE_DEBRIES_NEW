import { GameStateSchema, StoryStatePatchSchema, StoryStateSchema } from './schemas.js'

export function clampMetric(value) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
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

export function normalizeStoryState(state) {
  const normalized = {
    ...clone(state),
    metrics: {
      event_integrity: clampMetric(state.metrics?.event_integrity),
      relationship_connection: clampMetric(state.metrics?.relationship_connection),
      uncertainty: clampMetric(state.metrics?.uncertainty),
    },
    confirmed_facts: uniqueStrings(state.confirmed_facts || []),
    known_to_user: uniqueStrings(state.known_to_user || []),
    hidden_facts: uniqueStrings(state.hidden_facts || []),
    open_threads: uniqueStrings(state.open_threads || []),
    active_consequences: uniqueStrings(state.active_consequences || []),
    story_tags: uniqueStrings(state.story_tags || []),
  }
  return StoryStateSchema.parse(normalized)
}

export function applyStoryStatePatch(state, rawPatch) {
  const patch = StoryStatePatchSchema.parse(rawPatch)
  const next = clone(state)
  next.metrics = {
    event_integrity: clampMetric(next.metrics.event_integrity + patch.metrics_delta.event_integrity),
    relationship_connection: clampMetric(next.metrics.relationship_connection + patch.metrics_delta.relationship_connection),
    uncertainty: clampMetric(next.metrics.uncertainty + patch.metrics_delta.uncertainty),
  }
  next.confirmed_facts = uniqueStrings([...next.confirmed_facts, ...patch.add_confirmed_facts])
  next.known_to_user = uniqueStrings([...next.known_to_user, ...patch.add_known_to_user])
  next.hidden_facts = uniqueStrings([...next.hidden_facts, ...patch.add_hidden_facts])
  next.open_threads = uniqueStrings([
    ...next.open_threads.filter((item) => !patch.resolve_open_threads.includes(item)),
    ...patch.add_open_threads,
  ])
  next.active_consequences = uniqueStrings([...next.active_consequences, ...patch.add_active_consequences])
  next.story_tags = uniqueStrings([...next.story_tags, ...patch.add_story_tags])
  return normalizeStoryState(next)
}

export function applyFixedNarrativeEffect(state, effect, userAction) {
  const next = clone(state)
  const delta = effect?.metrics_delta || {}
  next.metrics = {
    event_integrity: clampMetric(next.metrics.event_integrity + Number(delta.event_integrity || 0)),
    relationship_connection: clampMetric(next.metrics.relationship_connection + Number(delta.relationship_connection || 0)),
    uncertainty: clampMetric(next.metrics.uncertainty + Number(delta.uncertainty || 0)),
  }
  if (effect?.add_confirmed_fact) next.confirmed_facts.push(effect.add_confirmed_fact)
  if (effect?.add_known_to_user) next.known_to_user.push(effect.add_known_to_user)
  if (effect?.add_hidden_fact) next.hidden_facts.push(effect.add_hidden_fact)
  if (effect?.add_open_thread) next.open_threads.push(effect.add_open_thread)
  if (effect?.consequence) next.active_consequences.push(effect.consequence)
  if (effect?.add_story_tag) next.story_tags.push(effect.add_story_tag)
  if (effect?.story_tag) next.story_tags.push(effect.story_tag)
  next.last_user_action = userAction
  return normalizeStoryState(next)
}

export function applyTechnicalMetrics(gameState, technicalEffect) {
  const next = clone(gameState)
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

export function cloneState(value) {
  return clone(value)
}
