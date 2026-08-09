import { getMaterialOption } from './materials.js'

export const CLEANUP_MODULE_ID = 'M6_CLEANUP_MATCHING'

const freeze = (value) => Object.freeze(value)

function mechanismProfile({ summary, suitable, unsuitable = [], tradeoffs, safety = [], relevance, facts }) {
  return freeze({
    mechanism_summary: summary,
    suitable_target_traits: freeze(suitable),
    unsuitable_target_traits: freeze(unsuitable),
    operational_tradeoffs: freeze(tradeoffs),
    safety_constraints: freeze(safety),
    debris_relevance: freeze(relevance),
    safe_facts: freeze(facts),
  })
}

export const CLEANUP_METHODS = freeze({
  LASER_ABLATION: freeze({
    cleanup_method_id: 'LASER_ABLATION',
    ui_method_id: 'laser',
    cleanup_method_name: '激光烧蚀',
    description: '以非接触方式为小碎片施加微小轨道改变量。',
    image: '/cleanup/1.jpg',
    mechanism_profile: mechanismProfile({
      summary: '短脉冲加热目标表面，烧蚀喷流产生微小反冲并逐步改变轨道。',
      suitable: ['数量多且尺寸小', '难以逐个接触捕获', '可被持续精确跟踪'],
      unsuitable: ['大型完整结构', '无法可靠跟踪或识别的目标'],
      tradeoffs: ['不需要近距离接触', '单次作用很小，需要精确重复施加'],
      safety: ['必须避免影响正常航天器', '需要高精度跟踪与指向'],
      relevance: ['可降低小碎片与关键轨道交会的概率'],
      facts: ['激光烧蚀依靠表面物质喷出形成反冲，不是把碎片直接烧毁。'],
    }),
  }),
  ROBOTIC_ARM_CAPTURE: freeze({
    cleanup_method_id: 'ROBOTIC_ARM_CAPTURE',
    ui_method_id: 'arm',
    cleanup_method_name: '机械臂抓取',
    description: '与大型完整目标建立刚性连接后实施稳定和离轨。',
    image: '/cleanup/2.jpg',
    mechanism_profile: mechanismProfile({
      summary: '服务航天器估计目标翻滚状态，再用机械臂包络、固定并拖离拥挤轨道。',
      suitable: ['质量集中的完整结构', '具有可夹持边缘', '相对运动能够被估计'],
      unsuitable: ['密集小碎片群', '接触后容易解体的脆弱目标'],
      tradeoffs: ['能够对大型目标实施受控处置', '接近和接触阶段复杂且耗时'],
      safety: ['必须控制相对速度和目标翻滚', '抓取点需能承受载荷'],
      relevance: ['优先移除大型完整物体可避免未来碰撞产生大量碎片'],
      facts: ['机械臂清理依赖交会、近距离导航和稳定抓取。'],
    }),
  }),
  FLEXIBLE_NET_CAPTURE: freeze({
    cleanup_method_id: 'FLEXIBLE_NET_CAPTURE',
    ui_method_id: 'net',
    cleanup_method_name: '柔性捕捉网',
    description: '以柔性网包覆缺少标准接口的中型不规则残骸。',
    image: '/cleanup/3.jpg',
    mechanism_profile: mechanismProfile({
      summary: '展开高强度柔性网包覆目标，再由缆绳控制组合体。',
      suitable: ['中型不规则外形', '没有标准对接口', '能够被网体完整包覆'],
      unsuitable: ['微小分散碎片群', '带有易缠绕长构件的目标'],
      tradeoffs: ['降低对精确对接口的要求', '网体展开和闭合通常只有有限机会'],
      safety: ['需避免网体或缆绳缠绕服务航天器'],
      relevance: ['为不规则中型目标提供柔性接触捕获路径'],
      facts: ['柔性网的优势是包覆，不代表后续拖曳不需要姿态控制。'],
    }),
  }),
  HARPOON_CAPTURE: freeze({
    cleanup_method_id: 'HARPOON_CAPTURE',
    ui_method_id: 'harpoon',
    cleanup_method_name: '飞行鱼叉',
    description: '穿透坚硬外壳建立锚点，再通过缆绳拖曳。',
    image: '/cleanup/4.jpg',
    mechanism_profile: mechanismProfile({
      summary: '高速锚体穿入目标外壳并锁定，以缆绳传递控制或离轨力。',
      suitable: ['外壳坚硬', '缺少抓取接口', '结构能承受局部冲击'],
      unsuitable: ['脆化或状态未知的薄壁结构', '小型分散目标'],
      tradeoffs: ['可快速建立牵引点', '穿透冲击可能损伤老化结构'],
      safety: ['必须先确认材料和结构状态'],
      relevance: ['适用于特定大型残骸的锚定处置研究'],
      facts: ['穿透式捕获若判断失误可能制造二次碎片。'],
    }),
  }),
  ELECTRODYNAMIC_TETHER: freeze({
    cleanup_method_id: 'ELECTRODYNAMIC_TETHER',
    ui_method_id: 'tether',
    cleanup_method_name: '电动力缆索',
    description: '利用导电缆索与近地空间环境耦合，持续降低轨道能量。',
    image: '/cleanup/5.jpg',
    mechanism_profile: mechanismProfile({
      summary: '导电缆索切割地磁场并与电离层交换电流，洛伦兹力持续改变轨道。',
      suitable: ['仍可部署装置的低轨航天器', '允许缓慢处置的寿命末期平台'],
      unsuitable: ['已经分散的自由碎片', '无法部署装置的失控目标'],
      tradeoffs: ['不依赖推进剂', '长缆部署和环境耦合复杂'],
      safety: ['必须管理长缆与其他轨道物体的交会风险'],
      relevance: ['适合作为航天器寿命末期的主动离轨设计'],
      facts: ['电动力缆索更适合预先集成或仍可控制的平台。'],
    }),
  }),
  DRAG_SAIL: freeze({
    cleanup_method_id: 'DRAG_SAIL',
    ui_method_id: 'sail',
    cleanup_method_name: '阻力帆',
    description: '展开大面积薄膜，利用低轨稀薄大气加快自然衰减。',
    image: '/cleanup/6.jpg',
    mechanism_profile: mechanismProfile({
      summary: '大面积轻质薄膜提高面积质量比，使高层稀薄大气更快消耗轨道能量。',
      suitable: ['低轨小卫星', '寿命末期仍能触发部署', '目标尚未解体'],
      unsuitable: ['已经脱离航天器的自由碎片', '高轨且大气阻力极弱的目标'],
      tradeoffs: ['装置质量和复杂度较低', '衰减需要时间且受轨道高度影响'],
      safety: ['部署时必须确认姿态和周边环境'],
      relevance: ['通过任务末期处置减少新增长期在轨物体'],
      facts: ['阻力帆是预防性离轨装置，不是隔空捕获工具。'],
    }),
  }),
})

