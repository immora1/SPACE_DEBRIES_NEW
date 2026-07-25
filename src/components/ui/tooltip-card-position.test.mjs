import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateTooltipPosition } from './tooltip-card-position.js'

test('tooltip avoids the right viewport edge before content height is measured', () => {
  assert.deepEqual(calculateTooltipPosition({
    mouseX: 0,
    mouseY: 0,
    containerRect: { left: 1050, top: 320 },
    viewportWidth: 1280,
    viewportHeight: 720,
    tooltipWidth: 300,
    tooltipHeight: 0,
    offset: 14,
  }), { x: -314, y: 14 })
})

test('tooltip moves above the anchor when its measured height would cross the bottom edge', () => {
  assert.deepEqual(calculateTooltipPosition({
    mouseX: 0,
    mouseY: 0,
    containerRect: { left: 700, top: 650 },
    viewportWidth: 1280,
    viewportHeight: 720,
    tooltipWidth: 300,
    tooltipHeight: 260,
    offset: 14,
  }), { x: 14, y: -274 })
})
