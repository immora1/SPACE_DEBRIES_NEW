import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import useI18n from '../../i18n/useI18n'
import { submitCleanupPairStoryAction } from '../../services/ai'
import './index.css'

const METHODS = [
  {
    id: 'laser',
    image: '/cleanup/1.jpg',
    label: '激光烧蚀',
    labelEn: 'LASER ABLATION',
    title: '激光改变轨道',
    titleEn: 'Laser Orbit Modification',
    action: '改变轨道',
    actionEn: 'ORBIT MODIFICATION',
    howItWorks: '激光脉冲照射碎片表面，使极少量材料发生烧蚀并产生微小反作用力，从而改变碎片的速度和轨道，使其更快降低轨道。',
    howItWorksEn: 'Laser pulses ablate a very small amount of material from the debris surface. The resulting reaction force slightly changes the object’s velocity and orbit, helping it move toward a lower orbit.',
    bestFor: '更适合尺寸较小、难以机械抓取的轨道碎片。这类目标数量多，逐个派航天器接近和捕获效率较低，激光可以通过非接触方式施加轨道扰动。',
    bestForEn: 'It is better suited to smaller debris that is difficult to capture mechanically. Because such objects are numerous and inefficient to retrieve one by one, laser systems can alter their trajectories without direct physical contact.',
    limitations: '需要先准确发现、跟踪和瞄准碎片，目前仍以研究和技术验证为主。大型失效卫星通常需要其他捕获或离轨方式。',
    limitationsEn: 'The target must first be detected, tracked, and accurately illuminated. The concept remains primarily in research and technology validation, and large defunct spacecraft generally require other capture or disposal methods.',
    takeaway: '激光通过微量烧蚀改变碎片轨道，并不会直接把整块碎片烧掉。',
    takeawayEn: 'Laser ablation changes the debris orbit through a small reaction force; it does not simply vaporize the entire object.',
  },
  {
    id: 'arm',
    image: '/cleanup/2.jpg',
    label: '直接捕获',
    labelEn: 'DIRECT CAPTURE',
    title: '机械臂抓取',
    titleEn: 'Robotic Arm Capture',
    action: '固定并离轨',
    actionEn: 'CAPTURE AND DEORBIT',
    howItWorks: '清理航天器先接近目标并控制相对运动，再利用机械臂抓住目标结构。捕获稳定后，可以带着目标改变轨道并完成后续处置。',
    howItWorksEn: 'A servicing spacecraft first approaches the target and controls its relative motion, then uses a robotic arm to grasp the object. Once captured, the target can be maneuvered toward a disposal orbit or reentry path.',
    bestFor: '更适合体积较大、结构完整，并具有可识别抓取位置的失效卫星或大型火箭残骸。机械臂可以在近距离对目标进行稳定控制。',
    bestForEn: 'It is better suited to large, structurally intact targets with identifiable grasping points, such as defunct satellites or large rocket bodies. Robotic arms allow relatively stable control once contact is established.',
    limitations: '清理航天器必须非常接近目标。目标如果正在快速翻滚或旋转，接近和抓取过程会明显变复杂，对导航和姿态控制要求很高。',
    limitationsEn: 'The servicing spacecraft must operate very close to the target. Rapidly tumbling or rotating objects make approach and capture much more difficult and require precise navigation and attitude control.',
    takeaway: '机械臂更适合能够近距离识别并稳定抓取的大型目标。',
    takeawayEn: 'Robotic arms are best suited to large targets that can be identified and grasped reliably at close range.',
  },
  {
    id: 'net',
    image: '/cleanup/3.jpg',
    label: '包围捕获',
    labelEn: 'NET CAPTURE',
    title: '柔性网捕获',
    titleEn: 'Net Capture',
    action: '包络捕获',
    actionEn: 'ENVELOPING CAPTURE',
    howItWorks: '清理航天器在一定距离外向目标展开柔性网，用网将目标包围并限制其运动，再通过连接绳控制或拖带目标。',
    howItWorksEn: 'A servicing spacecraft deploys a flexible net from a distance, surrounds the target, and restrains its motion. The captured object can then be controlled or towed using the connecting tether.',
    bestFor: '更适合体积较大、外形不规则或缺少专用抓取接口的目标。柔性网不需要准确抓住一个很小的连接点，可以通过包围方式完成捕获。',
    bestForEn: 'It is more suitable for large, irregularly shaped objects or targets without a dedicated capture interface. A net does not need to attach to one precise point and can capture the target by surrounding it.',
    limitations: '捕获后目标仍可能旋转或摆动，需要继续控制“清理航天器 + 目标”的整体运动，避免发生新的碰撞。',
    limitationsEn: 'The captured target may continue to rotate or swing. The combined motion of the servicing spacecraft and debris must therefore be controlled to avoid creating a new collision.',
    takeaway: '柔性网适合包围形状不规则、缺少抓取接口的大型目标。',
    takeawayEn: 'Nets are useful for surrounding large, irregular targets that lack a convenient grasping point.',
  },
  {
    id: 'harpoon',
    image: '/cleanup/4.jpg',
    label: '快速连接',
    labelEn: 'HARPOON CAPTURE',
    title: '鱼叉固定',
    titleEn: 'Harpoon Capture',
    action: '锚定拖曳',
    actionEn: 'ANCHOR AND TOW',
    howItWorks: '清理航天器向目标发射带有绳索的鱼叉，使鱼叉穿入并固定在目标结构上，再利用连接绳控制或拖动目标。',
    howItWorksEn: 'A servicing spacecraft fires a tethered harpoon into the target structure. Once anchored, the tether can be used to control or tow the captured object.',
    bestFor: '更适合表面具有可穿透结构、体积较大的刚性目标。鱼叉可以在一定距离外建立连接，对缺少标准抓取接口的物体具有一定优势。',
    bestForEn: 'It is better suited to large, rigid objects with structures that can safely accept penetration. The harpoon can establish a connection from some distance and does not require a standard docking interface.',
    limitations: '鱼叉撞击会对目标结构施加较大作用力，因此必须判断材料和撞击位置是否适合。捕获不当可能破坏目标并产生新的碎片。',
    limitationsEn: 'Harpoon impact places substantial force on the target structure, so the material and impact location must be suitable. Poorly controlled capture could damage the target and create additional debris.',
    takeaway: '鱼叉适合能够承受捕获冲击的大型刚性结构。',
    takeawayEn: 'Harpoons are better suited to large rigid structures that can withstand the impact of capture.',
  },
  {
    id: 'tether',
    image: '/cleanup/5.jpg',
    label: '降低轨道',
    labelEn: 'ELECTRODYNAMIC TETHER',
    title: '电动力绳索降轨',
    titleEn: 'Electrodynamic Tether Deorbiting',
    action: '持续降轨',
    actionEn: 'CONTINUOUS DECELERATION',
    howItWorks: '长导电绳索在地球磁场中运动并产生电磁作用，可以形成改变轨道的力，使已经连接的目标逐渐降低轨道，同时减少对传统推进剂的依赖。',
    howItWorksEn: 'A long conductive tether interacts with Earth’s magnetic field to generate a force that changes the orbit of an attached object, gradually lowering its altitude without relying continuously on conventional propellant.',
    bestFor: '适合已经能够与绳索系统连接的低轨目标，也可以在卫星设计阶段提前安装，在任务结束后用于加快自身离轨。',
    bestForEn: 'It is suitable for low-Earth-orbit targets that can be connected to the tether system. The device can also be installed on a satellite before launch and deployed at the end of its mission to accelerate deorbiting.',
    limitations: '电动力绳索主要解决“怎样降低轨道”。处理已经失控的旧碎片时，仍需要先完成目标接近和连接，绳索展开和控制本身也存在工程难度。',
    limitationsEn: 'Electrodynamic tethers mainly address how to lower an orbit. Existing uncontrolled debris must still be approached and connected first, while tether deployment and control remain significant engineering challenges.',
    takeaway: '电动力绳索主要帮助已经连接的目标逐渐降低轨道。',
    takeawayEn: 'Electrodynamic tethers mainly help an attached target gradually lower its orbit.',
  },
  {
    id: 'sail',
    image: '/cleanup/6.jpg',
    label: '增加阻力',
    labelEn: 'DRAG SAIL',
    title: '阻力帆降轨',
    titleEn: 'Drag-Sail Deorbiting',
    action: '加快离轨',
    actionEn: 'INCREASE DRAG',
    howItWorks: '航天器展开大面积轻质薄膜后，会受到更明显的稀薄大气阻力，使轨道逐渐衰减并加快进入大气层的过程。',
    howItWorksEn: 'A spacecraft deploys a large lightweight sail that increases drag from the thin upper atmosphere, causing its orbit to decay faster and accelerating its eventual atmospheric entry.',
    bestFor: '更适合低地球轨道中的小型卫星和 CubeSat。这类装置通常在发射前安装，任务结束后展开，帮助卫星加快自身离轨。',
    bestForEn: 'It is better suited to small satellites and CubeSats in low Earth orbit. The sail is typically installed before launch and deployed after the mission to accelerate the satellite’s own orbital decay.',
    limitations: '阻力帆依赖低轨仍然存在的稀薄大气，因此适用轨道范围有限。处理已经失控的旧碎片时，还需要先通过其他方式把装置连接到目标上。',
    limitationsEn: 'Drag sails depend on the residual atmosphere in low Earth orbit, so their useful orbital range is limited. Existing uncontrolled debris would first require another method to attach the device.',
    takeaway: '阻力帆通过增加大气阻力，加快低轨卫星自然离轨。',
    takeawayEn: 'Drag sails increase atmospheric drag and accelerate the natural orbital decay of low-Earth-orbit satellites.',
  },
]

