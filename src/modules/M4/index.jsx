import { useState, useEffect, useCallback } from 'react'
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

// 游戏状态机阶段
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

  // 游戏核心状态
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

  // 初始化护甲值
  const initialArmor = calcInitialArmor(damageLevel)

  // 初始化游戏
  useEffect(() => {
    const picked = pickEvents(damageLevel, clickedHistoryEvents || [], TOTAL_ROUNDS)
    setEvents(picked)
    setArmor(initialArmor)
  }, [])

  // M4 进行时锁定页面滚动
  useEffect(() => {
    if (phase === PHASE.EVENT || phase === PHASE.FEEDBACK) {
      setScrollLocked(true)
    } else {
      setScrollLocked(false)
    }
    return () => setScrollLocked(false)
  }, [phase])

  const currentEvent = events[round] || null

  // 用户选择选项后
  const handleChoose = useCallback(async (option) => {
    setAlertActive(false)
    setAiLoading(true)

    // 计算数值变化（保证边界）
    const newArmor   = Math.max(0,   Math.min(100, armor   + (option.armorDelta   || 0)))
    const newFuel    = Math.max(0,   Math.min(100, fuel    + (option.fuelDelta    || 0)))
    const newMission = Math.max(0,   Math.min(100, missionProgress + (option.missionDelta || 0)))

    // 调用 AI 生成即时反馈
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

    // 护甲或燃料归零立即结算
    if (newArmor <= 0 || newFuel <= 0) {
      await handleGameEnd([...decisions, decision], newArmor, newFuel, newMission)
    }
  }, [armor, fuel, missionProgress, round, currentEvent, decisions, satellite, user, storyOutline])

  // 用户点击「继续」
  const handleContinue = useCallback(async () => {
    const nextRound = round + 1
    const isLast = nextRound >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0

    if (isLast) {
      await handleGameEnd(decisions, armor, fuel, missionProgress)
    } else {
      setRound(nextRound)
      setFeedback(null)
      setPhase(PHASE.EVENT)
      setTimeout(() => setAlertActive(true), 400)
    }
  }, [round, decisions, armor, fuel, missionProgress])

  // 游戏结束，生成结算
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

    // 写入全局状态
    setGameResult({ result, finalArmor, finalFuel, finalMission, decisionCount: allDecisions.length })
    setDebrisGenerated([ref.debrisDescription])
    setStoryChapter('m4', ref.storyEnding)

    setReflection(ref)
    setScrollLocked(false)
    setPhase(PHASE.REFLECTION)
  }, [satellite, user, materials, storyOutline, setGameResult, setDebrisGenerated, setStoryChapter, setScrollLocked])

  // 开始游戏
  function startGame() {
    setPhase(PHASE.EVENT)
    setTimeout(() => setAlertActive(true), 600)
  }

  // 计算卫星倾角（来自真实卫星数据，转为弧度）
  const satInclination = satellite?.inclination
    ? (satellite.inclination * Math.PI) / 180 * 0.3
    : 0.5

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#0a0a0a', overflow: 'hidden' }}>

      {/* 3D 场景（始终渲染） */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <GameScene
          damageLevel={damageLevel}
          alertActive={alertActive}
          satelliteInclination={satInclination}
        />
      </div>

      {/* HUD（游戏进行时显示） */}
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

      {/* AI 加载指示 */}
      {aiLoading && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'Space Mono, monospace',
          fontSize: '11px',
          color: '#6b6b66',
          letterSpacing: '0.1em',
          zIndex: 15,
        }}>
          PROCESSING...
        </div>
      )}

      {/* INTRO 页 */}
      {phase === PHASE.INTRO && (
        <IntroOverlay
          satellite={satellite}
          initialArmor={initialArmor}
          damageLevel={damageLevel}
          storyOutline={storyOutline}
          onStart={startGame}
        />
      )}

      {/* 威胁事件卡片 */}
      {phase === PHASE.EVENT && !aiLoading && (
        <EventCard
          event={currentEvent}
          onChoose={handleChoose}
          disabled={aiLoading}
        />
      )}

      {/* AI 反馈展示 */}
      {phase === PHASE.FEEDBACK && !aiLoading && (
        <DecisionFeedback
          feedback={currentFeedback}
          onContinue={handleContinue}
          isLast={round + 1 >= TOTAL_ROUNDS || armor <= 0 || fuel <= 0}
        />
      )}

      {/* 结算页 */}
      {phase === PHASE.REFLECTION && (
        <ReflectionPage
          reflection={reflection}
          gameResult={gameResult}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}

// 游戏介绍覆盖层
function IntroOverlay({ satellite, initialArmor, damageLevel, storyOutline, onStart }) {
  const m4Beat = storyOutline?.checkpoints?.find((c) => c.id === 'm4')?.beat || '命运决战时刻'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(10,10,10,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    }}>
      <div style={{ maxWidth: 520, padding: '0 32px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '10px',
          letterSpacing: '0.15em',
          color: '#6b6b66',
          marginBottom: 16,
        }}>
          MODULE 04 · SURVIVAL MISSION
        </div>

        <h2 style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: '26px',
          color: '#f5f4f0',
          fontWeight: 300,
          margin: '0 0 16px',
        }}>
          卫星生存任务
        </h2>

        <p style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: '13px',
          color: '#8a8a84',
          lineHeight: 1.9,
          margin: '0 0 28px',
          fontStyle: 'italic',
        }}>
          {m4Beat}
        </p>

        {/* 卫星状态面板 */}
        <div style={{
          background: '#111110',
          border: '1px solid #2a2a28',
          borderRadius: 4,
          padding: '16px 20px',
          marginBottom: 28,
          textAlign: 'left',
        }}>
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '10px',
            color: '#6b6b66',
            letterSpacing: '0.08em',
            marginBottom: 12,
          }}>
            MISSION BRIEFING
          </div>
          <InfoRow label="卫星"   value={satellite?.name || 'UNKNOWN'} />
          <InfoRow label="轨道"   value={`${satellite?.altitudeKm || '--'} km LEO`} />
          <InfoRow label="初始护甲" value={`${initialArmor}% ${damageLevel > 0 ? `(M3受损 -${damageLevel * 5}%)` : ''}`} color={initialArmor < 70 ? '#c8a040' : '#4a6741'} />
          <InfoRow label="燃料"   value="100%" color="#4a6741" />
          <InfoRow label="决策轮次" value="6 轮" />
        </div>

        <p style={{
          fontFamily: 'Noto Sans SC, sans-serif',
          fontSize: '12px',
          color: '#6b6b66',
          lineHeight: 1.7,
          margin: '0 0 28px',
        }}>
          每轮随机遭遇一种真实轨道威胁，你的选择将同步改变平行时空中那件最重要的事。
        </p>

        <button
          onClick={onStart}
          style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '12px',
            letterSpacing: '0.12em',
            color: '#0a0a0a',
            background: '#c8b89a',
            border: 'none',
            borderRadius: 2,
            padding: '12px 40px',
            cursor: 'pointer',
          }}
        >
          开始任务
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, color = '#a0a09a' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#6b6b66' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color }}>
        {value}
      </span>
    </div>
  )
}
