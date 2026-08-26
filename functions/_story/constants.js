export const STORY_STATUS = Object.freeze({
  CREATING: 'creating',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
})

export const TASK_TYPE = Object.freeze({
  OUTLINE: 'STORY_OUTLINE',
  OPENING: 'STORY_OPENING',
  CONTINUE: 'STORY_CONTINUE',
  BRANCH: 'STORY_BRANCH',
  ENDING: 'STORY_ENDING',
  KNOWLEDGE_REVEAL: 'KNOWLEDGE_REVEAL',
})

export const ACTION_TYPE = Object.freeze({
  STORY_OPTION_SELECT: 'STORY_OPTION_SELECT',
  MATERIALS_COMMIT: 'MATERIALS_COMMIT',
  MISSION_SELECT: 'MISSION_SELECT',
  ORBITAL_EVENT_RESOLVE: 'ORBITAL_EVENT_RESOLVE',
  CLEANUP_PAIR_SUBMIT: 'CLEANUP_PAIR_SUBMIT',
})

export const CHECKPOINT = Object.freeze({
  MATERIALS: 'materials',
  MISSION: 'mission',
  ORBITAL_EVENTS: 'orbital_events',
  CLEANUP: 'cleanup',
  COMPLETED: 'completed',
  OPENING_READY: 'opening_ready',
})

export const PRODUCT_MODULE = Object.freeze({
  IDENTITY: 'M2_IDENTITY',
  MATERIALS: 'M2_MATERIALS',
  MISSION: 'M2_MISSION',
  ORBITAL_EVENTS: 'M4_ORBITAL_EVENTS',
  CLEANUP: 'M5_CLEANUP',
})

export const STORY_EXPIRY_MS = 60 * 60 * 1000
export const STORY_MODEL = 'gpt-5.6-luna'
export const STORY_REASONING_EFFORT = 'medium'
export const STORY_VERBOSITY = 'medium'
export const STORY_SPEC_VERSION = '2.0-numeric-state'
export const TOTAL_ORBITAL_EVENTS = 6
export const TOTAL_CLEANUP_PAIRS = 3
export const STORY_GENERATION_METADATA = Symbol.for(
  'space-debris.story-generation-metadata',
)

export const SUPPORTED_STORY_TASKS = Object.freeze([
  TASK_TYPE.OUTLINE,
  TASK_TYPE.OPENING,
  TASK_TYPE.CONTINUE,
  TASK_TYPE.BRANCH,
  TASK_TYPE.ENDING,
  TASK_TYPE.KNOWLEDGE_REVEAL,
])

export const INTERACTIVE_NODE_IDS = Object.freeze([
  'node_02',
  'node_03',
  'node_04',
  'node_05',
  'node_06',
  'node_07',
  'node_08',
])

export const STORY_NODE_IDS = Object.freeze([
  'node_01',
  ...INTERACTIVE_NODE_IDS,
  'node_09',
  'node_10',
])

export class StoryError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message)
    this.name = 'StoryError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function assertStory(condition, code, message, status = 400, details = undefined) {
  if (!condition) throw new StoryError(code, message, status, details)
}
