import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import gsap from 'gsap'
import useAppStore from '../../store/useAppStore'
import './index.css'

const FLOW_STEPS = [
  { index: '01', code: 'OBSERVE', id: 'm8-compare', label: '识别有效信息' },
  { index: '02', code: 'CLASSIFY', id: 'm8-practice', label: '完成分类练习' },
  { index: '03', code: 'REPORT', id: 'm8-report', label: '提交观测报告' },
  { index: '04', code: 'REVIEW', id: 'm8-community', label: '查看社区补充' },
]

const PRACTICE_OPTIONS = [
  ['debris', '太空垃圾'],
  ['meteor', '流星'],
  ['satellite', '卫星残骸'],
]

const GUIDE_STEPS = [
  {
    type: 'debris',
    action: '向下拖拽',
    image: '/m8-game/reentry-fragments.png',
    title: '太空垃圾',
    clue: '多个亮点同向、速度较慢、持续碎裂。',
    reportHint: '向下拖入太空垃圾背包。',
    vector: { x: 0, y: 1 },
  },
  {
    type: 'meteor',
    action: '向左拖拽',
    image: '/m8-game/meteor-fireball.png',
    title: '流星',
    clue: '单条亮线，时间很短，可能突然爆闪。',
    reportHint: '向左拖拽完成判断。',
    vector: { x: -1, y: 0 },
  },
  {
    type: 'satellite',
    action: '向右拖拽',
    image: '/m8-game/satellite-pass.png',
    title: '卫星残骸',
    clue: '主体仍可辨认，沿轨道方向稳定移动。',
    reportHint: '向右拖拽完成判断。',
    vector: { x: 1, y: 0 },
  },
]

const DEBRIS_SLOT = { type: 'debris', vector: { x: 0, y: 1 } }

const REQUIRED_FIELDS = [
  { id: 'time', label: '时间', hint: '例如 2026-05-02 21:37，尽量精确到分钟。', hintLines: ['2026-05-02 21:37', '精确到分钟'] },
  { id: 'location', label: '地点', hint: '城市、区县、经纬度或可复现的观测位置。', hintLines: ['城市 / 区县', '经纬度位置'] },
  { id: 'direction', label: '方位', hint: '出现和消失的大致方位，如西南到东北。', hintLines: ['出现 / 消失方位', '如西南到东北'] },
  { id: 'duration', label: '持续时间', hint: '几秒、几十秒，还是数分钟。', hintLines: ['持续几秒', '或数分钟'] },
  { id: 'motion', label: '运动特征', hint: '是否匀速、闪烁、分裂、拖尾、突然变亮。', hintLines: ['匀速 / 闪烁 / 分裂', '拖尾 / 突然变亮'] },
  { id: 'evidence', label: '证据', hint: '照片、视频、截图、目击者或设备信息。', hintLines: ['照片 / 视频 / 截图', '设备或目击者'] },
]

const BAD_REPORT = {
  text: '刚刚天上有一道很亮的东西飞过去，应该是太空垃圾，挺吓人的。',
  missing: ['时间', '地点', '方位', '持续时间', '运动特征', '证据'],
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
    title: '太空垃圾',
    signal: '慢于流星，可能持续数秒到数十秒；常出现橙红色、碎裂、多个亮点同向移动。',
    warning: '不能只凭“很亮”判断。需要时间、方位、持续时长和碎裂特征。',
  },
  {
    id: 'meteor',
    code: 'FIREBALL',
    title: '流星',
    signal: '通常极快，1–3 秒内划过；可能有短拖尾，偶尔爆闪。',
    warning: '如果持续几十秒并分裂成多点同向飞行，就要谨慎排除再入碎片。',
  },
  {
    id: 'satellite',
    code: 'ORBITAL OBJECT',
    image: '/任务结束.png',
    title: '卫星',
    signal: '通常匀速、无烟迹、无明显碎裂；星链可呈串珠状，亮度较稳定。',
    warning: '卫星过境不等于太空垃圾，报告中必须写出为何排除正常卫星。',
  },
]

