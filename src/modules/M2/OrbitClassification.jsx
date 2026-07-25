import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

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
    <span className="m2-orbit-card-density-mark" aria-hidden="true">
      <small>DEBRIS LOAD</small>
      <span className="m2-orbit-card-density-bars">
        {Array.from({ length: 5 }, (_, index) => (
          <i key={index} className={index < activeBars ? 'is-active' : ''} />
        ))}
      </span>
      <b>{String(activeBars).padStart(2, '0')} / 05</b>
    </span>
  )
}

function OrbitDebrisRating({ density }) {
  const rating = getDebrisRating(density)

  return (
    <span
      className="m2-orbit-card-rating"
      role="img"
      aria-label={`轨道碎片风险 ${rating} 星，共 5 星`}
    >
      <small>轨道碎片风险</small>
      <span className="m2-orbit-card-rating-planets" aria-hidden="true">
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
  const density = orb.debris / maxDebris
  const className = [
    'm2-orbit-card',
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
      aria-label={isFront ? `${orb.name} ${orb.full}，当前轨道` : `将 ${orb.name} ${orb.full} 移到最前`}
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
      <span className="m2-orbit-card-tab">
        <span className="m2-orbit-card-name">
          <b>{orb.name}</b>
          <small>{orb.full}</small>
        </span>
        <span className="m2-orbit-card-tab-meta">
          <span>ORBIT {String(sourceIndex + 1).padStart(2, '0')}</span>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </span>

      <span className="m2-orbit-card-body" aria-hidden={!isFront}>
        <span className="m2-orbit-card-topline">
          <span>CATALOGUED ORBITAL OBJECTS</span>
          <span>{orb.risk} RISK</span>
        </span>

        <span className="m2-orbit-card-summary">
          <span className="m2-orbit-card-count">
            <b>{orb.debrisLabel}</b>
            <small>已编目碎片</small>
          </span>
          <DebrisDensityMark density={density} />
        </span>

        <span className="m2-orbit-card-data">
          <span>
            <small>轨道高度</small>
            <b>{orb.alt}</b>
          </span>
          <span>
            <small>轨道周期</small>
            <b>{orb.period}</b>
          </span>
          <span>
            <small>主要用途</small>
            <b>{orb.use}</b>
          </span>
        </span>

        <span className="m2-orbit-card-footer">
          <OrbitDebrisRating density={density} />
          <span className="m2-orbit-card-note">{orb.note}</span>
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
      className="m2-orbit-classification"
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.68, ease: EASE }}
      viewport={{ once: true, amount: 0.16 }}
    >
      <header className="m2-orbit-classification-head">
        <span>01 · ORBIT CLASSIFICATION</span>
        <h3>三层轨道分类</h3>
        <p>不同高度形成不同的任务密度、碎片环境与长期风险。</p>
      </header>

      <div className={`m2-orbit-card-stack is-${shufflePhase}`}>
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
