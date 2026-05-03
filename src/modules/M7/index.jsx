import { useMemo, useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion, animate as fmAnimate, useMotionValue } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateAnswerExplanation, generateVideoQuestion } from '../../services/ai'

const MONO = 'Space Mono, monospace'
const SERIF = 'Noto Serif SC, serif'
const SANS = 'Noto Sans SC, sans-serif'
const EASE = [0.16, 1, 0.3, 1]
const CONTENT_MAX = 1080
const CARD_W      = 295
const CARD_GAP    = 10
const CARD_STEP   = CARD_W + CARD_GAP   // 305 px
const AUTO_MS     = 4200                // ms per step

const VIDEOS = [
  {
    id: 'scale',
    title: '1.7亿块、7000吨太空垃圾，正在包围地球',
    desc: '太空垃圾是怎样形成的？会产生哪些影响？',
    url: 'https://www.bilibili.com/video/BV1btUzB7Eor',
    img: '/covers/1.png',
    tag: 'SCALE',
    duration: '宏观概览',
    focus: ['数量级不是抽象数字，而是碰撞概率的底噪。', '厘米级碎片难以追踪，却足以摧毁航天器。', '清理问题同时是工程、治理和成本问题。'],
  },
  {
    id: 'cosmic-junk',
    title: "【It's Okay To Be Smart】双语·进击的太空垃圾",
    desc: 'Attack Of The Cosmic Space Junk!',
    url: 'https://www.bilibili.com/video/BV16E411h7n4',
    img: '/covers/2.png',
    tag: 'EXPLAINER',
    duration: '基础科普',
    focus: ['碎片速度让小物体具备巨大动能。', '轨道高度决定碎片停留时间。', '轨道环境需要像公共资源一样管理。'],
  },
  {
    id: 'imax',
    title: '【IMAX记录短片】空间垃圾 1080P',
    desc: '高码率中英双语字幕 Space Junk (2012)',
    url: 'https://www.bilibili.com/video/BV1MV411W7BF',
    img: '/covers/3.png',
    tag: 'DOCUMENTARY',
    duration: '纪录短片',
    focus: ['空间碎片问题并非未来风险，而是已发生的环境变化。', '可视化能帮助理解轨道拥堵。', '碎片治理需要长期观测数据支撑。'],
  },
  {
    id: 'impact',
    title: '太空垃圾撞击的力量有多大？',
    desc: '高速撞击实验展示惊人破坏力',
    url: 'https://www.bilibili.com/video/BV1CE41127ih',
    img: '/covers/4.png',
    tag: 'IMPACT',
    duration: '实验片段',
    focus: ['相对速度是破坏力的核心变量。', '毫米级碎片也可能造成穿孔和裂纹。', '防护只能降低风险，不能替代规避和清理。'],
  },
  {
    id: 'kessler',
    title: '凯斯勒综合征：被锁死的未来',
    desc: '太空垃圾将导致人类未来无法进入太空！',
    url: 'https://www.bilibili.com/video/BV1vb411u7Dd',
    img: '/covers/6.png',
    tag: 'CASCADE',
    duration: '风险模型',
    focus: ['一次碰撞会制造更多碰撞条件。', '高密度轨道区域更接近连锁反应阈值。', '预防比事后清理更便宜也更有效。'],
  },
  {
    id: 'cleanup',
    title: '清理太空：我们在行动',
    desc: '介绍现有的多种清理方案与技术',
    url: 'https://www.bilibili.com/video/BV1p34y1f7Ai',
    img: '/covers/12.png',
    tag: 'CLEANUP',
    duration: '解决方案',
    focus: ['不同碎片需要不同清理技术。', '清理大型目标通常优先级更高。', '法律授权和商业模式仍是现实瓶颈。'],
  },
]

