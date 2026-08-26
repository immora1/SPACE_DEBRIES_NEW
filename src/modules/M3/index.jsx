import { useState, useEffect, useRef } from 'react'
import { AnimateChars, ScrollReveal } from '../../animations'
import useAppStore from '../../store/useAppStore'
import {
  createStorySession,
  submitMaterialStoryAction,
  submitMissionStoryAction,
} from '../../services/ai'
import OrbitGlobe from './OrbitGlobe'
import OrbitClassification from './OrbitClassification'
import IdentityDossier from './IdentityDossier'
import MaterialSelectionLab from './MaterialSelectionLab'
import MissionSelectionDeck from './MissionSelectionDeck'
import OrbitNarrative from './OrbitNarrative'
import useI18n from '../../i18n/useI18n'
import { MISSION_OPTIONS } from '../../../functions/_story/config/missions.js'
import './orbit-classification.css'

const ORBITS = [
  {
    id: 'leo', name: 'LEO', full: '低地球轨道', fullEn: 'Low Earth Orbit',
    classification: {
      count: '27,465',
      countLabel: '编目在轨物体',
      countLabelEn: 'Catalogued objects in orbit',
      countNote: '这里的数字代表当前被编目、位于 LEO 区域中的在轨物体总数，不等同于全部都是太空垃圾。',
      countNoteEn: 'This figure represents catalogued objects currently in LEO and does not mean that every object is space debris.',
      fields: [
        { label: '轨道高度', labelEn: 'Altitude', value: '约 180–2,000 km', valueEn: 'Approx. 180–2,000 km' },
        { label: '轨道周期', labelEn: 'Orbital period', value: '约 90–127 min', valueEn: 'Approx. 90–127 min' },
        { label: '代表任务', labelEn: 'Typical missions', value: '空间站 · 地球观测 · 通信星座', valueEn: 'Space stations · Earth observation · Communication constellations' },
      ],
      reference: { value: 'ISS ≈ 400 km', valueEn: 'ISS ≈ 400 km' },
      riskLabel: '物体和碎片最密集',
      riskLabelEn: 'Highest object and debris density',
      riskDescription: '多数轨道碎片集中在低地球轨道。较低高度的碎片会受大气阻力影响逐渐再入，但高度增加后，碎片可能停留几十年至数百年。',
      riskDescriptionEn: 'Most catalogued orbital debris is concentrated in low Earth orbit. Objects at lower altitudes gradually re-enter because of atmospheric drag, while debris at higher LEO altitudes can remain for decades or centuries.',
      supporting: {
        label: '补充数据', labelEn: 'Supporting data',
        value: '750–1,000 km', valueEn: '750–1,000 km',
        detail: '碎片密度较高的典型区域', detailEn: 'Typical region of high debris concentration',
      },
    },
    compositionEn: 'Defunct satellites, upper stages, collision fragments, aluminum, steel, titanium, carbon fiber, solar-cell glass, and insulation films dominate this region. Objects range from millimeter particles to complete rocket stages.',
    historyEn: 'In 2009, Iridium 33 and Cosmos-2251 collided near 790 km, creating more than 2,000 trackable fragments.',
    composition: {
      title: '主要残留',
      segments: [
        { text: '这里最常见的是' },
        { text: '失效卫星与火箭上面级', emphasis: true },
        { text: '，以及碰撞和爆炸产生的碎片。材料以' },
        { text: '铝合金、钢、钛和碳纤维', emphasis: true },
        { text: '为主，还包括太阳能电池玻璃与隔热膜；尺度从' },
        { text: '毫米级颗粒到数米级整段火箭', emphasis: true },
        { text: '。' },
      ],
    },
    history: {
      title: '历史记录',
      segments: [
        { text: '2009 年，' },
        { text: '铱星 33 与 Cosmos-2251', emphasis: true },
        { text: '在约 790 公里高度相撞，产生' },
        { text: '超过 2,000 件可追踪碎片', emphasis: true },
        { text: '，成为低轨最具代表性的卫星碰撞事件之一。' },
      ],
    },
    color: '#7da7e8',
  },
  {
    id: 'meo', name: 'MEO', full: '中地球轨道', fullEn: 'Medium Earth Orbit',
    classification: {
      count: '1,140+',
      countLabel: 'MEO 编目物体',
      countLabelEn: 'Catalogued MEO objects',
      countNote: 'ESA 的轨道分类中，部分导航卫星轨道会单独统计，因此不要把这个数字解释为所有导航卫星和碎片的总量。',
      countNoteEn: 'Some navigation-satellite orbital regions are counted separately in ESA classifications, so this number should not be described as the total number of all navigation satellites and debris.',
      fields: [
        { label: '轨道范围', labelEn: 'Orbital range', value: '约 2,000–31,570 km', valueEn: 'Approx. 2,000–31,570 km' },
        { label: 'GPS 轨道周期', labelEn: 'GPS orbital period', value: '约 12 h', valueEn: 'Approx. 12 h' },
        { label: '典型任务', labelEn: 'Typical missions', value: 'GPS · Galileo · 导航定位', valueEn: 'GPS · Galileo · Navigation' },
      ],
      reference: { value: 'GPS ≈ 20,200 km', valueEn: 'GPS ≈ 20,200 km' },
      riskLabel: '数量较少，但长期留轨',
      riskLabelEn: 'Lower density, long orbital lifetime',
      riskDescription: 'MEO 已远离稠密大气层，大气阻力很弱。失效卫星和碎片很难像低轨物体一样自然降低轨道，因此可能长期留在空间中。',
      riskDescriptionEn: 'Atmospheric drag is extremely weak at MEO altitudes. Inactive satellites and debris therefore do not naturally lose altitude as quickly as objects in lower orbits and may remain in orbit for long periods.',
    },
    compositionEn: 'Retired navigation satellites and transfer-stage hardware dominate MEO, with aluminum honeycomb structures, titanium and steel pressure vessels, carbon fiber, and solar-cell glass.',
    historyEn: 'No catastrophic satellite collision has been confirmed here. The main risk comes from long-lived retired spacecraft crossing the GPS, Galileo, and BeiDou orbital bands.',
    composition: {
      title: '主要残留',
      segments: [
        { text: '这里主要留下' },
        { text: '退役导航卫星与转移轨道上面级', emphasis: true },
        { text: '，并混有偶发解体碎片。常见材料包括' },
        { text: '铝蜂窝结构与钛、钢制压力容器', emphasis: true },
        { text: '，以及碳纤维和太阳能电池玻璃；尺度从' },
        { text: '厘米级碎片到数米级卫星平台', emphasis: true },
        { text: '。' },
      ],
    },
    history: {
      title: '历史记录',
      segments: [
        { text: '中轨' },
        { text: '尚无已确认的灾难性卫星相撞', emphasis: true },
        { text: '；风险主要来自寿命极长的退役卫星和上面级，它们会长期穿越' },
        { text: 'GPS、Galileo 与北斗轨道带', emphasis: true },
        { text: '。' },
      ],
    },
    color: '#9fc4ff',
  },
  {
    id: 'geo', name: 'GEO', full: '地球静止轨道', fullEn: 'Geostationary Orbit',
    classification: {
      count: '951',
      countLabel: '编目在轨物体',
      countLabelEn: 'Catalogued objects in orbit',
      countNote: '这里的数字代表 GEO 区域内被持续编目的在轨物体，并不等同于全部都是太空垃圾。',
      countNoteEn: 'This figure represents catalogued objects in the GEO region and does not mean that every object is space debris.',
      fields: [
        { label: '轨道高度', labelEn: 'Altitude', value: '约 35,786 km', valueEn: 'Approx. 35,786 km' },
        { label: '轨道周期', labelEn: 'Orbital period', value: '约 24 h', valueEn: 'Approx. 24 h' },
        { label: '典型任务', labelEn: 'Typical missions', value: '通信 · 气象 · 数据中继', valueEn: 'Communications · Weather · Data relay' },
      ],
      reference: {
        value: '35,786 km', valueEn: '35,786 km',
        detail: '地球静止轨道典型高度', detailEn: 'Typical geostationary altitude',
      },
      riskLabel: '轨道位置有限，失效物体长期存在',
      riskLabelEn: 'Limited orbital space, long-lived inactive objects',
      riskDescription: 'GEO 的物体数量低于 LEO，但地球静止轨道是一种有限的轨道资源。失效卫星如果继续停留，会占据可用轨道位置。',
      riskDescriptionEn: 'GEO contains fewer objects than LEO, but geostationary orbital positions are limited. Inactive satellites can occupy valuable orbital slots for long periods.',
      supporting: {
        label: '处置方式', labelEn: 'Disposal',
        value: '任务结束后通常抬升约 300 km', valueEn: 'Typically raised by about 300 km after retirement',
        detail: '进入墓地轨道', detailEn: 'Moved to a graveyard orbit',
      },
    },
    compositionEn: 'Retired communication and weather satellites, apogee motors, and breakup fragments dominate GEO. Objects range from centimeter fragments to multi-ton spacecraft.',
    historyEn: 'No catastrophic collision has been confirmed in GEO. Suspected debris near AMC-9 in 2017 showed how anomalies can leave threats in an orbit with almost no natural clearing.',
    composition: {
      title: '主要残留',
      segments: [
        { text: '这里主要是' },
        { text: '退役通信与气象卫星', emphasis: true },
        { text: '、远地点发动机和异常解体碎片。材料多为' },
        { text: '铝合金、碳纤维和钛制储箱', emphasis: true },
        { text: '，并包含多层隔热膜与太阳能电池玻璃；尺度从' },
        { text: '厘米级碎片到数吨重的整星', emphasis: true },
        { text: '。' },
      ],
    },
    history: {
      title: '历史记录',
      segments: [
        { text: '地球同步轨道' },
        { text: '尚无已确认的灾难性卫星相撞', emphasis: true },
        { text: '。' },
        { text: '2017 年 AMC-9', emphasis: true },
        { text: '失联后附近曾观测到疑似碎片，说明异常解体会在几乎没有大气清除作用的轨道上' },
        { text: '长期留下威胁', emphasis: true },
        { text: '。' },
      ],
    },
    color: '#9fc4ff',
  },
]

