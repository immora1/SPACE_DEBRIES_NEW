import assert from 'node:assert/strict'
import test from 'node:test'

import { commitOrbitDragProgress, shouldStartOrbitMission } from './orbitControl.js'

test('orbit mission starts when the handle reaches the visible right-end zone', () => {
  assert.equal(shouldStartOrbitMission(0.9), true)
  assert.equal(shouldStartOrbitMission(0.95), true)
  assert.equal(shouldStartOrbitMission(0.899), false)
  assert.equal(shouldStartOrbitMission(Number.NaN), false)
})

test('orbit drag starts the mission as soon as movement enters the completion zone', () => {
  const calls = []

  commitOrbitDragProgress(0.92, {
    onProgressChange: (progress) => calls.push(['progress', progress]),
    onComplete: (progress) => calls.push(['complete', progress]),
  })

  assert.deepEqual(calls, [
    ['progress', 0.92],
    ['complete', 0.92],
  ])
})
