import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import gsap from 'gsap'
import useAppStore from '../../store/useAppStore'
import useI18n from '../../i18n/useI18n'
import { generateAnswerExplanation, generateVideoQuestion } from '../../services/ai'
import './index.css'

const EASE = [0.16, 1, 0.3, 1]

const VIDEOS = [
  {
    id: 'pollution',
    title: '轨道污染：我们如何把太空变成垃圾场',
    desc: 'ESA Space Safety 从碎片来源、碰撞风险与零碎片目标解释轨道污染。',
    url: 'https://www.youtube.com/watch?v=3Hq2zasVPuM',
    img: '/m7/space-pollution.jpg',
    tag: 'OVERVIEW',
    duration: 'ESA / 2026',
    focus: ['失效卫星、火箭级段与碰撞碎片共同构成轨道污染。', '高速碎片会威胁通信、导航和地球观测服务。', '零碎片设计需要覆盖任务的完整生命周期。'],
  },
  {
    id: 'risk',
    title: '太空垃圾为何比想象中更危险',
    desc: '从速度、数量和连锁碰撞三个尺度理解日益拥挤的近地轨道。',
    url: 'https://www.youtube.com/watch?v=TVGSGq5ZmyE',
    img: '/m7/space-junk-risk.jpg',
    tag: 'RISK',
    duration: 'SPARK / 2025',
    focus: ['厘米级碎片也能以极高相对速度造成灾难性破坏。', '无法追踪的小碎片使风险评估存在明显盲区。', '轨道越拥挤，规避机动与任务运营成本越高。'],
  },
  {
    id: 'history',
    title: '轨道碎片的增长轨迹',
    desc: 'ESA 动画回看航天时代以来人造物体如何逐步包围地球。',
    url: 'https://www.youtube.com/watch?v=9cd0-4qOvb0',
    img: '/m7/debris-history.jpg',
    tag: 'TIMELINE',
    duration: 'ESA ARCHIVE',
    focus: ['每次发射都会留下有效载荷、火箭体或任务相关物体。', '爆炸与碰撞会把少量大型物体转化为大量细小碎片。', '今天的轨道环境是数十年累积活动的结果。'],
  },
  {
    id: 'removal',
    title: 'e.Deorbit：主动清除失效卫星',
    desc: '机械臂捕获、稳定目标并引导再入的主动碎片清除任务概念。',
    url: 'https://www.youtube.com/watch?v=R6yZLbUCU2c',
    img: '/m7/active-removal.jpg',
    tag: 'REMOVAL',
    duration: 'ESA / MISSION',
    focus: ['清除任务必须先完成自主交会、识别与姿态同步。', '非合作目标没有标准接口，捕获难度远高于正常对接。', '优先移除大型失效目标能够降低未来碎片增殖风险。'],
  },
  {
    id: 'safety',
    title: '保护依赖卫星运行的世界',
    desc: 'ESA 展示如何同时应对空间碎片与空间天气对基础设施的影响。',
    url: 'https://www.youtube.com/watch?v=zNR0sdyaBLM',
    img: '/m7/protect-orbit.jpg',
    tag: 'SPACE SAFETY',
    duration: 'ESA / 2023',
    focus: ['轨道安全直接关系到通信、气象、导航与灾害响应。', '监测、预警和规避是当前最成熟的风险控制手段。', '空间可持续性需要运营方共享数据并遵守共同标准。'],
  },
  {
    id: 'reentry',
    title: 'Cluster 的最后一舞：一次受控再入',
    desc: 'ESA 通过提前调整轨道，让退役卫星在远离人口区域安全结束任务。',
    url: 'https://www.youtube.com/watch?v=KFNLzU3GItE',
    img: '/m7/targeted-reentry.jpg',
    tag: 'REENTRY',
    duration: 'ESA / 2024',
    focus: ['任务结束前的轨道设计决定卫星最终如何离开太空。', '定向再入能够缩小残骸可能落区并降低地面风险。', '可处置设计比任务结束后再寻找清理方案更高效。'],
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

const VIDEO_EN = {
  pollution: ['Orbital pollution: how space became a junkyard', 'ESA Space Safety explains debris sources, collision risk, and the zero-debris goal.', ['Defunct satellites, rocket stages, and collision fragments all contribute to orbital pollution.', 'Hypervelocity debris threatens communication, navigation, and Earth-observation services.', 'Zero-debris design must cover the full mission lifecycle.']],
  risk: ['Why space debris is more dangerous than it looks', 'Understand an increasingly crowded low Earth orbit through speed, population, and cascading collisions.', ['Centimeter-scale debris can cause catastrophic damage at high relative velocity.', 'Untracked small fragments create major blind spots in risk assessment.', 'Crowded orbits increase maneuver and operating costs.']],
  history: ['How orbital debris accumulated', 'An ESA animation traces how human-made objects gradually surrounded Earth throughout the space age.', ['Every launch leaves payloads, rocket bodies, or mission-related objects.', 'Explosions and collisions turn a few large objects into many small fragments.', 'Today\'s orbital environment is the result of decades of accumulated activity.']],
  removal: ['e.Deorbit: actively removing a dead satellite', 'A mission concept for robotic capture, stabilization, and guided re-entry.', ['Removal requires autonomous rendezvous, recognition, and attitude synchronization.', 'Uncooperative targets lack standard interfaces and are harder to capture than normal docking targets.', 'Removing large defunct objects first can reduce future debris growth.']],
  safety: ['Protecting a world that depends on satellites', 'ESA shows how debris and space weather affect infrastructure and how operators respond.', ['Orbital safety supports communication, weather, navigation, and disaster response.', 'Monitoring, warning, and avoidance are the most mature current controls.', 'Space sustainability requires data sharing and common standards.']],
  reentry: ['Cluster\'s final dance: a controlled re-entry', 'ESA adjusted the orbit in advance so retired satellites could end their missions away from populated regions.', ['End-of-life orbit design determines how a satellite leaves space.', 'Targeted re-entry narrows possible debris footprints and reduces ground risk.', 'Designing for disposal is more efficient than searching for cleanup options later.']],
}

const RESOURCE_EN = {
  'NASA Orbital Debris Program': 'NASA\'s official orbital-debris office, with quarterly reports, standards, and measurement resources.',
  'ESA Space Debris Office': 'ESA\'s debris office publishes annual environment reports and visual material.',
  'Stuff in Space': 'A live 3D orbital map of satellites, rocket bodies, and debris objects.',
  'LeoLabs Platform': 'A commercial LEO radar-tracking platform for conjunction warnings and orbital-awareness data.',
}

function localizeVideo(video, language) {
  if (language !== 'en') return video
  const translation = VIDEO_EN[video.id]
  return translation ? { ...video, title: translation[0], desc: translation[1], focus: translation[2] } : video
}

function getRecommendation({ gameResult, materials }) {
  const result = typeof gameResult === 'string' ? gameResult : gameResult?.result
  if (result === 'failure') return 'risk'
  if (materials?.propulsion === 'ti_tank' || materials?.frame === 'titanium') return 'removal'
  if (materials?.solar === 'flexible' || materials?.insulation === 'mli') return 'pollution'
  return 'safety'
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

export default function M7({ teachingEntry }) {
  const { language, pick } = useI18n()
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
  const rootRef = useRef(null)
  const mediaRef = useRef(null)
  const trackRef = useRef(null)

  const activeIndex = Math.max(0, VIDEOS.findIndex((video) => video.id === activeId))
  const activeVideo = localizeVideo(VIDEOS[activeIndex] || VIDEOS[0], language)
  const visitedCount = Object.keys(visited).length

  useLayoutEffect(() => {
    const mm = gsap.matchMedia()

    mm.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        reduced: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        if (context.conditions.reduced) {
          gsap.set('.m7-media-curtain', { scaleY: 0 })
          gsap.set('.m7-reveal', { autoAlpha: 1, y: 0 })
          return
        }

        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
        gsap.set('.m7-media-curtain', { scaleY: 1, transformOrigin: 'bottom center' })

        timeline
          .to('.m7-media-curtain', { scaleY: 0, duration: 0.72 })
          .fromTo('.m7-stage-image', { scale: 1.075 }, { scale: 1, duration: 1.05 }, 0)
          .fromTo(
            '.m7-reveal',
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.58, stagger: 0.055 },
            0.16,
          )
          .fromTo('.m7-active-line', { scaleX: 0 }, { scaleX: 1, duration: 0.62 }, 0.16)
      },
      rootRef.current,
    )

    return () => mm.revert()
  }, [activeId])

  useEffect(() => {
    const media = mediaRef.current
    const image = media?.querySelector('.m7-stage-image')
    if (!media || !image) return undefined

    const mm = gsap.matchMedia()
    mm.add(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      () => {
        const xTo = gsap.quickTo(image, 'xPercent', { duration: 0.8, ease: 'power3.out' })
        const yTo = gsap.quickTo(image, 'yPercent', { duration: 0.8, ease: 'power3.out' })

        function move(event) {
          const bounds = media.getBoundingClientRect()
          xTo(((event.clientX - bounds.left) / bounds.width - 0.5) * 2.4)
          yTo(((event.clientY - bounds.top) / bounds.height - 0.5) * 2.4)
        }

        function leave() {
          xTo(0)
          yTo(0)
        }

        media.addEventListener('pointermove', move)
        media.addEventListener('pointerleave', leave)
        return () => {
          media.removeEventListener('pointermove', move)
          media.removeEventListener('pointerleave', leave)
          gsap.killTweensOf(image)
        }
      },
      rootRef.current,
    )

    return () => mm.revert()
  }, [])

  useLayoutEffect(() => {
    const track = trackRef.current
    const viewport = track?.parentElement
    if (!track || !viewport) return undefined

    const mm = gsap.matchMedia()
    mm.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const itemStep = 100 / (VIDEOS.length * 2)
        const timeline = gsap.timeline({ repeat: -1 })
        let isCarouselVisible = false
        let hasFocusWithin = false
        gsap.set(track, { xPercent: 0 })
        timeline.to({}, { duration: 2.4 })

        for (let step = 1; step <= VIDEOS.length; step += 1) {
          timeline
            .to(track, {
              xPercent: -itemStep * step,
              duration: 0.85,
              ease: 'power2.inOut',
            })
            .call(() => setActiveId(VIDEOS[step % VIDEOS.length].id))
            .to({}, { duration: 2.4 })
        }

        timeline.set(track, { xPercent: 0 })

        timeline.pause()

        const carouselVisibilityObserver = new IntersectionObserver(([entry]) => {
          isCarouselVisible = entry.isIntersecting
          if (isCarouselVisible && !hasFocusWithin) timeline.resume()
          else timeline.pause()
        }, { rootMargin: '120px 0px' })
        carouselVisibilityObserver.observe(viewport)

        function pause() {
          hasFocusWithin = true
          timeline.pause()
        }

        function resumeAfterFocus(event) {
          if (viewport.contains(event.relatedTarget)) return
          hasFocusWithin = false
          if (isCarouselVisible) timeline.resume()
        }

        viewport.addEventListener('focusin', pause)
        viewport.addEventListener('focusout', resumeAfterFocus)

        return () => {
          viewport.removeEventListener('focusin', pause)
          viewport.removeEventListener('focusout', resumeAfterFocus)
          carouselVisibilityObserver.disconnect()
          timeline.kill()
        }
      },
      rootRef.current,
    )

    return () => mm.revert()
  }, [])

  function selectVideo(video) {
    if (video.id !== activeId) setActiveId(video.id)
  }

  function stepVideo(direction) {
    const nextIndex = (activeIndex + direction + VIDEOS.length) % VIDEOS.length
    setActiveId(VIDEOS[nextIndex].id)
  }

  function handleViewerKeyDown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      stepVideo(-1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      stepVideo(1)
    }
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
      setQuestion(res.question || pick(`结合你的卫星 ${satellite?.name || ''}，哪种碎片风险最值得关注？`, `For ${satellite?.name || 'your satellite'}, which debris risk deserves the most attention?`))
      setQuestionState('done')
    } catch {
      setQuestion(pick(`结合你的卫星 ${satellite?.name || ''}，哪种碎片风险最值得关注？`, `For ${satellite?.name || 'your satellite'}, which debris risk deserves the most attention?`))
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
      setExplanation(pick('你的回答已经把视频内容和前面模块联系起来了。继续补充碎片来源、轨道高度与清理成本之间的关系，会让判断更完整。', 'Your answer connects the archive with earlier modules. Add the relationship between debris source, orbital altitude, and cleanup cost to make the judgment more complete.'))
      setExplanationState('error')
    }
  }

  return (
    <section ref={rootRef} className="m7" data-module-scroll-target>
      <header className="m7-header">
        <span>MODULE 07 / FIELD ARCHIVE</span>
        <div>
          <h2>{pick('从真实资料，重新理解轨道环境。', 'Rebuild your view of orbit from real sources.')}</h2>
          <p>{pick('沿着六个视角浏览，提取关键判断，再前往原始视频或权威数据源。', 'Explore six perspectives, extract the key judgments, then continue to the original videos and authoritative data.')}</p>
        </div>
      </header>

      <div
        className="m7-viewer"
        tabIndex="0"
        onKeyDown={handleViewerKeyDown}
        aria-label={pick('视频资料浏览器，使用左右方向键切换', 'Video archive viewer; use the left and right arrow keys to navigate')}
      >
        <div className="m7-viewer-bar">
          <div>
            <span>01 / VIDEO OBSERVATORY</span>
            <small>{visitedCount} / {VIDEOS.length} {pick('已访问', 'VISITED')}</small>
          </div>
          <div className="m7-viewer-progress" aria-hidden="true">
            {VIDEOS.map((video) => <i key={video.id} className={video.id === activeId ? 'is-active' : ''} />)}
          </div>
        </div>

        <article className="m7-feature">
          <div ref={mediaRef} className="m7-feature-media">
            <img className="m7-stage-image" src={activeVideo.img} alt="" />
            <div className="m7-media-curtain" aria-hidden="true" />
            <div className="m7-media-meta m7-reveal">
              <span>{activeVideo.tag}</span>
              <span>{activeVideo.duration}</span>
              {activeVideo.id === recommendedId && <span>{pick('为你推荐', 'RECOMMENDED')}</span>}
              {visited[activeVideo.id] && <span>{pick('已访问', 'VISITED')}</span>}
            </div>
            <button
              className="m7-watch-button m7-reveal"
              type="button"
              onClick={() => openVideo(activeVideo)}
              aria-label={`${pick('打开视频', 'Open video')}: ${activeVideo.title}`}
            >
              <span>{pick('观看原片', 'WATCH SOURCE')}</span><i aria-hidden="true">↗</i>
            </button>
          </div>

          <div className="m7-feature-body">
            <div className="m7-feature-index m7-reveal">
              <strong>{String(activeIndex + 1).padStart(2, '0')}</strong>
              <span>/ {String(VIDEOS.length).padStart(2, '0')}</span>
            </div>
            <div className="m7-feature-copy">
              <span className="m7-feature-kicker m7-reveal">{activeVideo.tag} / {activeVideo.duration}</span>
              <h3 className="m7-reveal">{activeVideo.title}</h3>
              <p className="m7-reveal">{activeVideo.desc}</p>
            </div>
            <ol className="m7-feature-points">
              {activeVideo.focus.map((point, index) => (
                <li className="m7-reveal" key={point}>
                  <span>0{index + 1}</span><p>{point}</p>
                </li>
              ))}
            </ol>
          </div>
        </article>

        <nav className="m7-video-track" aria-label={pick('选择视频视角', 'Choose a video perspective')}>
          <div ref={trackRef} className="m7-video-track-inner">
            {[...VIDEOS, ...VIDEOS].map((sourceVideo, index) => {
              const video = localizeVideo(sourceVideo, language)
              const active = video.id === activeId
              const duplicate = index >= VIDEOS.length
              return (
                <button
                  key={video.id + '-' + index}
                  type="button"
                  className={active ? 'is-active' : ''}
                  aria-current={!duplicate && active ? 'true' : undefined}
                  aria-hidden={duplicate ? 'true' : undefined}
                  tabIndex={duplicate ? -1 : 0}
                  onClick={() => selectVideo(video)}
                >
                  <span className="m7-track-index">{String((index % VIDEOS.length) + 1).padStart(2, '0')}</span>
                  <span className="m7-track-thumb"><img src={video.img} alt="" loading="lazy" /></span>
                  <span className="m7-track-copy"><small>{video.duration}</small><b>{video.title}</b></span>
                  <span className="m7-track-state" aria-hidden="true">{visited[video.id] ? '✓' : '→'}</span>
                  {active && <span className="m7-active-line" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      <section className="m7-resources" aria-labelledby="m7-resource-title">
        <div className="m7-section-title">
          <span>02 / VERIFIED SOURCES</span>
          <h3 id="m7-resource-title">{pick('继续查证。', 'Verify further.')}</h3>
          <p>{pick('从机构报告、轨道地图和商业追踪平台进入原始数据。', 'Continue into institutional reports, orbital maps, and commercial tracking platforms.')}</p>
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
              <div><b>{resource.title}</b><p>{pick(resource.desc, RESOURCE_EN[resource.title])}</p></div>
              <i aria-hidden="true">↗</i>
            </motion.a>
          ))}
        </div>
      </section>

      <section className="m7-inquiry" aria-labelledby="m7-inquiry-title">
        <div className="m7-inquiry-head">
          <div>
            <span>03 / PERSONAL INQUIRY</span>
            <h3 id="m7-inquiry-title">{pick('把资料与你的卫星联系起来。', 'Connect the archive to your satellite.')}</h3>
          </div>
          <button type="button" onClick={() => setAiOpen((current) => !current)}>
            {aiOpen ? pick('收起', 'COLLAPSE') : pick('开始回答', 'START')}
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
                    {questionState === 'loading' ? <>{pick('生成中', 'GENERATING')}<LoadingDots /></> : question ? pick('重新生成', 'REGENERATE') : pick('生成问题', 'GENERATE QUESTION')}
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {questionState === 'loading' ? (
                    <motion.p key="loading" className="m7-question-placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {pick('正在读取你的任务记录', 'Reading your mission record')}<LoadingDots />
                    </motion.p>
                  ) : (
                    <motion.p key={question || 'empty'} className={question ? 'm7-question' : 'm7-question-placeholder'} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {question || pick('生成一个与你的卫星、轨道和前序选择有关的问题。', 'Generate a question connected to your satellite, orbit, and earlier choices.')}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="m7-answer-column">
                <label htmlFor="m7-answer">{pick('你的判断', 'YOUR JUDGMENT')}</label>
                <textarea
                  id="m7-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onBlur={() => answer.trim() && setStoryChapter('m7', answer.trim())}
                  placeholder={pick('写下你的判断与依据...', 'Write your judgment and evidence...')}
                  disabled={!question}
                />
                <button type="button" onClick={handleExplain} disabled={!question || !answer.trim() || explanationState === 'loading'}>
                  {explanationState === 'loading' ? <>{pick('分析中', 'ANALYZING')}<LoadingDots /></> : pick('补充分析', 'ADD ANALYSIS')}
                </button>
                <AnimatePresence>
                  {(explanationState === 'loading' || explanation) && (
                    <motion.div className="m7-explanation" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      {explanationState === 'loading' ? <p>{pick('正在分析你的回答', 'Analyzing your answer')}<LoadingDots /></p> : <p>{explanation}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer className="m7-footer">
        <div><span>ARCHIVE COMPLETE</span><p>{pick('资料链接可随时重新访问。', 'Source links remain available for later review.')}</p></div>
      </footer>
      {teachingEntry}
    </section>
  )
}