const targetProfile = ({ type, size = '', mass = '', motion = '', context = '', structure, risk, facts }) => freeze({
  target_type: type,
  size,
  mass,
  motion_state: motion,
  orbit_or_context: context,
  structural_traits: freeze(structure),
  risk_traits: freeze(risk),
  safe_facts: freeze(facts),
})

const TARGET_VARIANTS = freeze({
  laser: freeze([
    freeze({ cleanup_target_id: 'A17_FRAGMENT_CLOUD', ui_target_id: 'fragment-cloud', code: 'A-17', cleanup_target_name: '太阳能板与隔热层形成的小碎片群', source: '轨道事件产生的分散碎片', target_profile: targetProfile({ type: '碎片云', size: '1–10 cm', motion: '高速分散', structure: ['数量多', '单体尺寸小'], risk: ['逐个接触捕获不现实'], facts: ['小碎片仍可造成高相对速度碰撞风险。'] }) }),
    freeze({ cleanup_target_id: 'A31_MICRO_DEBRIS', ui_target_id: 'paint-flakes', code: 'A-31', cleanup_target_name: '漆片、薄膜与绝热材料混合碎片', source: '多点反射信号', target_profile: targetProfile({ type: '微小剥落物', size: '3–7 cm', motion: '密集漂移', structure: ['数量多', '反射截面较小'], risk: ['难以逐一近距离接触'], facts: ['表面材料剥落会形成尺寸小但速度高的轨道碎片。'] }) }),
    freeze({ cleanup_target_id: 'A42_PANEL_SPLINTERS', ui_target_id: 'panel-splinters', code: 'A-42', cleanup_target_name: '太阳能板断裂后形成的薄片群', source: '低雷达散射截面目标', target_profile: targetProfile({ type: '板材碎片群', size: '5–12 cm', motion: '轨道相位分散', structure: ['薄片状', '群体分散'], risk: ['单体跟踪和接触困难'], facts: ['薄片形碎片的姿态变化会改变其观测特征。'] }) }),
  ]),
  arm: freeze([
    freeze({ cleanup_target_id: 'B04_INTACT_BODY', ui_target_id: 'intact-body', code: 'B-04', cleanup_target_name: '完整卫星主体', source: '任务结算后的完整平台', target_profile: targetProfile({ type: '完整大型物体', size: '2.4 m', mass: '620 kg', motion: '缓慢翻滚', structure: ['质量集中', '主体结构完整'], risk: ['碰撞后可能产生大量碎片'], facts: ['大型完整物体是主动碎片清除的重要候选目标。'] }) }),
    freeze({ cleanup_target_id: 'B16_ROCKET_STAGE', ui_target_id: 'rocket-stage', code: 'B-16', cleanup_target_name: '失去控制的火箭上面级壳体', source: '大型完整回波', target_profile: targetProfile({ type: '火箭末级', size: '8.1 m', mass: '1.8 t', motion: '低速滚转', structure: ['大型刚性壳体', '可能缺少标准接口'], risk: ['质量大', '接近控制复杂'], facts: ['废弃上面级的质量和尺寸会放大碰撞后果。'] }) }),
    freeze({ cleanup_target_id: 'B27_RING_STRUCTURE', ui_target_id: 'adapter-ring', code: 'B-27', cleanup_target_name: '带有可夹持边缘的环形结构', source: '可建立刚性接触的目标', target_profile: targetProfile({ type: '适配器结构', size: '1.6 m', mass: '180 kg', motion: '稳定漂移', structure: ['环形边缘', '结构仍完整'], risk: ['需要可靠固定后才能拖曳'], facts: ['明确的几何边缘有助于规划刚性抓取点。'] }) }),
  ]),
  sail: freeze([
    freeze({ cleanup_target_id: 'C22_END_OF_LIFE_PLATFORM', ui_target_id: 'end-of-life', code: 'C-22', cleanup_target_name: '任务卫星的寿命末期平台', source: '当前任务的低轨平台', target_profile: targetProfile({ type: '预防性处置目标', size: '低轨小卫星', motion: '仍可控制', context: '低地球轨道', structure: ['尚未解体', '仍能触发末期装置'], risk: ['若不处置会成为长期在轨物体'], facts: ['在航天器仍可控制时执行末期处置通常比事后捕获更简单。'] }) }),
    freeze({ cleanup_target_id: 'C08_CUBESAT', ui_target_id: 'cubesat', code: 'C-08', cleanup_target_name: '任务结束但仍能触发装置的小卫星', source: '低轨可控目标', target_profile: targetProfile({ type: '立方星', size: '12U', mass: '26 kg', motion: '轨道自然衰减慢', context: '低地球轨道', structure: ['小型完整平台'], risk: ['任务结束后继续占用轨道环境'], facts: ['小卫星同样需要在任务设计中安排末期处置。'] }) }),
    freeze({ cleanup_target_id: 'C35_LEO_PLATFORM', ui_target_id: 'leo-platform', code: 'C-35', cleanup_target_name: '可部署末期离轨装置的低轨载荷', source: '尚未解体的低轨目标', target_profile: targetProfile({ type: '低轨平台', size: '60×40×30 cm', motion: '速度稳定', context: '低地球轨道', structure: ['完整', '可部署附加装置'], risk: ['自然衰减时间取决于高度和空间环境'], facts: ['增大面积质量比可提高低轨大气阻力效应。'] }) }),
  ]),
})

