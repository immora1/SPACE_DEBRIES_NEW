import { getMission } from '../../../functions/_story/config/missions.js'

export const THREAT_TYPES = {
  DEBRIS_APPROACH: 'debris_approach',
  SOLAR_STORM: 'solar_storm',
  ORBITAL_DECAY: 'orbital_decay',
  CASCADE_FRAGMENT: 'cascade_fragment',
  FUEL_LEAK: 'fuel_leak',
}

export const BASE_WEIGHTS = {
  [THREAT_TYPES.DEBRIS_APPROACH]: 35,
  [THREAT_TYPES.SOLAR_STORM]: 15,
  [THREAT_TYPES.ORBITAL_DECAY]: 20,
  [THREAT_TYPES.CASCADE_FRAGMENT]: 20,
  [THREAT_TYPES.FUEL_LEAK]: 10,
}

export const EVENT_WEIGHT_BOOST = {
  '铱星-33 / Cosmos-2251 碰撞': { [THREAT_TYPES.CASCADE_FRAGMENT]: 20, [THREAT_TYPES.DEBRIS_APPROACH]: 15 },
  '风云一号 C 反卫测试': { [THREAT_TYPES.CASCADE_FRAGMENT]: 25, [THREAT_TYPES.DEBRIS_APPROACH]: 10 },
  'Cerise 首次碎片碰撞': { [THREAT_TYPES.DEBRIS_APPROACH]: 20 },
  '2003 太阳风暴': { [THREAT_TYPES.SOLAR_STORM]: 30 },
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

const option = (id, label, subtext, outcome, armorDelta, fuelDelta, missionDelta, techNote) => ({
  id,
  label,
  subtext,
  outcome,
  armorDelta,
  fuelDelta,
  missionDelta,
  techNote,
})

export const THREAT_EVENTS = [
  {
    id: 'debris_close',
    type: THREAT_TYPES.DEBRIS_APPROACH,
    title: '近距离碎片交会',
    description: '一块可追踪碎片将在数小时后穿过安全距离，碰撞概率超过任务阈值。',
    realRef: '参考：铱星-33 与 Cosmos-2251 碰撞显示，低轨道高速交会会迅速制造碎片云。',
    options: [
      option('avoidance_burn', '执行规避机动', '消耗燃料，换取碰撞概率下降。', 'correct', 0, -12, 8, '规避机动是面对高置信交会预警的标准做法。'),
      option('wait_tracking', '等待下一轮定轨', '节省燃料，但窗口会变窄。', 'partial', -8, 0, 0, '等待可以减少误报，但接近窗口内会压缩处置余量。'),
      option('hold_course', '保持原轨道', '不消耗资源，但承担直接风险。', 'wrong', -25, 0, -8, '高速碎片无法靠装甲完全抵消，保持轨道会放大任务风险。'),
    ],
  },
  {
    id: 'solar_flare',
    type: THREAT_TYPES.SOLAR_STORM,
    title: '太阳风暴预警',
    description: '强太阳活动将提高辐射剂量并扰动上层大气，通信链路和轨道预测都会变差。',
    realRef: '参考：2003 年太阳风暴曾造成多颗卫星异常，并增加低轨道阻力。',
    options: [
      option('safe_mode', '切换安全模式', '暂停任务载荷，保护电源和姿控系统。', 'correct', 0, 0, -10, '安全模式会牺牲观测时间，但能显著降低单粒子事件风险。'),
      option('raise_orbit', '小幅抬升轨道', '提前抵消大气阻力增加。', 'partial', 0, -16, 3, '抬升轨道有帮助，但不能替代电子系统保护。'),
      option('continue_payload', '继续满负荷观测', '短期数据最多，硬件风险最高。', 'wrong', -22, 0, 8, '强辐射期间满负荷运行会增加载荷和存储异常概率。'),
    ],
  },
  {
    id: 'orbital_decay',
    type: THREAT_TYPES.ORBITAL_DECAY,
    title: '轨道衰减加速',
    description: '近地点持续降低，卫星可能提前进入无法控制的再入轨迹。',
    realRef: '参考：低轨道任务常用再提升机动维持高度，任务末期则需要预留离轨燃料。',
    options: [
      option('planned_reboost', '按计划再提升', '消耗可控，维持任务轨道。', 'correct', 0, -14, 9, '按计划再提升比紧急大推力机动更稳定。'),
      option('lower_for_disposal', '转入处置轨道', '任务收益下降，但善后更清晰。', 'partial', 0, -8, -7, '任务末期转入处置轨道可以减少长期遗留。'),
      option('ignore_decay', '忽略高度下降', '保留燃料，等待自然变化。', 'wrong', -10, 0, -18, '忽略衰减会把问题推迟到更难控制的阶段。'),
    ],
  },
  {
    id: 'cascade_fragment',
    type: THREAT_TYPES.CASCADE_FRAGMENT,
    title: '碎片云扩散',
    description: '历史碰撞产生的碎片云正在穿过相近轨道面，短时间内出现多次交会预警。',
    realRef: '参考：风云一号 C 事件产生大量长期碎片，是典型级联风险源。',
    options: [
      option('plane_bias', '调整轨道面偏置', '一次较大机动，避开密集区。', 'correct', 0, -20, 10, '改变轨道几何关系能同时降低多次交会风险。'),
      option('timed_burns', '分两次定时机动', '降低单次燃料峰值。', 'partial', -6, -12, 5, '分段机动更温和，但需要持续精确定轨。'),
      option('shield_only', '只依赖防护层', '不改变轨道。', 'wrong', -28, 0, -6, '防护层不能覆盖厘米级高速碎片的全部风险。'),
    ],
  },
  {
    id: 'fuel_leak',
    type: THREAT_TYPES.FUEL_LEAK,
    title: '推进系统泄漏',
    description: '遥测显示推进剂压力缓慢下降，姿控余量开始收缩。',
    realRef: '参考：推进系统异常会直接影响规避、再提升和任务末期离轨能力。',
    options: [
      option('isolate_valve', '隔离疑似阀路', '暂停部分机动，保存剩余燃料。', 'correct', 2, 8, -8, '先隔离再重算机动预算，可以保留后续处置能力。'),
      option('emergency_burn', '立即大推力转移', '争取高度，但燃料损失大。', 'partial', 0, -24, 5, '紧急点火可能解决高度问题，却会削弱后续规避能力。'),
      option('keep_schedule', '继续原任务计划', '不打断任务，风险累积。', 'wrong', -16, -16, 4, '带故障推进系统继续原计划，会让下一次预警更难处置。'),
    ],
  },
  {
    id: 'end_of_life',
    type: THREAT_TYPES.ORBITAL_DECAY,
    title: '任务末期处置窗口',
    description: '卫星仍可控制，但燃料只够一次关键机动：延长任务或进入离轨流程。',
    realRef: '参考：国际减缓指南要求任务结束后尽快离开受保护轨道区域。',
    options: [
      option('controlled_disposal', '执行受控离轨', '结束任务，减少长期风险。', 'correct', 0, -18, -10, '受控离轨把风险从轨道环境中移除，是负责任的末期处置。'),
      option('graveyard_plan', '进入弃置轨道', '适合高轨任务，低轨收益有限。', 'partial', 0, -12, -6, '弃置轨道要匹配轨道高度，低轨任务通常更适合离轨。'),
      option('extend_mission', '继续延寿运行', '短期收益高，善后余量不足。', 'wrong', -12, -8, 12, '延寿不能消耗掉最后的处置能力，否则卫星会变成长期碎片源。'),
    ],
  },
]

const THREAT_EVENT_EN = {
  debris_close: {
    title: 'Close debris conjunction',
    description: 'A tracked fragment will cross the safety envelope within hours, with collision probability above the mission threshold.',
    realRef: 'Reference: the Iridium 33 and Cosmos 2251 collision showed how a high-speed LEO conjunction can rapidly create a debris cloud.',
    options: {
      avoidance_burn: ['Perform avoidance burn', 'Spend fuel to reduce collision probability.', 'A maneuver is standard practice for a high-confidence conjunction warning.'],
      wait_tracking: ['Wait for another orbit solution', 'Save fuel, but narrow the response window.', 'Waiting can reduce false alarms, but it also compresses the remaining maneuver window.'],
      hold_course: ['Hold current orbit', 'Use no resources and accept the direct risk.', 'Shielding cannot fully offset a high-speed fragment; holding course increases mission risk.'],
    },
  },
  solar_flare: {
    title: 'Solar storm warning',
    description: 'Strong solar activity will raise radiation exposure and disturb the upper atmosphere, degrading communications and orbit prediction.',
    realRef: 'Reference: the 2003 solar storms caused anomalies on multiple satellites and increased drag in low Earth orbit.',
    options: {
      safe_mode: ['Enter safe mode', 'Pause the payload to protect power and attitude control.', 'Safe mode sacrifices observation time but greatly reduces single-event upset risk.'],
      raise_orbit: ['Raise the orbit slightly', 'Offset the expected increase in atmospheric drag.', 'An orbit raise helps, but it cannot replace electronic-system protection.'],
      continue_payload: ['Continue full payload operation', 'Maximize short-term data at the highest hardware risk.', 'Full-load operation during strong radiation increases payload and storage anomaly risk.'],
    },
  },
  orbital_decay: {
    title: 'Accelerating orbital decay',
    description: 'Perigee continues to fall and the satellite may enter an uncontrolled re-entry trajectory ahead of schedule.',
    realRef: 'Reference: LEO missions use reboost maneuvers to maintain altitude and must reserve fuel for end-of-life disposal.',
    options: {
      planned_reboost: ['Execute planned reboost', 'Spend a controlled amount of fuel to maintain orbit.', 'A planned reboost is more stable than a late emergency burn.'],
      lower_for_disposal: ['Transfer toward disposal', 'Reduce mission return but clarify end-of-life handling.', 'Moving toward disposal near mission end can reduce long-term orbital residue.'],
      ignore_decay: ['Ignore the altitude loss', 'Save fuel and wait for natural variation.', 'Ignoring decay postpones the problem until control margins are smaller.'],
    },
  },
  cascade_fragment: {
    title: 'Expanding debris cloud',
    description: 'Fragments from a historical collision are crossing nearby orbital planes and triggering repeated conjunction warnings.',
    realRef: 'Reference: the Fengyun-1C event created long-lived fragments and remains a major example of cascading risk.',
    options: {
      plane_bias: ['Bias the orbital plane', 'Use one larger maneuver to avoid the dense region.', 'Changing orbital geometry can reduce several conjunction risks at once.'],
      timed_burns: ['Use two timed burns', 'Reduce the peak fuel demand of a single maneuver.', 'Staged burns are gentler but require continuous precise tracking.'],
      shield_only: ['Rely on shielding only', 'Keep the orbit unchanged.', 'Shielding cannot cover the full risk from centimeter-scale hypervelocity debris.'],
    },
  },
  fuel_leak: {
    title: 'Propulsion-system leak',
    description: 'Telemetry shows propellant pressure falling slowly while attitude-control margin begins to shrink.',
    realRef: 'Reference: propulsion faults directly affect avoidance, reboost, and end-of-life disposal capability.',
    options: {
      isolate_valve: ['Isolate the suspected valve', 'Pause some maneuvers and preserve the remaining fuel.', 'Isolation followed by a revised maneuver budget can preserve disposal capability.'],
      emergency_burn: ['Perform an emergency transfer', 'Gain altitude at a high fuel cost.', 'An emergency burn may solve altitude loss but weaken later avoidance capability.'],
      keep_schedule: ['Continue the original plan', 'Avoid interruption while risk accumulates.', 'Continuing with a faulty propulsion system makes the next warning harder to manage.'],
    },
  },
  end_of_life: {
    title: 'End-of-life disposal window',
    description: 'The satellite remains controllable, but fuel is sufficient for only one critical maneuver: extend the mission or begin disposal.',
    realRef: 'Reference: international mitigation guidance calls for leaving protected orbital regions promptly after mission completion.',
    options: {
      controlled_disposal: ['Perform controlled deorbit', 'End the mission and reduce long-term risk.', 'Controlled deorbit removes risk from the orbital environment and is the responsible end-of-life choice.'],
      graveyard_plan: ['Enter a graveyard orbit', 'Useful for high-orbit missions, with limited value in LEO.', 'A graveyard orbit must match altitude; LEO missions are usually better served by deorbiting.'],
      extend_mission: ['Extend operations', 'Gain short-term value but lose disposal margin.', 'Mission extension must not consume the last disposal capability or the satellite becomes a persistent debris source.'],
    },
  },
}

export function localizeThreatEvent(event, language = 'zh') {
  if (!event || language !== 'en') return event
  const translation = THREAT_EVENT_EN[event.id]
  if (!translation) return event

  return {
    ...event,
    title: translation.title,
    description: translation.description,
    realRef: translation.realRef,
    options: event.options.map((item) => {
      const optionTranslation = translation.options[item.id]
      if (!optionTranslation) return item
      return {
        ...item,
        label: optionTranslation[0],
        subtext: optionTranslation[1],
        techNote: optionTranslation[2],
      }
    }),
  }
}

function normalizeText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return [value.name, value.title, value.label].filter(Boolean).join(' ')
}

