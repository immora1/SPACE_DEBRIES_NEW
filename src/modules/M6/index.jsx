import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import './index.css'

const CONSTRAINTS = [
  { id: 'velocity', index: '01', label: '相对速度', value: '14 km/s', summary: '捕获窗口极短' },
  { id: 'quantity', index: '02', label: '常规跟踪物体', value: '45,780', summary: '小碎片远多于可见目标' },
  { id: 'ownership', index: '03', label: '所有权', value: '授权优先', summary: '技术行动必须先获授权' },
  { id: 'economics', index: '04', label: '任务经济性', value: '一对一', summary: '大型目标需要单独交会' },
]

const METHODS = [
  { id: 'laser', image: '/cleanup/1.png', title: '激光烧蚀', titleEn: 'LASER ABLATION', status: '研究阶段', statusTone: 'research', mode: '非接触', target: '1–10 cm 小碎片', action: '微量改轨', principle: '用短脉冲加热目标表面，烧蚀喷流产生微小反冲，使碎片轨道逐步改变。', limit: '需要极高的跟踪与指向精度，并持续确认光束不会影响正常航天器。' },
  { id: 'arm', image: '/cleanup/2.png', title: '机械臂抓取', titleEn: 'ROBOTIC CAPTURE', status: '任务开发', statusTone: 'development', mode: '刚性接触', target: '完整卫星 / 火箭体', action: '固定并离轨', principle: '服务航天器近距离绕飞目标，估计翻滚状态后用多臂结构包络、固定并拖离拥挤轨道。', limit: '面对无对接口、失去控制且持续翻滚的目标，接近和接触阶段风险最高。' },
  { id: 'net', image: '/cleanup/3.png', title: '柔性捕捉网', titleEn: 'FLEXIBLE NET', status: '在轨演示', statusTone: 'tested', mode: '柔性接触', target: '不规则中型目标', action: '包络捕获', principle: '发射展开的高强度网，从多个方向包裹没有标准接口的目标，再通过缆绳控制组合体。', limit: '网体展开、闭合和后续拖曳都要避免缠绕失控；一次发射通常只有一次捕获机会。' },
  { id: 'harpoon', image: '/cleanup/4.png', title: '飞行鱼叉', titleEn: 'HARPOON CAPTURE', status: '在轨演示', statusTone: 'tested', mode: '穿透接触', target: '坚硬大型结构', action: '锚定拖曳', principle: '高速锚体穿入目标外壳，倒钩锁定后通过缆绳施加控制和离轨力。', limit: '穿透会向老化结构施加冲击；若材料状态判断错误，可能制造二次碎片。' },
  { id: 'tether', image: '/cleanup/5.png', title: '电动力缆索', titleEn: 'ELECTRODYNAMIC TETHER', status: '持续验证', statusTone: 'development', mode: '无推进剂', target: '寿命末期航天器', action: '持续减速', principle: '导电缆索切割地磁场并与电离层交换电流，洛伦兹力持续降低轨道能量。', limit: '长缆部署和空间环境耦合复杂，更适合在航天器仍可控时主动启用。' },
  { id: 'sail', image: '/cleanup/6.png', title: '阻力帆', titleEn: 'DRAG SAIL', status: '成熟部署', statusTone: 'ready', mode: '被动装置', target: '低轨小卫星', action: '增加阻力', principle: '任务结束时展开轻质大面积薄膜，提高面积质量比，让高层稀薄大气更快消耗轨道能量。', limit: '它是预防性离轨装置，不能隔空处理已经脱离航天器的自由碎片。' },
]

const METHOD_MAP = Object.fromEntries(METHODS.map((method) => [method.id, method]))
const DRAG_METHODS = METHODS.filter((method) => ['laser', 'arm', 'sail'].includes(method.id))

const MATERIAL_META = {
  frame: { aluminum: '铝合金主框架', titanium: '钛合金主框架', cfrp: '碳纤维复合主框架' },
  solar: { silicon: '硅基太阳能板', gaas: '砷化镓太阳能板', flexible: '柔性薄膜太阳能板' },
  insulation: { mli: '多层铝箔隔热毯', honeycomb: '铝蜂窝板', kevlar: '凯夫拉吸收层' },
  propulsion: { ti_tank: '钛合金球形贮箱', al_tank: '铝合金贮箱', copv: '复合材料缠绕贮箱' },
}

function materialLabel(materials, part, fallback) {
  return MATERIAL_META[part]?.[materials?.[part]] || fallback
}

