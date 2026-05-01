import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateAnswerExplanation, generateVideoQuestion } from '../../services/ai'

const MONO = 'Space Mono, monospace'
const SERIF = 'Noto Serif SC, serif'
const SANS = 'Noto Sans SC, sans-serif'
const EASE = [0.16, 1, 0.3, 1]
const CONTENT_MAX = 1080

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

export default function M7({ onComplete }) {
  const { user, satellite, materials, gameResult, debrisGenerated, storyOutline, setStoryChapter } = useAppStore()
  const recommendedId = useMemo(() => getRecommendation({ gameResult, materials }), [gameResult, materials])
  const [activeId, setActiveId] = useState(recommendedId)
  const [visited, setVisited] = useState({})
  const [checks, setChecks] = useState({})
  const [questionState, setQuestionState] = useState('idle')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [explanationState, setExplanationState] = useState('idle')
  const [explanation, setExplanation] = useState('')

  const active = VIDEOS.find(v => v.id === activeId) || VIDEOS[0]
  const activeChecks = checks[active.id] || []
  const completedChecks = activeChecks.length
  const visitedCount = Object.keys(visited).length
  const canComplete = visitedCount > 0 && completedChecks >= 2 && answer.trim().length >= 8

  useEffect(() => {
    setActiveId(recommendedId)
  }, [recommendedId])

  function toggleCheck(idx) {
    setChecks(prev => {
      const current = prev[active.id] || []
      const next = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx]
      return { ...prev, [active.id]: next }
    })
  }

  function openVideo(video) {
    setVisited(prev => ({ ...prev, [video.id]: true }))
    window.open(video.url, '_blank', 'noopener,noreferrer')
  }

  async function handleGenerateQuestion() {
    setQuestionState('loading')
    try {
      const res = await generateVideoQuestion({
        satellite: satellite || { name: 'UNKNOWN', altitudeKm: '未知' },
        user: user || { name: '用户', city: '' },
        storyOutline,
      })
      setQuestion(res.question || `看完《${active.title}》后，你觉得 ${satellite?.name || '这颗卫星'} 最应该避免哪类碎片风险？`)
      setQuestionState('done')
    } catch {
      setQuestion(`看完《${active.title}》后，你觉得 ${satellite?.name || '这颗卫星'} 最应该避免哪类碎片风险？`)
      setQuestionState('error')
    }
  }

  async function handleExplain() {
    if (!answer.trim()) return
    setExplanationState('loading')
    try {
      const res = await generateAnswerExplanation({
        question,
        answer,
        satellite: satellite || { name: 'UNKNOWN' },
        user: user || { name: '用户' },
      })
      setExplanation(res.explanation || '')
      setExplanationState('done')
    } catch {
      setExplanation('你的回答已经把视频内容和前面模块联系起来了。继续补充“碎片来源、轨道高度、清理成本”三者之间的关系，会让判断更完整。')
      setExplanationState('error')
    }
  }

  function handleContinue() {
    if (!canComplete) return
    setStoryChapter('m7', answer)
    onComplete()
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', padding: '80px 24px' }}>
      <style>{`
        @keyframes m7Scan { from { transform: translateX(-120%); } to { transform: translateX(220%); } }
        @keyframes m7Pulse { 0%, 100% { opacity: .25; } 50% { opacity: .85; } }
      `}</style>
      <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto' }}>

        <div style={{ marginBottom: 46 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: '#5a5a56', marginBottom: 12 }}>
            MODULE 07 · VIDEO BRIEFING
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, color: '#f5f4f0', margin: '0 0 14px' }}>
            把碎片问题看完整。
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: 0, lineHeight: 1.75, maxWidth: 780 }}>
            这不是一个普通视频列表。你需要选择一个观察角度，打开外部视频观看，再回到这里完成检查点和一句判断。
            系统会根据你前面选择的材料与游戏结果推荐起点。
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) 360px',
          gap: 18,
          alignItems: 'stretch',
          marginBottom: 30,
        }}>
          <div style={{
            background: '#0d0d0b',
            border: '1px solid #1c1c1a',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            minHeight: 430,
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, scale: 1.015 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.45, ease: EASE }}
                style={{ position: 'absolute', inset: 0 }}
              >
                <img src={active.img} alt={active.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.62 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #0d0d0b 0%, rgba(13,13,11,0.74) 38%, rgba(13,13,11,0.18) 100%)' }} />
              </motion.div>
            </AnimatePresence>

            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: '28%',
                background: 'linear-gradient(90deg, transparent, rgba(200,184,154,0.055), transparent)',
                animation: 'm7Scan 4.8s linear infinite',
              }} />
              <div style={{ position: 'absolute', inset: 18, border: '1px solid rgba(245,244,240,0.045)' }} />
            </div>

            <div style={{ position: 'relative', zIndex: 2, padding: '28px 30px', maxWidth: 500 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a', border: '1px solid rgba(200,184,154,0.25)', padding: '3px 8px' }}>
                  {active.tag}
                </span>
                {active.id === recommendedId && (
                  <span style={{ fontFamily: MONO, fontSize: 9, color: '#78c88c', border: '1px solid rgba(120,200,140,0.22)', padding: '3px 8px' }}>
                    PERSONALIZED START
                  </span>
                )}
              </div>
              <h3 style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.35, fontWeight: 300, color: '#f5f4f0', margin: '0 0 12px' }}>
                {active.title}
              </h3>
              <p style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.75, color: '#8a8a82', margin: '0 0 18px' }}>
                {active.desc}
              </p>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#4a4a46', marginBottom: 20 }}>
                WATCH TYPE · {active.duration} / SOURCE · BILIBILI
              </div>

              <motion.button
                onClick={() => openVideo(active)}
                whileHover={{ opacity: 0.86 }}
                whileTap={{ scale: 0.985 }}
                style={{
                  background: '#c8b89a',
                  border: '1px solid #c8b89a',
                  color: '#0a0a0a',
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  padding: '11px 18px',
                  cursor: 'pointer',
                  marginRight: 10,
                }}
              >
                OPEN VIDEO
              </motion.button>
              <span style={{ fontFamily: MONO, fontSize: 10, color: visited[active.id] ? '#78c88c' : '#5a5a56' }}>
                {visited[active.id] ? '已打开观看链接' : '打开后回到此处完成检查'}
              </span>
            </div>
          </div>

          <div style={{
            background: '#0d0d0b',
            border: '1px solid #1c1c1a',
            borderRadius: 4,
            padding: 18,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: '#5a5a56', marginBottom: 14 }}>
              OBSERVATION CHECKPOINTS
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {active.focus.map((item, idx) => {
                const checked = activeChecks.includes(idx)
                return (
                  <motion.button
                    key={item}
                    onClick={() => toggleCheck(idx)}
                    whileTap={{ scale: 0.985 }}
                    style={{
                      textAlign: 'left',
                      background: checked ? 'rgba(200,184,154,0.06)' : 'rgba(255,255,255,0.018)',
                      border: `1px solid ${checked ? 'rgba(200,184,154,0.36)' : '#20201e'}`,
                      borderRadius: 4,
                      padding: '12px 13px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: `1px solid ${checked ? '#c8b89a' : '#333330'}`,
                        background: checked ? '#c8b89a' : 'transparent',
                        flexShrink: 0, marginTop: 2,
                        boxShadow: checked ? '0 0 12px rgba(200,184,154,0.22)' : 'none',
                      }} />
                      <div style={{ fontFamily: SANS, fontSize: 12, color: checked ? '#c7c1b4' : '#74746d', lineHeight: 1.65 }}>
                        {item}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            <div style={{ height: 1, background: '#1c1c1a', margin: '18px 0' }} />
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#4a4a46', marginBottom: 8 }}>PERSONAL CONTEXT</div>
            <p style={{ fontFamily: SANS, fontSize: 11, color: '#696964', lineHeight: 1.7, margin: 0 }}>
              当前卫星：{satellite?.name || satellite?.OBJECT_NAME || '未知卫星'}。
              M4 产生的垃圾线索：{debrisGenerated?.[0] || '暂无记录'}。
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 34 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 12 }}>
            VIDEO SIGNALS · 选择观察角度
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {VIDEOS.map((video, i) => {
              const activeCard = video.id === active.id
              return (
                <motion.button
                  key={video.id}
                  onClick={() => setActiveId(video.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.035, ease: EASE }}
                  whileHover={{ y: -3 }}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 116,
                    background: '#0d0d0b',
                    border: `1px solid ${activeCard ? 'rgba(200,184,154,0.48)' : '#1c1c1a'}`,
                    borderRadius: 4,
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <img src={video.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: activeCard ? 0.45 : 0.28 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d0d0b 0%, rgba(13,13,11,0.25) 100%)' }} />
                  <div style={{ position: 'relative', zIndex: 1, padding: 14 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: activeCard ? '#c8b89a' : '#5a5a56', marginBottom: 18 }}>
                      {video.tag} {visited[video.id] ? '· VISITED' : ''}
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 14, color: '#f0efe8', lineHeight: 1.45 }}>
                      {video.title}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, marginBottom: 36 }}>
          <div style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 4, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: '#5a5a56', letterSpacing: '0.12em' }}>
                AI FOLLOW-UP
              </div>
              <button
                onClick={handleGenerateQuestion}
                disabled={questionState === 'loading'}
                style={{
                  background: 'transparent',
                  border: '1px solid #2a2a28',
                  color: '#c8b89a',
                  fontFamily: MONO,
                  fontSize: 9,
                  padding: '5px 10px',
                  cursor: questionState === 'loading' ? 'wait' : 'pointer',
                }}
              >
                {questionState === 'loading' ? 'GENERATING...' : '生成追问'}
              </button>
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: '#b8b4aa', lineHeight: 1.85, margin: '0 0 12px' }}>
              {question || '生成一个与你的卫星、城市或前面选择相关的问题，然后写下你的判断。'}
            </p>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="写一句你的观察：这个视频让你重新理解了哪一种碎片风险？"
              style={{
                width: '100%',
                minHeight: 92,
                resize: 'vertical',
                boxSizing: 'border-box',
                background: '#080807',
                border: '1px solid #242420',
                color: '#d8d3c8',
                fontFamily: SANS,
                fontSize: 12,
                lineHeight: 1.7,
                padding: 12,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <button
                onClick={handleExplain}
                disabled={!answer.trim() || explanationState === 'loading'}
                style={{
                  background: 'transparent',
                  border: '1px solid #2a2a28',
                  color: answer.trim() ? '#c8b89a' : '#3a3a38',
                  fontFamily: MONO,
                  fontSize: 9,
                  padding: '7px 10px',
                  cursor: answer.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {explanationState === 'loading' ? 'ANALYZING...' : '让 AI 补充解释'}
              </button>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#3a3a38' }}>{answer.trim().length}/8 MIN</span>
            </div>
            {explanation && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ fontFamily: SANS, fontSize: 11, color: '#8a8a82', lineHeight: 1.75, margin: '14px 0 0', borderLeft: '2px solid rgba(200,184,154,0.25)', paddingLeft: 10 }}
              >
                {explanation}
              </motion.p>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {RESOURCES.map(resource => (
              <a
                key={resource.title}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  background: '#0d0d0b',
                  border: '1px solid #1c1c1a',
                  borderRadius: 4,
                  padding: '13px 15px',
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 8, color: '#c8b89a', letterSpacing: '0.1em', marginBottom: 6 }}>
                  {resource.tag}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 14, color: '#f0efe8', marginBottom: 5 }}>
                  {resource.title}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: '#6a6a64', lineHeight: 1.55 }}>
                  {resource.desc}
                </div>
              </a>
            ))}
          </div>
        </div>

        <motion.button
          onClick={handleContinue}
          disabled={!canComplete}
          whileHover={canComplete ? { opacity: 0.85 } : {}}
          whileTap={canComplete ? { scale: 0.985 } : {}}
          style={{
            width: '100%',
            padding: '16px 0',
            background: canComplete ? '#c8b89a' : 'transparent',
            border: `1px solid ${canComplete ? '#c8b89a' : '#2a2a28'}`,
            color: canComplete ? '#0a0a0a' : '#5a5a56',
            fontFamily: SERIF,
            fontSize: 14,
            letterSpacing: '0.1em',
            cursor: canComplete ? 'pointer' : 'not-allowed',
            opacity: canComplete ? 1 : 0.38,
          }}
        >
          {!visitedCount
            ? '先打开至少一个视频'
            : completedChecks < 2
              ? `还需完成 ${2 - completedChecks} 个检查点`
              : answer.trim().length < 8
                ? '写下你的观察'
                : '完成视频科普'}
        </motion.button>
      </div>
    </div>
  )
}
