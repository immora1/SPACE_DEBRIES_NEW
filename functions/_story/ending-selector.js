import { StoryError } from './constants.js'
import { consequenceIds } from './config/story-options.js'
import { StoryMetricsSchema } from './schemas.js'

const METRICS = new Set([
  'event_integrity',
  'relationship_connection',
  'uncertainty',
])
const OPERATORS = new Set(['gte', 'lte', 'gt', 'lt', 'eq'])

function compare(actual, operator, expected) {
  switch (operator) {
    case 'gte': return actual >= expected
    case 'lte': return actual <= expected
    case 'gt': return actual > expected
    case 'lt': return actual < expected
    case 'eq': return actual === expected
    default: return false
  }
}

function constraintCount(rule) {
  return rule.conditions.length
    + rule.required_consequence_ids.length
    + rule.forbidden_consequence_ids.length
}

function validateRule(ending, index, knownConsequenceIds) {
  const rule = ending?.state_rule
  if (!rule || typeof rule !== 'object') {
    throw new StoryError(
      'ENDING_RULE_INVALID',
      `reachable_endings[${index}] has no state_rule.`,
      500,
    )
  }
  if (!Number.isInteger(rule.priority) || typeof rule.fallback !== 'boolean') {
    throw new StoryError(
      'ENDING_RULE_INVALID',
      `reachable_endings[${index}] has an invalid priority or fallback flag.`,
      500,
    )
  }
  for (const field of [
    'conditions',
    'required_consequence_ids',
    'forbidden_consequence_ids',
  ]) {
    if (!Array.isArray(rule[field])) {
      throw new StoryError(
        'ENDING_RULE_INVALID',
        `reachable_endings[${index}].state_rule.${field} must be an array.`,
        500,
      )
    }
  }
  if (rule.fallback && (
    rule.conditions.length
    || rule.required_consequence_ids.length
    || rule.forbidden_consequence_ids.length
  )) {
    throw new StoryError(
      'ENDING_FALLBACK_INVALID',
      'The fallback ending cannot contain constraints.',
      500,
    )
  }
  rule.conditions.forEach((condition, conditionIndex) => {
    if (
      !METRICS.has(condition.metric)
      || !OPERATORS.has(condition.operator)
      || !Number.isInteger(condition.value)
      || condition.value < 0
      || condition.value > 100
    ) {
      throw new StoryError(
        'ENDING_CONDITION_INVALID',
        `Invalid condition at reachable_endings[${index}].state_rule.conditions[${conditionIndex}].`,
        500,
      )
    }
  })
  const required = new Set(rule.required_consequence_ids)
  const forbidden = new Set(rule.forbidden_consequence_ids)
  if (
    required.size !== rule.required_consequence_ids.length
    || forbidden.size !== rule.forbidden_consequence_ids.length
    || [...required].some((consequenceId) => forbidden.has(consequenceId))
    || [...required, ...forbidden].some(
      (consequenceId) => !knownConsequenceIds.has(consequenceId),
    )
  ) {
    throw new StoryError(
      'ENDING_CONSEQUENCE_RULE_INVALID',
      `reachable_endings[${index}] contains invalid consequence constraints.`,
      500,
    )
  }
}

export function selectEnding({
  reachableEndings,
  storyState,
  activeConsequenceIds,
}) {
  if (!Array.isArray(reachableEndings) || reachableEndings.length === 0) {
    throw new StoryError(
      'ENDING_RULES_MISSING',
      'The story has no reachable ending rules.',
      500,
    )
  }
  const metrics = StoryMetricsSchema.parse(storyState)
  const active = new Set(activeConsequenceIds)
  const known = new Set(consequenceIds())
  reachableEndings.forEach((ending, index) => validateRule(ending, index, known))

  const fallbackEntries = reachableEndings
    .map((ending, index) => ({ ending, index }))
    .filter(({ ending }) => ending.state_rule.fallback)
  if (fallbackEntries.length !== 1) {
    throw new StoryError(
      'ENDING_FALLBACK_COUNT_INVALID',
      'Exactly one fallback ending is required.',
      500,
    )
  }

  const trace = []
  const matches = []
  reachableEndings.forEach((ending, index) => {
    const rule = ending.state_rule
    if (rule.fallback) return
    const condition_results = rule.conditions.map((condition) => ({
      ...structuredClone(condition),
      actual: metrics[condition.metric],
      matched: compare(metrics[condition.metric], condition.operator, condition.value),
    }))
    const missing_required_consequence_ids = rule.required_consequence_ids
      .filter((consequenceId) => !active.has(consequenceId))
    const present_forbidden_consequence_ids = rule.forbidden_consequence_ids
      .filter((consequenceId) => active.has(consequenceId))
    const matched = condition_results.every((condition) => condition.matched)
      && missing_required_consequence_ids.length === 0
      && present_forbidden_consequence_ids.length === 0
    const evaluation = {
      ending_id: ending.ending_id,
      matched,
      priority: rule.priority,
      constraint_count: constraintCount(rule),
      original_index: index,
      condition_results,
      missing_required_consequence_ids,
      present_forbidden_consequence_ids,
    }
    trace.push(evaluation)
    if (matched) matches.push({ ending, ...evaluation })
  })

  matches.sort((left, right) => (
    right.priority - left.priority
    || right.constraint_count - left.constraint_count
    || left.original_index - right.original_index
  ))
  const selected = matches[0]
    || {
      ending: fallbackEntries[0].ending,
      ending_id: fallbackEntries[0].ending.ending_id,
      matched: true,
      priority: fallbackEntries[0].ending.state_rule.priority,
      constraint_count: 0,
      original_index: fallbackEntries[0].index,
    }

  return {
    ending: structuredClone(selected.ending),
    trace: {
      metrics: structuredClone(metrics),
      active_consequence_ids: [...active],
      evaluated: trace,
      selected_ending_id: selected.ending.ending_id,
      used_fallback: matches.length === 0,
    },
  }
}

