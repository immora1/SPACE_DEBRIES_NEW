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
import useI18n from '../../i18n/useI18n'
import './mission-selection-deck.css'

const EASE = [0.16, 1, 0.3, 1]
const RETURN_SPRING = { type: 'spring', stiffness: 410, damping: 34 }

const MISSION_ICONS = {
  weather_monitoring: CloudSun,
  communications_relay: RadioTower,
  earth_observation: ScanLine,
  space_science_observation: Telescope,
}

function wrapIndex(index, length) {
  return (index + length) % length
}

function MissionCardContent({ mission }) {
  const { language, pick } = useI18n()
  const MissionIcon = MISSION_ICONS[mission.id] ?? Orbit

  return (
    <>
      <div className="m3-mission-card-heading">
        <span className="m3-mission-card-icon"><MissionIcon size={24} strokeWidth={1.35} /></span>
        <span>
          <small>{mission.label_en}</small>
          <h4>{language === 'en' ? mission.label_en : mission.label}</h4>
        </span>
      </div>

      <div className="m3-mission-card-copy">
        <span>
          <small>{pick('任务目标', 'Objective')}</small>
          <p>{pick(mission.objective, mission.objective_en)}</p>
        </span>
        <span>
          <small>{pick('如何工作', 'How it works')}</small>
          <p>{pick(mission.operation, mission.operation_en)}</p>
        </span>
      </div>

      <div className="m3-mission-card-data">
        <span>
          <small>{pick('目标轨道', 'Target orbit')}</small>
          <b>{pick(mission.orbit_profile.label, mission.orbit_profile.label_en)} · {pick(mission.orbit_profile.altitude_label, mission.orbit_profile.altitude_label_en)}</b>
        </span>
        <span><small>{pick('典型任务 / 卫星', 'Examples')}</small><b>{pick(mission.examples, mission.examples_en)}</b></span>
      </div>

      <div className="m3-mission-card-effect">
        <small>{pick('任务影响', 'Mission effect')}</small>
        <p>{pick(mission.mission_effect, mission.mission_effect_en)}</p>
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
  const { language, pick } = useI18n()
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
  const interactionLocked = aiState === 'loading' || aiState === 'done'
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
    <section className="m3-mission-deck">
      <header className="m3-mission-heading">
        <span>{pick('04 · 任务选择', '04 · MISSION SELECTION')}</span>
        <h3>{pick('为卫星指定任务', 'Assign a Mission')}</h3>
        <p>{pick('每颗卫星都有自己的任务，而任务决定它需要去哪里、如何运行。选择一项任务，为你的卫星确定工作目标和轨道环境。', 'Every satellite is built for a specific purpose, and that mission determines where it operates and how it works. Choose a mission to define your satellite’s objective and orbital environment.')}</p>
      </header>

      <div className="m3-mission-console">
        <div className="m3-mission-deck-head">
          <span><Orbit size={15} strokeWidth={1.4} /> MISSION CANDIDATES</span>
          <div>
            <button type="button" title={pick('上一项任务', 'Previous mission')} disabled={controlsLocked} onClick={() => cycleMission(-1)}>
              <ChevronLeft size={17} strokeWidth={1.5} />
            </button>
            <span>{String(activeIndex + 1).padStart(2, '0')} / {String(missions.length).padStart(2, '0')}</span>
            <button type="button" title={pick('下一项任务', 'Next mission')} disabled={controlsLocked} onClick={() => cycleMission(1)}>
              <ChevronRight size={17} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="m3-mission-tabs" role="tablist" aria-label={pick('选择卫星任务', 'Select a satellite mission')}>
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
                <b>{language === 'en' ? mission.label_en : mission.label}</b>
              </button>
            )
          })}
        </div>

        <div className={`m3-mission-card-stage${dragging ? ' is-dragging' : ''}`}>
          <motion.article
            key={activeMission.id}
            ref={cardRef}
            className="m3-mission-card is-current"
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

        <div className="m3-mission-assign-row">
          <button
            type="button"
            className={selectedMission ? 'is-assigned' : ''}
            disabled={controlsLocked}
            onClick={assignMission}
            aria-label={selectedMission
              ? pick(`已指派${selectedMission.label}`, `${selectedMission.label_en} assigned`)
              : pick(`指派${activeMission.label}`, `Assign ${activeMission.label_en}`)}
          >
            {selectedMission ? <Check size={17} strokeWidth={1.8} /> : null}
            <span>{selectedMission ? pick('任务已分配', 'Mission assigned') : pick('指派此任务', 'Assign this mission')}</span>
            {selectedMission ? null : <ArrowRight size={17} strokeWidth={1.6} />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {aiState === 'loading' ? (
            <motion.div
              key="mission-loading"
              className="m3-mission-loading"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <span aria-hidden="true"><i /><i /><i /></span>
              <div><b>{pick('正在保存任务配置', 'Saving mission profile')}</b><small>SAVING MISSION PROFILE</small></div>
            </motion.div>
          ) : null}

          {selectedMission && aiState === 'done' ? (
            <motion.article
              key="mission-story"
              className="m3-mission-story"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="m3-mission-story-head">
                <span>MISSION PROFILE · {satelliteName || 'YOUR SAT'}</span>
                <b>{language === 'en' ? selectedMission.label_en : selectedMission.label}</b>
              </div>
              <div className="m3-mission-story-meta">
                <span><small>{pick('轨道', 'Orbit')}</small><b>{pick(selectedMission.orbit_profile.label, selectedMission.orbit_profile.label_en)} · {pick(selectedMission.orbit_profile.altitude_label, selectedMission.orbit_profile.altitude_label_en)}</b></span>
                <span><small>{pick('典型任务 / 卫星', 'Examples')}</small><b>{pick(selectedMission.examples, selectedMission.examples_en)}</b></span>
              </div>
              <p>{story || pick(selectedMission.mission_effect, selectedMission.mission_effect_en)}</p>
              <footer><Sparkles size={15} strokeWidth={1.4} /> {pick('任务与轨道已绑定', 'MISSION AND ORBIT LINKED')} <ArrowRight size={16} strokeWidth={1.5} /></footer>
            </motion.article>
          ) : null}

          {aiState === 'error' ? (
            <motion.article
              key="mission-error"
              className="m3-mission-story"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <div className="m3-mission-story-head">
                <span>MISSION PROFILE · RETRY REQUIRED</span>
                <b>{pick('任务尚未提交', 'Mission not committed')}</b>
              </div>
              <p>{pick(
                '任务配置保存失败。请再次点击“指派此任务”重试。',
                'The mission profile could not be saved. Click “Assign this mission” to retry.',
              )}</p>
            </motion.article>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  )
}
