import {
  resolvePathOptionsForNode,
  STORY_STATE_PATH_NODE_IDS,
} from './config/story-path-options.js'
import { selectEnding } from './ending-selector.js'
import { applyStateDelta, storyMetrics } from './state-reducer.js'

function applyConsequences(activeIds, option) {
  const resolved = new Set(option.resolve_consequence_ids)
  return [...new Set([
    ...activeIds.filter((consequenceId) => !resolved.has(consequenceId)),
    ...option.add_consequence_ids,
  ])]
}

function endingRuleGuidance(states, endingIds) {
  const uniqueMetrics = [...new Map(states.map(({ metrics }) => [
    `${metrics.event_integrity}:${metrics.relationship_connection}:${metrics.uncertainty}`,
    metrics,
  ])).values()].sort((left, right) => (
    left.event_integrity - right.event_integrity
    || left.relationship_connection - right.relationship_connection
    || left.uncertainty - right.uncertainty
  ))
  return endingIds.map((endingId, index) => {
    const sampleIndex = endingIds.length <= 1
      ? 0
      : Math.round((index * (uniqueMetrics.length - 1)) / (endingIds.length - 1))
    return {
      ending_id: endingId,
      metrics: uniqueMetrics[sampleIndex],
    }
  })
}

export function analyzeEndingReachability(outline) {
  const selectedEndingIds = new Set()
  const representativePaths = {}
  const ranges = {
    event_integrity: { min: 100, max: 0 },
    relationship_connection: { min: 100, max: 0 },
    uncertainty: { min: 100, max: 0 },
  }

  let states = [{
    metrics: storyMetrics(outline.initial_story_state),
    activeConsequenceIds: [...outline.initial_story_state.active_consequences],
    path: [],
  }]

  for (const nodeId of STORY_STATE_PATH_NODE_IDS) {
    const nextStates = new Map()
    for (const state of states) {
      for (const option of resolvePathOptionsForNode({}, nodeId)) {
        const metrics = applyStateDelta(state.metrics, option.state_delta)
        const activeConsequenceIds = applyConsequences(
          state.activeConsequenceIds,
          option,
        )
        const key = JSON.stringify([
          metrics.event_integrity,
          metrics.relationship_connection,
          metrics.uncertainty,
          [...activeConsequenceIds].sort(),
        ])
        if (!nextStates.has(key)) {
          nextStates.set(key, {
            metrics,
            activeConsequenceIds,
            path: [...state.path, { node_id: nodeId, option_id: option.option_id }],
          })
        }
      }
    }
    states = [...nextStates.values()]
  }

  for (const { metrics, activeConsequenceIds, path } of states) {
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
  }

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
    ending_rule_guidance: endingRuleGuidance(states, nonFallbackIds),
  }
}
