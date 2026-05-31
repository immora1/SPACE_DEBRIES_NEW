import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import useAppStore from '../../store/useAppStore'
import {
  generateGameDecisionFeedback,
  generateGameReflection,
} from '../../services/ai'
import { pickEvents, calcInitialArmor, evaluateResult } from './gameData'
import GameScene from './GameScene'
import HUD from './HUD'
import EventCard from './EventCard'
import DecisionFeedback from './DecisionFeedback'
import ReflectionPage from './ReflectionPage'

const PHASE = {
  INTRO:      'intro',
  EVENT:      'event',
  FEEDBACK:   'feedback',
  REFLECTION: 'reflection',
}

const TOTAL_ROUNDS = 6

export default function M4({ onComplete }) {
  const {
    satellite, user, materials, mission,
    damageLevel, clickedHistoryEvents, storyOutline,
    setGameResult, setDebrisGenerated, setScrollLocked,
    setStoryChapter,
  } = useAppStore()

  const [phase, setPhase]               = useState(PHASE.INTRO)
  const [events, setEvents]             = useState([])
  const [round, setRound]               = useState(0)
  const [armor, setArmor]               = useState(100)
  const [fuel, setFuel]                 = useState(100)
  const [missionProgress, setMission]   = useState(0)
  const [decisions, setDecisions]       = useState([])
  const [currentFeedback, setFeedback]  = useState(null)
  const [reflection, setReflection]     = useState(null)
  const [gameResult, setLocalResult]    = useState(null)
  const [aiLoading, setAiLoading]       = useState(false)
  const [alertActive, setAlertActive]   = useState(false)
  // 累积故事线索：每轮决策后的平行时空更新
  const [storyThread, setStoryThread]   = useState([])
  // 自动推进倒计时（反馈阶段）
  const [countdown,   setCountdown]     = useState(null)
  const timerRef        = useRef(null)
  const hContinueRef    = useRef(null)   // 始终持有最新 handleContinue

  const initialArmor = calcInitialArmor(damageLevel)

  useEffect(() => {
    const picked = pickEvents(damageLevel, clickedHistoryEvents || [], TOTAL_ROUNDS)
    setEvents(picked)
    setArmor(initialArmor)
  }, [])

  useEffect(() => {
    if (phase === PHASE.EVENT || phase === PHASE.FEEDBACK) {
      setScrollLocked(true)
    } else {
      setScrollLocked(false)
    }
    return () => setScrollLocked(false)
  }, [phase])

  const currentEvent = events[round] || null

  const handleChoose = useCallback(async (option) => {
    setAlertActive(false)
    setAiLoading(true)

    const newArmor   = Math.max(0,   Math.min(100, armor   + (option.armorDelta   || 0)))
    const newFuel    = Math.max(0,   Math.min(100, fuel    + (option.fuelDelta    || 0)))
    const newMission = Math.max(0,   Math.min(100, missionProgress + (option.missionDelta || 0)))

    let aiResult = { feedback: '', storyUpdate: '' }
    try {
      aiResult = await generateGameDecisionFeedback({
        decision:       option.label,
        threat:         currentEvent.title,
        outcome:        option.outcome,
        satellite:      satellite || { name: 'UNKNOWN' },
        user:           user || { name: '用户', importantEvent: '某件重要的事' },
        storyOutline,
        decisionIndex:  round,
        totalDecisions: TOTAL_ROUNDS,
      })
    } catch (e) {
      aiResult = { feedback: option.techNote, storyUpdate: '' }
    }

    // 将故事更新追加到故事线索
    if (aiResult.storyUpdate) {
      setStoryThread(prev => [...prev, aiResult.storyUpdate])
    }

    const decision = {
      round,
      eventId:      currentEvent.id,
      eventTitle:   currentEvent.title,
      optionId:     option.id,
      optionLabel:  option.label,
      outcome:      option.outcome,
      armorDelta:   option.armorDelta,
      fuelDelta:    option.fuelDelta,
      missionDelta: option.missionDelta,
    }

    setDecisions((prev) => [...prev, decision])
    setArmor(newArmor)
    setFuel(newFuel)
    setMission(newMission)
    setFeedback({
      outcome:      option.outcome,
      aiLog:        aiResult.feedback || aiResult.content || '',
      storyUpdate:  aiResult.storyUpdate || '',
      techNote:     option.techNote,
      armorDelta:   option.armorDelta,
      fuelDelta:    option.fuelDelta,
      missionDelta: option.missionDelta,
    })
    setAiLoading(false)
    setPhase(PHASE.FEEDBACK)

    if (newArmor <= 0 || newFuel <= 0) {
      await handleGameEnd([...decisions, decision], newArmor, newFuel, newMission)
    }
  }, [armor, fuel, missionProgress, round, currentEvent, decisions, satellite, user, storyOutline])

  const handleContinue = useCallback(async () => {
    // 取消自动倒计时
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setCountdown(null)

    const nextRound = round + 1
    const isLast = nextRound >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0

    if (isLast) {
      await handleGameEnd(decisions, armor, fuel, missionProgress)
    } else {
      setRound(nextRound)
      setPhase(PHASE.EVENT)
      setTimeout(() => setAlertActive(true), 400)
    }
  }, [round, decisions, armor, fuel, missionProgress])

  // 始终保持 ref 指向最新 handleContinue，避免倒计时 stale closure
  hContinueRef.current = handleContinue

  // 进入 FEEDBACK 阶段后自动 4 秒推进（省去"继续"点击）
  useEffect(() => {
    if (phase !== PHASE.FEEDBACK || aiLoading) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setCountdown(null)
      return
    }
    let secs = 4
    setCountdown(secs)
    timerRef.current = setInterval(() => {
      secs -= 1
      if (secs <= 0) {
        clearInterval(timerRef.current)
        timerRef.current = null
        setCountdown(null)
        hContinueRef.current()
      } else {
        setCountdown(secs)
      }
    }, 1000)
    return () => { clearInterval(timerRef.current); timerRef.current = null }
  }, [phase, aiLoading])

  const handleGameEnd = useCallback(async (allDecisions, finalArmor, finalFuel, finalMission) => {
    const result = evaluateResult({
      armor: finalArmor,
      fuel:  finalFuel,
      missionProgress: finalMission,
      totalRounds: TOTAL_ROUNDS,
    })
    const isSuccess = result === 'success'
    setLocalResult(result)

    setAiLoading(true)
    let ref = { knowledgePoints: [], satFate: '', storyEnding: '', debrisDescription: '' }
    try {
      ref = await generateGameReflection({
        gameResult:  isSuccess ? 'success' : 'failure',
        decisions:   allDecisions,
        satellite:   satellite || { name: 'UNKNOWN' },
        user:        user || { name: '用户', importantEvent: '某件重要的事' },
        material:    materials?.frame || '铝合金',
        storyOutline,
      })
    } catch (e) {
      ref = {
        knowledgePoints: ['轨道机动需消耗宝贵燃料', '太空碎片碰撞风险是真实存在的统计问题', '25年离轨规定是国际共识但执行困难'],
        satFate: isSuccess ? '卫星完成任务，按规定离轨。' : '卫星失去控制，成为新的太空碎片。',
        storyEnding: isSuccess ? '那件最重要的事，被守住了。' : '那件最重要的事，在某个时刻悄悄改写了。',
        debrisDescription: '铝合金碎片，直径5-20cm，LEO轨道残留。',
      }
    }
    setAiLoading(false)

    setGameResult({ result, finalArmor, finalFuel, finalMission, decisionCount: allDecisions.length })
    setDebrisGenerated([ref.debrisDescription])
    setStoryChapter('m4', ref.storyEnding)

    setReflection(ref)
    setScrollLocked(false)
    setPhase(PHASE.REFLECTION)
  }, [satellite, user, materials, storyOutline, setGameResult, setDebrisGenerated, setStoryChapter, setScrollLocked])

  function startGame() {
    setPhase(PHASE.EVENT)
    setTimeout(() => setAlertActive(true), 600)
  }

  const satInclination = satellite?.inclination
    ? (satellite.inclination * Math.PI) / 180 * 0.3
    : 0.5

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: 'transparent', overflow: 'hidden' }}>

      {/* 3D 游戏场景 — 仅在游戏进行时显示，INTRO 不渲染 */}
      {phase !== PHASE.INTRO && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <GameScene
            damageLevel={damageLevel}
            alertActive={alertActive}
            satelliteInclination={satInclination}
          />
        </div>
      )}

      {/* 左侧白色磨砂玻璃面板 — 占屏幕 1/3 */}
      {(phase === PHASE.EVENT || phase === PHASE.FEEDBACK) && (
        <div style={{
          position: 'absolute', left: 0, top: 0,
          width: 'calc(100% / 3)',
          height: '100%',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRight: '1px solid rgba(18,18,18,0.08)',
          zIndex: 20,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* HUD 顶部状态区 */}
          <HUD
            armor={armor} fuel={fuel}
            missionProgress={missionProgress}
            round={round + 1} totalRounds={TOTAL_ROUNDS}
            satelliteName={satellite?.name}
          />
          {/* 分割线 */}
          <div style={{ height: 1, background: 'rgba(18,18,18,0.08)', flexShrink: 0 }} />

          {/* 内容区（可滚动） */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence mode="wait">
              {aiLoading && <AiThinkingPanel key="ai-thinking" />}
              {phase === PHASE.EVENT && !aiLoading && (
                <EventCard
                  key={`event-${round}`}
                  event={currentEvent}
                  onChoose={handleChoose}
                  disabled={aiLoading}
                  round={round + 1}
                  totalRounds={TOTAL_ROUNDS}
                  storyThread={storyThread}
                />
              )}
              {phase === PHASE.FEEDBACK && !aiLoading && (
                <DecisionFeedback
                  key={`feedback-${round}`}
                  feedback={currentFeedback}
                  storyThread={storyThread}
                />
              )}
            </AnimatePresence>
          </div>

          {/* 底部固定按钮区 — 位置始终不变 */}
          {phase === PHASE.FEEDBACK && !aiLoading && currentFeedback && (
            <div style={{
              flexShrink: 0,
              padding: '12px 20px 16px',
              borderTop: '1px solid rgba(18,18,18,0.08)',
              background: 'rgba(255,255,255,0.60)',
            }}>
              <motion.button
                onClick={handleContinue}
                whileHover={{ opacity: 0.82 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 11, letterSpacing: '0.12em', fontWeight: 700,
                  color: (round + 1 >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0) ? '#fff' : '#5046e5',
                  background: (round + 1 >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0) ? '#5046e5' : 'transparent',
                  border: `1px solid ${(round + 1 >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0) ? '#5046e5' : 'rgba(80,70,229,0.35)'}`,
                  borderRadius: 3, padding: '10px 0',
                  cursor: 'pointer', textAlign: 'center',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {(round + 1 >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0)
                  ? '查看结算 →'
                  : countdown != null ? `继续  (${countdown}s)` : '继续 →'
                }
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* INTRO */}
      {phase === PHASE.INTRO && (
        <IntroOverlay
          satellite={satellite}
          initialArmor={initialArmor}
          damageLevel={damageLevel}
          storyOutline={storyOutline}
          onStart={startGame}
        />
      )}

      {/* 结算页 */}
      {phase === PHASE.REFLECTION && (
        <ReflectionPage
          reflection={reflection}
          gameResult={gameResult}
          storyThread={storyThread}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}

const EASE = [0.16, 1, 0.3, 1]

// Earth GLB 模型 — 缓慢自转，仅用于 intro 页面
const EARTH_GLB = '/earth%20globe%203d%20model.glb'

function IntroEarthMesh({ scale = 1.2 }) {
  const { scene } = useGLTF(EARTH_GLB)
  const ref = useRef()
  useFrame((_, dt) => { ref.current.rotation.y += dt * 0.06 })
  return <primitive ref={ref} object={scene} scale={scale} />
}
useGLTF.preload(EARTH_GLB)

const MONO  = "'Space Mono', monospace"
const SERIF = "'Noto Serif SC', serif"
const SANS  = "'Noto Sans SC', sans-serif"

function IntroOverlay({ satellite, initialArmor, damageLevel, storyOutline, onStart }) {
  const [orbitProgress, setOrbitProgress] = useState(0)
  const orbitDragRef = useRef(false)
  const canvasContainerRef = useRef()

  const earthScale = 1.2 + orbitProgress * (3.5 - 1.2)
  const dashOpacity = Math.max(0, 1 - orbitProgress)

  const m4Beat = storyOutline?.checkpoints?.find((c) => c.id === 'm4')?.beat || '命运决战时刻'

  const briefRows = [
    { label: '卫星',    value: satellite?.name || 'UNKNOWN' },
    { label: '轨道高度', value: `${satellite?.altitudeKm || '--'} km` },
    { label: '轨道类型', value: 'LEO' },
    { label: '初始护甲', value: `${initialArmor}%`, color: initialArmor < 70 ? '#fbbf24' : '#34d399',
      sub: damageLevel > 0 ? `M3 受损 −${damageLevel * 5}%` : null },
    { label: '燃料储量', value: '100%', color: '#34d399' },
    { label: '决策轮次', value: `${TOTAL_ROUNDS} 轮` },
  ]

  const handleOrbitDragStart = useCallback((e) => {
    orbitDragRef.current = true
    handleOrbitDragMove(e)
  }, [])

  const handleOrbitDragMove = useCallback((e) => {
    if (!orbitDragRef.current || !canvasContainerRef.current) return
    const rect = canvasContainerRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const x = e.clientX - rect.left - centerX
    const y = e.clientY - rect.top - centerY

    let angle = Math.atan2(y, x)
    if (angle < 0) angle += Math.PI * 2

    if (angle >= Math.PI / 2 && angle <= 3 * Math.PI / 2) {
      const normalizedAngle = angle - Math.PI / 2
      const progress = Math.max(0, Math.min(1, normalizedAngle / Math.PI))
      setOrbitProgress(progress)
    }
  }, [])

  const handleOrbitDragEnd = useCallback(() => {
    orbitDragRef.current = false
  }, [])

  useEffect(() => {
    if (orbitDragRef.current) {
      document.addEventListener('mousemove', handleOrbitDragMove)
      document.addEventListener('mouseup', handleOrbitDragEnd)
      return () => {
        document.removeEventListener('mousemove', handleOrbitDragMove)
        document.removeEventListener('mouseup', handleOrbitDragEnd)
      }
    }
  }, [handleOrbitDragMove, handleOrbitDragEnd])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.65, ease: EASE }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        zIndex: 10,
      }}
    >
      {/* 轨道交互 UI — 最上层 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
        {/* 虚线轨道背景 */}
        <div style={{
          position: 'absolute',
          borderRadius: '50%',
          border: `2px dashed rgba(107,127,255,${dashOpacity * 0.5})`,
          top: '50%', left: '50%',
          width: '36%', height: '36%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* 白圆拖动控件 */}
      <div
        onMouseDown={handleOrbitDragStart}
        style={{
          position: 'absolute',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: `0 0 16px rgba(255,255,255,${0.6 + orbitProgress * 0.2}), 0 0 32px rgba(107,127,255,${0.3 + orbitProgress * 0.3})`,
          border: `2px solid rgba(107,127,255,${0.7 + orbitProgress * 0.2})`,
          cursor: 'grab',
          left: `calc(50% + ${Math.cos(Math.PI / 2 + orbitProgress * Math.PI) * 18}%)`,
          top: `calc(50% + ${Math.sin(Math.PI / 2 + orbitProgress * Math.PI) * 18}%)`,
          transform: 'translate(-50%, -50%)',
          transition: orbitDragRef.current ? 'none' : 'all 0.16s ease-out',
          pointerEvents: 'auto',
          zIndex: 100,
        }}
      />

      {/* ── 顶部：模块标签 + 大标题 ── */}
      <div style={{ textAlign: 'center', padding: '44px 0 0', flexShrink: 0 }}>
        <div style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'rgba(107,127,255,0.5)',
          marginBottom: 16,
        }}>
          MODULE 04 · SURVIVAL MISSION
        </div>

        <h1 style={{
          fontFamily: SERIF,
          fontSize: 'clamp(40px, 5.5vw, 72px)',
          color: '#e8e8f8', fontWeight: 300,
          letterSpacing: '0.05em', margin: 0, lineHeight: 1.1,
        }}>
          卫星生存任务
        </h1>

        <div style={{
          height: 1,
          background: 'linear-gradient(to right, transparent, rgba(107,127,255,0.22), transparent)',
          width: '36%', margin: '20px auto 0',
        }} />
      </div>

      {/* ── 主体：左栏 + 中心地球 + 右栏 ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        padding: '0 5vw', gap: '2vw', minHeight: 0,
      }}>

        {/* 左栏：任务简报 */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: EASE, delay: 0.15 }}
          style={{ width: '22%', flexShrink: 0 }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22,
          }}>
            <div style={{ width: 14, height: 1, background: 'rgba(107,127,255,0.4)' }} />
            <span style={{
              fontFamily: MONO, fontSize: 7, color: 'rgba(107,127,255,0.55)',
              letterSpacing: '0.22em', textTransform: 'uppercase',
            }}>
              MISSION BRIEFING
            </span>
          </div>

          {briefRows.map(({ label, value, color, sub }, i) => (
            <div key={i} style={{
              padding: '10px 0',
              borderBottom: i < briefRows.length - 1 ? '1px solid rgba(26,26,53,0.55)' : 'none',
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 7, color: '#484878',
                letterSpacing: '0.08em', marginBottom: 5,
              }}>
                {label}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: color || '#8888a8' }}>
                {value}
                {sub && (
                  <span style={{ fontFamily: MONO, fontSize: 8, color: '#fbbf24', marginLeft: 10 }}>
                    {sub}
                  </span>
                )}
              </div>
            </div>
          ))}
        </motion.div>

        {/* 中心：3D 地球 */}
        <div ref={canvasContainerRef} style={{ flex: 1, position: 'relative', minHeight: 0, height: '60vh' }}>
          <Canvas
            camera={{ position: [0, 0, 2.75], fov: 45 }}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
            gl={{ alpha: true, antialias: true }}
          >
            <ambientLight intensity={2.2} />
            <directionalLight position={[4, 3, 3]} intensity={4.0} color="#c8d8f0" />
            <directionalLight position={[-3, 1, -2]} intensity={1.2} color="#8899cc" />
            <pointLight position={[0, 4, 2]} intensity={2.5} color="#ffffff" />
            <Suspense fallback={null}>
              <IntroEarthMesh scale={earthScale} />
            </Suspense>
          </Canvas>

          {/* 地球下方装饰标签 */}
          <div style={{
            position: 'absolute', bottom: '6%', left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: MONO, fontSize: 7,
            color: 'rgba(107,127,255,0.30)', letterSpacing: '0.18em',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {satellite?.name || 'UNKNOWN'} · {satellite?.altitudeKm || '--'} KM LEO
          </div>
        </div>

        {/* 右栏：故事情境 + 开始按钮 */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: EASE, delay: 0.15 }}
          style={{ width: '22%', flexShrink: 0 }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22,
          }}>
            <div style={{ width: 14, height: 1, background: 'rgba(107,127,255,0.4)' }} />
            <span style={{
              fontFamily: MONO, fontSize: 7, color: 'rgba(107,127,255,0.55)',
              letterSpacing: '0.22em', textTransform: 'uppercase',
            }}>
              MISSION CONTEXT
            </span>
          </div>

          {/* 故事节拍 */}
          <p style={{
            fontFamily: SERIF, fontSize: 13,
            color: 'rgba(232,232,248,0.42)', lineHeight: 2.0,
            fontStyle: 'italic', margin: '0 0 22px',
          }}>
            {m4Beat}
          </p>

          <div style={{ height: 1, background: 'rgba(26,26,53,0.55)', marginBottom: 22 }} />

          {/* 说明文字 */}
          <p style={{
            fontFamily: SANS, fontSize: 11,
            color: 'rgba(232,232,248,0.30)', lineHeight: 1.95,
            margin: '0 0 36px',
          }}>
            每轮遭遇一种真实轨道威胁。你的每一个选择将同步推进平行时空中那件最重要的事。
          </p>

          {/* 开始按钮 */}
          <button
            onClick={onStart}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(107,127,255,0.12)'
              e.currentTarget.style.borderColor = 'rgba(107,127,255,0.9)'
              e.currentTarget.style.color = '#e8e8f8'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(107,127,255,0.4)'
              e.currentTarget.style.color = '#6b7fff'
            }}
            style={{
              fontFamily: MONO,
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#6b7fff', background: 'transparent',
              border: '1px solid rgba(107,127,255,0.4)',
              padding: '14px 0', width: '100%', cursor: 'pointer',
              transition: 'background 0.25s, border-color 0.25s, color 0.25s',
            }}
          >
            开始任务 →
          </button>

          <div style={{
            marginTop: 12, fontFamily: MONO, fontSize: 7,
            color: 'rgba(107,127,255,0.22)', letterSpacing: '0.14em',
            textAlign: 'center',
          }}>
            点击进入游戏
          </div>
        </motion.div>
      </div>

      {/* ── 底部状态行 ── */}
      <div style={{
        flexShrink: 0, padding: '0 0 28px',
        textAlign: 'center',
        fontFamily: MONO, fontSize: 7,
        color: '#484878', letterSpacing: '0.16em', textTransform: 'uppercase',
      }}>
        ARMOR {initialArmor}% · FUEL 100% · {TOTAL_ROUNDS} ROUNDS
      </div>
    </motion.div>
  )
}