function buildTargets({ gameResult, materials, debrisGenerated, satellite }) {
  const event = debrisGenerated?.[0] || '任务末期结构老化与外露部件脱落'
  const frame = materialLabel(materials, 'frame', '卫星主框架')
  const solar = materialLabel(materials, 'solar', '太阳能板')
  const insulation = materialLabel(materials, 'insulation', '隔热层')
  const propulsion = materialLabel(materials, 'propulsion', '推进系统')
  const failed = (typeof gameResult === 'string' ? gameResult : gameResult?.result) === 'failure'

  return [
    { id: 'fragment-cloud', code: 'A-17', ideal: 'laser', type: '碎片云', size: '1–10 cm', motion: '高速分散', name: `${solar}与${insulation}形成的碎片群`, source: `M4 事件：${event}`, diagnosis: '数量多、单体小、逐个接触捕获不现实。需要非接触方式为大量目标施加微小轨道改变量。' },
    { id: 'intact-body', code: 'B-04', ideal: 'arm', type: failed ? '失控主体' : '退役主体', size: '大型完整体', motion: failed ? '姿态翻滚' : '缓慢漂移', name: `${frame}与${propulsion}构成的主体`, source: `M4 结算：护甲 ${gameResult?.finalArmor ?? '—'} / 燃料 ${gameResult?.finalFuel ?? '—'}`, diagnosis: '目标质量集中且结构仍完整，必须先稳定相对姿态，再可靠固定并执行受控离轨。' },
    { id: 'end-of-life', code: 'C-22', ideal: 'sail', type: '预防性处置', size: '低轨小卫星', motion: '仍可控制', name: `${satellite?.name || '任务卫星'}的寿命末期平台`, source: `M1 轨道：${satellite?.altitudeKm ?? 836} km / 倾角 ${satellite?.inclination ?? 98}°`, diagnosis: '目标尚未变成自由碎片。此时部署低质量、低复杂度的离轨装置，比事后派专门航天器回收更有效。' },
  ]
}

function buildAssessment(target, method, correct) {
  if (correct) return `${method.title}与目标尺度、运动状态和接触条件匹配。${method.principle}`
  const ideal = METHOD_MAP[target.ideal]
  return `${method.title}不适合当前目标：${method.limit} 这里更需要“${ideal.action}”，优先考虑${ideal.title}。`
}

function MethodCard({ method, index }) {
  const [flipped, setFlipped] = useState(false)

  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setFlipped((current) => !current)
  }

  return (
    <article
      className={`m6-flip-card m6-flip-card-${index + 1} ${flipped ? 'is-flipped' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${method.title}，翻转查看技术说明`}
      onClick={() => setFlipped((current) => !current)}
      onKeyDown={handleKeyDown}
      onBlur={() => setFlipped(false)}
    >
      <div className="m6-flip-card-inner">
        <div className="m6-flip-face m6-flip-front">
          <img src={method.image} alt="" loading="lazy" decoding="async" />
          <div className="m6-flip-image-shade" aria-hidden="true" />
          <div className="m6-flip-front-top">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <small className={`is-${method.statusTone}`}>{method.status}</small>
          </div>
          <div className="m6-flip-front-copy">
            <span>{method.titleEn}</span>
            <h4>{method.title}</h4>
            <p>{method.target}</p>
          </div>
          <span className="m6-flip-hint">悬停查看原理</span>
        </div>

        <div className="m6-flip-face m6-flip-back">
          <div className="m6-flip-back-head">
            <span>{method.titleEn}</span>
            <small>{method.mode}</small>
          </div>
          <h4>{method.title}</h4>
          <dl>
            <div><dt>目标</dt><dd>{method.target}</dd></div>
            <div><dt>动作</dt><dd>{method.action}</dd></div>
          </dl>
          <div className="m6-flip-back-copy">
            <span>工作机制</span>
            <p>{method.principle}</p>
          </div>
          <div className="m6-flip-back-limit">
            <span>使用边界</span>
            <p>{method.limit}</p>
          </div>
        </div>
      </div>
    </article>
  )
}

