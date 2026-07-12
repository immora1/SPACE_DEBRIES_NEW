import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import './index.css'

const METHODS = [
  {
    id: 'laser',
    image: '/cleanup/1.png',
    title: '激光烧蚀',
    titleEn: 'LASER ABLATION',
    status: '研究阶段',
    statusTone: 'research',
    mode: '非接触',
    target: '1–10 cm 小碎片',
    action: '微量改轨',
    object: '适合数量多、尺寸小、无法逐个捕获的碎片群，例如太阳能板碎片、隔热层剥落物和碰撞后形成的小颗粒。',
    reason: '这类目标太小、速度太快，派航天器靠近反而风险更高。激光可以在远距离施加微小反冲，让碎片轨道逐步降低或避开关键轨道。',
    principle: '用短脉冲加热目标表面，烧蚀喷流产生微小反冲，使碎片轨道逐步改变。',
    limit: '需要极高的跟踪与指向精度，并持续确认光束不会影响正常航天器。',
  },
  {
    id: 'arm',
    image: '/cleanup/2.png',
    title: '机械臂抓取',
    titleEn: 'ROBOTIC CAPTURE',
    status: '任务开发',
    statusTone: 'development',
    mode: '刚性接触',
    target: '完整卫星 / 火箭体',
    action: '固定并离轨',
    object: '主要针对还保持完整结构的大型废弃卫星、火箭末级和失控平台。',
    reason: '大型目标质量集中，一旦碰撞会制造大量碎片。机械臂能先建立刚性连接，再把目标稳定拖离拥挤轨道。',
    principle: '服务航天器近距离绕飞目标，估计翻滚状态后用多臂结构包络、固定并拖离拥挤轨道。',
    limit: '面对无对接口、失去控制且持续翻滚的目标，接近和接触阶段风险最高。',
  },
  {
    id: 'net',
    image: '/cleanup/3.png',
    title: '柔性捕捉网',
    titleEn: 'FLEXIBLE NET',
    status: '在轨演示',
    statusTone: 'tested',
    mode: '柔性接触',
    target: '不规则中型目标',
    action: '包络捕获',
    object: '适合外形不规则、没有标准对接口、但尺寸仍足以被包覆的中型残骸。',
    reason: '目标表面可能破损、凸起或翻滚，刚性对接不容易成功。柔性网可以降低对接口要求，用包覆方式先获得控制。',
    principle: '发射展开的高强度网，从多个方向包裹没有标准接口的目标，再通过缆绳控制组合体。',
    limit: '网体展开、闭合和后续拖曳都要避免缠绕失控；一次发射通常只有一次捕获机会。',
  },
  {
    id: 'harpoon',
    image: '/cleanup/4.png',
    title: '飞行鱼叉',
    titleEn: 'HARPOON CAPTURE',
    status: '在轨演示',
    statusTone: 'tested',
    mode: '穿透接触',
    target: '坚硬大型结构',
    action: '锚定拖曳',
    object: '更适合外壳坚硬、可承受锚定冲击的大型残骸，如火箭贮箱、适配器或较厚结构件。',
    reason: '当目标没有可抓取接口、又需要快速建立牵引点时，鱼叉能直接锚定外壳，减少复杂对接步骤。',
    principle: '高速锚体穿入目标外壳，倒钩锁定后通过缆绳施加控制和离轨力。',
    limit: '穿透会向老化结构施加冲击；若材料状态判断错误，可能制造二次碎片。',
  },
  {
    id: 'tether',
    image: '/cleanup/5.png',
    title: '电动力缆索',
    titleEn: 'ELECTRODYNAMIC TETHER',
    status: '持续验证',
    statusTone: 'development',
    mode: '无推进剂',
    target: '寿命末期航天器',
    action: '持续减速',
    object: '主要面向仍能部署装置的低轨航天器、任务末期平台或未来设计时预装的离轨组件。',
    reason: '它不依赖推进剂，适合在航天器寿命末期用持续、温和的方式降低轨道能量。',
    principle: '导电缆索切割地磁场并与电离层交换电流，洛伦兹力持续降低轨道能量。',
    limit: '长缆部署和空间环境耦合复杂，更适合在航天器仍可控时主动启用。',
  },
  {
    id: 'sail',
    image: '/cleanup/6.png',
    title: '阻力帆',
    titleEn: 'DRAG SAIL',
    status: '成熟部署',
    statusTone: 'ready',
    mode: '被动装置',
    target: '低轨小卫星',
    action: '增加阻力',
    object: '适合低轨小卫星、立方星和任务结束前仍能触发部署的航天器。',
    reason: '低轨仍有稀薄大气。展开阻力帆后，航天器受到的阻力变大，可以更快自然衰减并再入。',
    principle: '任务结束时展开轻质大面积薄膜，提高面积质量比，让高层稀薄大气更快消耗轨道能量。',
    limit: '它是预防性离轨装置，不能隔空处理已经脱离航天器的自由碎片。',
  },
]

