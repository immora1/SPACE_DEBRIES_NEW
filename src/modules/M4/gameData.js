// M4 威胁事件数据、选项模板、权重配置
// 每次游戏随机抽取 5-8 个事件，权重受 M3 clickedHistoryEvents 影响

export const THREAT_TYPES = {
  DEBRIS_APPROACH: 'debris_approach',
  SOLAR_STORM:     'solar_storm',
  ORBITAL_DECAY:   'orbital_decay',
  CASCADE_FRAGMENT:'cascade_fragment',
  FUEL_LEAK:       'fuel_leak',
}

// 每种威胁的基础权重（M3事件可提升对应权重）
export const BASE_WEIGHTS = {
  [THREAT_TYPES.DEBRIS_APPROACH]:  35,
  [THREAT_TYPES.SOLAR_STORM]:      15,
  [THREAT_TYPES.ORBITAL_DECAY]:    20,
  [THREAT_TYPES.CASCADE_FRAGMENT]: 20,
  [THREAT_TYPES.FUEL_LEAK]:        10,
}

// M3 历史事件对应的权重加成
export const EVENT_WEIGHT_BOOST = {
  '铱星-33碰撞':    { [THREAT_TYPES.CASCADE_FRAGMENT]: +20, [THREAT_TYPES.DEBRIS_APPROACH]: +15 },
  '风云一号反卫测试': { [THREAT_TYPES.CASCADE_FRAGMENT]: +25, [THREAT_TYPES.DEBRIS_APPROACH]: +10 },
  'Cerise碰撞':     { [THREAT_TYPES.DEBRIS_APPROACH]:   +20 },
  '2003万圣节风暴':  { [THREAT_TYPES.SOLAR_STORM]:      +30 },
}

