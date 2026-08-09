import { MISSION_OPTIONS } from './missions.js'
import {
  SITE_STORY_MODULE,
  SITE_STORY_NODE,
  STORY_INTERACTION_MODE,
} from './node-interactions.js'

export const MISSION_CANDIDATE_SECTION_ID = 'mission_candidates'

const UNCONFIRMED_MISSION_STORY_DELTA = Object.freeze({
  event_integrity: 0,
  relationship_connection: 0,
  uncertainty: 0,
})

export function missionControlId(taskId) {
  return `m3-mission-${taskId}`
}

function taskProfile(mission) {
  return Object.freeze({
    objective_summary: mission.description,
    task_description: mission.description,
    orbit_or_range: mission.orbit,
    related_satellite: mission.example,
  })
}

function knowledgeProfile(mission) {
  return Object.freeze({
    keywords: Object.freeze([mission.label, mission.label_en, mission.mission_id]),
    safe_facts: Object.freeze([mission.description, mission.orbit]),
    mission_relevance: Object.freeze([mission.description]),
    // No planner-approved mission/debris or operational trade-off table exists yet.
    debris_relevance: Object.freeze([]),
    operational_tradeoffs: Object.freeze([]),
  })
}

function missionBinding(mission) {
  return Object.freeze({
    binding_id: `m3:mission:${mission.action_id}`,
    module_id: SITE_STORY_MODULE.M3,
    section_id: MISSION_CANDIDATE_SECTION_ID,
    control_id: missionControlId(mission.action_id),
    target_node_id: SITE_STORY_NODE.M3_MISSION,
    interaction_mode: STORY_INTERACTION_MODE.SITE_GROUP_SINGLE,
    task_id: mission.action_id,
    task_name: mission.label,
    option_id: mission.action_id,
    task_profile: taskProfile(mission),
    display_snapshot: Object.freeze({
      section_name: '任务候选',
      option_name: mission.label,
    }),
    // Until planning supplies a dedicated story effect, reuse only the approved
    // product description instead of inferring an effect from the task name.
    effect_summary: mission.description,
    // Do not infer narrative values from a mission name or orbit label.
    state_delta: UNCONFIRMED_MISSION_STORY_DELTA,
    add_consequence_ids: Object.freeze([]),
    resolve_consequence_ids: Object.freeze([]),
    // No planner-approved key-outcome copy exists yet.
    key_outcome: '',
    knowledge_profile: knowledgeProfile(mission),
  })
}

export const MISSION_STORY_BINDINGS = Object.freeze(
  MISSION_OPTIONS.map(missionBinding),
)

const BINDING_BY_TASK = Object.freeze(
  Object.fromEntries(MISSION_STORY_BINDINGS.map((binding) => [binding.task_id, binding])),
)

export function resolveMissionStoryBinding({
  moduleId,
  sectionId,
  controlId,
  taskId,
}) {
  if (
    moduleId !== SITE_STORY_MODULE.M3
    || sectionId !== MISSION_CANDIDATE_SECTION_ID
  ) return null
  const binding = BINDING_BY_TASK[taskId]
  if (!binding || binding.control_id !== controlId) return null
  return structuredClone(binding)
}
