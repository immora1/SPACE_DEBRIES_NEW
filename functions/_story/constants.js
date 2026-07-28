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
})

export const PRODUCT_MODULE = Object.freeze({
  IDENTITY: 'M2_IDENTITY',
  MATERIALS: 'M2_MATERIALS',
  MISSION: 'M2_MISSION',
  ORBITAL_EVENTS: 'M4_ORBITAL_EVENTS',
  CLEANUP: 'M5_CLEANUP',
})

export const STORY_EXPIRY_MS = 60 * 60 * 1000
export const STORY_MODEL = 'gpt-4o-mini'
export const TOTAL_ORBITAL_EVENTS = 6
export const TOTAL_CLEANUP_PAIRS = 3

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