export const THREAT_EVENTS = [
  {
    id: 'debris_close',
    type: THREAT_TYPES.DEBRIS_APPROACH,
    title: '碎片接近警报',
    description: '轨道预警系统检测到一枚直径约15cm的碎片，源自2009年铱星-33碰撞事件，接近概率1:1000，碰撞窗口72小时。',
    realRef: '铱星-33/Cosmos-2251碰撞，2009年，产生超过2000块可追踪碎片。',
    options: [
      {
        id: 'maneuver_up',
        label: '轨道抬升机动',
        subtext: '消耗燃料 12%，规避概率 92%',
        armorDelta: 0, fuelDelta: -12, missionDelta: +5,
        outcome: 'correct',
        techNote: '标准规避机动，NASA推荐碰撞概率>1:1000时执行。',
      },
      {
        id: 'maneuver_down',
        label: '轨道降低机动',
        subtext: '消耗燃料 8%，进入更密集碎片带',
        armorDelta: -10, fuelDelta: -8, missionDelta: -5,
        outcome: 'wrong',
        techNote: 'LEO低轨碎片密度更高，下降机动增加了后续碰撞风险。',
      },
      {
        id: 'shield_passive',
        label: '被动防护等待',
        subtext: '不消耗燃料，依赖Whipple防护层',
        armorDelta: -20, fuelDelta: 0, missionDelta: 0,
        outcome: 'partial',
        techNote: 'Whipple护盾可应对1cm以下碎片，15cm碎片将造成严重损伤。',
      },
    ],
  },
  {
    id: 'solar_flare',
    type: THREAT_TYPES.SOLAR_STORM,
    title: '太阳风暴爆发',
    description: 'X级太阳耀斑事件，带电粒子流将在18小时内抵达。大气层膨胀将加速轨道衰减，电子设备面临单粒子翻转风险。',
    realRef: '2003年万圣节太阳风暴，导致多颗卫星失联，ADEOS-2任务提前终止。',
    options: [
      {
        id: 'safe_mode',
        label: '进入安全模式',
        subtext: '关闭非核心系统，任务中断24h',
        armorDelta: 0, fuelDelta: 0, missionDelta: -10,
        outcome: 'correct',
        techNote: '标准应对方案，关闭冗余系统减少单粒子翻转风险，JAXA、NASA通用程序。',
      },
      {
        id: 'boost_altitude',
        label: '紧急轨道抬升',
        subtext: '消耗燃料 18%，减少大气阻力',
        armorDelta: 0, fuelDelta: -18, missionDelta: +5,
        outcome: 'correct',
        techNote: '太阳风暴期间大气层膨胀至更高高度，适当抬升可减缓轨道衰减。',
      },
      {
        id: 'continue_mission',
        label: '维持正常运行',
        subtext: '不中断任务，承担设备损伤风险',
        armorDelta: -25, fuelDelta: 0, missionDelta: +10,
        outcome: 'wrong',
        techNote: '2003年风暴中，多颗坚持运行的卫星遭受永久性传感器损坏。',
      },
    ],
  },
  {
    id: 'orbital_decay_warning',
    type: THREAT_TYPES.ORBITAL_DECAY,
    title: '轨道衰减加速',
    description: '高层大气密度异常升高，当前轨道衰减速率比预计高出40%。按此趋势，卫星将在19年内（非规定的25年）再入大气层。',
    realRef: '25年离轨规定（IADC 2002年指南），低于500km轨道须在25年内自然再入。',
    options: [
      {
        id: 'reboost',
        label: '执行轨道维持机动',
        subtext: '消耗燃料 15%，恢复标准轨道高度',
        armorDelta: 0, fuelDelta: -15, missionDelta: +10,
        outcome: 'correct',
        techNote: 'ISS每年需多次轨道维持机动，平均每月下降约2km。',
      },
      {
        id: 'accept_decay',
        label: '接受自然衰减',
        subtext: '节省燃料，但任务寿命缩短',
        armorDelta: 0, fuelDelta: 0, missionDelta: -15,
        outcome: 'partial',
        techNote: '符合25年离轨规定，但任务完成度将受影响。部分卫星运营商采用此策略节省燃料。',
      },
      {
        id: 'emergency_boost',
        label: '紧急大幅抬升轨道',
        subtext: '消耗燃料 30%，进入更高轨道',
        armorDelta: 0, fuelDelta: -30, missionDelta: +5,
        outcome: 'wrong',
        techNote: '过度消耗燃料将导致后续无法执行必要的规避机动，得不偿失。',
      },
    ],
  },
  {
    id: 'cascade_risk',
    type: THREAT_TYPES.CASCADE_FRAGMENT,
    title: '级联碎片云穿越',
    description: '轨道前方出现高密度碎片云，源自近期一颗废弃卫星解体事件。碎片数量估计超过300块，你的轨道与碎片云交叉点在4.5小时后到达。',
    realRef: '2007年风云一号反卫测试产生3000+碎片，至今仍有碎片威胁ISS。',
    options: [
      {
        id: 'plane_change',
        label: '轨道面调整机动',
        subtext: '消耗燃料 20%，彻底规避碎片云',
        armorDelta: 0, fuelDelta: -20, missionDelta: +10,
        outcome: 'correct',
        techNote: '轨道面变更是最有效但耗燃最高的规避方式，Delta-v代价最大。',
      },
      {
        id: 'timing_maneuver',
        label: '调整穿越时机',
        subtext: '消耗燃料 8%，错开密集区域',
        armorDelta: -8, fuelDelta: -8, missionDelta: +5,
        outcome: 'correct',
        techNote: '低成本规避策略，通过相位调整避开碎片云密集部分，有一定残余风险。',
      },
      {
        id: 'direct_through',
        label: '直接穿越碎片云',
        subtext: '不消耗燃料，靠护盾硬扛',
        armorDelta: -30, fuelDelta: 0, missionDelta: 0,
        outcome: 'wrong',
        techNote: '级联碎片云密度远超单一碎片，Whipple护盾无法抵御多次连续冲击。',
      },
    ],
  },
  {
    id: 'fuel_system_leak',
    type: THREAT_TYPES.FUEL_LEAK,
    title: '推进系统燃料泄漏',
    description: '传感器检测到推进舱压力异常，估计燃料泄漏速率 0.8kg/h。按当前速率，4小时后燃料将不足以执行任何规避机动。',
    realRef: 'ANIK E1卫星推进系统故障，1994年太阳风暴后控制能力丧失。',
    options: [
      {
        id: 'isolate_leak',
        label: '隔离泄漏回路',
        subtext: '关闭部分推进器，保留核心燃料',
        armorDelta: 0, fuelDelta: +10, missionDelta: -8,
        outcome: 'correct',
        techNote: '通过冗余阀门隔离故障回路，现代卫星推进系统标准应急程序。',
      },
      {
        id: 'emergency_burn',
        label: '立即执行紧急机动',
        subtext: '在燃料耗尽前完成关键变轨',
        armorDelta: 0, fuelDelta: -25, missionDelta: +15,
        outcome: 'partial',
        techNote: '优先消耗剩余燃料完成任务，但后续将失去规避机动能力。',
      },
      {
        id: 'ignore_leak',
        label: '继续监控，不干预',
        subtext: '等待地面指令，维持当前状态',
        armorDelta: -5, fuelDelta: -20, missionDelta: 0,
        outcome: 'wrong',
        techNote: '延误处置导致燃料大量流失，历史案例中此类决策均以卫星失控告终。',
      },
    ],
  },
  {
    id: 'debris_swarm',
    type: THREAT_TYPES.DEBRIS_APPROACH,
    title: '多目标碎片追踪',
    description: '太空监视网络同时追踪到3块独立碎片，轨道交叉时间不同：6h、14h、22h。任何单次机动都可能同时规避或加剧另一次风险。',
    realRef: 'Space Fence系统（美军）追踪超过26000个直径>10cm物体。',
    options: [
      {
        id: 'optimal_maneuver',
        label: '计算最优单次机动',
        subtext: '消耗燃料 10%，同时规避三个威胁',
        armorDelta: 0, fuelDelta: -10, missionDelta: +10,
        outcome: 'correct',
        techNote: '多目标规避优化算法，现代任务控制中心标准流程，最小化Delta-v消耗。',
      },
      {
        id: 'three_maneuvers',
        label: '分三次独立机动',
        subtext: '消耗燃料 28%，逐一规避',
        armorDelta: 0, fuelDelta: -28, missionDelta: +5,
        outcome: 'partial',
        techNote: '安全但低效，每次独立机动均引入新的位置不确定性。',
      },
      {
        id: 'prioritize_first',
        label: '只规避最近威胁',
        subtext: '消耗燃料 8%，忽略后续风险',
        armorDelta: -20, fuelDelta: -8, missionDelta: 0,
        outcome: 'wrong',
        techNote: '忽略14h和22h威胁导致后续两次碰撞，短视决策的典型代价。',
      },
    ],
  },
  {
    id: 'iss_warning',
    type: THREAT_TYPES.DEBRIS_APPROACH,
    title: 'ISS规避机动引发连锁',
    description: 'ISS执行规避机动改变了轨道，其产生的喷气羽流将在8小时后抵达你的轨道区域，同时推动一批小型碎片向你靠近。',
    realRef: 'ISS每年执行约3次规避机动，2020年后频率显著上升。',
    options: [
      {
        id: 'monitor_wait',
        label: '持续监控，待数据更新后再决策',
        subtext: '不消耗燃料，等待精确预测',
        armorDelta: -5, fuelDelta: 0, missionDelta: +5,
        outcome: 'correct',
        techNote: '信息不完整时等待更新是正确选择，过早机动可能适得其反。',
      },
      {
        id: 'preemptive_maneuver',
        label: '立即预防性机动',
        subtext: '消耗燃料 12%，主动规避',
        armorDelta: 0, fuelDelta: -12, missionDelta: +8,
        outcome: 'correct',
        techNote: '预防性机动消耗燃料，但将风险降至最低，尤其在数据不确定时是合理选择。',
      },
      {
        id: 'comm_iss',
        label: '联系ISS协调轨道',
        subtext: '尝试跨机构协调，耗时24h',
        armorDelta: -15, fuelDelta: 0, missionDelta: -10,
        outcome: 'wrong',
        techNote: '跨机构轨道协调耗时数天，在8小时窗口内不可行。',
      },
    ],
  },
  {
    id: 'battery_debris',
    type: THREAT_TYPES.ORBITAL_DECAY,
    title: '废弃电池托盘再入威胁',
    description: '地面监测到你轨道上方一个失控电池托盘正在衰减，预计在你轨道高度穿越时解体，产生新碎片云。',
    realRef: '2024年ISS电池托盘再入，碎片穿透佛罗里达民宅屋顶，质量约0.7kg。',
    options: [
      {
        id: 'raise_orbit',
        label: '轨道抬升至解体碎片云上方',
        subtext: '消耗燃料 14%，彻底规避解体区',
        armorDelta: 0, fuelDelta: -14, missionDelta: +8,
        outcome: 'correct',
        techNote: '在解体发生前完成高度分离，是最清洁的规避方案。',
      },
      {
        id: 'lower_orbit',
        label: '轨道下降，快速通过危险区',
        subtext: '消耗燃料 10%，压缩暴露时间',
        armorDelta: -12, fuelDelta: -10, missionDelta: 0,
        outcome: 'partial',
        techNote: '下降轨道虽缩短暴露时间，但进入更密集的低轨碎片带，综合风险未必更低。',
      },
      {
        id: 'report_only',
        label: '记录事件，上报地面站',
        subtext: '不机动，依赖地面协调',
        armorDelta: -22, fuelDelta: 0, missionDelta: -5,
        outcome: 'wrong',
        techNote: '地面协调响应时间通常超过4小时，在此场景中无法有效干预。',
      },
    ],
  },
]

