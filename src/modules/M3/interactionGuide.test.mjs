import assert from 'node:assert/strict'
import test from 'node:test'

import {
  M3_GUIDE_ACTIONS,
  clampGuideLabelPoint,
  getRelativeGuidePoint,
  isM3GuideDismissAction,
} from './interactionGuide.js'

test('only meaningful M3 interactions dismiss the guide', () => {
  assert.deepEqual(M3_GUIDE_ACTIONS, ['drag', 'trace', 'satellite'])
  assert.equal(isM3GuideDismissAction('drag'), true)
  assert.equal(isM3GuideDismissAction('trace'), true)
  assert.equal(isM3GuideDismissAction('satellite'), true)
  assert.equal(isM3GuideDismissAction('hover'), false)
  assert.equal(isM3GuideDismissAction(undefined), false)
})

test('target centers are converted into M3 visual-local coordinates', () => {
  const container = { left: 100, top: 40, width: 900, height: 700 }
  const target = { left: 420, top: 260, width: 40, height: 20 }

  assert.deepEqual(getRelativeGuidePoint(container, target), { x: 340, y: 230 })
  assert.deepEqual(getRelativeGuidePoint(container, target, { x: -12, y: 8 }), { x: 328, y: 238 })
})

test('guide labels remain fully inside the visual bounds', () => {
  const bounds = { width: 320, height: 240 }
  const label = { width: 132, height: 44 }

  assert.deepEqual(
    clampGuideLabelPoint({ x: 310, y: 10 }, bounds, label),
    { x: 172, y: 16 },
  )
  assert.deepEqual(
    clampGuideLabelPoint({ x: 20, y: 232 }, bounds, label),
    { x: 38, y: 180 },
  )
})
