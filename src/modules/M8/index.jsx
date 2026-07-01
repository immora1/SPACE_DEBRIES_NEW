import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import './index.css'

const FLOW_STEPS = [
  { index: '01', id: 'm8-compare', label: '识别有效信息' },
  { index: '02', id: 'm8-practice', label: '完成分类练习' },
  { index: '03', id: 'm8-report', label: '提交观测报告' },
  { index: '04', id: 'm8-community', label: '查看社区补充' },
]

const PRACTICE_OPTIONS = [
  ['debris', '再入物体'],
  ['meteor', '流星'],
  ['satellite', '卫星'],
]

const REQUIRED_FIELDS = [
  { id: 'time', label: '时间', hint: '例如 2026-05-02 21:37，尽量精确到分钟。' },
  { id: 'location', label: '地点', hint: '城市、区县、经纬度或可复现的观测位置。' },
  { id: 'direction', label: '方位', hint: '出现和消失的大致方位，如西南到东北。' },
  { id: 'duration', label: '持续时间', hint: '几秒、几十秒，还是数分钟。' },
  { id: 'motion', label: '运动特征', hint: '是否匀速、闪烁、分裂、拖尾、突然变亮。' },
  { id: 'evidence', label: '证据', hint: '照片、视频、截图、目击者或设备信息。' },
]

const BAD_REPORT = {
  text: '刚刚天上有一道很亮的东西飞过去，应该是太空垃圾，挺吓人的。',
  missing: ['没有时间', '没有地点', '没有方位', '没有持续时间', '没有判断依据'],
}

const GOOD_REPORT = {
  text: '2026-05-02 21:37，在上海徐汇区向西南方向观测到一条橙白色亮迹，持续约 7 秒，从西南向东北移动，末段出现 2 次碎裂闪光并留下短暂烟迹。手机拍到 3 秒视频，未听到声响。',
  fields: ['时间', '地点', '方位', '持续时间', '运动特征', '证据'],
}

const STANDARD_CARDS = [
  {
    id: 'debris',
    code: 'REENTRY',
    image: '/再入烧蚀.png',
    title: '太空垃圾再入',
    signal: '慢于流星，可能持续数秒到数十秒；常出现橙红色、碎裂、多个亮点同向移动。',
    warning: '不能只凭“很亮”判断。需要时间、方位、持续时长和碎裂特征。',
  },
  {
    id: 'meteor',
    code: 'FIREBALL',
    title: '流星 / 火流星',
    signal: '通常极快，1–3 秒内划过；可能有短拖尾，偶尔爆闪。',
    warning: '如果持续几十秒并分裂成多点同向飞行，就要谨慎排除再入碎片。',
  },
  {
    id: 'satellite',
    code: 'ORBITAL OBJECT',
    image: '/任务结束.png',
    title: '卫星 / 星链列车',
    signal: '通常匀速、无烟迹、无明显碎裂；星链可呈串珠状，亮度较稳定。',
    warning: '卫星过境不等于太空垃圾，报告中必须写出为何排除正常卫星。',
  },
]