const MISSIONS = MISSION_OPTIONS

export default function M3({ onComplete }) {
  const { language, pick } = useI18n()
  const introFont = language === 'zh'
    ? '"PingFang SC", "Microsoft YaHei", sans-serif'
    : '"Lexend", sans-serif'
  const satellite       = useAppStore((s) => s.satellite)
  const materials       = useAppStore((s) => s.materials)
  const damageLevel     = useAppStore((s) => s.damageLevel)
  const clickedHistoryEvents = useAppStore((s) => s.clickedHistoryEvents)
  const storyId         = useAppStore((s) => s.storyId)
  const storyCheckpoint = useAppStore((s) => s.storyCheckpoint)
  const storyTimeline   = useAppStore((s) => s.storyTimeline)
  const publicGameState = useAppStore((s) => s.publicGameState)
  const setUser         = useAppStore((s) => s.setUser)
  const setSatellite    = useAppStore((s) => s.setSatellite)
  const setStoryOutline = useAppStore((s) => s.setStoryOutline)
  const beginStorySession = useAppStore((s) => s.beginStorySession)
  const setMission       = useAppStore((s) => s.setMission)
  const setStoryChapter  = useAppStore((s) => s.setStoryChapter)
  const scrollLocked     = useAppStore((s) => s.scrollLocked)
  const setScrollLocked  = useAppStore((s) => s.setScrollLocked)
  const setMaterialPart  = useAppStore((s) => s.setMaterialPart)

  const restoredMissionId = publicGameState?.mission?.action_id || null
  const restoredMaterialsCommitted = Object.keys(publicGameState?.satellite_build?.materials || {}).length === 4
  const restoredMaterialStage = [...(storyTimeline || [])].reverse().find(
    (stage) => stage.input_action?.module === 'M2_MATERIALS',
  )
  const restoredOpeningStage = [...(storyTimeline || [])].reverse().find(
    (stage) => stage.task_type === 'STORY_OPENING',
  )

  const [mission,        setMissionLocal]  = useState(restoredMissionId)
  const [aiState,        setAiState]       = useState(restoredMissionId ? 'done' : 'idle')
  const [story,          setStory]         = useState(
    language === 'en'
      ? publicGameState?.mission?.mission_effect_en || ''
      : publicGameState?.mission?.mission_effect || '',
  )
  const [currentStep,    setCurrentStep]   = useState(0)
  const [activeOrbit, setActiveOrbit] = useState('leo')
  const [pinnedOrbit, setPinnedOrbit] = useState('leo')
  const [matAiState,     setMatAiState]    = useState(restoredMaterialsCommitted ? 'done' : 'idle')
  const [matFeedback,    setMatFeedback]   = useState(restoredMaterialStage?.display_content?.story_text || '')

  const [formStep,       setFormStep]      = useState(storyId && satellite ? 'result' : 'form')
  const [form,           setForm]          = useState({ name: '', city: '', importantEvent: '' })
  const [openingStory,   setOpeningStory]  = useState(restoredOpeningStage?.display_content?.story_text || '')
  const [formError,      setFormError]     = useState(null)

  const onCompleteRef = useRef(onComplete)
  const storyRestoreAppliedRef = useRef(false)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    if (mission && aiState === 'done') onCompleteRef.current?.({ autoScroll: false })
  }, [aiState, mission])

  useEffect(() => {
    if (
      !storyRestoreAppliedRef.current
      && storyId
      && satellite
      && formStep !== 'generating'
    ) {
      storyRestoreAppliedRef.current = true
      setFormStep('result')
      if (restoredOpeningStage?.display_content?.story_text) {
        setOpeningStory(restoredOpeningStage.display_content.story_text)
      }
    }

    if (restoredMaterialsCommitted && storyCheckpoint !== 'materials') {
      setMatAiState('done')
      setMatFeedback(restoredMaterialStage?.display_content?.story_text || '')
    }

    if (restoredMissionId) {
      setMissionLocal(restoredMissionId)
      setAiState('done')
      setStory(
        language === 'en'
          ? publicGameState?.mission?.mission_effect_en || ''
          : publicGameState?.mission?.mission_effect || '',
      )
    }
  }, [
    formStep,
    restoredMaterialStage,
    restoredMaterialsCommitted,
    restoredMissionId,
    restoredOpeningStage,
    language,
    publicGameState?.mission?.mission_effect,
    publicGameState?.mission?.mission_effect_en,
    satellite,
    storyCheckpoint,
    storyId,
  ])

  useEffect(() => {
    setActiveOrbit(currentStep === 0 ? pinnedOrbit : null)
  }, [currentStep, pinnedOrbit])

  const previewOrbit = (orbitId) => setActiveOrbit(orbitId)
  const endOrbitPreview = () => setActiveOrbit(currentStep === 0 ? pinnedOrbit : null)
  const selectOrbit = (orbitId) => {
    setPinnedOrbit(orbitId)
    setActiveOrbit(orbitId)
  }

  // 四章节 ref
  const chapterRef0    = useRef(null)
  const chapterRef1    = useRef(null)
  const chapterRef2    = useRef(null)
  const chapterRef3    = useRef(null)
  const moduleRootRef  = useRef(null)
  const moduleInViewRef = useRef(false)
  const scrollUpdateRef = useRef(null)

  // 进度条 DOM ref（直接操作，不经 React 状态，保证 60fps 丝滑）
  const indicatorRef = useRef(null)
  const fillRef      = useRef(null)
  const labelRef     = useRef(null)
  const BAR_H        = 400  // 进度条总高度(px)
  // 折线分隔 DOM ref
  const notchRef     = useRef(null)

  // formStepRef 让滚动 RAF 闭包能读到最新 formStep（避免 stale closure）
  const formStepRef      = useRef(formStep)
  const scrollLockedRef  = useRef(false)

  useEffect(() => {
    if (!scrollLocked) scrollLockedRef.current = false
  }, [scrollLocked])

  useEffect(() => {
    formStepRef.current = formStep

    if (formStep === 'result') {
      if (scrollLockedRef.current) {
        scrollLockedRef.current = false
        setScrollLocked(false)
      }
      return undefined
    }

    const frameId = requestAnimationFrame(() => scrollUpdateRef.current?.())
    return () => cancelAnimationFrame(frameId)
  }, [formStep, setScrollLocked])

  useEffect(() => {
    const element = moduleRootRef.current
    if (!element || !('IntersectionObserver' in window)) {
      moduleInViewRef.current = true
      scrollUpdateRef.current?.()
      return undefined
    }

    const observer = new IntersectionObserver(([entry]) => {
      moduleInViewRef.current = entry.isIntersecting
      if (entry.isIntersecting) {
        scrollUpdateRef.current?.()
      } else if (scrollLockedRef.current) {
        scrollLockedRef.current = false
        setScrollLocked(false)
      }
    }, { rootMargin: '180px 0px' })

    observer.observe(element)
    return () => observer.disconnect()
  }, [setScrollLocked])

  async function handleFormSubmit() {
    const ready = form.name.trim() && form.city.trim() && form.importantEvent.trim()
    if (!ready) return
    setFormError(null)
    setFormStep('matching')
    try {
      const res = await fetch(`/api/satellite?city=${encodeURIComponent(form.city)}`)
      const data = await res.json()
      let sat
      if (data.ok) {
        const s = data.satellite
        sat = {
          name: s.OBJECT_NAME?.trim() ?? 'UNKNOWN-SAT',
          noradId: s.NORAD_CAT_ID,
          altitudeKm: Math.round((s.APOGEE + s.PERIGEE) / 2) || 500,
          inclination: s.INCLINATION ?? 51.6,
          periodMin: s.PERIOD ?? 92,
          launchYear: s.LAUNCH_DATE ? new Date(s.LAUNCH_DATE).getFullYear() : 2020,
        }
      } else {
        throw new Error(data.error)
      }
      setUser(form)
      setSatellite(sat)
      beginStorySession()
      setMission(null)
      setMissionLocal(null)
      setAiState('idle')
      setStory('')
      setMatAiState('idle')
      setMatFeedback('')
      setFormStep('generating')
      const storySnapshot = await createStorySession({
        name: form.name,
        city: form.city,
        importantEvent: form.importantEvent,
        satellite: sat,
        damageLevel,
        historyEventIds: (clickedHistoryEvents || []).map((event) => (
          event?.id || event?.eventId || event?.name || event?.title || String(event)
        )),
      })
      setStoryOutline(null)
      const openStory = storySnapshot.current_stage?.display_content?.story_text || ''
      setOpeningStory(openStory)
      setStoryChapter('opening', openStory)
      setFormStep('result')
    } catch (error) {
      setFormError(error?.message || pick('匹配失败，请重试', 'Matching failed. Please try again.'))
      setFormStep('form')
    }
  }

  useEffect(() => {
    let frameId = 0
    function update() {
      if (!moduleInViewRef.current) return
      if (frameId) return
      frameId = requestAnimationFrame(() => {
        frameId = 0
        if (!moduleInViewRef.current) return
        const vMid   = window.innerHeight / 2
        const rects  = [chapterRef0, chapterRef1, chapterRef2, chapterRef3].map(
          (r) => r.current?.getBoundingClientRect() ?? null
        )

        // ── 连续进度（0→1）：视口中心在四章节之间的相对位置
        if (rects[0] && rects[3]) {
          const c0    = rects[0].top + rects[0].height / 2
          const c2    = rects[3].top + rects[3].height / 2
          const range = c2 - c0
          if (range !== 0) {
            const prog   = Math.max(0, Math.min(1, (vMid - c0) / range))
            const dotTop = prog * (BAR_H - 12)  // 12 = 圆点直径
            // 直接操作 DOM，不触发 React 重渲
            if (indicatorRef.current)
              indicatorRef.current.style.transform = `translateY(${dotTop}px)`
            if (fillRef.current)
              fillRef.current.style.height = `${dotTop + 3}px`
            if (labelRef.current)
              labelRef.current.style.transform = `translateY(${dotTop}px)`
            // 折线随滚动移动：prog 0→1 映射到 10%→88%
            if (notchRef.current)
              notchRef.current.style.top = `${10 + prog * 78}%`
          }
        }

        // ── 离散 step（仅用于章节透明度，频率低）— 复用上面已读取的 rects
        const dists = rects.map((rect) => {
          if (!rect) return Infinity
          return Math.abs(rect.top + rect.height / 2 - vMid)
        })
        const next = dists.indexOf(Math.min(...dists))
        setCurrentStep((prev) => (prev !== next ? next : prev))

        // ── 表单门控：身份章节抵达视口起点时固定，生成结果后立即释放 ──
        if (rects[1]) {
          const formRect = rects[1]
          const formGateReached = formRect.top <= window.innerHeight * 0.08
            && formRect.bottom >= window.innerHeight * 0.72
          const formIncomplete = formStepRef.current !== 'result'
          const shouldLock = formIncomplete && (scrollLockedRef.current || formGateReached)

          if (shouldLock && Math.abs(formRect.top) > 2) {
            window.scrollTo({
              top: Math.max(0, window.scrollY + formRect.top),
              behavior: 'auto',
            })
          }

          if (shouldLock !== scrollLockedRef.current) {
            scrollLockedRef.current = shouldLock
            setScrollLocked(shouldLock)
          }
        } else if (scrollLockedRef.current) {
          scrollLockedRef.current = false
          setScrollLocked(false)
        }

      })
    }
    scrollUpdateRef.current = update
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', update)
      if (scrollUpdateRef.current === update) scrollUpdateRef.current = null
      if (frameId) cancelAnimationFrame(frameId)
      setScrollLocked(false)
    }
  }, [setScrollLocked])

  const safeMatls  = materials ?? {}
  const matAllDone = Object.values(safeMatls).filter(Boolean).length === 4
  const materialAnalysis = publicGameState ? {
    fuel: publicGameState.technical_metrics?.fuel,
    armor: publicGameState.technical_metrics?.armor,
    profiles: publicGameState.satellite_build?.material_profiles || {},
  } : null

  async function handleMatFeedback() {
    if (!matAllDone || matAiState !== 'idle') return
    setMatAiState('loading')
    try {
      const storySnapshot = await submitMaterialStoryAction(materials)
      setMatFeedback(storySnapshot.current_stage?.display_content?.story_text || '')
      setMatAiState('done')
    } catch { setMatAiState('error') }
  }

  function handleMaterialSelect(partId, optionId) {
    if (matAiState === 'done') return
    setMaterialPart(partId, optionId)
    if (matAiState !== 'idle') {
      setMatAiState('idle')
      setMatFeedback('')
    }
  }

  async function handleMissionSelect(missionId) {
    if (aiState === 'loading' || aiState === 'done') return
    setAiState('loading')
    try {
      const storySnapshot = await submitMissionStoryAction(missionId)
      const resolvedMission = storySnapshot.public_game_state?.mission
      const resolvedMissionId = resolvedMission?.mission_id || missionId
      const text = language === 'en'
        ? resolvedMission?.mission_effect_en || ''
        : resolvedMission?.mission_effect || ''
      setMissionLocal(resolvedMissionId)
      setMission(resolvedMissionId)
      setStory(text)
      setStoryChapter('m3', text)
      setAiState('done')
    } catch {
      setAiState('error')
    }
  }

  // 章节容器通用样式
  const chapterWrap = (step) => ({
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    padding: '80px 28px 80px 28px',
    opacity: currentStep === step ? 1 : 0.28,
    transition: 'opacity 0.55s ease',
  })

  return (
    <div
      ref={moduleRootRef}
      style={{
        background: `
          linear-gradient(rgba(232, 232, 248, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(232, 232, 248, 0.025) 1px, transparent 1px),
          #050713
        `,
        backgroundSize: '100% 168px, 168px 100%, auto',
        color: '#eef6ff',
        position: 'relative',
      }}
    >

      {/* ── 顶部标题区 ─────────────────────────────────────── */}
      <div style={{ padding: '44px 48px 40px', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <ScrollReveal>
          <div style={{
            fontFamily: introFont, fontSize: 8,
            color: '#5d78a8', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            {pick('03 · ORBIT / 轨道环境', '03 · ORBIT / ORBITAL ENVIRONMENT')}
          </div>
        </ScrollReveal>
        <h2 style={{
          fontFamily: introFont,
          fontSize: 'clamp(28px, 3vw, 36px)',
          fontWeight: 700, color: '#eef6ff', lineHeight: 1.55, marginBottom: 14, letterSpacing: '0.01em',
        }}>
          <AnimateChars
            text={pick('太空垃圾，在不同轨道上的风险并不一样。', 'Space debris poses different risks in different orbits.')}
            as="span"
            style={{ display: 'block' }}
            delay={0.05}
          />
        </h2>
        <ScrollReveal delay={0.4}>
          <p style={{
            fontFamily: introFont,
            fontSize: 13, color: 'rgba(238,246,255,0.5)', lineHeight: 1.9, maxWidth: 560, margin: '0 auto',
          }}>
            {pick(
              '卫星运行在不同高度的轨道中，这些区域的环境并不相同。大气阻力、航天器密度和碎片停留时间都会随轨道而变化。下面从三类典型轨道开始了解它们的差异。',
              'Satellites operate at different orbital altitudes, where conditions can vary significantly. Atmospheric drag, spacecraft density, and the time debris remains in orbit all change with altitude. The following three typical orbital regions show how these differences affect debris risk.',
            )}
          </p>
        </ScrollReveal>
      </div>

      {/* ── 主体双栏 ─────────────────────────────────────────
          左列：三个 ~100vh 的滚动章节
          右列：position: sticky，地球在模块内保持固定
      ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>


        {/* 左列：flex 自然伸展，paddingRight 给右侧地球留空间 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', paddingRight: '50%', paddingLeft: 24 }}>

          {/* ── 章节进度指示器（极简线形）── */}
          <div style={{
            width: 32,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ position: 'relative', width: 32, height: BAR_H }}>

              {/* 轨道底线（极暗） */}
              <div style={{
                position: 'absolute', left: 6, top: 0,
                width: 1, height: BAR_H,
                background: 'rgba(238,246,255,0.07)',
              }} />

              {/* 填充线（ref 控制高度，亮色） */}
              <div ref={fillRef} style={{
                position: 'absolute', left: 6, top: 0,
                width: 1, height: 0,
                background: '#7da7e8',
                boxShadow: 'none',
              }} />

              {/* 末端小点（ref 控制 transform） */}
              <div ref={indicatorRef} style={{
                position: 'absolute', left: 3, top: -3,
                width: 7, height: 7, borderRadius: '50%',
                background: '#7da7e8',
                boxShadow: 'none',
                transform: 'translateY(0px)',
              }} />

              {/* 跟随数字（ref 控制 transform，内容用 state 更新） */}
              <div ref={labelRef} style={{
                position: 'absolute', left: 16, top: -6,
                transform: 'translateY(0px)',
                pointerEvents: 'none',
              }}>
                <span style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: 9, color: 'rgba(125,167,232,0.65)',
                  letterSpacing: '0.12em',
                }}>
                  {String(currentStep + 1).padStart(2, '0')}
                </span>
              </div>

            </div>
          </div>

          {/* 章节内容区 */}
          <div style={{ flex: 1, minWidth: 0 }}>

          {/* ═══════════════════════════════════════════════
              {pick('章节 0 · 三层轨道分类', 'CHAPTER 0 · ORBIT CLASSIFICATION')}
          ═══════════════════════════════════════════════ */}
          <div ref={chapterRef0} style={chapterWrap(0)}>
            <OrbitClassification
              orbits={ORBITS}
              activeOrbit={activeOrbit}
              selectedOrbit={pinnedOrbit}
              onPreview={previewOrbit}
              onPreviewEnd={endOrbitPreview}
              onSelect={selectOrbit}
            />
          </div>

          {/* ═══════════════════════════════════════════════
              {pick('章节 1 · 用户信息 & 卫星匹配', 'CHAPTER 1 · IDENTITY & SATELLITE MATCH')}
          ═══════════════════════════════════════════════ */}
          <div ref={chapterRef1} style={chapterWrap(1)}>
            <IdentityDossier
              form={form}
              formStep={formStep}
              formError={formError}
              satellite={satellite}
              openingStory={openingStory}
              onChange={(field, value) => setForm((previous) => ({ ...previous, [field]: value }))}
              onSubmit={handleFormSubmit}
              onReset={() => {
                setFormError(null)
                setFormStep('form')
              }}
            />
          </div>

          {/* ═══════════════════════════════════════════════
              {pick('章节 2 · 材料选择 · MATERIAL SELECTION', 'CHAPTER 2 · MATERIAL SELECTION')}
          ═══════════════════════════════════════════════ */}
          <div ref={chapterRef2} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 28px' }}>
            <MaterialSelectionLab
              materials={safeMatls}
              allDone={matAllDone}
              aiState={matAiState}
              feedback={matFeedback}
              materialAnalysis={materialAnalysis}
              onSelect={handleMaterialSelect}
              onAnalyze={handleMatFeedback}
              onContinue={() => chapterRef3.current?.scrollIntoView({ behavior: 'smooth' })}
            />
          </div>

          {/* ═══════════════════════════════════════════════
              {pick('章节 3 · 任务指派', 'CHAPTER 3 · MISSION ASSIGNMENT')}
          ═══════════════════════════════════════════════ */}
          <div ref={chapterRef3} style={chapterWrap(3)}>
            <MissionSelectionDeck
              missions={MISSIONS}
              selectedMissionId={mission}
              aiState={aiState}
              story={story}
              satelliteName={satellite?.name}
              onConfirm={handleMissionSelect}
            />
          </div>

          </div>{/* 章节内容区 end */}
        </div>{/* 左列 end */}

        {/* ── 右列：脱离文档流，absolute 外壳 + sticky 内层 ── */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '48%',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
        <div style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          pointerEvents: 'auto',
        }}>

          {/* 3D 地球 — absolute 固定居中，不受下方 UI 影响 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100% - 40px)',
          }}>
            <OrbitGlobe
              satellite={satellite}
              height={420}
              activeOrbit={activeOrbit}
              currentStep={currentStep === 0 ? 0 : Math.max(0, currentStep - 1)}
              mission={mission}
            />
          </div>

          {/* 信息面板统一锚定到底部 */}
          <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>

          {currentStep === 0 && pinnedOrbit ? (
            <OrbitNarrative
              orbit={ORBITS.find((orbit) => orbit.id === pinnedOrbit)}
            />
          ) : null}

          </div>{/* 信息面板 end */}
        </div>
        </div>{/* absolute outer end */}
      </div>

    </div>
  )
}