const RESOURCES = [
  {
    title: 'NASA Orbital Debris Program',
    desc: 'NASA 官方轨道碎片计划办公室，提供季度报告、标准与测量资料。',
    url: 'https://orbitaldebris.jsc.nasa.gov/',
    tag: 'OFFICIAL DATA',
  },
  {
    title: 'ESA Space Debris Office',
    desc: '欧洲航天局太空碎片办公室，发布年度空间环境报告和可视化材料。',
    url: 'https://www.esa.int/Safety_Security/Space_Debris',
    tag: 'REPORT',
  },
  {
    title: 'Stuff in Space',
    desc: '实时三维轨道可视化，能看到卫星、火箭体和碎片对象。',
    url: 'http://stuffin.space/',
    tag: '3D MAP',
  },
  {
    title: 'LeoLabs Platform',
    desc: '商业低轨雷达追踪平台，展示碰撞预警和轨道态势数据。',
    url: 'https://platform.leolabs.space/visualization',
    tag: 'TRACKING',
  },
]

function getRecommendation({ gameResult, materials }) {
  const result = typeof gameResult === 'string' ? gameResult : gameResult?.result
  if (result === 'failure') return 'kessler'
  if (materials?.propulsion === 'ti_tank' || materials?.frame === 'titanium') return 'impact'
  if (materials?.solar === 'flexible' || materials?.insulation === 'mli') return 'scale'
  return 'cleanup'
}

function Dots({ color = '#c8b89a' }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 6 }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          animate={{ opacity: [0.15, 0.9, 0.15], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: color }}
        />
      ))}
    </span>
  )
}

function ScanBar() {
  return (
    <div style={{ height: 1, background: '#1c1c1a', overflow: 'hidden', position: 'relative', borderRadius: 1 }}>
      <motion.div
        animate={{ x: ['-100%', '250%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', top: 0, left: 0, width: '45%', height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(200,184,154,0.7), transparent)',
        }}
      />
    </div>
  )
}

// ── Hero Card ─────────────────────────────────────────────────────────────────
function HeroCard({ video, isVisited, isSelected, onClick }) {
  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.998 }}
      style={{
        position: 'relative', overflow: 'hidden', height: 300,
        background: '#0d0d0b',
        border: `1px solid ${isSelected ? 'rgba(200,184,154,0.28)' : '#1c1c1a'}`,
        borderRadius: 3, cursor: 'pointer',
        transition: 'border-color 0.25s',
        userSelect: 'none',
      }}
    >
      <img src={video.img} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        opacity: isSelected ? 0.52 : 0.3,
        transition: 'opacity 0.4s ease',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: isSelected
          ? 'linear-gradient(to top, rgba(13,13,11,0.97) 0%, rgba(13,13,11,0.65) 42%, rgba(13,13,11,0.18) 100%)'
          : 'linear-gradient(to top, rgba(13,13,11,0.95) 0%, rgba(13,13,11,0.5) 52%, rgba(13,13,11,0.1) 100%)',
        transition: 'background 0.35s', pointerEvents: 'none',
      }} />

      <div style={{ position: 'absolute', top: 16, left: 18, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#c8b89a', border: '1px solid rgba(200,184,154,0.22)', padding: '2px 8px', letterSpacing: '0.1em' }}>
          {video.tag}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#78c88c', border: '1px solid rgba(120,200,140,0.25)', padding: '2px 7px', letterSpacing: '0.06em' }}>
          推荐
        </span>
        {isVisited && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#5a7a5a', border: '1px solid rgba(90,122,90,0.22)', padding: '2px 6px' }}>已看</span>
        )}
      </div>
      <div style={{ position: 'absolute', top: 17, right: 18, fontFamily: MONO, fontSize: 8, color: '#2e2e2c', letterSpacing: '0.14em' }}>
        FEATURED
      </div>
      <div style={{ position: 'absolute', bottom: 26, left: 26, right: 52 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#4e4e4a', letterSpacing: '0.06em', marginBottom: 11 }}>
          {video.duration}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 21, color: '#ede9e0', lineHeight: 1.55, fontWeight: 300, marginBottom: 13 }}>
          {video.title}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: '#5e5e58', lineHeight: 1.65 }}>
          {video.focus[0]}
        </div>
      </div>
      <motion.div
        animate={{ scaleX: isSelected ? 1 : 0, opacity: isSelected ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(to right, rgba(200,184,154,0.55), rgba(200,184,154,0.08))',
          transformOrigin: 'left', pointerEvents: 'none',
        }}
      />
    </motion.div>
  )
}

