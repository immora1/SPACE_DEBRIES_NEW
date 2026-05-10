import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
    const nextRound = round + 1
    const isLast = nextRound >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0

    if (isLast) {
      await handleGameEnd(decisions, armor, fuel, missionProgress)
    } else {
      setRound(nextRound)
      // 不清空 feedback：AnimatePresence 退场动画期间仍需渲染旧内容
      // feedback 会在下一次 handleChoose 时被新值覆盖
      setPhase(PHASE.EVENT)
      setTimeout(() => setAlertActive(true), 400)
    }
  }, [round, decisions, armor, fuel, missionProgress])

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

      {/* 3D 场景 */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <GameScene
          damageLevel={damageLevel}
          alertActive={alertActive}
          satelliteInclination={satInclination}
        />
      </div>

      {/* HUD — 左上角 */}
      {(phase === PHASE.EVENT || phase === PHASE.FEEDBACK) && (
        <HUD
          armor={armor}
          fuel={fuel}
          missionProgress={missionProgress}
          round={round + 1}
          totalRounds={TOTAL_ROUNDS}
          satelliteName={satellite?.name}
        />
      )}

      {/* AI 处理中 — 动态思考面板 */}
      <AnimatePresence>
        {aiLoading && <AiThinkingPanel key="ai-thinking" />}
      </AnimatePresence>

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

      {/* 右侧面板 — 事件卡片 / 反馈，AnimatePresence 管理切换动画 */}
      <AnimatePresence mode="wait">
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
            onContinue={handleContinue}
            isLast={round + 1 >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0}
            storyThread={storyThread}
          />
        )}
      </AnimatePresence>

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

function IntroOverlay({ satellite, initialArmor, damageLevel, storyOutline, onStart }) {
  const m4Beat = storyOutline?.checkpoints?.find((c) => c.id === 'm4')?.beat || '命运决战时刻'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(4,4,14,0.88)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    }}>
      <div style={{ maxWidth: 500, padding: '0 32px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '10px',
          letterSpacing: '0.15em',
          color: 'rgba(80,70,229,0.6)',
          marginBottom: 14,
        }}>
          MODULE 04 · SURVIVAL MISSION
        </div>

        <h2 style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: '26px',
          color: '#e8e8f8',
          fontWeight: 300,
          margin: '0 0 14px',
        }}>
          卫星生存任务
        </h2>

        <p style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: '13px',
          color: '#6a6a64',
          lineHeight: 1.9,
          margin: '0 0 26px',
          fontStyle: 'italic',
        }}>
          {m4Beat}
        </p>

        <div style={{
          background: 'rgba(4,4,14,0.8)',
          border: '1px solid rgba(80,70,229,0.18)',
          borderRadius: 6,
          padding: '16px 20px',
          marginBottom: 26,
          textAlign: 'left',
        }}>
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '9px',
            color: 'rgba(80,70,229,0.5)',
            letterSpacing: '0.12em',
            marginBottom: 12,
          }}>
            MISSION BRIEFING
          </div>
          <InfoRow label="卫星"     value={satellite?.name || 'UNKNOWN'} />
          <InfoRow label="轨道"     value={`${satellite?.altitudeKm || '--'} km LEO`} />
          <InfoRow label="初始护甲"  value={`${initialArmor}% ${damageLevel > 0 ? `(M3受损 -${damageLevel * 5}%)` : ''}`}
            color={initialArmor < 70 ? '#f59e0b' : '#10b981'} />
          <InfoRow label="燃料"     value="100%" color="#10b981" />
          <InfoRow label="决策轮次"  value="6 轮" />
        </div>

        <p style={{
          fontFamily: 'Noto Sans SC, sans-serif',
          fontSize: '12px',
          color: '#3a3a52',
          lineHeight: 1.7,
          margin: '0 0 26px',
        }}>
          每轮遭遇一种真实轨道威胁。你的每一个选择将同步推进平行时空中那件最重要的事。
        </p>

        <button
          onClick={onStart}
          style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '12px',
            letterSpacing: '0.12em',
            color: 'transparent',
            background: '#6b7fff',
            border: 'none',
            borderRadius: 3,
            padding: '12px 44px',
            cursor: 'pointer',
          }}
        >
          开始任务
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, color = '#5a5a72' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#28283e' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color }}>
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
        position: 'absolute',
        top: 0, right: 0,
        width: 360,
        height: '100%',
        background: 'rgba(4, 4, 14, 0.94)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderLeft: `1px solid rgba(80,70,229,0.22)`,
        boxShadow: '-16px 0 48px rgba(0,0,0,0.65)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'stretch',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      {/* Top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(to right, transparent, ${ACCENT}cc, transparent)`,
      }} />

      {/* Scan line */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        top: `${scanY}%`,
        height: 1,
        background: `linear-gradient(to right, transparent, rgba(80,70,229,0.25), transparent)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Orbital pulse indicator */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 72, height: 72 }}>
            {/* Outer ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
                border: `1px solid rgba(80,70,229,0.22)`,
                borderTopColor: `rgba(80,70,229,0.7)`,
              }}
            />
            {/* Middle ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', inset: 10,
                borderRadius: '50%',
                border: `1px solid rgba(80,70,229,0.12)`,
                borderBottomColor: `rgba(139,92,246,0.6)`,
              }}
            />
            {/* Core dot */}
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 8, height: 8,
                borderRadius: '50%',
                background: ACCENT,
                boxShadow: `0 0 10px ${ACCENT}`,
              }}
            />
            {/* Orbit dot */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 2, left: '50%',
                transform: 'translateX(-50%)',
                width: 4, height: 4,
                borderRadius: '50%',
                background: 'rgba(139,92,246,0.9)',
                boxShadow: '0 0 6px rgba(139,92,246,0.8)',
              }} />
            </motion.div>
          </div>
        </div>

        {/* Rotating status line */}
        <div style={{ textAlign: 'center' }}>
          <motion.div
            key={lineIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'rgba(80,70,229,0.65)',
            }}
          >
            {THINKING_LINES[lineIdx]}
          </motion.div>
          {/* Animated dots */}
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ opacity: [0.15, 0.9, 0.15] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.28, ease: 'easeInOut' }}
                style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT }}
              />
            ))}
          </div>
        </div>

        {/* Data stream */}
        <div style={{
          background: 'rgba(255,255,255,0.018)',
          border: '1px solid rgba(80,70,229,0.10)',
          borderRadius: 4,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 8,
            letterSpacing: '0.1em',
            color: 'rgba(80,70,229,0.35)',
            marginBottom: 4,
          }}>
            DATA STREAM · LIVE
          </div>
          {fragRows.map((row, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.25, 0.55, 0.25] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
              style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: 9,
                color: 'rgba(80,70,229,0.38)',
                letterSpacing: '0.06em',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {row}
            </motion.div>
          ))}
        </div>

        {/* Bottom label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 20, height: 1,
            background: 'linear-gradient(to right, transparent, rgba(80,70,229,0.4))',
          }} />
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 9,
            letterSpacing: '0.16em',
            color: 'rgba(80,70,229,0.28)',
          }}>
            AI INFERENCE ENGINE
          </span>
          <div style={{
            width: 20, height: 1,
            background: 'linear-gradient(to left, transparent, rgba(80,70,229,0.4))',
          }} />
        </div>

      </div>

      {/* Bottom accent */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(to right, transparent, rgba(80,70,229,0.10), transparent)`,
      }} />
    </motion.div>
  )
}