function explanationProfile(methodId) {
  if (methodId === 'LASER_ABLATION') return freeze({ why_suitable: freeze(['非接触微小反冲适合数量多且尺寸小的目标。']), tradeoffs: freeze(['需要精确跟踪并多次施加微小作用。']), why_other_methods_may_be_limited: freeze(['逐个接触捕获效率低且接近风险高。']) })
  if (methodId === 'ROBOTIC_ARM_CAPTURE') return freeze({ why_suitable: freeze(['完整结构和可夹持部位允许建立刚性连接。']), tradeoffs: freeze(['能够受控离轨，但接近、同步和抓取复杂。']), why_other_methods_may_be_limited: freeze(['非接触微推力难以快速控制大型目标。']) })
  return freeze({ why_suitable: freeze(['目标尚未解体且仍可部署装置，适合预防性离轨。']), tradeoffs: freeze(['装置简单但轨道衰减需要时间，并受高度影响。']), why_other_methods_may_be_limited: freeze(['事后接触回收的成本和风险通常更高。']) })
}

export const CLEANUP_MATCH_RULES = freeze(Object.fromEntries(
  Object.entries(TARGET_VARIANTS).flatMap(([family, targets]) => {
    const methodId = { laser: 'LASER_ABLATION', arm: 'ROBOTIC_ARM_CAPTURE', sail: 'DRAG_SAIL' }[family]
    return targets.map((target) => [target.cleanup_target_id, freeze({
      cleanup_target_id: target.cleanup_target_id,
      allowed_method_ids: freeze([methodId]),
      preferred_method_ids: freeze([methodId]),
      explanation_profile: explanationProfile(methodId),
    })])
  }),
))

function seedIndex(storyId, family, length) {
  const value = `${storyId}:${family}`
    .split('')
    .reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0)
  return value % length
}

