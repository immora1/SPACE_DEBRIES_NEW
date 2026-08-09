import { MATERIAL_STORY_BINDINGS } from './material-story-bindings.js'
import { MISSION_STORY_BINDINGS } from './mission-story-bindings.js'
import { SITE_STORY_NODE } from './node-interactions.js'
import { resolveOptionsForNode } from './story-options.js'
import { GAME_ANSWER_STORY_BINDINGS } from './game-story-bindings.js'

export const STORY_STATE_PATH_NODE_IDS = Object.freeze([
  SITE_STORY_NODE.M2_MATERIALS,
  SITE_STORY_NODE.M3_MISSION,
  ...Array.from({ length: 6 }, (_, index) => `orbit_q${index + 1}`),
])

function addDelta(left, right) {
  return {
    event_integrity: left.event_integrity + right.event_integrity,
    relationship_connection:
      left.relationship_connection + right.relationship_connection,
    uncertainty: left.uncertainty + right.uncertainty,
  }
}

function materialCompositeOptions() {
  const bySection = MATERIAL_STORY_BINDINGS.reduce((groups, binding) => ({
    ...groups,
    [binding.section_id]: [...(groups[binding.section_id] || []), binding],
  }), {})
  const sectionIds = ['frame', 'solar', 'insulation', 'propulsion']

  const allPaths = sectionIds.reduce((paths, sectionId) => (
    paths.flatMap((path) => bySection[sectionId].map((binding) => ({
      option_ids: [...path.option_ids, binding.option_id],
      state_delta: addDelta(path.state_delta, binding.state_delta),
      add_consequence_ids: [...new Set([
        ...path.add_consequence_ids,
        ...binding.add_consequence_ids,
      ])],
      resolve_consequence_ids: [...new Set([
        ...path.resolve_consequence_ids,
        ...binding.resolve_consequence_ids,
      ])],
    })))
  ), [{
    option_ids: [],
    state_delta: {
      event_integrity: 0,
      relationship_connection: 0,
      uncertainty: 0,
    },
    add_consequence_ids: [],
    resolve_consequence_ids: [],
  }]).map((path) => ({
    ...path,
    option_id: `m2-composite:${path.option_ids.join('+')}`,
  }))

  return [...new Map(allPaths.map((path) => [
    JSON.stringify({
      state_delta: path.state_delta,
      add: [...path.add_consequence_ids].sort(),
      resolve: [...path.resolve_consequence_ids].sort(),
    }),
    path,
  ])).values()]
}

export const M2_MATERIAL_COMPOSITE_PATH_OPTIONS = Object.freeze(
  materialCompositeOptions().map(Object.freeze),
)

export function resolvePathOptionsForNode(story, nodeId) {
  if (!STORY_STATE_PATH_NODE_IDS.includes(nodeId)) return []
  if (nodeId === SITE_STORY_NODE.M2_MATERIALS) {
    return structuredClone(M2_MATERIAL_COMPOSITE_PATH_OPTIONS)
  }
  if (nodeId === SITE_STORY_NODE.M3_MISSION) {
    return structuredClone(MISSION_STORY_BINDINGS.map((binding) => ({
      option_id: binding.task_id,
      state_delta: binding.state_delta,
      add_consequence_ids: binding.add_consequence_ids,
      resolve_consequence_ids: binding.resolve_consequence_ids,
    })))
  }
  const orbitMatch = /^orbit_q([1-6])$/.exec(nodeId)
  if (orbitMatch) {
    const questionOrder = Number(orbitMatch[1])
    return structuredClone(
      GAME_ANSWER_STORY_BINDINGS
        .filter((binding) => binding.question_order === questionOrder)
        .map((binding) => ({
          option_id: binding.answer_id,
          state_delta: binding.state_delta,
          add_consequence_ids: binding.add_consequence_ids,
          resolve_consequence_ids: binding.resolve_consequence_ids,
        })),
    )
  }
  return resolveOptionsForNode(story, nodeId)
}
