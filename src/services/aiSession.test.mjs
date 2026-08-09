import assert from 'node:assert/strict'
import test from 'node:test'

import { isStorySessionUnavailableError } from './storySessionRecovery.js'

test('only missing or expired story sessions trigger automatic M3 recovery', () => {
  assert.equal(isStorySessionUnavailableError({ code: 'STORY_SESSION_MISSING' }), true)
  assert.equal(isStorySessionUnavailableError({ code: 'STORY_SESSION_EXPIRED' }), true)
  assert.equal(isStorySessionUnavailableError({ code: 'AI_REQUEST_FAILED' }), false)
  assert.equal(isStorySessionUnavailableError(null), false)
})
