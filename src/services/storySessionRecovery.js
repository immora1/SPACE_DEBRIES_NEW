export function isStorySessionUnavailableError(error) {
  return ['STORY_SESSION_MISSING', 'STORY_SESSION_EXPIRED'].includes(error?.code)
}
