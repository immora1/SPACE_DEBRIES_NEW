import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Orbit,
  RadioTower,
  ScanLine,
  Sparkles,
  Telescope,
} from 'lucide-react'
import './mission-selection-deck.css'

const EASE = [0.16, 1, 0.3, 1]
const RETURN_SPRING = { type: 'spring', stiffness: 410, damping: 34 }

const MISSION_ICONS = {
  weather: CloudSun,
  comms: RadioTower,
  imaging: ScanLine,
  science: Telescope,
}

function wrapIndex(index, length) {
  return (index + length) % length
}

function MissionCardContent({ mission }) {
  const MissionIcon = MISSION_ICONS[mission.id] ?? Orbit

  return (
    <>
      <div className="m2-mission-card-heading">
        <span className="m2-mission-card-icon"><MissionIcon size={24} strokeWidth={1.35} /></span>
        <span>
          <small>{mission.labelEn}</small>
          <h4>{mission.label}</h4>
        </span>
      </div>

      <p>{mission.desc}</p>

      <div className="m2-mission-card-data">
        <span><small>目标轨道</small><b>{mission.orbit}</b></span>
        <span><small>典型案例</small><b>{mission.example}</b></span>
      </div>
    </>
  )
}

export default function MissionSelectionDeck({
  missions,
  selectedMissionId,
  aiState,
  story,
  satelliteName,
  onConfirm,
}) {
  const selectedIndex = missions.findIndex((mission) => mission.id === selectedMissionId)
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0)
  const [dragging, setDragging] = useState(false)
  const [resolving, setResolving] = useState(false)
  const cardRef = useRef(null)
  const resolvingRef = useRef(false)
  const reduceMotion = useReducedMotion()
  const cardX = useMotionValue(0)
  const cardScale = useMotionValue(1)
  const cardRotate = useMotionValue(0)
  const cardOpacity = useMotionValue(1)

  const activeMission = missions[activeIndex]
  const selectedMission = selectedIndex >= 0 ? missions[selectedIndex] : null
  const interactionLocked = aiState !== 'idle'
  const controlsLocked = resolving || interactionLocked

  useEffect(() => {
    if (selectedIndex >= 0) setActiveIndex(selectedIndex)
  }, [selectedIndex])

  function resetCard() {
    animate(cardX, 0, reduceMotion ? { duration: 0.01 } : RETURN_SPRING)
    animate(cardScale, 1, reduceMotion ? { duration: 0.01 } : RETURN_SPRING)
    animate(cardRotate, 0, reduceMotion ? { duration: 0.01 } : RETURN_SPRING)
    animate(cardOpacity, 1, { duration: reduceMotion ? 0.01 : 0.18 })
  }

  async function transitionMission(nextIndex, direction) {
    if (resolvingRef.current || interactionLocked) return
    resolvingRef.current = true
    setResolving(true)
    const duration = reduceMotion ? 0.01 : 0.28
    const exitX = direction > 0 ? -250 : 250

    await Promise.all([
      animate(cardX, exitX, { duration, ease: [0.55, 0, 0.45, 1] }),
      animate(cardRotate, direction > 0 ? -4 : 4, { duration }),
      animate(cardScale, 0.96, { duration }),
      animate(cardOpacity, 0.04, { duration: duration * 0.78 }),
    ])

    setActiveIndex(nextIndex)
    cardX.set(direction > 0 ? 46 : -46)
    cardRotate.set(direction > 0 ? 1.4 : -1.4)
    cardScale.set(0.985)
    cardOpacity.set(0.62)

    if (!reduceMotion) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }

    await Promise.all([
      animate(cardX, 0, reduceMotion ? { duration: 0.01 } : RETURN_SPRING),
      animate(cardRotate, 0, reduceMotion ? { duration: 0.01 } : RETURN_SPRING),
      animate(cardScale, 1, reduceMotion ? { duration: 0.01 } : RETURN_SPRING),
      animate(cardOpacity, 1, { duration: reduceMotion ? 0.01 : 0.24 }),
    ])

    setResolving(false)
    resolvingRef.current = false
  }

  function cycleMission(direction) {
    transitionMission(wrapIndex(activeIndex + direction, missions.length), direction)
  }

  function selectMission(index) {
    if (index === activeIndex) return
    const forwardDistance = wrapIndex(index - activeIndex, missions.length)
    const backwardDistance = wrapIndex(activeIndex - index, missions.length)
    transitionMission(index, forwardDistance <= backwardDistance ? 1 : -1)
  }

  async function assignMission() {
    if (resolvingRef.current || interactionLocked) return
    resolvingRef.current = true
    setResolving(true)
    setDragging(false)

    const duration = reduceMotion ? 0.01 : 0.2

    await Promise.all([
      animate(cardScale, 0.985, { duration, ease: [0.22, 1, 0.36, 1] }),
      animate(cardRotate, 0, { duration }),
      animate(cardOpacity, 0.72, { duration }),
    ])

    onConfirm(activeMission.id)
    cardX.set(0)
    cardRotate.set(0)
    await Promise.all([
      animate(cardScale, 1, reduceMotion ? { duration: 0.01 } : RETURN_SPRING),
      animate(cardOpacity, 1, { duration: reduceMotion ? 0.01 : 0.22 }),
    ])
    setResolving(false)
    resolvingRef.current = false
  }

  function handleDragEnd(_, info) {
    setDragging(false)
    const horizontalDistance = Math.abs(info.offset.x)

    if (horizontalDistance > 78 || Math.abs(info.velocity.x) > 460) {
      cycleMission(info.offset.x < 0 ? 1 : -1)
      return
    }

    resetCard()
  }

  return (
    <section className="m2-mission-deck">
      <header className="m2-mission-heading">
        <span>04 · MISSION SELECT</span>
        <h3>为卫星指定任务</h3>
        <p>选择一项主任务。它将决定故事走向与 M4 游戏的背景设定，也是全站第二个有后果的选择。</p>
      </header>

      <div className="m2-mission-console">
        <div className="m2-mission-deck-head">
          <span><Orbit size={15} strokeWidth={1.4} /> MISSION CANDIDATES</span>
          <div>
            <button type="button" title="上一项任务" disabled={controlsLocked} onClick={() => cycleMission(-1)}>
              <ChevronLeft size={17} strokeWidth={1.5} />
            </button>
            <span>{String(activeIndex + 1).padStart(2, '0')} / {String(missions.length).padStart(2, '0')}</span>
            <button type="button" title="下一项任务" disabled={controlsLocked} onClick={() => cycleMission(1)}>
              <ChevronRight size={17} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="m2-mission-tabs" role="tablist" aria-label="选择卫星任务">
          {missions.map((mission, index) => {
            const MissionIcon = MISSION_ICONS[mission.id] ?? Orbit
            const active = index === activeIndex
            const assigned = mission.id === selectedMissionId
            return (
              <button
                key={mission.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${active ? 'is-active' : ''}${assigned ? ' is-assigned' : ''}`}
                disabled={controlsLocked}
                onClick={() => selectMission(index)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <MissionIcon size={15} strokeWidth={1.45} />
                <b>{mission.label}</b>
              </button>
            )
          })}
        </div>

        <div className={`m2-mission-card-stage${dragging ? ' is-dragging' : ''}`}>
          <motion.article
            key={activeMission.id}
            ref={cardRef}
            className="m2-mission-card is-current"
            style={{ x: cardX, scale: cardScale, rotate: cardRotate, opacity: cardOpacity }}
            drag={controlsLocked ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.42}
            dragMomentum={false}
            onDragStart={() => setDragging(true)}
            onDragEnd={handleDragEnd}
          >
            <MissionCardContent mission={activeMission} />
          </motion.article>
        </div>

        <div className="m2-mission-assign-row">
          <button
            type="button"
            className={selectedMission ? 'is-assigned' : ''}
            disabled={controlsLocked}
            onClick={assignMission}
            aria-label={selectedMission ? `已指派${selectedMission.label}` : `指派${activeMission.label}`}
          >
            {selectedMission ? <Check size={17} strokeWidth={1.8} /> : null}
            <span>{selectedMission ? '任务已分配' : '指派此任务'}</span>
            {selectedMission ? null : <ArrowRight size={17} strokeWidth={1.6} />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {aiState === 'loading' ? (
            <motion.div
              key="mission-loading"
              className="m2-mission-loading"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <span aria-hidden="true"><i /><i /><i /></span>
              <div><b>正在生成任务叙事</b><small>GENERATING MISSION NARRATIVE</small></div>
            </motion.div>
          ) : null}

          {selectedMission && (aiState === 'done' || aiState === 'error') ? (
            <motion.article
              key="mission-story"
              className="m2-mission-story"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="m2-mission-story-head">
                <span>MISSION NARRATIVE · {satelliteName || 'YOUR SAT'}</span>
                <b>{selectedMission.label}</b>
              </div>
              <div className="m2-mission-story-meta">
                <span><small>轨道</small><b>{selectedMission.orbit}</b></span>
                <span><small>典型案例</small><b>{selectedMission.example}</b></span>
              </div>
              <p>{aiState === 'done' ? story : '叙事生成失败，任务已记录，继续下一章。'}</p>
              <footer><Sparkles size={15} strokeWidth={1.4} /> 第二段 · 任务展开 <ArrowRight size={16} strokeWidth={1.5} /></footer>
            </motion.article>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  )
}
