import { ORBITAL_EVENTS } from './config/orbital-events.js'
import { resolveGameAnswerStoryBinding } from './config/game-story-bindings.js'
import { selectEnding } from './ending-selector.js'
import { applyStateDelta, storyMetrics } from './state-reducer.js'

function applyConsequences(activeIds, option) {
  const resolved = new Set(option.resolve_consequence_ids)
  return [...new Set([
    ...activeIds.filter((consequenceId) => !resolved.has(consequenceId)),
    ...option.add_consequence_ids,
  ])]
}

export function analyzeEndingReachability(outline) {
  const selectedEndingIds = new Set()
  const representativePaths = {}
  const ranges = {
    event_integrity: { min: 100, max: 0 },
    relationship_connection: { min: 100, max: 0 },
    uncertainty: { min: 100, max: 0 },
  }

  function visit(index, metrics, activeConsequenceIds, path) {
    if (index === ORBITAL_EVENTS.length) {
      for (const metric of Object.keys(ranges)) {
        ranges[metric].min = Math.min(ranges[metric].min, metrics[metric])
        ranges[metric].max = Math.max(ranges[metric].max, metrics[metric])
      }
      const selected = selectEnding({
        reachableEndings: outline.reachable_endings,
        storyState: metrics,
        activeConsequenceIds,
      }).ending.ending_id
      selectedEndingIds.add(selected)
      representativePaths[selected] ||= [...path]
      return
    }

    const event = ORBITAL_EVENTS[index]
    for (const answer of event.options) {
      const option = resolveGameAnswerStoryBinding(event.id, answer.id)
      visit(
        index + 1,
        applyStateDelta(metrics, option.state_delta),
        applyConsequences(activeConsequenceIds, option),
        [...path, { question_id: event.id, answer_id: answer.id }],
      )
    }
  }

  visit(
    0,
    storyMetrics(outline.initial_story_state),
    [...outline.initial_story_state.active_consequences],
    [],
  )

  const nonFallbackIds = outline.reachable_endings
    .filter((ending) => !ending.state_rule.fallback)
    .map((ending) => ending.ending_id)

  return {
    selected_ending_ids: [...selectedEndingIds],
    unreachable_non_fallback_ids: nonFallbackIds.filter(
      (endingId) => !selectedEndingIds.has(endingId),
    ),
    representative_paths: representativePaths,
    reachable_metric_ranges: ranges,
  }
}
