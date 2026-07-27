import assert from 'node:assert/strict'
import test from 'node:test'

import {
  M2_GUIDE_ACTIONS,
  clampGuideLabelPoint,
  getRelativeGuidePoint,
  isM2GuideDismissAction,
} from './interactionGuide.js'

test('only meaningful M2 interactions dismiss the guide', () => {
  assert.deepEqual(M2_GUIDE_ACTIONS, ['drag', 'trace', 'satellite'])
  assert.equal(isM2GuideDismissAction('drag'), true)
  assert.equal(isM2GuideDismissAction('trace'), true)
  assert.equal(isM2GuideDismissAction('satellite'), true)
  assert.equal(isM2GuideDismissAction('hover'), false)
  assert.equal(isM2GuideDismissAction(undefined), false)
})

test('target centers are converted into M2 visual-local coordinates', () => {
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
