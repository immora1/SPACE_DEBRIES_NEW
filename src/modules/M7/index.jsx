import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateAnswerExplanation, generateVideoQuestion } from '../../services/ai'
import './index.css'

const EASE = [0.16, 1, 0.3, 1]

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

function LoadingDots() {
  return (
    <span className="m7-loading-dots" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.i
          key={index}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.16 }}
        />
      ))}
    </span>
  )
}

export default function M7({ onComplete }) {
  const { user, satellite, materials, gameResult, setStoryChapter } = useAppStore()
  const recommendedId = useMemo(() => getRecommendation({ gameResult, materials }), [gameResult, materials])
  const [activeId, setActiveId] = useState(recommendedId)
  const [visited, setVisited] = useState({})
  const [aiOpen, setAiOpen] = useState(false)
  const [questionState, setQuestionState] = useState('idle')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [explanationState, setExplanationState] = useState('idle')
  const [explanation, setExplanation] = useState('')

  const activeVideo = VIDEOS.find((video) => video.id === activeId) || VIDEOS[0]
  const visitedCount = Object.keys(visited).length

  function selectVideo(video) {
    setActiveId(video.id)
  }

  function openVideo(video) {
    setVisited((current) => ({ ...current, [video.id]: true }))
    window.open(video.url, '_blank', 'noopener,noreferrer')
  }

  async function handleGenerateQuestion() {
    setQuestionState('loading')
    setQuestion('')
    setExplanation('')
    try {
      const res = await generateVideoQuestion({
        satellite: satellite || { name: 'UNKNOWN', altitudeKm: '未知' },
        user: user || { name: '用户', city: '' },
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
        question,
        answer,
        satellite: satellite || { name: 'UNKNOWN' },
        user: user || { name: '用户' },
      })
      setExplanation(res.explanation || '')
      setExplanationState('done')
    } catch {
      setExplanation('你的回答已经把视频内容和前面模块联系起来了。继续补充碎片来源、轨道高度与清理成本之间的关系，会让判断更完整。')
      setExplanationState('error')
    }
  }

  function handleContinue() {
    if (answer.trim()) setStoryChapter('m7', answer)
    onComplete()
  }

  return (
    <section className="m7" data-module-scroll-target>
      <header className="m7-header">
        <span>MODULE 07 / FIELD ARCHIVE</span>
        <div>
          <h2>从真实资料，重新理解轨道环境。</h2>
          <p>选择一个视角，查看关键判断，再前往原始视频或权威数据源。</p>
        </div>
      </header>

      <motion.div
        className="m7-viewer"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <div className="m7-stage">
          <AnimatePresence mode="wait">
            <motion.article
              key={activeVideo.id}
              className="m7-stage-content"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.24, ease: EASE }}
            >
              <div className="m7-stage-media">
                <img src={activeVideo.img} alt="" />
                <button type="button" onClick={() => openVideo(activeVideo)} aria-label={`打开视频：${activeVideo.title}`}>
                  <span>↗</span>
                </button>
              </div>
              <div className="m7-stage-body">
                <div className="m7-stage-meta">
                  <span>{activeVideo.tag}</span>
                  <span>{activeVideo.duration}</span>
                  {activeVideo.id === recommendedId && <span>为你推荐</span>}
                  {visited[activeVideo.id] && <span>已访问</span>}
                </div>
                <h3>{activeVideo.title}</h3>
                <p>{activeVideo.desc}</p>
                <ol>
                  {activeVideo.focus.map((point, index) => (
                    <li key={point}><span>0{index + 1}</span><p>{point}</p></li>
                  ))}
                </ol>
                <button className="m7-open-video" type="button" onClick={() => openVideo(activeVideo)}>
                  前往原始视频 <span>↗</span>
                </button>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <aside className="m7-playlist" aria-label="视频目录">
          <div className="m7-playlist-head">
            <span>VIDEO INDEX</span>
            <small>{visitedCount} / {VIDEOS.length} 已访问</small>
          </div>
          <div className="m7-playlist-list">
            {VIDEOS.map((video, index) => (
              <button
                key={video.id}
                type="button"
                className={video.id === activeVideo.id ? 'is-active' : ''}
                onClick={() => selectVideo(video)}
              >
                <span className="m7-playlist-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="m7-playlist-thumb"><img src={video.img} alt="" loading="lazy" /></span>
                <span className="m7-playlist-copy">
                  <small>{video.tag} / {video.duration}</small>
                  <b>{video.title}</b>
                </span>
                <span className="m7-playlist-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </aside>
      </motion.div>

      <section className="m7-resources" aria-labelledby="m7-resource-title">
        <div className="m7-section-title">
          <span>02 / VERIFIED SOURCES</span>
          <h3 id="m7-resource-title">继续查证。</h3>
          <p>从机构报告、轨道地图和商业追踪平台进入原始数据。</p>
        </div>
        <div className="m7-resource-list">
          {RESOURCES.map((resource, index) => (
            <motion.a
              key={resource.title}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.28, delay: index * 0.04, ease: EASE }}
            >
              <span>{resource.tag}</span>
              <div><b>{resource.title}</b><p>{resource.desc}</p></div>
              <i aria-hidden="true">↗</i>
            </motion.a>
          ))}
        </div>
      </section>

      <section className="m7-inquiry" aria-labelledby="m7-inquiry-title">
        <div className="m7-inquiry-head">
          <div>
            <span>03 / PERSONAL INQUIRY</span>
            <h3 id="m7-inquiry-title">把资料与你的卫星联系起来。</h3>
          </div>
          <button type="button" onClick={() => setAiOpen((current) => !current)}>
            {aiOpen ? '收起' : '开始回答'}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {aiOpen && (
            <motion.div
              className="m7-inquiry-body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <div className="m7-question-column">
                <div className="m7-question-action">
                  <span>AI QUESTION</span>
                  <button type="button" onClick={handleGenerateQuestion} disabled={questionState === 'loading'}>
                    {questionState === 'loading' ? <>生成中<LoadingDots /></> : question ? '重新生成' : '生成问题'}
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {questionState === 'loading' ? (
                    <motion.p key="loading" className="m7-question-placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      正在读取你的任务记录<LoadingDots />
                    </motion.p>
                  ) : (
                    <motion.p key={question || 'empty'} className={question ? 'm7-question' : 'm7-question-placeholder'} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {question || '生成一个与你的卫星、轨道和前序选择有关的问题。'}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="m7-answer-column">
                <label htmlFor="m7-answer">你的判断</label>
                <textarea
                  id="m7-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="写下你的判断与依据..."
                  disabled={!question}
                />
                <button type="button" onClick={handleExplain} disabled={!question || !answer.trim() || explanationState === 'loading'}>
                  {explanationState === 'loading' ? <>分析中<LoadingDots /></> : '补充分析'}
                </button>
                <AnimatePresence>
                  {(explanationState === 'loading' || explanation) && (
                    <motion.div className="m7-explanation" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      {explanationState === 'loading' ? <p>正在分析你的回答<LoadingDots /></p> : <p>{explanation}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer className="m7-footer">
        <div><span>ARCHIVE COMPLETE</span><p>资料链接可随时重新访问。</p></div>
        <button type="button" onClick={handleContinue}>继续下一章节 <span>→</span></button>
      </footer>
    </section>
  )
}