const OBSERVATION_SET = [
  { id: 'obs01', img: '/m8-game/reentry-fragments.png', type: 'debris', title: '多点同向碎裂亮迹', clue: '持续 18 秒，橙红色，末段分裂成 5 个亮点。', reportHint: '重点记录碎裂数量和飞行方向。' },
  { id: 'obs02', img: '/m8-game/meteor-fireball.png', type: 'meteor', title: '短促高速火流星', clue: '持续 2 秒，单条亮线，突然爆闪后消失。', reportHint: '重点记录持续时间，不要直接写成太空垃圾。' },
  { id: 'obs03', img: '/m8-game/reentry-stage.png', type: 'debris', title: '长时间缓慢再入带', clue: '持续 40 秒，多个亮点排成弧线缓慢移动。', reportHint: '适合写成疑似再入碎片报告。' },
  { id: 'obs04', img: '/m8-game/satellite-pass.png', type: 'satellite', title: '匀速单点过境', clue: '亮点匀速穿过夜空，无拖尾，无碎裂。', reportHint: '更像正常卫星过境。' },
  { id: 'obs05', img: '/m8-game/reentry-target.png', type: 'debris', title: '火箭级段再入疑似', clue: '3 个主亮点伴随细小闪光，持续 25 秒。', reportHint: '记录是否有多个同步亮点。' },
  { id: 'obs06', img: '/m8-game/meteor-split.png', type: 'meteor', title: '垂直短亮迹', clue: '极快下落，持续不足 1 秒，没有持续碎裂。', reportHint: '更像流星。' },
  { id: 'obs07', img: '/m8-game/reentry-fragments.png', type: 'debris', title: '分段拖尾事件', clue: '亮迹分成前后两段，速度较慢，持续 12 秒。', reportHint: '报告里要写清前后段位置变化。' },
  { id: 'obs08', img: '/m8-game/satellite-pass.png', type: 'satellite', title: '串珠状卫星列车', clue: '多个等距亮点，亮度稳定，匀速同轨移动。', reportHint: '应优先排查星链等卫星列车。' },
  { id: 'obs09', img: '/covers/12.png', type: 'debris', title: '低空碎裂闪光', clue: '亮度不稳定，末段出现散落点，持续 9 秒。', reportHint: '可写为疑似太空碎片再入。' },
  { id: 'obs10', img: '/source_1.png', type: 'satellite', title: '失效卫星想象图', clue: '图片本身不是地面观测记录。', reportHint: '不能当作观测报告证据。' },
  { id: 'obs11', img: '/source_2.png', type: 'debris', title: '碰撞碎片云示意', clue: '说明碎片来源，但不是目击照片。', reportHint: '可作为背景资料，不可替代现场记录。' },
  { id: 'obs12', img: '/source_3.png', type: 'debris', title: '操作遗留物示意', clue: '体现遗留来源，不等同再入目击。', reportHint: '报告需区分资料图和本人观测。' },
]

const PRACTICE_SET = OBSERVATION_SET.slice(0, 8)
const PRACTICE_IDS = new Set(PRACTICE_SET.map((item) => item.id))

const SAMPLE_COMMENTS = {
  obs01: [
    { name: '成都观测者', text: '我会补一条方位角：如果手机指南针可信，最好写成“约 240° 到 55°”。' },
    { name: '轨道社群志愿者', text: '持续 18 秒且多点同向，确实比普通流星更接近再入碎片特征。' },
  ],
  obs03: [
    { name: '南京天文社', text: '这类长时间事件最好附视频原始文件，截图容易丢失速度信息。' },
    { name: '数据校对员', text: '请补充云量和遮挡情况，否则亮度判断会有偏差。' },
  ],
}

function emptyReport(city) {
  return {
    time: '',
    location: city || '',
    direction: '',
    duration: '',
    motion: '',
    evidence: '',
    classification: 'debris',
    confidence: 'medium',
    note: '',
  }
}

function scoreReport(report) {
  const filled = REQUIRED_FIELDS.filter(f => report[f.id]?.trim()).length
  const hasClass = !!report.classification
  const hasNote = report.note.trim().length >= 16
  return Math.round(((filled + (hasClass ? 1 : 0) + (hasNote ? 1 : 0)) / 8) * 100)
}

