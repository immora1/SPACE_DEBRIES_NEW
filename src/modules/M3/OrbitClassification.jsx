import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import useI18n from '../../i18n/useI18n'

const EASE = [0.16, 1, 0.3, 1]

function moveOrbitToFront(order, targetId) {
  const targetIndex = order.indexOf(targetId)
  if (targetIndex <= 0) return order
  return [targetId, ...order.filter((id) => id !== targetId)]
}

function createOrbitOrder(orbits, selectedOrbit) {
  return moveOrbitToFront(orbits.map((orbit) => orbit.id), selectedOrbit)
}

function getDebrisRating(density) {
  return density >= 0.5 ? 5 : density >= 0.05 ? 3 : 2
}

function DebrisDensityMark({ density }) {
  const activeBars = getDebrisRating(density)

  return (
    <span className="m3-orbit-card-density-mark" aria-hidden="true">
      <small>DEBRIS LOAD</small>
      <span className="m3-orbit-card-density-bars">
        {Array.from({ length: 5 }, (_, index) => (
          <i key={index} className={index < activeBars ? 'is-active' : ''} />
        ))}
      </span>
      <b>{String(activeBars).padStart(2, '0')} / 05</b>
    </span>
  )
}

function OrbitDebrisRating({ density }) {
  const { pick } = useI18n()
  const rating = getDebrisRating(density)

  return (
    <span
      className="m3-orbit-card-rating"
      role="img"
      aria-label={pick(`轨道碎片风险 ${rating} 星，共 5 星`, `Orbital debris risk: ${rating} out of 5`)}
    >
      <small>{pick('轨道碎片风险', 'DEBRIS RISK')}</small>
      <span className="m3-orbit-card-rating-planets" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <i key={index} className={index < rating ? 'is-active' : ''} />
        ))}
      </span>
      <b>{String(rating).padStart(2, '0')} / 05</b>
    </span>
  )
}

function OrbitCard({
  orb,
  sourceIndex,
  depth,
  maxDebris,
  isActive,
  isSelected,
  isFront,
  shuffleRole,
  isShuffling,
  onPreview,
  onPreviewEnd,
  onSelect,
  onTransitionEnd,
}) {
  const { pick } = useI18n()
  const density = orb.debris / maxDebris
  const className = [
    'm3-orbit-card',
    `is-depth-${depth}`,
    isFront ? 'is-front' : 'is-rear',
    isActive ? 'is-active' : '',
    isSelected ? 'is-selected' : '',
    shuffleRole,
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={className}
      data-orbit-id={orb.id}
      aria-label={isFront
        ? pick(`${orb.name} ${orb.full}，当前轨道`, `${orb.name} ${orb.fullEn}, current orbit`)
        : pick(`将 ${orb.name} ${orb.full} 移到最前`, `Move ${orb.name} ${orb.fullEn} to the front`)}
      aria-pressed={isSelected}
      aria-expanded={isFront}
      aria-disabled={isShuffling}
      onPointerEnter={() => onPreview(orb.id)}
      onPointerLeave={onPreviewEnd}
      onFocus={() => onPreview(orb.id)}
      onBlur={onPreviewEnd}
      onClick={() => onSelect(orb.id)}
      onTransitionEnd={(event) => onTransitionEnd(event, orb.id)}
      style={{
        '--orbit-accent': orb.color,
        zIndex: 3 - depth,
      }}
    >
      <span className="m3-orbit-card-tab">
        <span className="m3-orbit-card-name">
          <b>{orb.name}</b>
          <small>{pick(orb.full, orb.fullEn)}</small>
        </span>
        <span className="m3-orbit-card-tab-meta">
          <span>ORBIT {String(sourceIndex + 1).padStart(2, '0')}</span>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </span>

      <span className="m3-orbit-card-body" aria-hidden={!isFront}>
        <span className="m3-orbit-card-topline">
          <span>CATALOGUED ORBITAL OBJECTS</span>
          <span>{pick(orb.risk, orb.riskEn)} RISK</span>
        </span>

        <span className="m3-orbit-card-summary">
          <span className="m3-orbit-card-count">
            <b>{orb.debrisLabel}</b>
            <small>{pick('已编目碎片', 'CATALOGUED DEBRIS')}</small>
          </span>
          <DebrisDensityMark density={density} />
        </span>

        <span className="m3-orbit-card-data">
          <span>
            <small>{pick('轨道高度', 'ALTITUDE')}</small>
            <b>{orb.alt}</b>
          </span>
          <span>
            <small>{pick('轨道周期', 'PERIOD')}</small>
            <b>{pick(orb.period, orb.periodEn ?? orb.period)}</b>
          </span>
          <span>
            <small>{pick('主要用途', 'PRIMARY USE')}</small>
            <b>{pick(orb.use, orb.useEn)}</b>
          </span>
        </span>

        <span className="m3-orbit-card-footer">
          <OrbitDebrisRating density={density} />
          <span className="m3-orbit-card-note">{pick(orb.note, orb.noteEn)}</span>
        </span>
      </span>
    </button>
  )
}