function localizeMethod(method, language) {
  if (language !== 'en') return method
  return {
    ...method,
    label: method.labelEn,
    title: method.titleEn,
    action: method.actionEn,
    howItWorks: method.howItWorksEn,
    bestFor: method.bestForEn,
    limitations: method.limitationsEn,
    takeaway: method.takeawayEn,
  }
}

const TARGET_SCENARIOS = {
  laser: {
    code: 'A-17',
    type: '高速碎片群',
    typeEn: 'High-speed debris cluster',
    name: '厘米级碎片群',
    nameEn: 'Centimeter-Scale Debris Cluster',
    diagnosis: '一次在轨解体产生了多块厘米级碎片，它们体积小、数量多，并继续高速绕地球运行。逐个接近并进行机械捕获的效率很低。',
    diagnosisEn: 'An orbital breakup has produced multiple centimeter-scale fragments. They are small, numerous, and continue travelling at orbital velocity, making individual mechanical capture inefficient.',
    size: '1–10 cm',
    motion: '高速运行',
    motionEn: 'High orbital speed',
    thirdLabel: 'NUMBER',
    thirdValue: '多个碎片',
    thirdValueEn: 'Multiple fragments',
  },
  arm: {
    code: 'B-04',
    type: '完整大型目标',
    typeEn: 'Intact large target',
    name: '失效大型残骸',
    nameEn: 'Large Defunct Object',
    diagnosis: '这是一块已经失去控制的大型航天器残骸，主体结构仍然完整，目前正在轨道中缓慢翻滚。目标尺寸较大，可以从近距离识别其外部结构。',
    diagnosisEn: 'This large spacecraft remnant is no longer under control, but its main structure remains intact. It is slowly tumbling in orbit and has external structures that can be identified at close range.',
    size: '2.4 m / 620 kg',
    motion: '缓慢翻滚',
    motionEn: 'Slow tumble',
    thirdLabel: 'STRUCTURE',
    thirdValue: '主体完整',
    thirdValueEn: 'Intact body',
  },
  sail: {
    code: 'C-22',
    type: '低轨可控目标',
    typeEn: 'Controlled LEO target',
    name: '任务末期小卫星',
    nameEn: 'End-of-Life Small Satellite',
    diagnosis: '这颗低轨小卫星已经完成任务，机体保持完整，目前仍能响应控制指令。它质量较低、轨道高度不高，正在等待任务后的离轨处置。',
    diagnosisEn: 'This small satellite in low Earth orbit has completed its mission and remains structurally intact. It can still respond to control commands and is awaiting end-of-life disposal.',
    size: '小型卫星',
    sizeEn: 'Small satellite',
    motion: '姿态可控',
    motionEn: 'Controlled',
    thirdLabel: 'ORBIT',
    thirdValue: '低地球轨道',
    thirdValueEn: 'Low Earth orbit',
  },
}