function ClassificationDeck({ items, practice, onAnswer, onRestart }) {
  const [cursor, setCursor] = useState(0)
  const [resolving, setResolving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const resolvingRef = useRef(false)
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(1)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const rotate = useTransform(x, [-320, 0, 320], [-10, 0, 10])
  const leftCue = useTransform(x, [-170, -50, 0], [1, 0.2, 0])
  const rightCue = useTransform(x, [0, 50, 170], [0, 0.2, 1])
  const current = items[cursor]
  const correctCount = items.filter((item) => practice[item.id] === item.type).length
  const score = Math.round((correctCount / items.length) * 100)

  async function submit(type, direction = 0) {
    if (!current || resolvingRef.current) return
    resolvingRef.current = true
    setResolving(true)
    const correct = type === current.type
    const label = PRACTICE_OPTIONS.find(([option]) => option === current.type)?.[1]
    setFeedback({ correct, label })
    onAnswer(current.id, type)

    const duration = reduceMotion ? 0.01 : 0.34
    if (direction) {
      await Promise.all([
        animate(x, direction * Math.max(window.innerWidth * 0.72, 760), { duration, ease: [0.22, 1, 0.36, 1] }),
        animate(opacity, 0, { duration: duration * 0.75 }),
      ])
    } else {
      await Promise.all([
        animate(y, -54, { duration, ease: [0.22, 1, 0.36, 1] }),
        animate(scale, 0.9, { duration }),
        animate(opacity, 0, { duration: duration * 0.75 }),
      ])
    }

    x.set(0)
    y.set(0)
    scale.set(1)
    opacity.set(1)
    rotateX.set(0)
    rotateY.set(0)
    setCursor((value) => value + 1)
    resolvingRef.current = false
    setResolving(false)
  }

  function restart() {
    onRestart()
    setCursor(0)
    setFeedback(null)
    resolvingRef.current = false
    x.set(0)
    y.set(0)
    scale.set(1)
    opacity.set(1)
    rotateX.set(0)
    rotateY.set(0)
  }

  function handlePointerMove(event) {
    if (resolvingRef.current || reduceMotion) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    rotateY.set(px * 8)
    rotateX.set(py * -8)
  }

  function handlePointerLeave() {
    if (reduceMotion) return
    animate(rotateX, 0, { type: 'spring', stiffness: 260, damping: 26 })
    animate(rotateY, 0, { type: 'spring', stiffness: 260, damping: 26 })
  }

  if (!current) {
    return (
      <div className="m8-game-summary" aria-live="polite">
        <span>ROUND COMPLETE</span>
        <strong>{score}%</strong>
        <h5>{score >= 66 ? '分类训练通过' : '再观察一次运动特征'}</h5>
        <p>{correctCount} / {items.length} 判断正确</p>
        <button type="button" onClick={restart}>重新开始</button>
      </div>
    )
  }

  return (
    <div className="m8-card-game">
      <div className="m8-game-status" aria-live="polite">
        <span>{String(cursor + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
        <div className="m8-game-progress" aria-hidden="true"><i style={{ width: `${(cursor / items.length) * 100}%` }} /></div>
        <b>{feedback ? (feedback.correct ? '判断正确' : `正确分类：${feedback.label}`) : '观察运动特征'}</b>
      </div>

      <div className="m8-game-stage">
        {items[cursor + 2] && <div className="m8-game-card m8-game-card--back is-third" aria-hidden="true" />}
        {items[cursor + 1] && <div className="m8-game-card m8-game-card--back is-next" aria-hidden="true" />}
        <motion.article
          key={current.id}
          className="m8-game-card is-current"
          style={{ x, y, scale, opacity, rotate, rotateX, rotateY }}
          drag={resolving ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.78}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.x < -110 || info.velocity.x < -650) submit('debris', -1)
            else if (info.offset.x > 110 || info.velocity.x > 650) submit('meteor', 1)
            else animate(x, 0, reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 34 })
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onTap={() => submit('satellite')}
        >
          <div className="m8-game-image">
            <img src={current.img} alt="" draggable="false" />
            <span className="m8-game-photo-shade" aria-hidden="true" />
            <span className="m8-game-index">{String(cursor + 1).padStart(2, '0')}</span>
            <span className="m8-game-badge">OBSERVATION</span>
            <motion.span className="m8-game-cue is-left" style={{ opacity: leftCue }}>左滑 · 再入物体</motion.span>
            <motion.span className="m8-game-cue is-right" style={{ opacity: rightCue }}>右滑 · 流星</motion.span>
          </div>
          <div className="m8-game-copy">
            <div className="m8-game-meta">
              <span>SCENE {String(cursor + 1).padStart(2, '0')}</span>
              <span>{current.reportHint}</span>
            </div>
            <h5>{current.title}</h5>
            <p>{current.clue}</p>
            <div className="m8-game-ticket" aria-hidden="true">
              <span><b>LEFT</b> 再入物体</span>
              <span><b>TAP</b> 卫星</span>
              <span><b>RIGHT</b> 流星</span>
            </div>
          </div>
        </motion.article>
      </div>

      <div className="m8-game-controls" role="group" aria-label="观测事件分类">
        <button type="button" disabled={resolving} onClick={() => submit('debris', -1)}><b>←</b><span>再入物体</span></button>
        <button type="button" className="is-center" disabled={resolving} onClick={() => submit('satellite')}><b>●</b><span>卫星</span></button>
        <button type="button" disabled={resolving} onClick={() => submit('meteor', 1)}><span>流星</span><b>→</b></button>
      </div>
    </div>
  )
}

export default function M8({ onComplete }) {
  const { user, setStoryChapter } = useAppStore()
  const [lessonStep, setLessonStep] = useState(0)
  const [practice, setPractice] = useState({})
  const [selectedId, setSelectedId] = useState('obs01')
  const [report, setReport] = useState(() => emptyReport(user?.city))
  const [reports, setReports] = useState([])
  const [activeCommunityId, setActiveCommunityId] = useState('obs01')
  const [activeSection, setActiveSection] = useState('m8-compare')
  const flowNavigationTargetRef = useRef(null)
  const flowNavigationTimerRef = useRef(null)

  const activeFlowIndex = Math.max(0, FLOW_STEPS.findIndex((step) => step.id === activeSection))
  const activeFlowStep = FLOW_STEPS[activeFlowIndex]
  const activeFlowPosition = 6 + (activeFlowIndex / (FLOW_STEPS.length - 1)) * 88

  const selected = OBSERVATION_SET.find((item) => item.id === selectedId) || OBSERVATION_SET[0]
  const activeCommunity = OBSERVATION_SET.find((item) => item.id === activeCommunityId) || selected
  const reportScore = scoreReport(report)
  const practiceAnsweredCount = Object.keys(practice).filter((id) => PRACTICE_IDS.has(id)).length
  const practiceScore = useMemo(() => {
    const answered = Object.keys(practice).filter((id) => PRACTICE_IDS.has(id))
    if (!answered.length) return 0
    const correct = answered.filter((id) => practice[id] === PRACTICE_SET.find((item) => item.id === id)?.type).length
    return Math.round((correct / answered.length) * 100)
  }, [practice])
  const practiceDone = practiceAnsweredCount === PRACTICE_SET.length && practiceScore >= 66
  const canSubmit = Boolean(selected && reportScore >= 75)
  const canComplete = reports.length > 0 && practiceDone
  const communityComments = [
    ...(SAMPLE_COMMENTS[activeCommunity.id] || []),
    ...reports
      .filter((item) => item.imageId === activeCommunity.id)
      .map((item) => ({
        name: item.author,
        text: `${item.report.time || '未填时间'} · ${item.report.location || '未填地点'} · ${item.report.note}`,
      })),
  ]

  useEffect(() => {
    const ids = ['m8-compare', 'm8-practice', 'm8-report', 'm8-community']
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!sections.length) return undefined

    let frameId = 0
    const updateActiveSection = () => {
      frameId = 0
      if (flowNavigationTargetRef.current) return

      const marker = Math.min(window.innerHeight * 0.34, 340)
      let current = sections[0]
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) current = section
        else break
      }
      setActiveSection((previous) => previous === current.id ? previous : current.id)
    }
    const handleScroll = () => {
      if (frameId) return
      frameId = requestAnimationFrame(updateActiveSection)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    updateActiveSection()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frameId) cancelAnimationFrame(frameId)
      if (flowNavigationTimerRef.current) window.clearTimeout(flowNavigationTimerRef.current)
    }
  }, [])

  function setField(key, value) {
    setReport((current) => ({ ...current, [key]: value }))
  }

  function selectObservation(item) {
    setSelectedId(item.id)
    setActiveCommunityId(item.id)
  }

  function submitReport(event) {
    event.preventDefault()
    if (!canSubmit) return
    const next = {
      id: `${selected.id}-${Date.now()}`,
      imageId: selected.id,
      imageTitle: selected.title,
      author: user?.name || '匿名观测者',
      report: { ...report },
      score: reportScore,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    setReports((current) => [next, ...current])
    setActiveCommunityId(selected.id)
    setReport(emptyReport(user?.city))
  }

  function handleComplete() {
    if (!canComplete) return
    setStoryChapter('m8', '用户提交了一份观测报告，并进入社区学习他人的补充细节。')
    onComplete()
  }

  function goTo(sectionId) {
    if (flowNavigationTimerRef.current) window.clearTimeout(flowNavigationTimerRef.current)
    flowNavigationTargetRef.current = sectionId
    setActiveSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    flowNavigationTimerRef.current = window.setTimeout(() => {
      if (flowNavigationTargetRef.current === sectionId) flowNavigationTargetRef.current = null
    }, 1200)
  }

  function handleStandardKeyDown(event, index) {
    let nextIndex = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % STANDARD_CARDS.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + STANDARD_CARDS.length) % STANDARD_CARDS.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = STANDARD_CARDS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    setLessonStep(nextIndex)
    requestAnimationFrame(() => document.getElementById(`m8-standard-tab-${nextIndex}`)?.focus())
  }

  return (
    <section className="m8" data-module-scroll-target>
      <nav
        className="m8-flow"
        aria-label="观测报告流程"
        style={{ '--m8-flow-current': `${activeFlowPosition}%` }}
      >
        <div className="m8-flow-meter">
          <span className="m8-flow-track" aria-hidden="true" />
          <span className="m8-flow-fill" aria-hidden="true" />
          {FLOW_STEPS.map((step, stepIndex) => {
            const done = step.id === 'm8-compare'
              || (step.id === 'm8-practice' && practiceDone)
              || ((step.id === 'm8-report' || step.id === 'm8-community') && reports.length > 0)
            const nodePosition = 6 + (stepIndex / (FLOW_STEPS.length - 1)) * 88

            return (
              <button
                key={step.id}
                type="button"
                className={['m8-flow-node', done && 'is-done', activeSection === step.id && 'is-current'].filter(Boolean).join(' ')}
                style={{ '--m8-flow-node': `${nodePosition}%` }}
                aria-label={`前往阶段 ${step.index}：${step.label}`}
                aria-current={activeSection === step.id ? 'step' : undefined}
                onClick={() => goTo(step.id)}
              >
                <span aria-hidden="true" />
              </button>
            )
          })}
          <div className="m8-flow-current" aria-live="polite">
            <span>{activeFlowStep.index} / {String(FLOW_STEPS.length).padStart(2, '0')}</span>
            <b>{activeFlowStep.label}</b>
          </div>
        </div>
      </nav>

      <div className="m8-content">
      <header className="m8-header">
        <span>MODULE 08 / OBSERVATION & COMMUNITY</span>
        <div>
          <h2>把一次目击，写成可以复核的记录。</h2>
          <p>先学会区分再入碎片、流星与卫星，再完成一份包含时间、地点、运动特征和证据的观测报告。</p>
        </div>
      </header>



      <section id="m8-compare" className="m8-band m8-compare">
        <div className="m8-section-heading">
          <span>01 / REPORT ANATOMY</span>
          <div><h3>一句感受，不是一份报告。</h3><p>有效记录必须让其他人知道何时、何地、向哪里看，以及事件如何运动。</p></div>
        </div>
        <div className="m8-report-compare">
          <article className="is-bad">
            <span>信息不足</span>
            <blockquote>{BAD_REPORT.text}</blockquote>
            <div>{BAD_REPORT.missing.map((item) => <small key={item}>{item}</small>)}</div>
          </article>
          <article className="is-good">
            <span>可复核记录</span>
            <blockquote>{GOOD_REPORT.text}</blockquote>
            <div>{GOOD_REPORT.fields.map((item) => <small key={item}>{item}</small>)}</div>
          </article>
        </div>
      </section>

      <section id="m8-practice" className="m8-band m8-training">
        <div className="m8-section-heading">
          <span>02 / CLASSIFICATION LAB</span>
          <div><h3>先看运动，再判断对象。</h3><p>亮度不是充分证据。持续时间、碎裂方式与运动稳定性更有区分度。</p></div>
        </div>

        <div className="m8-standard-tabs" role="radiogroup" aria-label="观测对象分类">
          {STANDARD_CARDS.map((card, index) => {
            const active = lessonStep === index
            return (
              <motion.button
                key={card.id}
                id={`m8-standard-tab-${index}`}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                layout
                layoutDependency={lessonStep}
                transition={{ layout: { duration: 0.46, ease: [0.22, 1, 0.36, 1] } }}
                style={{ flexGrow: active ? 2.55 : 0.72 }}
                className={['m8-standard-panel', active && 'is-active'].filter(Boolean).join(' ')}
                onPointerMove={() => {
                  if (lessonStep !== index) setLessonStep(index)
                }}
                onFocus={() => setLessonStep(index)}
                onClick={() => setLessonStep(index)}
                onKeyDown={(event) => handleStandardKeyDown(event, index)}
              >
                <span
                  className={['m8-standard-visual', card.id === 'meteor' && 'is-meteor'].filter(Boolean).join(' ')}
                  style={card.image ? { backgroundImage: `url("${card.image}")` } : undefined}
                  aria-hidden="true"
                />
                <span className="m8-standard-shade" aria-hidden="true" />
                <motion.span layout="position" className="m8-standard-label">0{index + 1} · {card.code}</motion.span>
                <motion.span layout="position" className="m8-standard-number" aria-hidden="true">0{index + 1}</motion.span>
                <motion.span layout="position" className="m8-standard-content">
                  <b>{card.title}</b>
                  <span className="m8-standard-signal">{card.signal}</span>
                  <span className="m8-standard-warning">{card.warning}</span>
                </motion.span>
              </motion.button>
            )
          })}
        </div>

        <div className="m8-practice-head">
          <div><span>SCENE TEST</span><h4>判断八组观测事件</h4></div>
          <div><strong>{practiceScore}%</strong><span>{practiceAnsweredCount}/8 已判断</span></div>
        </div>

        <ClassificationDeck
          items={PRACTICE_SET}
          practice={practice}
          onAnswer={(id, type) => setPractice((current) => ({ ...current, [id]: type }))}
          onRestart={() => setPractice({})}
        />
      </section>

      <section id="m8-report" className="m8-band m8-report-workbench">
        <div className="m8-section-heading">
          <span>03 / REPORT WORKBENCH</span>
          <div><h3>选择事件，完成结构化记录。</h3><p>质量达到 75% 后即可提交到社区。</p></div>
        </div>

        <div className="m8-workbench">
          <div className="m8-observation-picker">
            <div className="m8-selected-observation">
              <img src={selected.img} alt="" />
              <div><span>{selected.type.toUpperCase()}</span><h4>{selected.title}</h4><p>{selected.clue}</p></div>
            </div>
            <div className="m8-observation-thumbs">
              {OBSERVATION_SET.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedId === item.id ? 'is-active' : ''}
                  onClick={() => selectObservation(item)}
                  aria-label={`选择事件 ${index + 1}：${item.title}`}
                >
                  <img src={item.img} alt="" loading="lazy" /><span>{String(index + 1).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
            <p className="m8-observation-hint">{selected.reportHint}</p>
          </div>

          <form className="m8-report-form" onSubmit={submitReport}>
            <div className="m8-form-grid">
              {REQUIRED_FIELDS.map((field) => (
                <label key={field.id}>
                  <span>{field.label}</span>
                  <input
                    value={report[field.id]}
                    onChange={(event) => setField(field.id, event.target.value)}
                    placeholder={field.hint}
                  />
                </label>
              ))}
            </div>
            <div className="m8-form-selects">
              <label><span>事件分类</span>
                <select value={report.classification} onChange={(event) => setField('classification', event.target.value)}>
                  <option value="debris">疑似太空垃圾再入</option>
                  <option value="meteor">更像流星</option>
                  <option value="satellite">更像正常卫星</option>
                  <option value="unknown">无法判断</option>
                </select>
              </label>
              <label><span>判断置信度</span>
                <select value={report.confidence} onChange={(event) => setField('confidence', event.target.value)}>
                  <option value="low">低置信度</option>
                  <option value="medium">中置信度</option>
                  <option value="high">高置信度</option>
                </select>
              </label>
            </div>
            <label className="m8-note-field"><span>补充判断</span>
              <textarea
                value={report.note}
                onChange={(event) => setField('note', event.target.value)}
                placeholder="说明判断依据、仍然存在的不确定性，以及是否有其他目击者。"
              />
            </label>
            <div className="m8-form-footer">
              <div><span>REPORT QUALITY</span><strong>{reportScore}%</strong><progress value={reportScore} max="100" /></div>
              <button type="submit" disabled={!canSubmit}>提交到社区</button>
            </div>
          </form>
        </div>
      </section>

      <section id="m8-community" className="m8-band m8-community">
        <div className="m8-section-heading">
          <span>04 / COMMUNITY REVIEW</span>
          <div><h3>让其他观测者补足盲点。</h3><p>社区反馈用于补充方位、天气、设备与原始文件等上下文。</p></div>
        </div>
        <div className="m8-community-layout">
          <div className="m8-community-event">
            <img src={activeCommunity.img} alt="" />
            <span>{activeCommunity.type.toUpperCase()}</span>
            <h4>{activeCommunity.title}</h4>
            <p>{activeCommunity.clue}</p>
          </div>
          <div className="m8-comment-list">
            {communityComments.map((comment, index) => (
              <motion.article key={`${comment.name}-${index}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><b>{comment.name}</b><p>{comment.text}</p></div>
              </motion.article>
            ))}
            {!communityComments.length && <p className="m8-empty-comments">提交报告后，讨论会出现在这里。</p>}
          </div>
        </div>
      </section>

      <footer className="m8-complete">
        <div>
          <span>TRAINING STATUS</span>
          <p>{!practiceDone ? '完成全部 8 组判断并达到 66% 正确率。' : reports.length === 0 ? '分类训练已完成，请提交一份报告。' : '观测训练与社区报告均已完成。'}</p>
        </div>
        <button type="button" onClick={handleComplete} disabled={!canComplete}>
          {canComplete ? '完成观测教学' : practiceDone ? '等待报告提交' : '等待分类训练'}
        </button>
      </footer>
      </div>
    </section>
  )
}