export default function OrbitClassification({
  orbits,
  activeOrbit,
  selectedOrbit,
  onPreview,
  onPreviewEnd,
  onSelect,
}) {
  const { pick } = useI18n()
  const [orbitOrder, setOrbitOrder] = useState(() => createOrbitOrder(orbits, selectedOrbit))
  const [shufflePhase, setShufflePhase] = useState('idle')
  const pendingTargetRef = useRef(null)
  const frontOrbitId = orbitOrder[0]
  const maxDebris = Math.max(...orbits.map((orbit) => orbit.debris))

  useEffect(() => {
    if (shufflePhase !== 'idle') return

    setOrbitOrder((current) => {
      const next = createOrbitOrder(orbits, selectedOrbit)
      const isSameOrder = current.length === next.length
        && current.every((id, index) => id === next[index])
      return isSameOrder ? current : next
    })
  }, [orbits, selectedOrbit, shufflePhase])

  function beginShuffle(targetId) {
    if (shufflePhase !== 'idle' || targetId === frontOrbitId) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOrbitOrder((current) => moveOrbitToFront(current, targetId))
      onSelect(targetId)
      return
    }

    pendingTargetRef.current = targetId
    setShufflePhase('separating')
  }

  function handleCardTransitionEnd(event, orbitId) {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return

    if (shufflePhase === 'separating' && orbitId === frontOrbitId) {
      const targetId = pendingTargetRef.current
      if (!targetId) {
        setShufflePhase('idle')
        return
      }

      setOrbitOrder((current) => moveOrbitToFront(current, targetId))
      onSelect(targetId)
      setShufflePhase('returning')
      return
    }

    if (shufflePhase === 'returning' && orbitId === frontOrbitId) {
      pendingTargetRef.current = null
      setShufflePhase('idle')
    }
  }

  return (
    <motion.div
      className="m3-orbit-classification"
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.68, ease: EASE }}
      viewport={{ once: true, amount: 0.16 }}
    >
      <header className="m3-orbit-classification-head">
        <span>01 · ORBIT CLASSIFICATION</span>
        <h3>{pick('三层轨道分类', 'Three orbital regimes')}</h3>
        <p>{pick('不同高度形成不同的任务密度、碎片环境与长期风险。', 'Different altitudes create different mission densities, debris environments, and long-term risks.')}</p>
      </header>

      <div className={`m3-orbit-card-stack is-${shufflePhase}`}>
        {orbits.map((orb, sourceIndex) => {
          const orderIndex = orbitOrder.indexOf(orb.id)
          const depth = orderIndex === -1 ? sourceIndex : orderIndex
          const isFront = depth === 0
          let shuffleRole = ''

          if (shufflePhase === 'separating') {
            if (isFront) shuffleRole = 'is-shuffle-front'
            else if (pendingTargetRef.current === orb.id) shuffleRole = 'is-shuffle-target'
            else shuffleRole = 'is-shuffle-bystander'
          }

          return (
            <OrbitCard
              key={orb.id}
              orb={orb}
              sourceIndex={sourceIndex}
              depth={depth}
              maxDebris={maxDebris}
              isActive={activeOrbit === orb.id}
              isSelected={selectedOrbit === orb.id}
              isFront={isFront}
              shuffleRole={shuffleRole}
              isShuffling={shufflePhase !== 'idle'}
              onPreview={onPreview}
              onPreviewEnd={onPreviewEnd}
              onSelect={beginShuffle}
              onTransitionEnd={handleCardTransitionEnd}
            />
          )
        })}
      </div>
    </motion.div>
  )
}
