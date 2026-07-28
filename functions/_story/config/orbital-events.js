const option = (id, label, outcome, armorDelta, fuelDelta, missionDelta, techNote) => ({
  id,
  label,
  outcome,
  technical_effect: {
    armor_delta: armorDelta,
    fuel_delta: fuelDelta,
    mission_progress_delta: missionDelta,
  },
  narrative_effect: {
    metrics_delta: outcome === 'correct'
      ? { event_integrity: 3, relationship_connection: 1, uncertainty: -3 }
      : outcome === 'partial'
        ? { event_integrity: 0, relationship_connection: 0, uncertainty: 1 }
        : { event_integrity: -4, relationship_connection: -1, uncertainty: 4 },
    consequence: techNote,
    story_tag: `orbital_${outcome}`,
  },
})

export const ORBITAL_EVENTS = [
  {
    id: 'debris_close',
    title: '近距离碎片交会',
    options: [
      option('avoidance_burn', '执行规避机动', 'correct', 0, -12, 8, '规避机动是面对高置信交会预警的标准做法。'),
      option('wait_tracking', '等待下一轮定轨', 'partial', -8, 0, 0, '等待可以减少误报，但接近窗口内会压缩处置余量。'),
      option('hold_course', '保持原轨道', 'wrong', -25, 0, -8, '高速碎片无法靠装甲完全抵消，保持轨道会放大任务风险。'),
    ],
  },
  {
    id: 'solar_flare',
    title: '太阳风暴预警',
    options: [
      option('safe_mode', '切换安全模式', 'correct', 0, 0, -10, '安全模式会牺牲观测时间，但能显著降低单粒子事件风险。'),
      option('raise_orbit', '小幅抬升轨道', 'partial', 0, -16, 3, '抬升轨道有帮助，但不能替代电子系统保护。'),
      option('continue_payload', '继续满负荷观测', 'wrong', -22, 0, 8, '强辐射期间满负荷运行会增加载荷和存储异常概率。'),
    ],
  },
  {
    id: 'orbital_decay',
    title: '轨道衰减加速',
    options: [
      option('planned_reboost', '按计划再提升', 'correct', 0, -14, 9, '按计划再提升比紧急大推力机动更稳定。'),
      option('lower_for_disposal', '转入处置轨道', 'partial', 0, -8, -7, '任务末期转入处置轨道可以减少长期遗留。'),
      option('ignore_decay', '忽略高度下降', 'wrong', -10, 0, -18, '忽略衰减会把问题推迟到更难控制的阶段。'),
    ],
  },
  {
    id: 'cascade_fragment',
    title: '碎片云扩散',
    options: [
      option('plane_bias', '调整轨道面偏置', 'correct', 0, -20, 10, '改变轨道几何关系能同时降低多次交会风险。'),
      option('timed_burns', '分两次定时机动', 'partial', -6, -12, 5, '分段机动更温和，但需要持续精确定轨。'),
      option('shield_only', '只依赖防护层', 'wrong', -28, 0, -6, '防护层不能覆盖厘米级高速碎片的全部风险。'),
    ],
  },
  {
    id: 'fuel_leak',
    title: '推进系统泄漏',
    options: [
      option('isolate_valve', '隔离疑似阀路', 'correct', 2, 8, -8, '先隔离再重算机动预算，可以保留后续处置能力。'),
      option('emergency_burn', '立即大推力转移', 'partial', 0, -24, 5, '紧急点火可能解决高度问题，却会削弱后续规避能力。'),
      option('keep_schedule', '继续原任务计划', 'wrong', -16, -16, 4, '带故障推进系统继续原计划，会让下一次预警更难处置。'),
    ],
  },
  {
    id: 'end_of_life',
    title: '任务末期处置窗口',
    options: [
      option('controlled_disposal', '执行受控离轨', 'correct', 0, -18, -10, '受控离轨把风险从轨道环境中移除，是负责任的末期处置。'),
      option('graveyard_plan', '进入弃置轨道', 'partial', 0, -12, -6, '弃置轨道要匹配轨道高度，低轨任务通常更适合离轨。'),
      option('extend_mission', '继续延寿运行', 'wrong', -12, -8, 12, '延寿不能消耗掉最后的处置能力，否则卫星会变成长期碎片源。'),
    ],
  },
]

export const ORBITAL_EVENT_BY_ID = Object.freeze(
  Object.fromEntries(ORBITAL_EVENTS.map((event) => [
    event.id,
    { ...event, option_by_id: Object.fromEntries(event.options.map((item) => [item.id, item])) },
  ])),
)

export function getOrbitalEventOption(eventId, optionId) {
  const event = ORBITAL_EVENT_BY_ID[eventId]
  const selected = event?.option_by_id?.[optionId]
  return event && selected ? { event, option: selected } : null
}
