import assert from 'node:assert/strict'
import test from 'node:test'

import { getMission } from '../../../functions/_story/config/missions.js'
import {
  pickEvents,
  resolveMissionEnvironment,
} from './gameData.js'

function publicMission(missionId) {
  const mission = getMission(missionId)
  return {
    mission_id: mission.mission_id,
    action_id: mission.action_id,
    label: mission.label,
    label_en: mission.label_en,
    anomaly_type: mission.anomaly_type,
    orbit_profile: structuredClone(mission.orbit_profile),
  }
}

test('M4 resolves orbit labels altitude inclination and mission context from story state', () => {
  const environment = resolveMissionEnvironment(publicMission('communications_relay'))

  assert.equal(environment.missionId, 'communications_relay')
  assert.equal(environment.orbitFamily, 'GEO')
  assert.equal(environment.altitudeKm, 35786)
  assert.equal(environment.inclinationDeg, 0)
  assert.match(environment.orbitLabelEn, /Geostationary/)
  assert.match(environment.missionEffectEn, /high-altitude/i)
})

test('M4 retains a safe satellite-derived fallback for legacy stories without mission profile', () => {
  const environment = resolveMissionEnvironment(null, {
    altitudeKm: 836,
    inclination: 98.7,
  })

  assert.equal(environment.orbitFamily, 'LEO')
  assert.equal(environment.altitudeKm, 836)
  assert.equal(environment.inclinationDeg, 98.7)
})

test('mission orbit profile changes the order of M4 environment events', () => {
  const leoEvents = pickEvents(0, [], 6, publicMission('weather_monitoring'))
  const geoEvents = pickEvents(0, [], 6, publicMission('communications_relay'))

  assert.notDeepEqual(
    geoEvents.map((event) => event.id),
    leoEvents.map((event) => event.id),
  )
  assert.equal(geoEvents[0].id, 'solar_flare')
  assert.equal(leoEvents[0].id, 'debris_close')
})
