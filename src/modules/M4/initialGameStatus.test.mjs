import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { resolveInitialGameStatus } from './gameData.js'

const source = readFileSync(new URL('./M4New.jsx', import.meta.url), 'utf8')

test('M4 initial status uses trusted story metrics when available', () => {
  assert.deepEqual(
    resolveInitialGameStatus(
      { fuel: 95, armor: 81, mission_progress: 0 },
      40,
    ),
    { fuel: 95, armor: 81, missionProgress: 0 },
  )
  assert.match(
    source,
    /resolveInitialGameStatus\(publicGameState\?\.technical_metrics, damageLevel\)/,
  )
})

test('M4 initial status preserves the existing damage-based fallback', () => {
  assert.deepEqual(
    resolveInitialGameStatus(null, 40),
    { fuel: 100, armor: 72, missionProgress: 0 },
  )
})