const OBSERVATION_SET = [
  { id: 'obs01', img: '/m8-game/reentry-fragments.png', type: 'debris', title: '多点同向亮迹', clue: '持续 18 秒，多个亮点同向移动，末段继续碎裂。', reportHint: '重点记录碎裂数量和飞行方向。' },
  { id: 'obs02', img: '/m8-game/meteor-fireball.png', type: 'meteor', title: '短促斜向亮线', clue: '持续约 2 秒，单条亮线快速划过后消失。', reportHint: '重点记录持续时间和轨迹形态。' },
  { id: 'obs03', img: '/m8-game/satellite-pass.png', type: 'satellite', title: '稳定主体过境', clue: '单个主体沿轨道方向移动，无烟迹、无持续碎裂。', reportHint: '记录烟迹、碎裂和亮度变化。' },
  { id: 'obs04', img: '/m8-game/reentry-stage.png', type: 'debris', title: '多亮点长时段', clue: '3 个主亮点伴随细小闪光，持续约 25 秒。', reportHint: '记录是否有多个同步亮点。' },
  { id: 'obs05', img: '/m8-game/meteor-split.png', type: 'meteor', title: '垂直短亮迹', clue: '极快下落，持续不足 1 秒，没有持续碎裂。', reportHint: '记录是否有后续亮点。' },
  { id: 'obs06', img: '/m8-game/satellite-pass.png', type: 'satellite', title: '主体反光过境', clue: '主体清晰，亮度变化很小，运动路径平滑。', reportHint: '记录主体形状和运动路径。' },
  { id: 'obs07', img: '/m8-game/reentry-target.png', type: 'debris', title: '低速弧线亮点', clue: '多个小点沿同一弧线移动，速度慢于普通流星。', reportHint: '写清多点之间的相对位置。' },
  { id: 'obs08', img: '/m8-game/meteor-fireball.png', type: 'meteor', title: '末端爆闪亮迹', clue: '短时间内一闪而过，末端突然变亮后消失。', reportHint: '记录爆闪前后的持续时间。' },
  { id: 'obs09', img: '/m8-game/satellite-pass.png', type: 'satellite', title: '轨道边缘亮点', clue: '主体沿地球边缘稳定移动，没有散落光点。', reportHint: '记录路径稳定性和亮度变化。' },
  { id: 'obs10', img: '/再入烧蚀.png', type: 'debris', title: '长尾分段轨迹', clue: '橙色亮迹持续十余秒，前后分成多段。', reportHint: '记录颜色、持续时间和分段节奏。' },
  { id: 'obs11', img: '/m8-game/meteor-split.png', type: 'meteor', title: '单线高速划过', clue: '只有一条极细亮线，没有多点同步移动。', reportHint: '记录是否只有单线轨迹。' },
  { id: 'obs12', img: '/m8-game/satellite-pass.png', type: 'satellite', title: '地平线上方过境', clue: '亮点沿平滑轨道稳定移动，没有烟迹。', reportHint: '补充出现和消失方位会更可靠。' },
  { id: 'obs13', img: '/m8-game/reentry-fragments.png', type: 'debris', title: '多点拖尾事件', clue: '多个亮点在同一方向拉开，拖尾持续存在。', reportHint: '记录颜色、持续时间和碎裂节奏。' },
  { id: 'obs14', img: '/m8-game/meteor-fireball.png', type: 'meteor', title: '掠过式亮线', clue: '短促、明亮、单一轨迹，没有稳定后续亮点。', reportHint: '持续时间是主要判断依据。' },
  { id: 'obs15', img: '/m8-game/satellite-pass.png', type: 'satellite', title: '稳定主体疑似', clue: '可见主体结构，运动平滑，不出现烟迹或碎裂。', reportHint: '记录主体结构和排除依据。' },
]

const PRACTICE_SET = OBSERVATION_SET.slice(0, 15)
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

function getDragDecision(info, threshold = 120) {
  if (info.offset.y > threshold || info.velocity.y > 700) return { type: 'debris', vector: { x: 0, y: 1 } }
  if (info.offset.x < -threshold || info.velocity.x < -700) return { type: 'meteor', vector: { x: -1, y: 0 } }
  if (info.offset.x > threshold || info.velocity.x > 700) return { type: 'satellite', vector: { x: 1, y: 0 } }
  return null
}

