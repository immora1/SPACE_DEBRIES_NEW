import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CLOUD_GEOMETRY_MAX_RADIUS,
  EARTH_RADIUS,
  FALL_TRACE_VARIANTS,
  createFallEventHover,
  createFallEventPlacements,
} from './fallEventPlacement.js'

const dataUrl = new URL('./fall-events.json', import.meta.url)
const data = JSON.parse(await readFile(dataUrl, 'utf8'))
const events = data['事件']

test('fall-event dataset declares and contains exactly 60 events', () => {
  assert.equal(data['事件总数'], 60)
  assert.equal(events.length, 60)
})

test('placement creates one deterministic cloud for every event', () => {
  const first = createFallEventPlacements(events)
  const second = createFallEventPlacements(events)

  assert.equal(first.length, events.length)
  assert.deepEqual(first, second)
  assert.deepEqual(first.map((placement) => placement.eventId), events.map((event) => event['事件编号']))
})

test('cloud centers stay inside Earth while their outer caps cross the surface', () => {
  const placements = createFallEventPlacements(events)

  for (const placement of placements) {
    const centerRadius = Math.hypot(...placement.position)
    const outerRadius = centerRadius + placement.scale[2] * CLOUD_GEOMETRY_MAX_RADIUS

    assert.ok(centerRadius < EARTH_RADIUS - 0.015, `event ${placement.eventId} center should sit below the surface`)
    assert.ok(outerRadius > EARTH_RADIUS + 0.01, `event ${placement.eventId} trace should cross the surface`)
  }
})

test('fibonacci distribution keeps event cloud centers visually separated', () => {
  const placements = createFallEventPlacements(events)
  let minimumChordDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i].normal
      const b = placements[j].normal
      minimumChordDistance = Math.min(
        minimumChordDistance,
        Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
      )
    }
  }

  assert.ok(minimumChordDistance > 0.3, `minimum unit-sphere separation was ${minimumChordDistance}`)
})

test('event traces use broad shallow proportions instead of oval volumes', () => {
  const placements = createFallEventPlacements(events)

  for (const placement of placements) {
    assert.ok(placement.scale[0] >= 0.72, `event ${placement.eventId} should be wider`)
    assert.ok(placement.scale[1] >= 0.55, `event ${placement.eventId} should be broader`)
    assert.ok(placement.scale[2] <= 0.16, `event ${placement.eventId} should stay close to the surface`)
    assert.ok(
      placement.scale[0] / placement.scale[2] >= 4.5,
      `event ${placement.eventId} should read as a thin surface trace`,
    )
  }
})

test('trace variants are open irregular bands rather than closed discs', () => {
  assert.ok(FALL_TRACE_VARIANTS.length >= 8)

  for (const variant of FALL_TRACE_VARIANTS) {
    assert.ok(variant.arcSpan >= 1.45 && variant.arcSpan <= 2.85)
    assert.ok(variant.bandWidth >= 0.16 && variant.bandWidth <= 0.32)
    assert.ok(variant.wave >= 0.035 && variant.wave <= 0.11)
  }

  assert.ok(new Set(FALL_TRACE_VARIANTS.map((variant) => variant.arcSpan)).size >= 6)
})

test('fall-event hover state exists only for an active trace and follows pointer samples', () => {
  const event = events[0]

  assert.equal(createFallEventHover(null, { x: 120, y: 180 }), null)
  assert.equal(createFallEventHover(event, null), null)

  const first = createFallEventHover(event, { x: 120, y: 180 })
  const moved = createFallEventHover(event, { x: 126, y: 184 })

  assert.deepEqual(first, { event, x: 120, y: 180 })
  assert.equal(moved.x - first.x, 6)
  assert.equal(moved.y - first.y, 4)
})