// 根据 damageLevel 和 clickedHistoryEvents 计算事件权重并随机抽取 count 个
export function pickEvents(damageLevel = 0, clickedEvents = [], count = 6) {
  const weights = { ...BASE_WEIGHTS }

  // M3 历史事件提升权重
  clickedEvents.forEach((ev) => {
    const boost = EVENT_WEIGHT_BOOST[ev.name]
    if (boost) {
      Object.entries(boost).forEach(([type, delta]) => {
        weights[type] = (weights[type] || 0) + delta
      })
    }
  })

  // 按权重池随机抽取（不重复）
  const pool = []
  THREAT_EVENTS.forEach((ev) => {
    const w = weights[ev.type] || 10
    for (let i = 0; i < w; i++) pool.push(ev.id)
  })

  const picked = []
  const usedIds = new Set()
  let attempts = 0
  while (picked.length < count && attempts < 500) {
    const idx = Math.floor(Math.random() * pool.length)
    const id = pool[idx]
    if (!usedIds.has(id)) {
      const ev = THREAT_EVENTS.find((e) => e.id === id)
      if (ev) { picked.push(ev); usedIds.add(id) }
    }
    attempts++
  }

  // 不足时补全（去重后的所有事件）
  if (picked.length < count) {
    THREAT_EVENTS.forEach((ev) => {
      if (!usedIds.has(ev.id) && picked.length < count) {
        picked.push(ev); usedIds.add(ev.id)
      }
    })
  }

  return picked.slice(0, count)
}

// 计算初始护甲值（来自 M3 damageLevel）
export function calcInitialArmor(damageLevel = 0) {
  return Math.max(40, 100 - damageLevel * 5)
}

// 判断游戏胜负
export function evaluateResult({ armor, fuel, missionProgress, totalRounds }) {
  if (armor <= 0) return 'failure_armor'
  if (fuel <= 0) return 'failure_fuel'
  if (missionProgress >= 60) return 'success'
  return 'failure_mission'
}