function BlurRevealText({ text, className = '', delayOffset = 0 }) {
  return (
    <span className={className} aria-label={text}>
      {[...text].map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="m8-blur-char"
          aria-hidden="true"
          style={{ '--m8-char-delay': `${delayOffset + index * 14}ms` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  )
}

function ObservationCardContent({ item, indexLabel, totalLabel, isGuide = false }) {
  const ledgerLabel = isGuide ? 'ACTION' : 'INPUT'
  const ledgerText = isGuide ? item.action : '图像与运动描述'

  return (
    <>
      <div className="m8-ticket-media">
        <img src={item.img || item.image} alt="" draggable="false" />
        <span className="m8-ticket-index">{indexLabel}</span>
        <span className="m8-ticket-badge">OBSERVATION</span>
      </div>
      <div className="m8-ticket-copy">
        <div className="m8-ticket-meta">
          <span>SCENE {indexLabel}</span>
          <span>{indexLabel} / {totalLabel}</span>
        </div>
        <h5>{item.title}</h5>
        <p>{item.clue}</p>
        <div className="m8-ticket-ledger" aria-hidden="true">
          <span><b>{ledgerLabel}</b>{ledgerText}</span>
          <span><b>NOTE</b>{item.reportHint}</span>
        </div>
      </div>
    </>
  )
}

function QueuedCardBack({ index }) {
  return (
    <div className="m8-stack-back-face" aria-hidden="true">
      <span />
      <i />
      <i />
      <i />
      <b>{String(index).padStart(2, '0')}</b>
    </div>
  )
}

function ClassificationDeck({ items, practice, onAnswer, onRestart }) {
  const [cursor, setCursor] = useState(0)
  const [guideIndex, setGuideIndex] = useState(0)
  const [guideDone, setGuideDone] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [guideFeedback, setGuideFeedback] = useState(null)
  const [guideDragging, setGuideDragging] = useState(false)
  const [backpackEntry, setBackpackEntry] = useState(null)
  const resolvingRef = useRef(false)
  const draggingRef = useRef(false)
  const guideFeedbackTimerRef = useRef(null)
  const guideCardRef = useRef(null)
  const guidePointerRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(1)
  const guideX = useMotionValue(0)
  const guideY = useMotionValue(0)
  const guideScale = useMotionValue(1)
  const guideOpacity = useMotionValue(1)
  const guideTiltX = useMotionValue(0)
  const guideTiltY = useMotionValue(0)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const rotate = useTransform(x, [-320, 0, 320], [-10, 0, 10])
  const guideRotate = useTransform(guideX, [-320, 0, 320], [-9, 0, 9])
  const current = items[cursor]
  const guide = GUIDE_STEPS[guideIndex]
  const correctCount = items.filter((item) => practice[item.id] === item.type).length
  const score = Math.round((correctCount / items.length) * 100)

  useEffect(() => {
    if (guideDone || !guideCardRef.current || !guidePointerRef.current) return undefined

    const vector = guide.vector
    if (guideFeedbackTimerRef.current) {
      window.clearTimeout(guideFeedbackTimerRef.current)
      guideFeedbackTimerRef.current = null
    }
    guideX.set(0)
    guideY.set(0)
    guideScale.set(1)
    guideOpacity.set(1)
    guideTiltX.set(0)
    guideTiltY.set(0)
    setGuideFeedback(null)
    setGuideDragging(false)

    const ctx = gsap.context(() => {
      gsap.set(guidePointerRef.current, {
        autoAlpha: reduceMotion ? 0 : 1,
        x: vector.x < 0 ? 170 : vector.x > 0 ? -170 : 0,
        y: vector.y > 0 ? -148 : 158,
        scale: 1,
      })

      if (reduceMotion) return

      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.72,
        defaults: { ease: 'power3.inOut' },
      })

      if (vector.y > 0) {
        timeline
          .fromTo(guidePointerRef.current, { autoAlpha: 0, y: -158 }, { autoAlpha: 1, duration: 0.24 })
          .to(guidePointerRef.current, { y: 180, duration: 0.72 })
          .to(guidePointerRef.current, { autoAlpha: 0, duration: 0.2 })
          return
      }

      timeline
        .fromTo(guidePointerRef.current, { autoAlpha: 0, x: vector.x * -188, y: 158 }, { autoAlpha: 1, duration: 0.24 })
        .to(guidePointerRef.current, { x: vector.x * 204, duration: 0.7 })
        .to(guidePointerRef.current, { autoAlpha: 0, duration: 0.2 })
    })

    return () => ctx.revert()
  }, [guide.vector, guideDone, guideIndex, guideOpacity, guideScale, guideTiltX, guideTiltY, guideX, guideY, reduceMotion])

  useEffect(() => {
    if (guideDone || guideDragging || resolving || guideFeedback || reduceMotion) {
      return undefined
    }

    const targetX = guide.vector.x * 48
    const targetY = guide.vector.y * 44
    const targetTiltX = guide.vector.y > 0 ? -11 : 1.8
    const targetTiltY = guide.vector.x ? guide.vector.x * -11 : 0
    const controls = [
      animate(guideX, [0, targetX, 0], { duration: 1.55, ease: 'easeInOut', repeat: Infinity }),
      animate(guideY, [0, targetY, 0], { duration: 1.55, ease: 'easeInOut', repeat: Infinity }),
      animate(guideTiltX, [0, targetTiltX, 0], { duration: 1.55, ease: 'easeInOut', repeat: Infinity }),
      animate(guideTiltY, [0, targetTiltY, 0], { duration: 1.55, ease: 'easeInOut', repeat: Infinity }),
    ]

    return () => controls.forEach((control) => control.stop())
  }, [guide.vector, guideDone, guideDragging, guideFeedback, guideTiltX, guideTiltY, guideX, guideY, reduceMotion, resolving])

  useEffect(() => () => {
    if (guideFeedbackTimerRef.current) window.clearTimeout(guideFeedbackTimerRef.current)
  }, [])

  async function submit(type, vector = { x: 0, y: 0 }) {
    if (!current || resolvingRef.current) return
    resolvingRef.current = true
    setResolving(true)
    const correct = type === current.type
    const label = PRACTICE_OPTIONS.find(([option]) => option === current.type)?.[1]
    setFeedback({ correct, label })
    if (type === 'debris') {
      setBackpackEntry({
        title: current.title,
        correct,
        index: cursor + 1,
      })
    }
    onAnswer(current.id, type)

    const duration = reduceMotion ? 0.01 : 0.34
    const exitX = vector.x * Math.max(window.innerWidth * 0.68, 720)
    const exitY = vector.y * Math.max(window.innerHeight * 0.5, 420)
    await Promise.all([
      animate(x, exitX, { duration, ease: [0.22, 1, 0.36, 1] }),
      animate(y, exitY, { duration, ease: [0.22, 1, 0.36, 1] }),
      animate(scale, 0.92, { duration }),
      animate(opacity, 0, { duration: duration * 0.78 }),
    ])

    x.set(0)
    y.set(0)
    scale.set(1)
    opacity.set(1)
    rotateX.set(0)
    rotateY.set(0)
    setCursor((value) => value + 1)
    draggingRef.current = false
    resolvingRef.current = false
    setResolving(false)
  }

  function resetGuideCardMotion() {
    animate(guideX, 0, reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 34 })
    animate(guideY, 0, reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 34 })
    animate(guideScale, 1, reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 360, damping: 28 })
    animate(guideOpacity, 1, { duration: reduceMotion ? 0.01 : 0.2 })
    animate(guideTiltX, 0, { duration: reduceMotion ? 0.01 : 0.18 })
    animate(guideTiltY, 0, { duration: reduceMotion ? 0.01 : 0.18 })
  }

  async function completeGuideDrag(vector) {
    resolvingRef.current = true
    setResolving(true)
    setGuideFeedback({ type: 'success', text: `动作正确：${guide.action}` })

    const duration = reduceMotion ? 0.01 : 0.34
    const exitX = vector.x * Math.max(window.innerWidth * 0.68, 720)
    const exitY = vector.y * Math.max(window.innerHeight * 0.5, 420)
    await Promise.all([
      animate(guideX, exitX, { duration, ease: [0.22, 1, 0.36, 1] }),
      animate(guideY, exitY, { duration, ease: [0.22, 1, 0.36, 1] }),
      animate(guideScale, 0.92, { duration }),
      animate(guideOpacity, 0, { duration: duration * 0.78 }),
    ])
    await new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 10 : 360))

    guideX.set(0)
    guideY.set(0)
    guideScale.set(1)
    guideOpacity.set(1)
    guideTiltX.set(0)
    guideTiltY.set(0)
    resolvingRef.current = false
    setResolving(false)

    if (guideIndex < GUIDE_STEPS.length - 1) {
      setGuideIndex((value) => value + 1)
      return
    }
    setGuideDone(true)
  }

  function rejectGuideDrag(message) {
    if (guideFeedbackTimerRef.current) window.clearTimeout(guideFeedbackTimerRef.current)
    setGuideFeedback({ type: 'error', text: message })
    resetGuideCardMotion()
    guideFeedbackTimerRef.current = window.setTimeout(() => {
      setGuideFeedback(null)
      guideFeedbackTimerRef.current = null
    }, 1100)
  }

  function restart() {
    onRestart()
    setCursor(0)
    setGuideIndex(0)
    setGuideDone(false)
    setFeedback(null)
    setGuideFeedback(null)
    setBackpackEntry(null)
    if (guideFeedbackTimerRef.current) {
      window.clearTimeout(guideFeedbackTimerRef.current)
      guideFeedbackTimerRef.current = null
    }
    resolvingRef.current = false
    draggingRef.current = false
    x.set(0)
    y.set(0)
    scale.set(1)
    opacity.set(1)
    guideX.set(0)
    guideY.set(0)
    guideScale.set(1)
    guideOpacity.set(1)
    guideTiltX.set(0)
    guideTiltY.set(0)
    rotateX.set(0)
    rotateY.set(0)
  }

  function handlePointerMove(event) {
    if (resolvingRef.current || draggingRef.current || reduceMotion) return
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

  if (!guideDone) {
    return (
      <div className="m8-card-game m8-card-game--guide" aria-live="polite">
        <div className="m8-game-status">
          <span>{String(guideIndex + 1).padStart(2, '0')} / {String(GUIDE_STEPS.length).padStart(2, '0')}</span>
          <div className="m8-game-progress" aria-hidden="true"><i style={{ width: `${((guideIndex + 1) / GUIDE_STEPS.length) * 100}%` }} /></div>
          <b>先完成操作引导</b>
        </div>
        <div className="m8-guide-shell">
          <div className={['m8-guide-stage', guideDragging && 'is-dragging', guideFeedback && `is-${guideFeedback.type}`].filter(Boolean).join(' ')}>
            <div className={['m8-guide-copy', guideFeedback && `is-${guideFeedback.type}`].filter(Boolean).join(' ')}>
              <span>GESTURE {String(guideIndex + 1).padStart(2, '0')} / {String(GUIDE_STEPS.length).padStart(2, '0')}</span>
              <h5>此卡片为{guide.title}</h5>
              <p>{guideFeedback?.text || `跟随指示${guide.action}`}</p>
            </div>
            <motion.article
              ref={guideCardRef}
              className={['m8-game-card', 'm8-training-card', 'is-current', 'is-guide-demo', guideFeedback && `is-${guideFeedback.type}`].filter(Boolean).join(' ')}
              style={{ x: guideX, y: guideY, scale: guideScale, opacity: guideOpacity, rotate: guideRotate, rotateX: guideTiltX, rotateY: guideTiltY }}
              drag={resolving ? false : true}
              dragElastic={0.72}
              dragMomentum={false}
              onDragStart={() => {
                setGuideDragging(true)
                setGuideFeedback(null)
                animate(guideTiltX, 0, { duration: reduceMotion ? 0.01 : 0.16 })
                animate(guideTiltY, 0, { duration: reduceMotion ? 0.01 : 0.16 })
              }}
              onDragEnd={(_, info) => {
                setGuideDragging(false)
                if (resolvingRef.current) return
                const decision = getDragDecision(info, 96)
                if (!decision) {
                  rejectGuideDrag(`拖动距离再明显一点：${guide.action}`)
                  return
                }
                if (decision.type !== guide.type) {
                  rejectGuideDrag(`方向不对，请${guide.action}`)
                  return
                }
                completeGuideDrag(decision.vector)
              }}
            >
              <ObservationCardContent
                item={{ ...guide, img: guide.image }}
                indexLabel={String(guideIndex + 1).padStart(2, '0')}
                totalLabel={String(GUIDE_STEPS.length).padStart(2, '0')}
              />
            </motion.article>
            <span
              ref={guidePointerRef}
              className={['m8-guide-pointer', (guideDragging || guideFeedback) && 'is-hidden'].filter(Boolean).join(' ')}
              aria-hidden="true"
            >
              <i />
            </span>
          </div>
        </div>
      </div>
    )
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
        {items.slice(cursor + 1, cursor + 3).map((item, index) => (
          <article
            key={item.id}
            className="m8-game-card m8-training-card is-queued"
            style={{ '--stack-index': index + 1 }}
            aria-hidden="true"
          >
            <QueuedCardBack index={cursor + index + 2} />
          </article>
        ))}
        <motion.article
          key={current.id}
          className="m8-game-card m8-training-card is-current"
          style={{ x, y, scale, opacity, rotate, rotateX, rotateY }}
          drag={resolving ? false : true}
          dragElastic={0.72}
          dragMomentum={false}
          onDragStart={() => {
            draggingRef.current = true
            rotateX.set(0)
            rotateY.set(0)
          }}
          onDragEnd={(_, info) => {
            draggingRef.current = false
            const decision = getDragDecision(info)
            if (decision) submit(decision.type, decision.vector)
            else {
              animate(x, 0, reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 34 })
              animate(y, 0, reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 34 })
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <ObservationCardContent
            item={current}
            indexLabel={String(cursor + 1).padStart(2, '0')}
            totalLabel={String(items.length).padStart(2, '0')}
          />
        </motion.article>
      </div>

      <div className="m8-drop-slots" role="group" aria-label="太空垃圾背包">
        <button
          type="button"
          disabled={resolving}
          className={['m8-drop-slot', 'm8-backpack-slot', backpackEntry && 'is-filled'].filter(Boolean).join(' ')}
          onClick={() => submit(DEBRIS_SLOT.type, DEBRIS_SLOT.vector)}
        >
          <span className="m8-backpack-mark" aria-hidden="true">
            <i />
          </span>
          <span className="m8-drop-copy">
            <strong>{backpackEntry ? '已放入太空垃圾背包' : '太空垃圾背包'}</strong>
            <small>{backpackEntry ? `SCENE ${String(backpackEntry.index).padStart(2, '0')} · ${backpackEntry.title}` : '向下拖拽卡片，把疑似太空垃圾收入背包'}</small>
          </span>
          <span className="m8-backpack-state" aria-hidden="true">{backpackEntry ? 'IN' : '↓'}</span>
        </button>
      </div>
    </div>
  )
}

export default function M8({ onComplete }) {
  const { user, setStoryChapter } = useAppStore()
  const rootRef = useRef(null)
  const heroMarkRef = useRef(null)
  const [lessonStep, setLessonStep] = useState(0)
  const [practice, setPractice] = useState({})
  const [selectedId, setSelectedId] = useState('obs01')
  const [report, setReport] = useState(() => emptyReport(user?.city))
  const [reports, setReports] = useState([])
  const [activeCommunityId, setActiveCommunityId] = useState('obs01')
  const [activeSection, setActiveSection] = useState('m8-compare')
  const [flowPosition, setFlowPosition] = useState(6)
  const flowNavigationTargetRef = useRef(null)
  const flowNavigationTimerRef = useRef(null)

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
    const root = rootRef.current
    if (!root) return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let observer = null
    let blurObserver = null
    let xTo = null
    let yTo = null

    const ctx = gsap.context(() => {
      gsap.set('.m8-reveal', { autoAlpha: 0, y: 34 })
      gsap.to('.m8-reveal', {
        autoAlpha: 1,
        y: 0,
        duration: reduceMotion ? 0.01 : 0.85,
        ease: 'power3.out',
        stagger: 0.08,
      })

      const sections = gsap.utils.toArray('.m8-animate-section')
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const targets = entry.target.querySelectorAll(
            '.m8-section-heading, .m8-report-compare, .m8-required-fields, .m8-standard-tabs, .m8-practice-head, .m8-card-game, .m8-workbench, .m8-community-layout, .m8-complete',
          )
          gsap.fromTo(targets,
            { autoAlpha: 0, y: 30 },
            {
              autoAlpha: 1,
              y: 0,
              duration: reduceMotion ? 0.01 : 0.72,
              ease: 'power3.out',
              stagger: 0.07,
              overwrite: 'auto',
            },
          )
          observer.unobserve(entry.target)
        })
      }, { threshold: 0.18 })
      sections.forEach((section) => observer.observe(section))

      blurObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-in-view', entry.isIntersecting)
        })
      }, { threshold: 0.12 })
      root.querySelectorAll('.m8-standard-panel').forEach((panel) => blurObserver.observe(panel))

      if (!reduceMotion && heroMarkRef.current) {
        xTo = gsap.quickTo(heroMarkRef.current, 'x', { duration: 0.72, ease: 'power3.out' })
        yTo = gsap.quickTo(heroMarkRef.current, 'y', { duration: 0.72, ease: 'power3.out' })
      }
    }, root)

    function handlePointerMove(event) {
      if (!xTo || !yTo) return
      const rect = root.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      xTo(px * 18)
      yTo(py * 12)
    }

    root.addEventListener('pointermove', handlePointerMove)
    return () => {
      root.removeEventListener('pointermove', handlePointerMove)
      if (observer) observer.disconnect()
      if (blurObserver) blurObserver.disconnect()
      ctx.revert()
    }
  }, [])

  useEffect(() => {
    const ids = ['m8-compare', 'm8-practice', 'm8-report', 'm8-community']
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!sections.length) return undefined

    let frameId = 0
    const updateActiveSection = () => {
      frameId = 0

      const marker = Math.min(window.innerHeight * 0.34, 340)
      const markerY = window.scrollY + marker
      const startY = sections[0].getBoundingClientRect().top + window.scrollY
      const endY = sections[sections.length - 1].getBoundingClientRect().bottom + window.scrollY
      const rawProgress = (markerY - startY) / Math.max(endY - startY, 1)
      const clampedProgress = Math.min(1, Math.max(0, rawProgress))
      setFlowPosition(6 + clampedProgress * 88)

      if (flowNavigationTargetRef.current) return

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
    const nextIndex = Math.max(0, FLOW_STEPS.findIndex((step) => step.id === sectionId))
    setFlowPosition(6 + (nextIndex / (FLOW_STEPS.length - 1)) * 88)
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
    <section ref={rootRef} className="m8" data-module-scroll-target>
      <nav
        className="m8-flow"
        aria-label="观测报告流程"
        style={{ '--m8-flow-current': `${flowPosition}%` }}
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
                aria-label={`前往阶段 ${step.index} ${step.code}：${step.label}`}
                aria-current={activeSection === step.id ? 'step' : undefined}
                onClick={() => goTo(step.id)}
              >
                <span className="m8-flow-dot" aria-hidden="true" />
                <span className="m8-flow-node-label" aria-hidden="true">
                  <span><b>{step.index}</b>{step.code}</span>
                  <small>{step.label}</small>
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="m8-content">
        <header className="m8-header">
          <span className="m8-reveal">MODULE 08 / FIELD OBSERVATION</span>
          <div className="m8-hero-composition">
            <div className="m8-header-copy">
              <h2 className="m8-reveal">
                <span>先判断，</span>
                <span>再记录。</span>
              </h2>
              <p className="m8-reveal">把一次目击压缩成六个可复核信息：时间、地点、方位、持续、运动、证据。</p>
            </div>
            <div ref={heroMarkRef} className="m8-hero-mark m8-reveal" aria-hidden="true">
              <span>6</span>
              <b>要素</b>
              <i />
            </div>
          </div>
        </header>

      <section id="m8-compare" className="m8-band m8-compare m8-animate-section">
        <div className="m8-section-heading m8-section-heading--tight">
          <span>01 / REPORT ANATOMY</span>
          <div><h3>感受不足以复核。</h3><p>报告只保留别人能验证的信息。</p></div>
        </div>
        <div className="m8-report-compare">
          <article className="is-bad">
            <span>信息不足</span>
            <blockquote>{BAD_REPORT.text}</blockquote>
            <div className="m8-report-flag-group is-missing">
              <p>没有</p>
              <ol className="m8-report-flags" aria-label="这份记录缺少的信息">
                {BAD_REPORT.missing.map((item, index) => (
                  <li key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <b>{item}</b>
                  </li>
                ))}
              </ol>
            </div>
          </article>
          <article className="is-good">
            <span>可复核记录</span>
            <blockquote>{GOOD_REPORT.text}</blockquote>
            <div className="m8-report-flag-group is-included">
              <ol className="m8-report-flags" aria-label="这份记录包含的信息">
                {GOOD_REPORT.fields.map((item, index) => (
                  <li key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <b>{item}</b>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        </div>
        <div className="m8-required-fields" aria-label="观测报告必须包含的信息">
          <div className="m8-required-intro">
            <span>报告必须包含以下内容</span>
            <b><em>6</em> 要素</b>
            <p>缺少任意一项，记录都很难被他人复核。</p>
          </div>
          <ol>
            {REQUIRED_FIELDS.map((field, index) => (
              <li key={field.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{field.label}</strong>
                <p>
                  {field.hintLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="m8-practice" className="m8-band m8-training m8-animate-section">
        <div className="m8-section-heading">
          <span>02 / CLASSIFICATION LAB</span>
          <div><h3>先看运动，再判断对象。</h3><p>亮度不是充分证据。持续时间、碎裂方式与运动稳定性更有区分度。</p></div>
        </div>

        <div className="m8-standard-tabs" role="radiogroup" aria-label="观测对象分类">
          {STANDARD_CARDS.map((card, index) => {
            const active = lessonStep === index
            return (
              <button
                key={card.id}
                id={`m8-standard-tab-${index}`}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                className={['m8-standard-panel', active && 'is-active'].filter(Boolean).join(' ')}
                onPointerEnter={() => {
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
                <span className="m8-standard-label">0{index + 1} · {card.code}</span>
                <span className="m8-standard-number" aria-hidden="true">0{index + 1}</span>
                <span className="m8-standard-content">
                  <b>{card.title}</b>
                  <BlurRevealText text={card.signal} className="m8-standard-signal m8-blur-text" />
                  <BlurRevealText text={card.warning} className="m8-standard-warning m8-blur-text" delayOffset={180} />
                </span>
              </button>
            )
          })}
        </div>

        <div className="m8-practice-head">
          <div><span>SCENE TEST</span><h4>判断十五组观测事件</h4></div>
          <div><strong>{practiceScore}%</strong><span>{practiceAnsweredCount}/15 已判断</span></div>
        </div>

        <ClassificationDeck
          items={PRACTICE_SET}
          practice={practice}
          onAnswer={(id, type) => setPractice((current) => ({ ...current, [id]: type }))}
          onRestart={() => setPractice({})}
        />
      </section>

      <section id="m8-report" className="m8-band m8-report-workbench m8-animate-section">
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

      <section id="m8-community" className="m8-band m8-community m8-animate-section">
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
          <p>{!practiceDone ? '完成全部 15 组判断并达到 66% 正确率。' : reports.length === 0 ? '分类训练已完成，请提交一份报告。' : '观测训练与社区报告均已完成。'}</p>
        </div>
        <button type="button" onClick={handleComplete} disabled={!canComplete}>
          {canComplete ? '完成观测教学' : practiceDone ? '等待报告提交' : '等待分类训练'}
        </button>
      </footer>
      </div>
    </section>
  )
}