function localizeTarget(target, language, index) {
  if (language !== 'en') return target
  const copy = TARGET_SCENARIOS[target.ideal]
  return {
    ...target,
    type: copy.typeEn,
    name: copy.nameEn,
    diagnosis: copy.diagnosisEn,
    size: copy.sizeEn || copy.size,
    motion: copy.motionEn,
    thirdLabel: copy.thirdLabel,
    thirdValue: copy.thirdValueEn,
    source: `TARGET ${String(index + 1).padStart(2, '0')} · GENERATED FROM CURRENT MISSION`,
  }
}

const METHOD_MAP = Object.fromEntries(METHODS.map((method) => [method.id, method]))
const CLEANUP_FLOW_TEXT = METHODS
  .map((method) => `${method.title} · ${method.action}`)
  .join('  ·  ')
const CLEANUP_FLOW_MARQUEE_TEXT = `${CLEANUP_FLOW_TEXT}  ·  ${CLEANUP_FLOW_TEXT}  ·  `
const CLEANUP_FLOW_LINES = [
  {
    id: 'cleanup-upper-01',
    fontSize: 16,
    opacity: 0.24,
    offset: -80,
    d: 'M -220 118 C 40 12 320 218 586 112 C 846 12 992 222 1240 112 C 1490 4 1648 220 1910 108 C 2102 28 2208 110 2280 74',
  },
  {
    id: 'cleanup-upper-02',
    fontSize: 17,
    opacity: 0.2,
    offset: -360,
    d: 'M -240 288 C 48 414 318 168 606 286 C 860 390 1012 172 1260 280 C 1508 388 1668 170 1916 278 C 2100 358 2210 270 2284 318',
  },
  {
    id: 'cleanup-lower-01',
    fontSize: 16,
    opacity: 0.16,
    offset: -620,
    d: 'M -250 520 C 44 398 336 644 626 514 C 884 402 1038 644 1288 508 C 1532 376 1696 640 1942 500 C 2116 402 2220 526 2290 472',
  },
  {
    id: 'cleanup-lower-02',
    fontSize: 15,
    opacity: 0.12,
    offset: -880,
    d: 'M -260 742 C 48 868 340 592 646 724 C 918 844 1050 602 1310 718 C 1564 832 1718 594 1976 710 C 2140 784 2242 712 2300 760',
  },
]

const MATERIAL_META = {
  frame: { aluminum: '铝合金主体结构', titanium: '钛合金主体结构', cfrp: '碳纤维复合主体结构' },
  solar: { silicon: '硅基刚性电池板', gaas: '砷化镓多结电池板', flexible: '柔性薄膜阵列' },
  insulation: {
    aluminized: '镀铝聚酯薄膜',
    kapton: '镀铝聚酰亚胺薄膜',
    ceramic: '玻璃纤维外层材料',
    mli: '多层铝箔隔热毯',
    honeycomb: '铝蜂窝板',
    kevlar: '凯夫拉吸收层',
  },
  propulsion: {
    'aluminum-tank': '铝合金贮箱',
    'composite-tank': '复合材料缠绕贮箱',
    'titanium-tank': '钛合金贮箱',
    ti_tank: '钛合金球形贮箱',
    al_tank: '铝合金贮箱',
    copv: '复合材料缠绕贮箱',
  },
}