const METHOD_MAP = Object.fromEntries(METHODS.map((method) => [method.id, method]))
const DRAG_METHODS = METHODS.filter((method) => ['laser', 'arm', 'sail'].includes(method.id))
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
  frame: { aluminum: '铝合金主框架', titanium: '钛合金主框架', cfrp: '碳纤维复合主框架' },
  solar: { silicon: '硅基太阳能板', gaas: '砷化镓太阳能板', flexible: '柔性薄膜太阳能板' },
  insulation: { mli: '多层铝箔隔热毯', honeycomb: '铝蜂窝板', kevlar: '凯夫拉吸收层' },
  propulsion: { ti_tank: '钛合金球形贮箱', al_tank: '铝合金贮箱', copv: '复合材料缠绕贮箱' },
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
    { ...laserTarget, ideal: 'laser', diagnosis: '数量多、单体小，逐个接触捕获不现实。需要非接触方式为大量目标施加微小轨道改变量。' },
    { ...armTarget, ideal: 'arm', diagnosis: '目标质量集中且结构仍完整，需要先稳定相对姿态，再可靠固定并执行受控离轨。' },
    { ...sailTarget, ideal: 'sail', diagnosis: '目标尚未变成自由碎片。此时部署低质量、低复杂度的离轨装置，比事后回收更有效。' },
  ])
}

function buildAssessment(target, method, correct) {
  if (correct) return `${method.title}与目标尺度、运动状态和接触条件匹配。${method.principle}`
  const ideal = METHOD_MAP[target.ideal]
  return `${method.title}不适合当前目标：${method.limit} 这里更需要“${ideal.action}”，优先考虑${ideal.title}。`
}

const METHOD_CARD_TRANSITION = {
  type: 'tween',
  duration: 0.34,
  ease: [0.16, 1, 0.3, 1],
}

const METHOD_CARD_LAYOUTS = [
  { y: -22, rotate: -10, zIndex: 2 },
  { y: 26, rotate: 7, zIndex: 3 },
  { y: -54, rotate: -4, zIndex: 4 },
  { y: 18, rotate: 8, zIndex: 5 },
  { y: -34, rotate: -7, zIndex: 6 },
  { y: 24, rotate: 5, zIndex: 7 },
]

const ACTIVE_METHOD_CARD_X = -142
const COLLAPSED_METHOD_SPREAD = 0.58