function scoreEvent(event, weights, index) {
  return (weights[event.type] || 0) + index * 0.01
}

export function pickEvents(damageLevel = 0, clickedEvents = [], count = 6, missionState = null) {
  const weights = { ...BASE_WEIGHTS }
  const history = clickedEvents.map(normalizeText).join(' ')

  Object.entries(EVENT_WEIGHT_BOOST).forEach(([keyword, boost]) => {
    if (!history.includes(keyword)) return
    Object.entries(boost).forEach(([type, delta]) => {
      weights[type] = (weights[type] || 0) + delta
    })
  })

  if (damageLevel > 20) weights[THREAT_TYPES.CASCADE_FRAGMENT] += 10
  if (damageLevel > 40) weights[THREAT_TYPES.FUEL_LEAK] += 12

  const profile = missionOrbitProfile(missionState)
  Object.entries(profile?.event_weight_bias || {}).forEach(([type, delta]) => {
    weights[type] = (weights[type] || 0) + Number(delta || 0)
  })

  return [...THREAT_EVENTS]
    .sort((a, b) => scoreEvent(b, weights, THREAT_EVENTS.indexOf(b)) - scoreEvent(a, weights, THREAT_EVENTS.indexOf(a)))
    .slice(0, Math.min(count, THREAT_EVENTS.length))
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

export function evaluateResult({ armor, fuel, missionProgress }) {
  const score = armor * 0.42 + fuel * 0.28 + missionProgress * 0.3
  return score >= 55 && armor > 0 && fuel > 0 ? 'success' : 'failure'
}