function materialLabel(materials, part, fallback) {
  return MATERIAL_META[part]?.[materials?.[part]] || fallback
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function shuffleTargets(list) {
  return [...list].sort(() => Math.random() - 0.5)
}

function buildTargets({ gameResult, materials, debrisGenerated, satellite }) {
  const event = debrisGenerated?.[0] || '任务末期结构老化与外露部件脱落'
  const frame = materialLabel(materials, 'frame', '卫星主框架')
  const solar = materialLabel(materials, 'solar', '太阳能板')
  const insulation = materialLabel(materials, 'insulation', '隔热层')
  const propulsion = materialLabel(materials, 'propulsion', '推进系统')
  const failed = (typeof gameResult === 'string' ? gameResult : gameResult?.result) === 'failure'
  const satelliteName = satellite?.name || '任务卫星'

  const laserTarget = pickRandom([
    { id: 'fragment-cloud', code: 'A-17', type: '碎片云', size: '1–10 cm', motion: '高速分散', name: solar + '与' + insulation + '形成的小碎片群', source: 'M4 事件：' + event },
    { id: 'paint-flakes', code: 'A-31', type: '微小剥落物', size: '3–7 cm', motion: '密集漂移', name: '漆片、薄膜与绝热材料混合碎片', source: '随机目标：多点反射信号' },
    { id: 'panel-splinters', code: 'A-42', type: '板材碎片群', size: '5–12 cm', motion: '轨道相位分散', name: solar + '断裂后形成的薄片群', source: '随机目标：雷达散射截面低' },
  ])

  const armTarget = pickRandom([
    { id: 'intact-body', code: 'B-04', type: failed ? '失控主体' : '退役主体', size: '2.4 m / 620 kg', motion: failed ? '姿态翻滚' : '缓慢漂移', name: frame + '与' + propulsion + '构成的完整主体', source: 'M4 结算：护甲 ' + (gameResult?.finalArmor ?? '—') + ' / 燃料 ' + (gameResult?.finalFuel ?? '—') },
    { id: 'rocket-stage', code: 'B-16', type: '火箭末级', size: '8.1 m / 1.8 t', motion: '低速滚转', name: '失去控制的上面级壳体', source: '随机目标：大型完整回波' },
    { id: 'adapter-ring', code: 'B-27', type: '适配器结构', size: '1.6 m / 180 kg', motion: '稳定漂移', name: '带有可夹持边缘的环形结构', source: '随机目标：可建立刚性接触' },
  ])

  const sailTarget = pickRandom([
    { id: 'end-of-life', code: 'C-22', type: '预防性处置', size: '低轨小卫星', motion: '仍可控制', name: satelliteName + '的寿命末期平台', source: 'M1 轨道：' + (satellite?.altitudeKm ?? 836) + ' km / 倾角 ' + (satellite?.inclination ?? 98) + '°' },
    { id: 'cubesat', code: 'C-08', type: '立方星', size: '12U / 26 kg', motion: '轨道自然衰减慢', name: '任务结束但仍能触发装置的小卫星', source: '随机目标：低轨可控目标' },
    { id: 'leo-platform', code: 'C-35', type: '低轨平台', size: '60×40×30 cm', motion: '速度稳定', name: '可部署末期离轨装置的低轨载荷', source: '随机目标：尚未解体' },
  ])

  return shuffleTargets([
    { ...laserTarget, ...TARGET_SCENARIOS.laser, ideal: 'laser' },
    { ...armTarget, ...TARGET_SCENARIOS.arm, ideal: 'arm' },
    { ...sailTarget, ...TARGET_SCENARIOS.sail, ideal: 'sail' },
  ])
}

function buildAssessment(target, method, correct, language = 'zh') {
  if (language === 'en') {
    if (correct) return `${method.title} matches the target scale, motion, and contact conditions. ${method.howItWorks}`
    const idealMethod = localizeMethod(METHOD_MAP[target.ideal], language)
    return `${method.title} is not suitable for this target. A ${idealMethod.action.toLowerCase()} approach is a better match: ${idealMethod.title}.`
  }
  if (correct) return `${method.title}与目标尺度、运动状态和接触条件匹配。${method.howItWorks}`
  const ideal = METHOD_MAP[target.ideal]
  return `${method.title}不适合当前目标：${method.limitations} 这里更需要“${ideal.action}”，优先考虑${ideal.title}。`
}

const BACKEND_METHOD_TO_UI_METHOD = {
  LASER_ABLATION: 'laser',
  ROBOTIC_ARM_CAPTURE: 'arm',
  DRAG_SAIL: 'sail',
}

function buildRestoredResults(targets, resolvedMatches, language) {
  return Object.fromEntries((resolvedMatches || []).flatMap((match) => {
    const methodId = BACKEND_METHOD_TO_UI_METHOD[match.method_id]
    const target = targets.find((item) => item.ideal === methodId)
    const method = methodId ? localizeMethod(METHOD_MAP[methodId], language) : null
    if (!target || !method) return []
    return [[target.id, {
      correct: true,
      methodId,
      message: buildAssessment(target, method, true, language),
    }]]
  }))
}

const METHOD_CARD_TRANSITION = {
  type: 'tween',
  duration: 0.52,
  ease: [0.16, 1, 0.3, 1],
  layout: {
    type: 'tween',
    duration: 0.58,
    ease: [0.16, 1, 0.3, 1],
  },
}

const METHOD_CARD_LAYOUTS = [
  { y: -22, rotate: -10, zIndex: 2 },
  { y: 26, rotate: 7, zIndex: 3 },
  { y: -54, rotate: -4, zIndex: 4 },
  { y: 18, rotate: 8, zIndex: 5 },
  { y: -34, rotate: -7, zIndex: 6 },
  { y: 24, rotate: 5, zIndex: 7 },
]

const ACTIVE_METHOD_CARD_X = -118
const COLLAPSED_METHOD_SPREAD = 0.66

function MethodCard({ method, index, activeMethodId, cardSpacing, middle, onActivate }) {
  const { pick } = useI18n()
  const isActive = activeMethodId === method.id
  const hasActive = Boolean(activeMethodId)
  const offsetX = (index - middle) * cardSpacing
  const layout = METHOD_CARD_LAYOUTS[index % METHOD_CARD_LAYOUTS.length]
  const activeIndex = METHODS.findIndex((item) => item.id === activeMethodId)
  const activeOffsetX = activeIndex >= 0 ? (activeIndex - middle) * cardSpacing : 0
  const collapsedCenterCompensation = hasActive ? (activeOffsetX * COLLAPSED_METHOD_SPREAD) / (METHODS.length - 1) : 0
  const collapsedX = ACTIVE_METHOD_CARD_X + offsetX * COLLAPSED_METHOD_SPREAD + collapsedCenterCompensation

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onActivate(null)
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onActivate(isActive ? null : method.id)
  }

  return (
    <motion.article
      layout="size"
      layoutDependency={isActive}
      role="button"
      tabIndex={0}
      className={`m6-method-card ${isActive ? 'is-active' : ''} ${hasActive ? 'has-active' : ''}`}
      aria-pressed={isActive}
      aria-label={pick(`${method.title}，查看清理方式说明`, `${method.title}, view cleanup method details`)}
      onClick={(event) => {
        event.stopPropagation()
        onActivate(isActive ? null : method.id)
      }}
      onKeyDown={handleKeyDown}
      initial={{ opacity: 0, x: 0, y: 18, scale: 0.82 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      animate={{
        x: isActive ? ACTIVE_METHOD_CARD_X : hasActive ? collapsedX : offsetX,
        y: isActive ? 58 : hasActive ? 272 : layout.y,
        rotate: isActive ? 0 : hasActive ? layout.rotate * 0.3 : layout.rotate,
        scale: isActive ? 1 : hasActive ? 0.88 : 1,
      }}
      whileHover={{
        scale: isActive ? 1 : hasActive ? 0.9 : 1.04,
      }}
      transition={METHOD_CARD_TRANSITION}
      style={{ zIndex: isActive ? 50 : layout.zIndex }}
    >
      <div className="m6-method-card-media">
        <img src={method.image} alt="" loading="lazy" decoding="async" draggable="false" />
      </div>
      <div className="m6-method-card-copy">
        <div className="m6-method-card-meta">
          <span>{String(index + 1).padStart(2, '0')}</span>
        </div>
        <span className="m6-method-card-en">{method.label}</span>
        <h4>{method.title}</h4>
        <p>{method.howItWorks}</p>
      </div>
    </motion.article>
  )
}

function MethodObservatory() {
  const { language, pick } = useI18n()
  const [activeMethodId, setActiveMethodId] = useState(null)
  const [cardSpacing, setCardSpacing] = useState(136)
  const methods = METHODS.map((method) => localizeMethod(method, language))
  const methodMap = Object.fromEntries(methods.map((method) => [method.id, method]))
  const middle = (METHODS.length - 1) / 2
  const activeMethod = activeMethodId ? methodMap[activeMethodId] : null

  useEffect(() => {
    if (!activeMethodId) return undefined

    function closeActiveMethod() {
      setActiveMethodId(null)
    }

    document.addEventListener('click', closeActiveMethod, true)
    return () => document.removeEventListener('click', closeActiveMethod, true)
  }, [activeMethodId])

  useEffect(() => {
    function updateCardSpacing() {
      if (window.matchMedia('(max-width: 720px)').matches) {
        setCardSpacing(76)
        return
      }
      if (window.matchMedia('(max-width: 1000px)').matches) {
        setCardSpacing(104)
        return
      }
      setCardSpacing(136)
    }

    updateCardSpacing()
    window.addEventListener('resize', updateCardSpacing)
    return () => window.removeEventListener('resize', updateCardSpacing)
  }, [])

  return (
    <section className="m6-observatory" aria-label={pick('清理方式卡片', 'Cleanup method cards')}>
      <div className={`m6-method-stack ${activeMethodId ? 'has-active-card' : ''}`} onClick={() => setActiveMethodId(null)}>
        <AnimatePresence>
          {activeMethod && (
            <motion.aside
              key={activeMethod.id}
              className="m6-method-side-note"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <span>{activeMethod.label}</span>
              <h3>{activeMethod.title}</h3>
              <dl>
                <div><dt>{pick('工作原理', 'HOW IT WORKS')}</dt><dd>{activeMethod.howItWorks}</dd></div>
                <div><dt>{pick('适用场景', 'BEST FOR')}</dt><dd>{activeMethod.bestFor}</dd></div>
                <div><dt>{pick('技术边界', 'LIMITATIONS')}</dt><dd>{activeMethod.limitations}</dd></div>
              </dl>
              <strong className="m6-method-takeaway">{activeMethod.takeaway}</strong>
            </motion.aside>
          )}
        </AnimatePresence>
        {methods.map((method, index) => (
          <MethodCard
            key={method.id}
            method={method}
            index={index}
            activeMethodId={activeMethodId}
            cardSpacing={cardSpacing}
            middle={middle}
            onActivate={setActiveMethodId}
          />
        ))}
      </div>
    </section>
  )
}

function DragMatchLab({
  targets,
  resolvedMatches,
  onComplete,
  onStoryMatch,
}) {
  const { language, pick } = useI18n()
  const methods = METHODS.map((method) => localizeMethod(method, language))
  const methodMap = Object.fromEntries(methods.map((method) => [method.id, method]))
  const dragMethods = methods.filter((method) => ['laser', 'arm', 'sail'].includes(method.id))
  const [selectedMethodId, setSelectedMethodId] = useState(null)
  const [draggingMethodId, setDraggingMethodId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [draftMatches, setDraftMatches] = useState({})
  const [results, setResults] = useState(
    () => buildRestoredResults(targets, resolvedMatches, language),
  )
  const [attempts, setAttempts] = useState(
    () => Object.keys(buildRestoredResults(targets, resolvedMatches, language)).length,
  )
  const [pendingTargetId, setPendingTargetId] = useState(null)
  const [requestError, setRequestError] = useState('')
  const [storyBeat, setStoryBeat] = useState('')
  const [latestStorySnapshot, setLatestStorySnapshot] = useState(null)

  const resolvedCount = targets.filter((target) => results[target.id]?.correct).length
  const allResolved = resolvedCount === targets.length
  const efficiency = attempts ? Math.round((resolvedCount / attempts) * 100) : 0
  const selectedMethod = selectedMethodId ? methodMap[selectedMethodId] : null
  const lockedMethodIds = new Set(Object.values(results).filter((result) => result.correct).map((result) => result.methodId))

  useEffect(() => {
    const restored = buildRestoredResults(targets, resolvedMatches, language)
    const restoredCount = Object.keys(restored).length
    if (!restoredCount) return
    setResults((current) => ({ ...restored, ...current }))
    setAttempts((current) => Math.max(current, restoredCount))
  }, [language, resolvedMatches, targets])

  function assignTarget(targetId, methodId) {
    const target = targets.find((item) => item.id === targetId)
    const method = methodMap[methodId]
    if (
      pendingTargetId
      || !target
      || !method
      || results[targetId]?.correct
      || lockedMethodIds.has(methodId)
    ) return
    setDraftMatches((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([draftTargetId, draftMethodId]) => draftTargetId !== targetId && draftMethodId !== methodId),
      )
      return { ...next, [targetId]: methodId }
    })
    if (results[targetId] && !results[targetId].correct) {
      setResults((current) => {
        const next = { ...current }
        delete next[targetId]
        return next
      })
    }
    setSelectedMethodId(null)
    setDraggingMethodId(null)
    setDragOverId(null)
  }

  async function confirmMatches() {
    const entries = Object.entries(draftMatches).filter(([targetId]) => !results[targetId]?.correct)
    if (!entries.length || pendingTargetId) return

    setRequestError('')
    setStoryBeat('')
    setSelectedMethodId(null)
    setDraggingMethodId(null)
    setDragOverId(null)

    let nextResults = { ...results }
    const committedTargetIds = []
    let committedCount = 0

    for (const [targetId, methodId] of entries) {
      const target = targets.find((item) => item.id === targetId)
      const method = methodMap[methodId]
      if (!target || !method) continue
      const correct = target.ideal === methodId

      if (correct) {
        setPendingTargetId(targetId)
        try {
          const storySnapshot = await onStoryMatch({
            idealMethodId: target.ideal,
            uiTargetId: target.id,
          })
          setLatestStorySnapshot(storySnapshot)
          setStoryBeat(
            storySnapshot.current_stage?.display_content?.story_text
            || storySnapshot.current_stage?.stage_summary
            || '',
          )
        } catch (error) {
          setRequestError(
            error?.message
            || pick('故事推进失败，配对尚未提交。请重试。', 'Story generation failed, so the match was not committed. Please retry.'),
          )
          setPendingTargetId(null)
          break
        }
      }

      nextResults = {
        ...nextResults,
        [targetId]: { correct, methodId, message: buildAssessment(target, method, correct, language) },
      }
      setResults(nextResults)
      committedTargetIds.push(targetId)
      committedCount += 1
    }

    if (committedTargetIds.length) {
      setAttempts((current) => current + committedCount)
      setDraftMatches((current) => Object.fromEntries(
        Object.entries(current).filter(([targetId]) => !committedTargetIds.includes(targetId)),
      ))
    }
    setPendingTargetId(null)
  }

  function startDrag(event, methodId) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', methodId)
    setSelectedMethodId(methodId)
    setDraggingMethodId(methodId)
  }

  function endDrag() {
    setDraggingMethodId(null)
    setDragOverId(null)
    setSelectedMethodId(null)
  }

  function drop(event, targetId) {
    event.preventDefault()
    assignTarget(targetId, event.dataTransfer.getData('text/plain'))
  }

  function targetKeyDown(event, targetId) {
    if (!selectedMethodId || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    assignTarget(targetId, selectedMethodId)
  }

  return (
    <section className="m6-simulator" aria-labelledby="m6-simulator-title">
      <div className="m6-section-heading">
        <span>03 / QUIZ</span>
        <div>
          <h3 id="m6-simulator-title">
            <span>{pick('清理方式', 'CLEANUP')}</span>
            {' '}
            <span>{pick('小测试', 'MATCHING LAB')}</span>
          </h3>
          <p>{pick('观察每个目标的尺寸、运动状态和结构特点，再从左侧选择合适的清理方式，将卡片拖入对应目标。', 'Examine each target’s size, motion, and structural characteristics, then choose a suitable removal method from the left and drag it onto the matching target.')}</p>
        </div>
      </div>

      <div
        className={['m6-pocket-lab', selectedMethod ? 'is-selecting' : '', draggingMethodId ? 'is-dragging' : ''].join(' ')}
        aria-busy={Boolean(pendingTargetId)}
      >
        <div className="m6-pocket-status" aria-live="polite">
          <span>{pick('目标生成 / 3 个随机轨道物体', 'TARGET SET / 3 ORBITAL OBJECTS')}</span>
          <b>{resolvedCount} / {targets.length} {pick('已归档', 'RESOLVED')}</b>
        </div>
        {(requestError || storyBeat) && (
          <div className={requestError ? 'm6-story-message is-error' : 'm6-story-message'}>
            <span>{requestError ? 'STORY ERROR' : 'STORY UPDATE'}</span>
            <p>{requestError || storyBeat}</p>
          </div>
        )}

        <div className="m6-pocket-stage">
          <aside className="m6-cleanup-deck" aria-label={pick('可拖动清理方式卡片', 'Draggable cleanup method cards')}>
            <div className="m6-deck-label">
              <span>{pick('清理方式', 'CLEANUP METHODS')}</span>
              <small>{draggingMethodId ? `${pick('拖动中', 'DRAGGING')}: ${methodMap[draggingMethodId].title}` : selectedMethod ? `${pick('已选择', 'SELECTED')}: ${selectedMethod.title}` : pick('拖拽或点击选择', 'DRAG OR CLICK TO SELECT')}</small>
            </div>
            <div className="m6-cleanup-card-list">
              {dragMethods.map((method, index) => {
                const selected = selectedMethodId === method.id
                const locked = lockedMethodIds.has(method.id)
                const unavailable = locked || Boolean(pendingTargetId)
                return (
                  <motion.button
                    key={method.id}
                    type="button"
                    className={['m6-cleanup-option', selected ? 'is-selected' : '', locked ? 'is-locked' : ''].join(' ')}
                    draggable={!unavailable}
                    disabled={unavailable}
                    aria-pressed={selected}
                    aria-label={locked ? `${method.title}, ${pick('已完成匹配', 'matched')}` : `${method.title}, ${pick('拖动到目标卡兜', 'drag to a target')}`}
                    onClick={() => setSelectedMethodId((current) => current === method.id ? null : method.id)}
                    onDragStart={(event) => startDrag(event, method.id)}
                    onDragEnd={endDrag}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.24, delay: index * 0.04 }}
                  >
                    <span className="m6-cleanup-option-thumb"><img src={method.image} alt="" loading="lazy" decoding="async" draggable="false" /></span>
                    <span className="m6-cleanup-option-copy">
                      <small>{String(index + 1).padStart(2, '0')} / {method.titleEn}</small>
                      <b>{method.title}</b>
                      <em>{method.action}</em>
                    </span>
                    <span className="m6-cleanup-option-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                  </motion.button>
                )
              })}
            </div>
          </aside>

          <div className="m6-pocket-rack" aria-label={pick('目标卡兜', 'Target pockets')}>
            {targets.map((target, index) => {
              const result = results[target.id]
              const draftMethod = draftMatches[target.id] ? methodMap[draftMatches[target.id]] : null
              const method = draftMethod || (result ? methodMap[result.methodId] : null)
              const isOver = dragOverId === target.id
              const ready = Boolean(selectedMethodId && !result?.correct)
              const pending = pendingTargetId === target.id
              return (
                <motion.div
                  key={target.id}
                  className={['m6-card-pocket', isOver ? 'is-over' : '', ready ? 'is-ready' : '', pending ? 'is-pending' : '', result?.correct ? 'is-correct' : '', result && !result.correct ? 'is-wrong' : ''].join(' ')}
                  role="button"
                  tabIndex={result?.correct ? -1 : 0}
                  aria-label={`${target.type}, ${target.name}${ready ? `, ${pick('点击投放所选技术', 'click to apply the selected method')}` : ''}`}
                  onClick={() => selectedMethodId && assignTarget(target.id, selectedMethodId)}
                  onKeyDown={(event) => targetKeyDown(event, target.id)}
                  onDragEnter={(event) => { event.preventDefault(); if (!result?.correct) setDragOverId(target.id) }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOverId(null) }}
                  onDrop={(event) => drop(event, target.id)}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.26, delay: index * 0.05 }}
                >
                  <div className="m6-pocket-shell">
                    <div className="m6-pocket-head">
                      <span>{target.code}</span>
                      <small>{target.type}</small>
                    </div>
                    <div className="m6-pocket-title">
                      <h4>{target.name}</h4>
                      <p>{target.diagnosis}</p>
                    </div>
                    <div className={['m6-pocket-groove', method ? 'has-card' : '', result?.correct ? 'is-correct' : '', result && !result.correct ? 'is-wrong' : ''].join(' ')} aria-hidden="true">
                      <span className="m6-pocket-groove-line" />
                      <AnimatePresence mode="wait">
                        {method && (
                          <motion.div
                            key={target.id + '-insert-' + method.id}
                            className="m6-pocket-inserted-card"
                            initial={{ opacity: 0, y: -16, rotate: -1.8 }}
                            animate={{ opacity: 1, y: 0, rotate: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <img src={method.image} alt="" loading="lazy" decoding="async" draggable="false" />
                            <span>
                              <b>{method.title}</b>
                              <small>{result?.correct ? pick('已入袋 / 匹配完成', 'INSERTED / MATCHED') : pick('已入袋 / 需要重试', 'INSERTED / RETRY')}</small>
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <i className="m6-pocket-lip" />
                    </div>
                    <div className="m6-pocket-meta">
                      <span><b>SIZE</b>{target.size}</span>
                      <span><b>MOTION</b>{target.motion}</span>
                      <span><b>{target.thirdLabel}</b>{target.thirdValue}</span>
                    </div>
                    <div className="m6-pocket-slot">
                      <span>{pending ? pick('正在生成故事节点', 'GENERATING STORY BEAT') : result?.correct ? pick('匹配完成', 'MATCHED') : result ? pick('方式不合适', 'NOT SUITABLE') : draftMethod ? pick('已选择，等待确定', 'SELECTED, READY TO CONFIRM') : isOver ? pick('松开装入卡兜', 'DROP TO APPLY') : pick('拖入合适的清理方式', 'DRAG IN A SUITABLE REMOVAL METHOD')}</span>
                      <small>{pending ? pick('AI 成功后才会锁定本次配对。', 'This match is committed only after the AI response succeeds.') : result && !result.correct ? result.message : ''}</small>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
        <button
          className="m6-pocket-confirm"
          type="button"
          disabled={!Object.keys(draftMatches).length || Boolean(pendingTargetId)}
          onClick={() => void confirmMatches()}
        >
          {pendingTargetId ? pick('正在生成故事', 'GENERATING STORY') : pick('确认选择', 'CONFIRM SELECTION')}
        </button>
      </div>

      <div className={['m6-match-completion', allResolved ? 'is-ready' : ''].join(' ')}>
        <div><span>{pick('完成度', 'COMPLETION')}</span><strong>{resolvedCount}/{targets.length}</strong></div>
        <div><span>{pick('匹配效率', 'EFFICIENCY')}</span><strong>{efficiency}%</strong></div>
        <p>{allResolved ? pick('目标与清理方式已全部对应。', 'Every target now has a suitable cleanup method.') : pick('完成三个卡兜匹配后进入下一章节。', 'Resolve all three targets to continue.')}</p>
        <button
          type="button"
          disabled={!allResolved || Boolean(pendingTargetId)}
          onClick={() => onComplete(efficiency, latestStorySnapshot)}
        >
          {pick('继续下一章', 'Continue')}
        </button>
      </div>
    </section>
  )
}

export default function M6({ onComplete }) {
  const { language, pick } = useI18n()
  const { user, satellite, materials, gameResult, debrisGenerated, setStoryChapter } = useAppStore()
  const resolvedCleanupMatches = useAppStore(
    (state) => state.publicGameState?.cleanup_test?.matches,
  )
  const restoredFinalStory = useAppStore((state) => state.finalStory)
  const rawTargets = useMemo(() => buildTargets({ gameResult, materials, debrisGenerated, satellite }), [debrisGenerated, gameResult, materials, satellite])
  const targets = useMemo(
    () => rawTargets.map((target, index) => localizeTarget(target, language, index)),
    [language, rawTargets],
  )
  const cleanupFlowText = METHODS
    .map((method) => {
      const localized = localizeMethod(method, language)
      return `${localized.title} · ${localized.action}`
    })
    .join('  ·  ')
  const cleanupFlowMarquee = language === 'en'
    ? `${cleanupFlowText}  ·  ${cleanupFlowText}  ·  `
    : CLEANUP_FLOW_MARQUEE_TEXT

  function finishModule(efficiency, storySnapshot) {
    const satelliteName = satellite?.name || pick('任务卫星', 'mission satellite')
    const fallbackEpilogue = pick(
      `${user?.name || '任务指挥员'}为${satelliteName}完成了三类清理决策，决策效率为 ${efficiency}%。真正有效的轨道治理，从来不是寻找一种万能技术，而是让目标、时机与处置方法准确对应。`,
      `${user?.name || 'The mission operator'} completed three cleanup decisions for ${satelliteName} with ${efficiency}% efficiency. Effective orbital governance depends on matching the target, timing, and disposal method rather than relying on one universal technology.`,
    )
    const finalStory = storySnapshot?.final_story_if_completed || restoredFinalStory
    const ending = finalStory?.ending?.story_text || fallbackEpilogue
    const knowledgeReveal = finalStory?.knowledge_reveal?.story_text || ''
    setStoryChapter('m6', ending)
    if (knowledgeReveal) setStoryChapter('knowledgeReveal', knowledgeReveal)
    onComplete()
  }

  return (
    <div className="m6" data-module-scroll-target>
      <div className="m6-cleanup-flow-field" aria-hidden="true">
        {CLEANUP_FLOW_LINES.map((line) => (
          <svg
            key={line.id}
            className="m6-cleanup-flow-layer"
            viewBox="0 0 2000 900"
            preserveAspectRatio="none"
            style={{
              '--m6-flow-opacity': line.opacity,
              '--m6-flow-font-size': `${line.fontSize}px`,
            }}
          >
            <path id={`m6-cleanup-flow-path-${line.id}`} d={line.d} fill="none" />
            <text className="m6-cleanup-flow-text">
              <textPath href={`#m6-cleanup-flow-path-${line.id}`} startOffset={line.offset}>
                {cleanupFlowMarquee}
              </textPath>
            </text>
          </svg>
        ))}
      </div>
      <header className="m6-hero">
        <div className="m6-hero-copy">
          <span>{pick('模块 06 / 轨道清理', 'MODULE 06 / ORBITAL DEBRIS REMOVAL')}</span>
          <h2>
            <span>{pick('太空垃圾清理方法', 'Space Debris Removal Methods')}</span>
          </h2>
          <div className="m6-hero-rule" aria-hidden="true" />
          <p>
            {pick(
              '太空垃圾的尺寸、形状和运动状态各不相同。机械臂、柔性网和鱼叉可以捕获大型目标，激光可用于改变部分小型碎片的轨道，电动力绳索和阻力帆则可以帮助目标降低轨道。',
              'Space debris varies in size, shape, and motion. Robotic arms, nets, and harpoons can be used to capture large targets, lasers can alter the orbits of some smaller fragments, while electrodynamic tethers and drag sails can help lower an object’s orbit.',
            )}
          </p>
        </div>
        <MethodObservatory />
      </header>
      <DragMatchLab
        targets={targets}
        resolvedMatches={resolvedCleanupMatches || []}
        onComplete={finishModule}
        onStoryMatch={submitCleanupPairStoryAction}
      />
      <footer className="m6-sources">
        <span>{pick('资料依据', 'SOURCES')}</span>
        <a href="https://sdup.esoc.esa.int/discosweb/statistics/" target="_blank" rel="noreferrer">ESA Space Environment Statistics</a>
        <a href="https://www.esa.int/Space_Safety/ClearSpace-1" target="_blank" rel="noreferrer">ESA ClearSpace-1</a>
        <a href="https://www.nasa.gov/smallsat-institute/sst-soa/deorbit-systems/" target="_blank" rel="noreferrer">NASA Deorbit Systems</a>
      </footer>
    </div>
  )
}