function materialLabel(gameState, component, fallback) {
  const optionId = gameState?.satellite_build?.materials?.[component]
  return getMaterialOption(component, optionId)?.label || fallback
}

export function buildCleanupTargetSet(story) {
  const gameState = story?.game_state || {}
  const chosen = Object.entries(TARGET_VARIANTS).map(([family, variants]) => {
    const target = structuredClone(variants[seedIndex(story.story_id, family, variants.length)])
    if (family === 'laser') {
      if (target.cleanup_target_id === 'A17_FRAGMENT_CLOUD') {
        target.cleanup_target_name = `${materialLabel(gameState, 'solar', '太阳能板')}与${materialLabel(gameState, 'insulation', '隔热层')}形成的小碎片群`
      } else if (target.cleanup_target_id === 'A42_PANEL_SPLINTERS') {
        target.cleanup_target_name = `${materialLabel(gameState, 'solar', '太阳能板')}断裂后形成的薄片群`
      }
    }
    if (family === 'arm' && target.cleanup_target_id === 'B04_INTACT_BODY') {
      target.cleanup_target_name = `${materialLabel(gameState, 'frame', '主框架')}与${materialLabel(gameState, 'propulsion', '推进系统')}构成的完整主体`
      target.source = `任务结算：护甲 ${gameState?.technical_metrics?.armor ?? '—'} / 燃料 ${gameState?.technical_metrics?.fuel ?? '—'}`
    }
    if (family === 'sail' && target.cleanup_target_id === 'C22_END_OF_LIFE_PLATFORM') {
      const satellite = gameState?.satellite_build?.satellite || {}
      target.cleanup_target_name = `${satellite.name || '任务卫星'}的寿命末期平台`
      target.source = `任务轨道：${satellite.altitudeKm ?? 836} km / 倾角 ${satellite.inclination ?? 98}°`
      target.target_profile.orbit_or_context = `低地球轨道，约 ${satellite.altitudeKm ?? 836} km`
    }
    const rule = CLEANUP_MATCH_RULES[target.cleanup_target_id]
    target.preferred_method_id = rule.preferred_method_ids[0]
    return target
  })
  return chosen.sort((a, b) => a.cleanup_target_id.localeCompare(b.cleanup_target_id))
}

export function getCleanupMethod(methodId) {
  return CLEANUP_METHODS[methodId] || Object.values(CLEANUP_METHODS)
    .find((method) => method.ui_method_id === methodId) || null
}

export function getCleanupTarget(targetId, targetSet = []) {
  return targetSet.find((target) => target.cleanup_target_id === targetId) || null
}

export function evaluateCleanupMatch(targetId, methodId, targetSet = []) {
  const target = getCleanupTarget(targetId, targetSet)
  const method = getCleanupMethod(methodId)
  const rule = CLEANUP_MATCH_RULES[targetId]
  if (!target || !method || !rule) return null
  return {
    target,
    method,
    rule,
    is_allowed_match: rule.allowed_method_ids.includes(method.cleanup_method_id),
    is_preferred_match: (rule.preferred_method_ids || []).includes(method.cleanup_method_id),
  }
}

export function cleanupTargetIds(targetSet = []) {
  return targetSet.map((target) => target.cleanup_target_id).sort()
}

// Read-only adapter for pre-M6-contract stories. New flows use evaluateCleanupMatch().
export function getCleanupPair(targetId, methodId, uiTargetId) {
  const legacy = {
    A31_MICRO_DEBRIS: ['LASER_ABLATION', 'laser', '激光烧蚀', '微小剥落物'],
    B27_RING_STRUCTURE: ['ROBOTIC_ARM_CAPTURE', 'arm', '机械臂抓取', '大型完整结构'],
    C22_END_OF_LIFE_PLATFORM: ['DRAG_SAIL', 'sail', '阻力帆', '寿命末期平台'],
  }[targetId]
  if (!legacy) return null
  const [stableMethodId, uiMethodId, methodLabel, targetLabel] = legacy
  if (![stableMethodId, uiMethodId].includes(methodId)) return null
  const acceptedUiIds = TARGET_VARIANTS[uiMethodId].map((target) => target.ui_target_id)
  if (uiTargetId && !acceptedUiIds.includes(uiTargetId)) return null
  return {
    ui_method_id: uiMethodId,
    method_id: stableMethodId,
    method_label: methodLabel,
    target_id: targetId,
    target_label: targetLabel,
    accepted_ui_ids: acceptedUiIds,
    technical_effect: { correct: true, cleanup_method: stableMethodId },
    narrative_effect: {
      metrics_delta: { event_integrity: 0, relationship_connection: 0, uncertainty: 0 },
      consequence: `${methodLabel}与${targetLabel}完成配对。`,
      story_tag: `cleanup_${uiMethodId}`,
    },
  }
}