// ── Track Card ────────────────────────────────────────────────────────────────
// progressScaleX: MotionValue (0→1), only passed to the active card
function TrackCard({ video, isVisited, isSelected, isActive, progressScaleX, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        height: 200, flexShrink: 0, width: CARD_W,
        background: '#0d0d0b',
        border: `1px solid ${
          isSelected ? 'rgba(200,184,154,0.28)'
          : isActive  ? 'rgba(200,184,154,0.16)'
          : isVisited ? 'rgba(200,184,154,0.09)'
          : '#1c1c1a'
        }`,
        borderRadius: 3, cursor: 'pointer',
        transition: 'border-color 0.4s',
        userSelect: 'none',
      }}
    >
      <img src={video.img} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover',
        opacity: hovered ? 0.48 : isActive ? 0.30 : 0.18,
        transition: 'opacity 0.4s ease',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: hovered
          ? 'linear-gradient(to top, rgba(13,13,11,0.97) 0%, rgba(13,13,11,0.65) 45%, rgba(13,13,11,0.15) 100%)'
          : 'linear-gradient(to top, rgba(13,13,11,0.95) 0%, rgba(13,13,11,0.28) 55%, transparent 100%)',
        transition: 'background 0.4s',
        pointerEvents: 'none',
      }} />

      {/* Badges */}
      <div style={{ position: 'absolute', top: 11, left: 12, display: 'flex', gap: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#c8b89a', border: '1px solid rgba(200,184,154,0.17)', padding: '2px 6px', letterSpacing: '0.08em' }}>
          {video.tag}
        </span>
        {isVisited && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#5a7a5a', border: '1px solid rgba(90,122,90,0.18)', padding: '2px 5px' }}>已看</span>
        )}
      </div>

      {/* Default: title at bottom */}
      <motion.div
        animate={{ opacity: hovered ? 0 : 1, y: hovered ? 6 : 0 }}
        transition={{ duration: 0.18 }}
        style={{ position: 'absolute', bottom: 14, left: 14, right: 14 }}
      >
        <div style={{ fontFamily: MONO, fontSize: 8, color: '#484844', marginBottom: 6, letterSpacing: '0.05em' }}>{video.duration}</div>
        <div style={{ fontFamily: SERIF, fontSize: 13, color: '#dedad2', lineHeight: 1.5, fontWeight: 300 }}>{video.title}</div>
      </motion.div>

      {/* Hover: first focus point + cta */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 10 }}
        transition={{ duration: 0.22, ease: EASE }}
        style={{ position: 'absolute', bottom: 14, left: 14, right: 14 }}
      >
        <div style={{ fontFamily: SANS, fontSize: 11, color: '#8a8a82', lineHeight: 1.65, marginBottom: 12 }}>
          {video.focus[0]}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a', letterSpacing: '0.08em' }}>点击查看详情 →</div>
      </motion.div>

      {/* Selected bottom line */}
      <motion.div
        animate={{ scaleX: isSelected ? 1 : 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: '#c8b89a', transformOrigin: 'left', pointerEvents: 'none',
        }}
      />

      {/* Active auto-scroll progress bar (hidden when selected to avoid overlap) */}
      {isActive && progressScaleX && !isSelected && (
        <motion.div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
            background: 'rgba(200,184,154,0.45)',
            scaleX: progressScaleX,
            transformOrigin: 'left', pointerEvents: 'none',
          }}
        />
      )}
    </motion.div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ video, onOpen, onClose }) {
  return (
    <motion.div
      key={video.id}
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      style={{ overflow: 'hidden', marginTop: 8 }}
    >
      <div style={{
        background: '#0d0d0b',
        border: '1px solid rgba(200,184,154,0.12)',
        borderLeft: '3px solid rgba(200,184,154,0.32)',
        borderRadius: 3, padding: '22px 26px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: '#c8b89a', letterSpacing: '0.1em', marginBottom: 7, opacity: 0.6 }}>
              {video.tag} · {video.duration}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 16, color: '#f0ede6', fontWeight: 300, lineHeight: 1.5 }}>
              {video.title}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#4a4a46',
            fontFamily: MONO, fontSize: 11, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0,
          }}>✕</button>
        </div>

        <div style={{ height: 1, background: '#1a1a18', marginBottom: 16 }} />

        <div style={{ display: 'grid', gap: 11, marginBottom: 22 }}>
          {video.focus.map((f, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.07, ease: EASE }}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#484844', lineHeight: 1.75, flexShrink: 0 }}>0{i + 1}</span>
              <span style={{ fontFamily: SANS, fontSize: 12, color: '#9a9a90', lineHeight: 1.75 }}>{f}</span>
            </motion.div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <motion.button
            onClick={() => onOpen(video)}
            whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.97 }}
            style={{
              background: '#c8b89a', border: 'none', color: '#0a0a0a',
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
              padding: '9px 22px', cursor: 'pointer', borderRadius: 2,
            }}
          >
            打开视频 →
          </motion.button>
          <span style={{ fontFamily: SANS, fontSize: 11, color: '#3a3a36' }}>在新标签页打开</span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function M7({ onComplete }) {
  const { user, satellite, materials, gameResult, storyOutline, setStoryChapter } = useAppStore()
  const recommendedId = useMemo(() => getRecommendation({ gameResult, materials }), [gameResult, materials])

  const [visited, setVisited]               = useState({})
  const [selectedId, setSelectedId]         = useState(null)
  const [autoIdx, setAutoIdx]               = useState(0)
  const [trackHovered, setTrackHovered]     = useState(false)
  const [aiOpen, setAiOpen]                 = useState(false)
  const [questionState, setQuestionState]   = useState('idle')
  const [question, setQuestion]             = useState('')
  const [answer, setAnswer]                 = useState('')
  const [explanationState, setExplanationState] = useState('idle')
  const [explanation, setExplanation]       = useState('')

  const xMV             = useMotionValue(0)
  const progressScaleX  = useMotionValue(0)
  const progressAnimRef = useRef(null)
  const stepCountRef    = useRef(0)
  const resetTimerRef   = useRef(null)

  const featuredVideo = useMemo(
    () => VIDEOS.find(v => v.id === recommendedId) || VIDEOS[0],
    [recommendedId]
  )
  const trackVideos = useMemo(
    () => VIDEOS.filter(v => v.id !== featuredVideo.id),
    [featuredVideo]
  )
  const loopVideos = useMemo(() => [...trackVideos, ...trackVideos], [trackVideos])

  const paused = trackHovered || Boolean(selectedId && selectedId !== featuredVideo.id)

  // ── Infinite rightward auto-advance ──────────────────────────────────────
  useEffect(() => {
    if (paused) {
      progressAnimRef.current?.stop()
      return
    }

    progressScaleX.set(0)
    progressAnimRef.current = fmAnimate(progressScaleX, 1, {
      duration: AUTO_MS / 1000,
      ease: 'linear',
    })

    const timer = setTimeout(() => {
      stepCountRef.current += 1
      const nextIdx = stepCountRef.current % trackVideos.length
      fmAnimate(xMV, -(stepCountRef.current * CARD_STEP), {
        type: 'spring', stiffness: 260, damping: 30, restDelta: 0.5,
      })
      setAutoIdx(nextIdx)
      if (nextIdx === 0) {
        resetTimerRef.current = setTimeout(() => {
          xMV.set(0)
          stepCountRef.current = 0
        }, 600)
      }
    }, AUTO_MS)

    return () => {
      progressAnimRef.current?.stop()
      clearTimeout(timer)
    }
  }, [autoIdx, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(video) {
    setSelectedId(prev => (prev === video.id ? null : video.id))
  }

  function openVideo(video) {
    setVisited(prev => ({ ...prev, [video.id]: true }))
    window.open(video.url, '_blank', 'noopener,noreferrer')
  }

  function jumpTo(idx) {
    const N = trackVideos.length
    const clamped = ((idx % N) + N) % N
    if (clamped === autoIdx) return
    clearTimeout(resetTimerRef.current)
    const cycleBase = stepCountRef.current - (stepCountRef.current % N)
    stepCountRef.current = cycleBase + clamped
    fmAnimate(xMV, -(stepCountRef.current * CARD_STEP), {
      type: 'spring', stiffness: 260, damping: 30, restDelta: 0.5,
    })
    setAutoIdx(clamped)
  }

  async function handleGenerateQuestion() {
    setQuestionState('loading')
    setQuestion('')
    try {
      const res = await generateVideoQuestion({
        satellite: satellite || { name: 'UNKNOWN', altitudeKm: '未知' },
        user: user || { name: '用户', city: '' },
        storyOutline,
      })
      setQuestion(res.question || `结合你的卫星 ${satellite?.name || ''}，哪种碎片风险最值得关注？`)
      setQuestionState('done')
    } catch {
      setQuestion(`结合你的卫星 ${satellite?.name || ''}，哪种碎片风险最值得关注？`)
      setQuestionState('error')
    }
  }

  async function handleExplain() {
    if (!answer.trim()) return
    setExplanationState('loading')
    setExplanation('')
    try {
      const res = await generateAnswerExplanation({
        question, answer,
        satellite: satellite || { name: 'UNKNOWN' },
        user: user || { name: '用户' },
      })
      setExplanation(res.explanation || '')
      setExplanationState('done')
    } catch {
      setExplanation('你的回答已经把视频内容和前面模块联系起来了。继续补充"碎片来源、轨道高度、清理成本"三者之间的关系，会让判断更完整。')
      setExplanationState('error')
    }
  }

  function handleContinue() {
    if (answer.trim()) setStoryChapter('m7', answer)
    onComplete()
  }

  const selectedVideo = selectedId ? VIDEOS.find(v => v.id === selectedId) : null
  const visitedCount  = Object.keys(visited).length

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', padding: '80px 24px' }}>
      <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto' }}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }}
          style={{ marginBottom: 52 }}
        >
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: '#5a5a56', marginBottom: 12 }}>
            MODULE 07 · VIDEO BRIEFING
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, color: '#f5f4f0', margin: '0 0 14px' }}>
            探索太空垃圾的多个视角。
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: 0, lineHeight: 1.75, maxWidth: 680 }}>
            几个不同维度的视频资料与核心数据来源。按兴趣自由浏览，点击卡片查看要点，随时可以继续。
          </p>
        </motion.div>

        {/* ── 视频精选 ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.45, ease: EASE }}
          style={{ marginBottom: 56 }}
        >
          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56' }}>
              视频精选
            </div>
            <AnimatePresence>
              {visitedCount > 0 && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ fontFamily: MONO, fontSize: 9, color: '#5a7a5a', letterSpacing: '0.06em' }}
                >
                  已看 {visitedCount} 个
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Hero card */}
          <HeroCard
            video={featuredVideo}
            isVisited={!!visited[featuredVideo.id]}
            isSelected={selectedId === featuredVideo.id}
            onClick={() => handleSelect(featuredVideo)}
          />

          {/* Detail panel under hero */}
          <AnimatePresence>
            {selectedId === featuredVideo.id && selectedVideo && (
              <DetailPanel video={selectedVideo} onOpen={openVideo} onClose={() => setSelectedId(null)} />
            )}
          </AnimatePresence>

          {/* ── Track controls: pill indicators + arrows ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 12px' }}>
            {/* Clickable pill indicators */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {Array.from({ length: trackVideos.length }, (_, i) => (
                <motion.button
                  key={i}
                  onClick={() => jumpTo(i)}
                  animate={{
                    width: i === autoIdx ? 20 : 5,
                    background: i === autoIdx ? '#c8b89a' : '#2a2a28',
                  }}
                  transition={{ duration: 0.38, ease: EASE }}
                  style={{ height: 3, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0 }}
                />
              ))}
            </div>

            {/* Arrow buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[[-1, '←'], [1, '→']].map(([dir, label]) => (
                <motion.button
                  key={label}
                  onClick={() => jumpTo(autoIdx + Number(dir))}
                  whileHover={{ opacity: 0.75, borderColor: '#3a3a38' }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    background: 'transparent', border: '1px solid #252523',
                    color: '#5a5a56', fontFamily: MONO, fontSize: 11,
                    width: 28, height: 28, cursor: 'pointer', borderRadius: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, transition: 'border-color 0.2s',
                  }}
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* ── Horizontal track (overflow hidden, spring x) ── */}
          <div
            style={{ overflow: 'hidden' }}
            onMouseEnter={() => setTrackHovered(true)}
            onMouseLeave={() => setTrackHovered(false)}
          >
            <motion.div style={{ display: 'flex', gap: CARD_GAP, x: xMV }}>
              {loopVideos.map((video, i) => (
                <TrackCard
                  key={`${video.id}-${i}`}
                  video={video}
                  isVisited={!!visited[video.id]}
                  isSelected={selectedId === video.id}
                  isActive={i % trackVideos.length === autoIdx}
                  progressScaleX={i % trackVideos.length === autoIdx ? progressScaleX : undefined}
                  onClick={() => handleSelect(video)}
                />
              ))}
            </motion.div>
          </div>

          {/* Detail panel under track */}
          <AnimatePresence>
            {selectedId && selectedId !== featuredVideo.id && selectedVideo && (
              <DetailPanel video={selectedVideo} onOpen={openVideo} onClose={() => setSelectedId(null)} />
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── 延伸数据源 ── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ height: 1, background: '#151513', marginBottom: 36 }} />
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            延伸数据源
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {RESOURCES.map((r, i) => (
              <motion.a
                key={r.title}
                href={r.url} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.07, ease: EASE }}
                whileHover={{ y: -2 }}
                style={{
                  display: 'block', textDecoration: 'none',
                  background: '#0d0d0b', border: '1px solid #1c1c1a',
                  borderRadius: 3, padding: '16px 18px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: '#c8b89a', letterSpacing: '0.1em' }}>{r.tag}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: '#3a3a38' }}>↗</span>
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 15, color: '#f0efe8', marginBottom: 7, fontWeight: 300 }}>{r.title}</div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: '#6a6a64', lineHeight: 1.65 }}>{r.desc}</div>
              </motion.a>
            ))}
          </div>
        </div>

        {/* ── 深入探索（可选 AI 问答）── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ height: 1, background: '#151513', marginBottom: 36 }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 6 }}>
                深入探索
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12, color: '#484844', margin: 0, lineHeight: 1.7 }}>
                想把视频内容和你的卫星故事联系起来？可以让 AI 生成一个专属问题。
              </p>
            </div>
            <motion.button
              onClick={() => setAiOpen(v => !v)}
              whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.97 }}
              style={{
                flexShrink: 0, background: 'transparent',
                border: `1px solid ${aiOpen ? 'rgba(200,184,154,0.30)' : '#252523'}`,
                color: aiOpen ? '#c8b89a' : '#5a5a56',
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                padding: '9px 16px', cursor: 'pointer', borderRadius: 2,
                transition: 'all 0.2s',
              }}
            >
              {aiOpen ? '收起' : '展开'}
            </motion.button>
          </div>

          <AnimatePresence>
            {aiOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 3, padding: '22px 24px' }}>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: '#4a4a46', letterSpacing: '0.1em' }}>
                      AI 个性化追问
                    </div>
                    <motion.button
                      onClick={handleGenerateQuestion}
                      disabled={questionState === 'loading'}
                      whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.97 }}
                      style={{
                        background: 'transparent', border: '1px solid #2a2a28', borderRadius: 2,
                        color: '#c8b89a', fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                        padding: '6px 12px', cursor: questionState === 'loading' ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {questionState === 'loading'
                        ? <><span>生成中</span><Dots /></>
                        : question ? '重新生成' : '生成追问'
                      }
                    </motion.button>
                  </div>

                  <AnimatePresence mode="wait">
                    {questionState === 'loading' ? (
                      <motion.div key="loading"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ marginBottom: 16 }}
                      >
                        <ScanBar />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: '#4a4a46' }}>正在生成</span>
                          <Dots color="#4a4a46" />
                        </div>
                      </motion.div>
                    ) : question ? (
                      <motion.p key={question}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                        style={{ fontFamily: SERIF, fontSize: 16, color: '#c8c2b8', lineHeight: 1.9, margin: '0 0 18px' }}
                      >
                        {question}
                      </motion.p>
                    ) : (
                      <motion.p key="hint"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ fontFamily: SANS, fontSize: 12, color: '#484844', lineHeight: 1.75, margin: '0 0 18px', fontStyle: 'italic' }}
                      >
                        点击"生成追问"，系统根据你的卫星和之前的选择生成一个具体问题。
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {(question || questionState === 'done') && (
                    <>
                      <div style={{ height: 1, background: '#181816', margin: '0 0 16px' }} />
                      <textarea
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        placeholder="写下你的想法..."
                        style={{
                          width: '100%', minHeight: 96, resize: 'vertical', boxSizing: 'border-box',
                          background: '#080807',
                          border: `1px solid ${answer.trim() ? 'rgba(200,184,154,0.20)' : '#1e1e1c'}`,
                          color: '#d8d3c8', fontFamily: SANS, fontSize: 13, lineHeight: 1.7,
                          padding: '12px 14px', outline: 'none', borderRadius: 2,
                          transition: 'border-color 0.3s', marginBottom: 10,
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <motion.button
                          onClick={handleExplain}
                          disabled={!answer.trim() || explanationState === 'loading'}
                          whileHover={answer.trim() ? { opacity: 0.8 } : {}}
                          whileTap={answer.trim() ? { scale: 0.97 } : {}}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${answer.trim() ? '#2a2a28' : '#181816'}`,
                            color: answer.trim() ? '#c8b89a' : '#282826',
                            fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                            padding: '7px 12px', borderRadius: 2,
                            cursor: answer.trim() ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          {explanationState === 'loading'
                            ? <><span>分析中</span><Dots /></>
                            : 'AI 补充解释'
                          }
                        </motion.button>
                      </div>

                      <AnimatePresence>
                        {explanation && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.4, ease: EASE }}
                            style={{ overflow: 'hidden' }}
                          >
                            {explanationState === 'loading' ? (
                              <div style={{ marginTop: 16 }}>
                                <ScanBar />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#4a4a46' }}>正在分析</span>
                                  <Dots color="#4a4a46" />
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: 18 }}>
                                <div style={{ height: 1, background: '#181816', marginBottom: 16 }} />
                                <div style={{ display: 'flex', gap: 14 }}>
                                  <div style={{ width: 2, background: 'rgba(200,184,154,0.18)', borderRadius: 1, flexShrink: 0 }} />
                                  <p style={{ fontFamily: SANS, fontSize: 12, color: '#8a8a82', lineHeight: 1.85, margin: 0 }}>
                                    {explanation}
                                  </p>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 继续 ── */}
        <div style={{ borderTop: '1px solid #1c1c1a', paddingTop: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#484844', margin: 0, lineHeight: 1.6 }}>
              这里的链接可以收藏，随时回来看。
            </p>
            <motion.button
              onClick={handleContinue}
              whileHover={{ opacity: 0.85, y: -1 }} whileTap={{ scale: 0.97 }}
              style={{
                fontFamily: MONO, fontSize: 12, letterSpacing: '0.12em',
                color: '#0a0a0a', background: '#c8b89a',
                border: 'none', borderRadius: 2,
                padding: '12px 40px', cursor: 'pointer',
              }}
            >
              继续下一章节 →
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  )
}
