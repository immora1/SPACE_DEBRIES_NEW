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
  SITE_INTERACTION_COMMIT: 'SITE_INTERACTION_COMMIT',
  MATERIALS_COMMIT: 'MATERIALS_COMMIT',
  MISSION_SELECT: 'MISSION_SELECT',
  ORBITAL_EVENT_RESOLVE: 'ORBITAL_EVENT_RESOLVE',
  GAME_ANSWER_CONFIRM: 'GAME_ANSWER_CONFIRM',
  CLEANUP_PAIR_SUBMIT: 'CLEANUP_PAIR_SUBMIT',
  M6_MATCH_UPDATE: 'M6_MATCH_UPDATE',
  M6_MATCH_COMPLETE: 'M6_MATCH_COMPLETE',
})

export const STORY_JOB_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  RETRYABLE: 'RETRYABLE',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
})

export const STORY_ARTIFACT_GENERATION_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  QUEUED: 'QUEUED',
  WAITING_PREREQUISITE: 'WAITING_PREREQUISITE',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
})

export const STORY_ARTIFACT_REVEAL_STATUS = Object.freeze({
  HIDDEN: 'HIDDEN',
  REVEALED: 'REVEALED',
})

export const STORY_JOB_LEASE_MS = 15 * 60 * 1000

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
  CLEANUP: 'M6_CLEANUP_MATCHING',
})

export const STORY_EXPIRY_MS = 60 * 60 * 1000
export const STORY_MODEL = 'gpt-5.6-luna'
export const STORY_REASONING_EFFORT = 'medium'
export const STORY_VERBOSITY = 'medium'
export const STORY_SPEC_VERSION = '4.0-five-stage-v1'
export const TOTAL_ORBITAL_EVENTS = 6
export const TOTAL_CLEANUP_PAIRS = 3
export const STORY_GENERATION_METADATA = Symbol.for(
  'space-debris.story-generation-metadata',
)
export const STORY_SCHEMA_VALIDATION_METADATA = Symbol.for(
  'space-debris.story-schema-validation-metadata',
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
])

export const STORY_NODE_IDS = Object.freeze([
  'node_01',
  'node_02',
  'node_03',
  'node_04',
  'node_05',
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
