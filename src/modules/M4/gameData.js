import { ORBITAL_EVENTS } from '../../../functions/_story/config/orbital-events.js'
import { getMission } from '../../../functions/_story/config/missions.js'
export { evaluateOrbitalResult as evaluateResult } from '../../../functions/_story/product-actions.js'

export const THREAT_TYPES = {
  DEBRIS_APPROACH: 'debris_approach',
  SOLAR_STORM: 'solar_storm',
  ORBITAL_DECAY: 'orbital_decay',
  CASCADE_FRAGMENT: 'cascade_fragment',
  FUEL_LEAK: 'fuel_leak',
}

function missionOrbitProfile(missionState) {
  if (missionState?.orbit_profile) return missionState.orbit_profile
  const configured = getMission(missionState?.mission_id || missionState?.action_id)
  return configured?.orbit_profile || null
}

export function resolveMissionEnvironment(missionState, satellite = {}) {
  const configured = getMission(missionState?.mission_id || missionState?.action_id)
  const profile = missionOrbitProfile(missionState)

  if (profile) {
    return {
      missionId: missionState?.mission_id || configured?.mission_id || null,
      missionLabel: missionState?.label || configured?.label || '卫星任务',
      missionLabelEn: missionState?.label_en || configured?.label_en || 'Satellite Mission',
      missionEffect: missionState?.mission_effect || configured?.mission_effect || profile.environment,
      missionEffectEn: missionState?.mission_effect_en || configured?.mission_effect_en || profile.environment_en,
      orbitProfileId: profile.profile_id,
      orbitFamily: profile.orbit_family,
      orbitLabel: profile.label,
      orbitLabelEn: profile.label_en,
      altitudeKm: profile.altitude_km,
      altitudeLabel: profile.altitude_label,
      altitudeLabelEn: profile.altitude_label_en,
      inclinationDeg: profile.inclination_deg,
      eventWeightBias: { ...(profile.event_weight_bias || {}) },
    }
  }

  const parsedAltitude = Number(satellite?.altitudeKm)
  const altitudeKm = Number.isFinite(parsedAltitude) ? parsedAltitude : 836
  const parsedInclination = Number(satellite?.inclination)
  const inclinationDeg = Number.isFinite(parsedInclination) ? parsedInclination : 98.7
  const orbitFamily = altitudeKm >= 30000 ? 'GEO' : altitudeKm >= 2000 ? 'MEO' : 'LEO'
  const fallbackLabels = {
    LEO: ['低地球轨道（LEO）', 'Low Earth Orbit (LEO)'],
    MEO: ['中地球轨道（MEO）', 'Medium Earth Orbit (MEO)'],
    GEO: ['地球静止轨道（GEO）', 'Geostationary Orbit (GEO)'],
  }
  const [orbitLabel, orbitLabelEn] = fallbackLabels[orbitFamily]

  return {
    missionId: null,
    missionLabel: '卫星任务',
    missionLabelEn: 'Satellite Mission',
    missionEffect: '进入既定轨道环境执行任务。',
    missionEffectEn: 'Operates in the assigned orbital environment.',
    orbitProfileId: `legacy_${orbitFamily.toLowerCase()}`,
    orbitFamily,
    orbitLabel,
    orbitLabelEn,
    altitudeKm,
    altitudeLabel: `约 ${altitudeKm.toLocaleString('en-US')} km`,
    altitudeLabelEn: `Approx. ${altitudeKm.toLocaleString('en-US')} km`,
    inclinationDeg,
    eventWeightBias: {},
  }
}

export const THREAT_EVENTS = ORBITAL_EVENTS.map(event => ({
  ...event,
  options: event.options.map(option => ({
    ...option,
    armorDelta: option.technical_effect.armor_delta,
    fuelDelta: option.technical_effect.fuel_delta,
    missionDelta: option.technical_effect.mission_progress_delta,
    techNote: option.narrative_effect.consequence,
  })),
}))

export function localizeThreatEvent(event, language = 'zh') {
  if (!event || language !== 'en') return event
  return {
    ...event,
    ...event.en,
    options: event.options.map(option => ({
      ...option,
      label: option.en[0],
      subtext: option.en[1],
      techNote: option.en[2],
    })),
  }
}

// Preserve the call signature used by restored sessions; every mission now follows
// the same three decisions, so retirement always comes after operational choices.
export function pickEvents(_damageLevel = 0, _clickedEvents = [], count = 3, _missionState = null) {
  return THREAT_EVENTS.slice(0, Math.min(count, THREAT_EVENTS.length))
}

export function calcInitialArmor(damageLevel = 0) {
  const value = 100 - Number(damageLevel || 0) * 0.7
  return Math.max(45, Math.min(100, Math.round(value)))
}

export function resolveInitialGameStatus(technicalMetrics, damageLevel = 0) {
  if (
    Number.isFinite(technicalMetrics?.fuel)
    && Number.isFinite(technicalMetrics?.armor)
    && Number.isFinite(technicalMetrics?.mission_progress)
  ) {
    return {
      fuel: technicalMetrics.fuel,
      armor: technicalMetrics.armor,
      missionProgress: technicalMetrics.mission_progress,
    }
  }

  return {
    fuel: 100,
    armor: calcInitialArmor(damageLevel),
    missionProgress: 0,
  }
}