function MethodCard({ method, index, activeMethodId, cardSpacing, middle, onActivate }) {
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
    onActivate(method.id)
  }

  return (
    <motion.article
      role="button"
      tabIndex={0}
      className={`m6-method-card ${isActive ? 'is-active' : ''} ${hasActive ? 'has-active' : ''}`}
      aria-pressed={isActive}
      aria-label={`${method.title}，查看清理方式说明`}
      onClick={(event) => {
        event.stopPropagation()
        onActivate(method.id)
      }}
      onKeyDown={handleKeyDown}
      initial={{ opacity: 0, x: 0, y: 18, scale: 0.82 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      animate={{
        x: isActive ? ACTIVE_METHOD_CARD_X : hasActive ? collapsedX : offsetX,
        y: isActive ? 112 : hasActive ? 330 : layout.y,
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
        <span className="m6-method-card-en">{method.titleEn}</span>
        <h4>{method.title}</h4>
        <p>{method.principle}</p>
      </div>
    </motion.article>
  )
}

function MethodObservatory() {
  const [activeMethodId, setActiveMethodId] = useState(null)
  const [cardSpacing, setCardSpacing] = useState(136)
  const middle = (METHODS.length - 1) / 2
  const activeMethod = activeMethodId ? METHOD_MAP[activeMethodId] : null

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
    <section className="m6-observatory" aria-label="清理方式卡片">
      <div className={`m6-method-stack ${activeMethodId ? 'has-active-card' : ''}`} onClick={() => setActiveMethodId(null)}>
        <AnimatePresence>
          {activeMethod && (
            <motion.aside
              key={activeMethod.id}
              className="m6-method-side-note"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <span>{activeMethod.titleEn}</span>
              <h3>{activeMethod.title}</h3>
              <dl>
                <div><dt>适用情况</dt><dd>{activeMethod.reason}</dd></div>
                <div><dt>主要垃圾类型</dt><dd>{activeMethod.object}</dd></div>
                <div><dt>处理边界</dt><dd>{activeMethod.limit}</dd></div>
              </dl>
            </motion.aside>
          )}
        </AnimatePresence>
        {METHODS.map((method, index) => (
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

function DragMatchLab({ targets, onComplete }) {
  const [selectedMethodId, setSelectedMethodId] = useState(null)
  const [draggingMethodId, setDraggingMethodId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [results, setResults] = useState({})
  const [attempts, setAttempts] = useState(0)

  const resolvedCount = targets.filter((target) => results[target.id]?.correct).length
  const allResolved = resolvedCount === targets.length
  const efficiency = attempts ? Math.round((resolvedCount / attempts) * 100) : 0
  const selectedMethod = selectedMethodId ? METHOD_MAP[selectedMethodId] : null
  const lockedMethodIds = new Set(Object.values(results).filter((result) => result.correct).map((result) => result.methodId))

  function matchTarget(targetId, methodId) {
    const target = targets.find((item) => item.id === targetId)
    const method = METHOD_MAP[methodId]
    if (!target || !method || results[targetId]?.correct || lockedMethodIds.has(methodId)) return
    const correct = target.ideal === methodId
    setAttempts((current) => current + 1)
    setResults((current) => ({ ...current, [targetId]: { correct, methodId, message: buildAssessment(target, method, correct) } }))
    setSelectedMethodId(null)
    setDraggingMethodId(null)
    setDragOverId(null)
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
    matchTarget(targetId, event.dataTransfer.getData('text/plain'))
  }

  function targetKeyDown(event, targetId) {
    if (!selectedMethodId || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    matchTarget(targetId, selectedMethodId)
  }

  return (
    <section className="m6-simulator" aria-labelledby="m6-simulator-title">
      <div className="m6-section-heading">
        <span>03 / QUIZ</span>
        <div>
          <h3 id="m6-simulator-title">
            <span>清理方式</span>
            <span>小测试</span>
          </h3>
          <p>先看上方清理方式卡片，再判断随机目标的类型与尺寸，把对应清理卡拖入目标卡兜。</p>
        </div>
      </div>

      <div className={['m6-pocket-lab', selectedMethod ? 'is-selecting' : '', draggingMethodId ? 'is-dragging' : ''].join(' ')}>
        <div className="m6-pocket-status" aria-live="polite">
          <span>目标生成 / 3 个随机轨道物体</span>
          <b>{resolvedCount} / {targets.length} 已归档</b>
        </div>

        <div className="m6-pocket-stage">
          <aside className="m6-cleanup-deck" aria-label="可拖动清理方式卡片">
            <div className="m6-deck-label">
              <span>清理方式</span>
              <small>{draggingMethodId ? '拖动中：' + METHOD_MAP[draggingMethodId].title : selectedMethod ? '已选择：' + selectedMethod.title : '拖拽或点击选择'}</small>
            </div>
            <div className="m6-cleanup-card-list">
              {DRAG_METHODS.map((method, index) => {
                const selected = selectedMethodId === method.id
                const locked = lockedMethodIds.has(method.id)
                return (
                  <motion.button
                    key={method.id}
                    type="button"
                    className={['m6-cleanup-option', selected ? 'is-selected' : '', locked ? 'is-locked' : ''].join(' ')}
                    draggable={!locked}
                    disabled={locked}
                    aria-pressed={selected}
                    aria-label={locked ? method.title + '，已完成匹配' : method.title + '，拖动到目标卡兜'}
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

          <div className="m6-pocket-rack" aria-label="目标卡兜">
            {targets.map((target, index) => {
              const result = results[target.id]
              const method = result ? METHOD_MAP[result.methodId] : null
              const isOver = dragOverId === target.id
              const ready = Boolean(selectedMethodId && !result?.correct)
              return (
                <motion.div
                  key={target.id}
                  className={['m6-card-pocket', isOver ? 'is-over' : '', ready ? 'is-ready' : '', result?.correct ? 'is-correct' : '', result && !result.correct ? 'is-wrong' : ''].join(' ')}
                  role="button"
                  tabIndex={result?.correct ? -1 : 0}
                  aria-label={target.type + '，' + target.name + (ready ? '，点击投放所选技术' : '')}
                  onClick={() => selectedMethodId && matchTarget(target.id, selectedMethodId)}
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
                              <small>{result?.correct ? '已入袋 / 匹配完成' : '已入袋 / 需要重试'}</small>
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <i className="m6-pocket-lip" />
                    </div>
                    <div className="m6-pocket-meta">
                      <span><b>SIZE</b>{target.size}</span>
                      <span><b>MOTION</b>{target.motion}</span>
                    </div>
                    <div className="m6-pocket-slot">
                      <span>{result?.correct ? '匹配完成' : result ? '方式不合适' : isOver ? '松开装入卡兜' : '等待清理卡'}</span>
                      <small>{result && !result.correct ? result.message : target.source}</small>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      <div className={['m6-match-completion', allResolved ? 'is-ready' : ''].join(' ')}>
        <div><span>完成度</span><strong>{resolvedCount}/{targets.length}</strong></div>
        <div><span>匹配效率</span><strong>{efficiency}%</strong></div>
        <p>{allResolved ? '目标与清理方式已全部对应。' : '完成三个卡兜匹配后进入下一章节。'}</p>
        <button type="button" disabled={!allResolved} onClick={() => onComplete(efficiency)}>继续下一章</button>
      </div>
    </section>
  )
}

export default function M6({ onComplete }) {
  const { user, satellite, materials, gameResult, debrisGenerated, setStoryChapter } = useAppStore()
  const targets = useMemo(() => buildTargets({ gameResult, materials, debrisGenerated, satellite }), [debrisGenerated, gameResult, materials, satellite])

  function finishModule(efficiency) {
    const satelliteName = satellite?.name || '任务卫星'
    const epilogue = `${user?.name || '任务指挥员'}为${satelliteName}完成了三类清理决策，决策效率为 ${efficiency}%。真正有效的轨道治理，从来不是寻找一种万能技术，而是让目标、时机与处置方法准确对应。`
    setStoryChapter('m6', epilogue)
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
                {CLEANUP_FLOW_MARQUEE_TEXT}
              </textPath>
            </text>
          </svg>
        ))}
      </div>
      <header className="m6-hero">
        <div className="m6-hero-copy">
          <span>MODULE 06 / ORBITAL CLEANUP</span>
          <h2>
            <span>清理不是</span>
            <span>捡起垃圾</span>
          </h2>
          <div className="m6-hero-rule" aria-hidden="true" />
          <p>每一种目标，都需要不同的接近方式、接触条件和离轨路径。先读懂目标，再决定如何行动。</p>
        </div>
        <MethodObservatory />
      </header>
      <DragMatchLab targets={targets} onComplete={finishModule} />
      <footer className="m6-sources">
        <span>资料依据</span>
        <a href="https://sdup.esoc.esa.int/discosweb/statistics/" target="_blank" rel="noreferrer">ESA Space Environment Statistics</a>
        <a href="https://www.esa.int/Space_Safety/ClearSpace-1" target="_blank" rel="noreferrer">ESA ClearSpace-1</a>
        <a href="https://www.nasa.gov/smallsat-institute/sst-soa/deorbit-systems/" target="_blank" rel="noreferrer">NASA Deorbit Systems</a>
      </footer>
    </div>
  )
}
