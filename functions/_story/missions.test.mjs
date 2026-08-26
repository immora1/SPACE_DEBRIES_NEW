import assert from 'node:assert/strict'
import test from 'node:test'

import { MISSION_OPTIONS, getMission } from './config/missions.js'
import { resolveProductAction } from './product-actions.js'
import { createInitialGameState } from './state-reducer.js'

const EXPECTED_MISSIONS = {
  weather_monitoring: {
    orbitProfileId: 'sso_leo_800',
    orbitFamily: 'LEO',
    altitudeKm: 800,
  },
  communications_relay: {
    orbitProfileId: 'geo_35786',
    orbitFamily: 'GEO',
    altitudeKm: 35786,
  },
  earth_observation: {
    orbitProfileId: 'sso_leo_700',
    orbitFamily: 'LEO',
    altitudeKm: 700,
  },
  space_science_observation: {
    orbitProfileId: 'polar_leo_500',
    orbitFamily: 'LEO',
    altitudeKm: 500,
  },
}

function missionStory() {
  return {
    current_checkpoint: 'mission',
    game_state: createInitialGameState({
      satellite: { name: 'TEST-SAT' },
      damageLevel: 0,
    }),
  }
}

function selectMission(missionId, payload = {}) {
  return resolveProductAction(missionStory(), {
    action_type: 'MISSION_SELECT',
    source_id: 'mission',
    action_id: missionId,
    payload,
  })
}

test('all four canonical mission ids resolve to a trusted orbit profile', () => {
  assert.equal(MISSION_OPTIONS.length, 4)

  for (const [missionId, expected] of Object.entries(EXPECTED_MISSIONS)) {
    const mission = getMission(missionId)
    assert.ok(mission)
    assert.equal(mission.mission_id, missionId)
    assert.equal(mission.orbit_profile.profile_id, expected.orbitProfileId)
    assert.equal(mission.orbit_profile.orbit_family, expected.orbitFamily)
    assert.equal(mission.orbit_profile.altitude_km, expected.altitudeKm)
  }
})

test('science mission reuses the existing near-polar LEO profile', () => {
  const science = getMission('space_science_observation')

  assert.equal(science.orbit_profile.profile_id, 'polar_leo_500')
  assert.equal(science.orbit_profile.orbit_family, 'LEO')
  assert.equal(science.orbit_profile.altitude_km, 500)
  assert.match(science.orbit_profile.label_en, /polar/i)
  assert.match(science.examples_en, /Swarm/)
  assert.match(science.examples_en, /GRACE-FO/)
})

test('mission selection persists the trusted orbit profile in game state', () => {
  for (const [missionId, expected] of Object.entries(EXPECTED_MISSIONS)) {
    const resolution = selectMission(missionId)

    assert.equal(resolution.nextCheckpoint, 'orbital_events')
    assert.equal(resolution.gameState.mission.mission_id, missionId)
    assert.equal(
      resolution.gameState.mission.orbit_profile.profile_id,
      expected.orbitProfileId,
    )
    assert.equal(
      resolution.gameState.mission.orbit_profile.altitude_km,
      expected.altitudeKm,
    )
  }
})

test('client supplied orbit fields cannot override the trusted mission mapping', () => {
  const resolution = selectMission('communications_relay', {
    targetAltitude: 1,
    targetOrbit: 'LEO',
    orbitProfile: {
      profile_id: 'fake_orbit',
      orbit_family: 'LEO',
      altitude_km: 1,
    },
  })

  assert.equal(resolution.gameState.mission.orbit_profile.profile_id, 'geo_35786')
  assert.equal(resolution.gameState.mission.orbit_profile.orbit_family, 'GEO')
  assert.equal(resolution.gameState.mission.orbit_profile.altitude_km, 35786)
})