function MethodObservatory() {
  return (
    <section className="m6-observatory" aria-labelledby="m6-methods-title">
      <div className="m6-section-heading m6-section-heading-light">
        <span>01–02 / CONSTRAINTS × METHODS</span>
        <h3 id="m6-methods-title">先看限制，再选择清理方式。</h3>
      </div>
      <div className="m6-method-context" aria-label="清理任务关键限制">
        {CONSTRAINTS.map((item) => (
          <div key={item.id}>
            <span>{item.index} / {item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.summary}</p>
          </div>
        ))}
      </div>
      <div className="m6-method-grid">
        {METHODS.map((method, index) => (
          <MethodCard key={method.id} method={method} index={index} />
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
        <span>03 / DRAG TO MATCH</span>
        <div>
          <h3 id="m6-simulator-title">拖动技术，匹配目标。</h3>
          <p>从左侧选择一种技术，向右拖到适合的目标。</p>
        </div>
      </div>

      <div className={`m6-match-board ${selectedMethod ? 'is-selecting' : ''} ${draggingMethodId ? 'is-dragging' : ''}`}>
        <div className="m6-drag-guide" aria-hidden="true">
          <span className="m6-guide-grip"><i /><i /><i /><i /><i /><i /></span>
          <b>抓住技术卡</b>
          <span className="m6-guide-path"><i /></span>
          <b>投放到目标槽</b>
        </div>

        <div className="m6-tech-bank">
          <div className="m6-match-label">
            <span>01 / 可拖动技术</span>
            <small aria-live="polite">{draggingMethodId ? `正在拖动：${METHOD_MAP[draggingMethodId].title}` : selectedMethod ? `已选择：${selectedMethod.title}` : '拖动卡片右上角手柄'}</small>
          </div>
          <div className="m6-tech-list">
            {DRAG_METHODS.map((method, index) => {
              const selected = selectedMethodId === method.id
              const locked = lockedMethodIds.has(method.id)
              return (
                <motion.button
                  key={method.id}
                  type="button"
                  className={`m6-tech-card ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
                  draggable={!locked}
                  disabled={locked}
                  aria-pressed={selected}
                  aria-label={locked ? `${method.title}，已完成匹配` : `${method.title}，可拖动到目标区域`}
                  onClick={() => setSelectedMethodId((current) => current === method.id ? null : method.id)}
                  onDragStart={(event) => startDrag(event, method.id)}
                  onDragEnd={endDrag}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.28, delay: index * 0.05 }}
                >
                  <span className="m6-tech-card-image">
                    <img src={method.image} alt="" loading="lazy" decoding="async" draggable="false" />
                  </span>
                  <span className="m6-tech-card-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="m6-tech-card-copy">
                    <small>{method.titleEn}</small>
                    <b>{method.title}</b>
                    <span>{method.action}</span>
                  </span>
                  <span className="m6-drag-handle" aria-hidden="true">
                    <span><i /><i /><i /><i /><i /><i /></span>
                  </span>
                </motion.button>
              )
            })}
          </div>
        </div>

        <motion.div
          className="m6-transfer-cue"
          aria-hidden="true"
          animate={draggingMethodId ? { x: [0, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.7, repeat: draggingMethodId ? Infinity : 0, ease: 'easeInOut' }}
        >
          <span />
          <i>→</i>
          <span />
        </motion.div>

        <div className="m6-drop-column">
          <div className="m6-match-label">
            <span>02 / 目标投放槽</span>
            <small>{resolvedCount} / {targets.length} 已完成</small>
          </div>
          <div className="m6-target-list">
            {targets.map((target, index) => {
              const result = results[target.id]
              const method = result ? METHOD_MAP[result.methodId] : null
              const isOver = dragOverId === target.id
              const ready = Boolean(selectedMethodId && !result?.correct)
              return (
                <motion.div
                  key={target.id}
                  className={`m6-target-drop ${isOver ? 'is-over' : ''} ${ready ? 'is-ready' : ''} ${result?.correct ? 'is-correct' : ''} ${result && !result.correct ? 'is-wrong' : ''}`}
                  role="button"
                  tabIndex={result?.correct ? -1 : 0}
                  aria-label={`${target.type}，${target.name}${ready ? '，点击投放所选技术' : ''}`}
                  onClick={() => selectedMethodId && matchTarget(target.id, selectedMethodId)}
                  onKeyDown={(event) => targetKeyDown(event, target.id)}
                  onDragEnter={(event) => { event.preventDefault(); if (!result?.correct) setDragOverId(target.id) }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOverId(null) }}
                  onDrop={(event) => drop(event, target.id)}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.28, delay: index * 0.05 }}
                >
                  <div className="m6-target-head">
                    <span>{target.code}</span>
                    <small>{target.type}</small>
                  </div>
                  <h4>{target.name}</h4>
                  <div className="m6-target-meta"><span>{target.size}</span><span>{target.motion}</span></div>
                  <p>{target.diagnosis}</p>
                  <small className="m6-target-source">{target.source}</small>
                  <div className="m6-drop-state">
                    <span className="m6-drop-symbol" aria-hidden="true">{result?.correct ? '✓' : '↓'}</span>
                    <span>{result?.correct ? '匹配完成' : isOver ? '松开完成匹配' : ready ? '投放到这里' : result ? '重新投放技术' : '等待技术卡'}</span>
                    {method && <b>{method.title}</b>}
                  </div>
                  <AnimatePresence mode="wait">
                    {result && !result.correct && (
                      <motion.div key={`${target.id}-${result.methodId}-${result.correct}`} className="m6-match-feedback" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status">
                        <strong>{result.correct ? '路径可执行' : '匹配不适合，请重试'}</strong>
                        <p>{result.message}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      <div className={`m6-match-completion ${allResolved ? 'is-ready' : ''}`}>
        <div><span>完成度</span><strong>{resolvedCount}/{targets.length}</strong></div>
        <div><span>匹配效率</span><strong>{efficiency}%</strong></div>
        <p>{allResolved ? '目标与清理方式已全部对应。' : '完成三组匹配后进入下一章。'}</p>
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
      <header className="m6-hero">
        <div className="m6-hero-copy"><span>MODULE 06 / ORBITAL CLEANUP</span><h2>清理，不是把垃圾捡起来。</h2><p>每一种目标，都需要不同的接近方式、接触条件和离轨路径。先读懂目标，再决定如何行动。</p></div>
        <div className="m6-hero-figure" aria-hidden="true"><span>06</span><div className="m6-hero-orbit"><i /><i /><i /></div><b>CLEANUP VECTOR</b></div>
      </header>
      <MethodObservatory />
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