function InfoRow({ label, value, color = '#8888a8', last = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid rgba(26,26,53,0.7)',
    }}>
      <span style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 9, color: '#484878', letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 10, color,
      }}>
        {value}
      </span>
    </div>
  )
}

const THINKING_LINES = [
  'ANALYZING THREAT VECTOR...',
  'CROSS-REF ORBITAL DATABASE...',
  'COMPUTING DELTA-V COST...',
  'QUERYING HISTORICAL RECORDS...',
  'SIMULATING OUTCOME BRANCHES...',
  'CALIBRATING NARRATIVE THREAD...',
  'SYNCHRONIZING PARALLEL TIMELINE...',
  'GENERATING MISSION LOG ENTRY...',
]

const DATA_FRAGMENTS = [
  '01001011 10110100 00111010',
  'ΔV = 4.2 m/s  · t+00:14',
  'LEO 782km · i=98.2°',
  'DEBRIS DENSITY 0.0031 /km³',
  'FUEL RESERVE: RECALCULATING',
  'STORY_THREAD[n] ← COMMIT',
  'ARMOR_INTEGRITY SCAN...',
  '2251 / 33440 CROSS CHECK',
]

function AiThinkingPanel() {
  const [lineIdx, setLineIdx] = useState(0)
  const [fragRows, setFragRows] = useState(() =>
    Array.from({ length: 5 }, (_, i) => DATA_FRAGMENTS[i % DATA_FRAGMENTS.length])
  )
  const [scanY, setScanY] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setLineIdx(i => (i + 1) % THINKING_LINES.length)
    }, 1100)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setFragRows(prev => {
        const next = [...prev]
        const idx = Math.floor(Math.random() * next.length)
        next[idx] = DATA_FRAGMENTS[Math.floor(Math.random() * DATA_FRAGMENTS.length)]
        return next
      })
    }, 340)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let frame
    let y = 0
    function tick() {
      y = (y + 0.6) % 100
      setScanY(y)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const ACCENT = '#5046e5'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'stretch',
        overflow: 'hidden', position: 'relative',
        padding: '0 20px',
      }}
    >
      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: `${scanY}%`,
        height: 1,
        background: 'linear-gradient(to right, transparent, rgba(80,70,229,0.12), transparent)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Orbital pulse */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(80,70,229,0.18)', borderTopColor: 'rgba(80,70,229,0.65)' }} />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', inset: 9, borderRadius: '50%', border: '1px solid rgba(80,70,229,0.10)', borderBottomColor: 'rgba(139,92,246,0.55)' }} />
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 7, height: 7, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT}80` }} />
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}>
              <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'rgba(139,92,246,0.85)' }} />
            </motion.div>
          </div>
        </div>

        {/* Status line */}
        <div style={{ textAlign: 'center' }}>
          <motion.div key={lineIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}
            style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.12em', fontWeight: 700, color: 'rgba(80,70,229,0.65)' }}>
            {THINKING_LINES[lineIdx]}
          </motion.div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i} animate={{ opacity: [0.15, 0.85, 0.15] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.28, ease: 'easeInOut' }}
                style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT + 'aa' }} />
            ))}
          </div>
        </div>

        {/* Data stream */}
        <div style={{ background: 'rgba(80,70,229,0.05)', border: '1px solid rgba(80,70,229,0.12)', borderRadius: 4, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(80,70,229,0.45)', marginBottom: 3 }}>
            DATA STREAM · LIVE
          </div>
          {fragRows.map((row, i) => (
            <motion.div key={i} animate={{ opacity: [0.25, 0.50, 0.25] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
              style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 600, color: 'rgba(80,70,229,0.55)', letterSpacing: '0.06em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {row}
            </motion.div>
          ))}
        </div>

        {/* Footer label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 1, background: 'linear-gradient(to right, transparent, rgba(80,70,229,0.30))' }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.16em', fontWeight: 700, color: 'rgba(80,70,229,0.35)' }}>
            AI INFERENCE ENGINE
          </span>
          <div style={{ width: 16, height: 1, background: 'linear-gradient(to left, transparent, rgba(80,70,229,0.30))' }} />
        </div>

      </div>
    </motion.div>
  )
}

