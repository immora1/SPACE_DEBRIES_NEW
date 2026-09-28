import { storyMetrics } from './state-reducer.js'
import { evaluateOrbitalResult } from './product-actions.js'
export { findOutlineNode, latestContinuityHandoff } from './story-context.js'
import { findOutlineNode } from './story-context.js'

export function matchedSatelliteContext(satellite) {
  // Allow only satellite facts, never matching metadata or the identity form.
  const fields = ['name', 'noradId', 'altitudeKm', 'inclination', 'periodMin',
    'type', 'purpose', 'function', 'description', 'orbitType', 'country', 'launchDate']
  return Object.fromEntries(fields.filter(key => ['string', 'number'].includes(typeof satellite[key]))
    .map(key => [key, satellite[key]]))
}

export function narrativeContext(outline, state, nodeId) {
  return {
    current_node: findOutlineNode(outline, nodeId),
    event_anchor: structuredClone(outline.event_anchor),
    satellite_anchor: structuredClone(outline.satellite_anchor),
    primary_anomaly: outline.primary_anomaly,
    causal_chain: {
      A_satellite_event: outline.causal_chain.A_satellite_event,
      C_human_effect: outline.causal_chain.C_human_effect,
      event_connection: outline.causal_chain.event_connection,
    },
    story_state: {
      ...storyMetrics(state),
      current_node_id: state.current_node_id,
      active_consequences: structuredClone(state.active_consequences),
    },
    known_to_user: structuredClone(state.known_to_user),
  }
}

export function buildProductContinueContext({ story, interaction, previousHandoff }) {
  return {
    ...narrativeContext(story.story_outline, story.story_state, story.current_node_id),
    previous_handoff: structuredClone(previousHandoff),
    interaction_result: {
      action_id: interaction.action_id,
      effect: structuredClone(interaction.narrative_effect),
      technical_effect: structuredClone(interaction.technical_effect),
    },
  }
}

export function buildEndingContext({ story, runtimeState, previousHandoff }) {
  const game = story.game_state
  const events = game.orbital_events.resolved
  const successes = events.filter(event => event.outcome === 'correct').length
  const failures = events.filter(event => event.outcome === 'wrong').length
  return {
    ...narrativeContext(story.story_outline, runtimeState, 'node_04'),
    previous_handoff: structuredClone(previousHandoff),
    ending_candidates: structuredClone(story.story_outline.ending_candidates),
    game_summary: {
      overall_result: evaluateOrbitalResult({ armor: game.technical_metrics.armor,
        fuel: game.technical_metrics.fuel, missionProgress: game.technical_metrics.mission_progress }),
      success_count: successes,
      partial_count: events.length - successes - failures,
      failure_count: failures,
      final_game_state: {
        materials: structuredClone(game.satellite_build.materials),
        mission: structuredClone(game.mission),
        technical_metrics: structuredClone(game.technical_metrics),
      },
      active_consequences: structuredClone(runtimeState.active_consequences),
      final_story_metrics: storyMetrics(runtimeState),
      key_outcomes: structuredClone(runtimeState.key_outcomes),
      event_connection: story.story_outline.causal_chain.event_connection,
      irreplaceable_part: story.story_outline.event_anchor.irreplaceable_part,
    },
  }
}

export function buildKnowledgeContext({ story, endingOutput }) {
  const outline = story.story_outline
  return {
    current_node: findOutlineNode(outline, 'node_05'),
    satellite_anchor: structuredClone(outline.satellite_anchor),
    primary_anomaly: outline.primary_anomaly,
    causal_chain: structuredClone(outline.causal_chain),
    ending_summary: endingOutput.ending_summary,
    next_node_context: structuredClone(endingOutput.next_node_context),
  }
}
