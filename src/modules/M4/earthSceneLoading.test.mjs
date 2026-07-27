import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./M4New.jsx', import.meta.url), 'utf8')
const earthSceneSource = source.slice(
  source.indexOf('function EarthScene'),
  source.indexOf('function EarthOrbitControls'),
)

test('satellite loading is isolated so the Earth scene never falls back to blank', () => {
  assert.match(
    earthSceneSource,
    /showPersonalOrbit[\s\S]*?<Suspense fallback=\{null\}>[\s\S]*?<PersonalSatelliteOrbit/,
  )
})
