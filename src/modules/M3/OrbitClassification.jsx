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

function OrbitCard({
  orb,
  sourceIndex,
  depth,
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
  const content = orb.classification
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
        <span className="m3-orbit-card-summary">
          <span className="m3-orbit-card-count">
            <b>{content.count}</b>
            <small>{pick(content.countLabel, content.countLabelEn)}</small>
          </span>
          <span className="m3-orbit-card-risk-summary">
            <small>{pick('风险特点', 'RISK PROFILE')}</small>
            <b>{pick(content.riskLabel, content.riskLabelEn)}</b>
          </span>
        </span>

        <span className="m3-orbit-card-count-note">
          {pick(content.countNote, content.countNoteEn)}
        </span>

        <span className="m3-orbit-card-data">
          {content.fields.map((field) => (
            <span key={field.label}>
              <small>{pick(field.label, field.labelEn)}</small>
              <b>{pick(field.value, field.valueEn)}</b>
            </span>
          ))}
        </span>

        <span className="m3-orbit-card-footer">
          <span className="m3-orbit-card-risk-detail">
            <small>{pick('风险说明', 'RISK DESCRIPTION')}</small>
            <span>{pick(content.riskDescription, content.riskDescriptionEn)}</span>
          </span>

          <span className={`m3-orbit-card-context ${content.supporting ? '' : 'is-single'}`}>
            <span>
              <small>{pick('代表数据', 'REFERENCE')}</small>
              <b>{pick(content.reference.value, content.reference.valueEn)}</b>
              {content.reference.detail ? (
                <em>{pick(content.reference.detail, content.reference.detailEn)}</em>
              ) : null}
            </span>
            {content.supporting ? (
              <span>
                <small>{pick(content.supporting.label, content.supporting.labelEn)}</small>
                <b>{pick(content.supporting.value, content.supporting.valueEn)}</b>
                <em>{pick(content.supporting.detail, content.supporting.detailEn)}</em>
              </span>
            ) : null}
          </span>
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
        <h3>{pick('三层轨道分类', 'Three Orbital Regions')}</h3>
        <p>{pick(
          '不同高度的轨道，在物体密度、运行环境和碎片停留时间上都有明显差异。',
          'Orbital altitude affects object density, operating conditions, and how long debris can remain in space.',
        )}</p>
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
