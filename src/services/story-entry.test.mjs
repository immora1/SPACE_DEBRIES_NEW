import test from 'node:test'
import assert from 'node:assert/strict'
import { hasIdentity, missingGamePreparation } from './story-entry.js'

const prepared = () => ({
  user: { name: '旅人', city: '泉州', importantEvent: '去机场接姐姐' },
  satellite: { name: 'TEST-SAT' },
  storySessionReady: true,
  storyCheckpoint: 'orbital_events',
  publicGameState: {
    satellite_build: { materials: { frame: 'aluminum', solar: 'silicon', insulation: 'kapton', propulsion: 'aluminum-tank' } },
    mission: { mission_id: 'weather_monitoring' },
  },
})

test('cached satellite and progress cannot bypass explicit identity acceptance', () => {
  const state = prepared()
  state.storySessionReady = false
  assert.equal(missingGamePreparation(state), 'identity')
  for (const key of ['name', 'city', 'importantEvent']) {
    const incomplete = prepared()
    incomplete.user[key] = '  '
    assert.equal(hasIdentity(incomplete.user, incomplete.satellite), false)
    assert.equal(missingGamePreparation(incomplete), 'identity')
  }
})

test('game requires committed materials followed by a mission, not selected UI values', () => {
  const state = prepared()
  state.storyCheckpoint = 'materials'
  assert.equal(missingGamePreparation(state), 'materials')
  state.storyCheckpoint = 'mission'
  assert.equal(missingGamePreparation(state), 'mission')
  state.storyCheckpoint = 'orbital_events'
  delete state.publicGameState.mission.mission_id
  assert.equal(missingGamePreparation(state), 'mission')
  delete state.publicGameState.satellite_build.materials.solar
  assert.equal(missingGamePreparation(state), 'materials')
})

test('committed local play and restored recovery work without waiting for an AI story ID', () => {
  const state = prepared()
  for (const checkpoint of ['orbital_events', 'cleanup', 'completed']) {
    state.storyCheckpoint = checkpoint
    assert.equal(missingGamePreparation(state), null)
  }
})
