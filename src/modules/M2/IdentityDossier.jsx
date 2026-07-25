import { useEffect, useRef } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import { ArrowUpRight, Check, RotateCcw, Satellite, TriangleAlert } from 'lucide-react'
import './identity-dossier.css'

const EASE = [0.16, 1, 0.3, 1]
const TILT_SPRING = { stiffness: 190, damping: 24, mass: 0.65 }

const IDENTITY_FIELDS = [
  {
    key: 'name',
    label: '你的名字或代号',
    hint: '卫星将以此命名档案',
    placeholder: '例：林远 / YUAN',
  },
  {
    key: 'city',
    label: '所在城市',
    hint: '用于匹配飞过你头顶的卫星',
    placeholder: '例：北京、上海、成都',
  },
  {
    key: 'importantEvent',
    label: '对你最重要的一件事',
    hint: '可以是一个时刻、一个人或一段经历',
    placeholder: '写下它……',
    multiline: true,
  },
]

function IdentityField({ field, value, onChange }) {
  const isComplete = value.trim().length > 0
  const inputProps = {
    value,
    placeholder: field.placeholder,
    onChange: (event) => onChange(field.key, event.target.value),
  }

  return (
    <label className={`m2-identity-field${isComplete ? ' is-complete' : ''}`}>
      <span className="m2-identity-field-label">
        <b>{field.label}</b>
        <small>{field.hint}</small>
      </span>

      <span className="m2-identity-field-control">
        {field.multiline ? (
          <textarea {...inputProps} rows={2} />
        ) : (
          <input
            {...inputProps}
            autoComplete={field.key === 'name' ? 'name' : 'address-level2'}
          />
        )}
        <span className="m2-identity-field-check" aria-hidden="true">
          {isComplete ? <Check size={14} strokeWidth={2.2} /> : null}
        </span>
      </span>
    </label>
  )
}

function LoadingState({ formStep }) {
  const generating = formStep === 'generating'
  const stages = [
    { label: '定位城市', complete: true },
    { label: '匹配轨道', complete: generating },
    { label: '生成叙事', complete: false, active: generating },
  ]

  return (
    <motion.div
      key="loading"
      className="m2-identity-loading"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.38, ease: EASE }}
    >
      <motion.span
        className="m2-identity-loading-icon"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
        aria-hidden="true"
      >
        <Satellite size={28} strokeWidth={1.35} />
      </motion.span>

      <div className="m2-identity-loading-copy">
        <span>{generating ? '正在生成' : '正在匹配'}</span>
        <h4>{generating ? '正在写入你的故事坐标' : '正在寻找与你相遇的卫星'}</h4>
        <p>
          {generating
            ? '真实卫星已经确认，系统正在建立第一段平行叙事。'
            : '系统正在轨道数据中检索经过你所在城市上空的目标。'}
        </p>
      </div>

      <div className="m2-identity-stage-list" aria-label="匹配进度">
        {stages.map((stage, index) => {
          const active = stage.active || (!generating && index === 1)
          return (
            <span
              key={stage.label}
              className={`${stage.complete ? 'is-complete' : ''}${active ? ' is-active' : ''}`}
            >
              <i />
              {stage.label}
            </span>
          )
        })}
      </div>
    </motion.div>
  )
}

function getOrbitProfile(satellite) {
  const altitude = satellite.altitudeKm ?? 0
  const zone = altitude < 2000 ? 'LEO' : altitude < 35786 ? 'MEO' : 'GEO'
  const speed = Math.max(0, 7800 - altitude * 0.08).toFixed(0)
  const risk = {
    LEO: '高风险 · 28,000+ 件已编目碎片集中于此；2009 年铱星碰撞发生在同一轨道层。',
    MEO: '中风险 · 约 2,000 件已编目碎片；导航卫星密集，碰撞可能影响全球定位与通信。',
    GEO: '长期风险 · 约 900 件已编目碎片；缺少大气阻力，碎片会长期停留。',
  }[zone]

  return { zone, speed, risk }
}

function ResultState({ satellite, openingStory, onReset }) {
  const orbit = getOrbitProfile(satellite)

  return (
    <motion.div
      key="result"
      className="m2-identity-result"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div className="m2-identity-result-heading">
        <span><Check size={13} strokeWidth={2.2} /> 匹配完成</span>
        <div className="m2-identity-result-meta">
          <b>{orbit.zone}</b>
          <i aria-hidden="true" />
          <small>NORAD #{satellite.noradId ?? '—'}</small>
        </div>
        <h4>{satellite.name}</h4>
      </div>

      {openingStory ? (
        <div className="m2-identity-story">
          <div className="m2-identity-story-heading">
            <span>故事开场</span>
            <small>OPENING SCENE</small>
          </div>
          <p>{openingStory}</p>
        </div>
      ) : null}

      <div className="m2-identity-result-primary">
        {[
          { label: '轨道高度', value: satellite.altitudeKm, unit: 'km' },
          { label: '运行速度', value: orbit.speed, unit: 'm/s' },
        ].map(({ label, value, unit }) => (
          <div key={label}>
            <small>{label}</small>
            <span><b>{value}</b><em>{unit}</em></span>
          </div>
        ))}
      </div>

      <div className="m2-identity-result-secondary">
        {[
          { label: '轨道倾角', value: satellite.inclination, unit: '°' },
          { label: '运行周期', value: satellite.periodMin, unit: 'min' },
          { label: '发射年份', value: satellite.launchYear, unit: '' },
        ].map(({ label, value, unit }) => (
          <div key={label}>
            <small>{label}</small>
            <span><b>{value}</b>{unit ? <em>{unit}</em> : null}</span>
          </div>
        ))}
      </div>

      <div className="m2-identity-orbit-risk">
        <TriangleAlert size={15} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <span>{orbit.zone} 轨道环境</span>
          <p>{orbit.risk}</p>
        </div>
      </div>

      <button type="button" className="m2-identity-reset" onClick={onReset}>
        <RotateCcw size={14} strokeWidth={1.7} />
        重新建立身份
      </button>
    </motion.div>
  )
}

export default function IdentityDossier({
  form,
  formStep,
  formError,
  satellite,
  openingStory,
  onChange,
  onSubmit,
  onReset,
}) {
  const completedCount = IDENTITY_FIELDS.reduce(
    (count, field) => count + Number(form[field.key].trim().length > 0),
    0,
  )
  const isReady = completedCount === IDENTITY_FIELDS.length
  const shouldReduceMotion = useReducedMotion()
  const tiltXValue = useMotionValue(0)
  const tiltYValue = useMotionValue(0)
  const rotateX = useSpring(tiltXValue, TILT_SPRING)
  const rotateY = useSpring(tiltYValue, TILT_SPRING)
  const cardRef = useRef(null)
  const cardTiltActiveRef = useRef(false)

  const resetCardTilt = () => {
    cardTiltActiveRef.current = false
    tiltXValue.set(0)
    tiltYValue.set(0)
  }

  const handleCardPointerMove = (event) => {
    if (shouldReduceMotion || event.pointerType !== 'mouse') {
      resetCardTilt()
      return
    }

    cardTiltActiveRef.current = true
    const rect = event.currentTarget.getBoundingClientRect()
    const normalizedX = (event.clientX - rect.left) / rect.width - 0.5
    const normalizedY = (event.clientY - rect.top) / rect.height - 0.5

    tiltXValue.set(normalizedY * -10)
    tiltYValue.set(normalizedX * 10)
  }

  useEffect(() => {
    const resetTiltOutsideCard = (event) => {
      if (!cardTiltActiveRef.current || event.pointerType !== 'mouse') return

      const card = cardRef.current
      if (!card) return

      const rect = card.getBoundingClientRect()
      const isOutside = event.clientX < rect.left
        || event.clientX > rect.right
        || event.clientY < rect.top
        || event.clientY > rect.bottom

      if (isOutside) {
        cardTiltActiveRef.current = false
        tiltXValue.set(0)
        tiltYValue.set(0)
      }
    }

    window.addEventListener('pointermove', resetTiltOutsideCard, { passive: true })
    return () => window.removeEventListener('pointermove', resetTiltOutsideCard)
  }, [tiltXValue, tiltYValue])

  return (
    <section className="m2-identity-dossier">
      <header className="m2-identity-heading">
        <h3>告诉系统你是谁</h3>
        <p>系统将为你匹配一颗真实卫星，并以此开始一段平行叙事。</p>
      </header>

      <motion.article
        ref={cardRef}
        layout
        className={`m2-identity-card is-${formStep}`}
        style={{ rotateX, rotateY, transformPerspective: 1100 }}
        onPointerMove={handleCardPointerMove}
        onPointerLeave={resetCardTilt}
        onPointerCancel={resetCardTilt}
        onMouseLeave={resetCardTilt}
        transition={{ layout: { type: 'spring', stiffness: 240, damping: 30, mass: 0.82 } }}
      >
        <div className="m2-identity-card-body" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {formStep === 'form' ? (
              <motion.div
                key="form"
                className="m2-identity-form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.34, ease: EASE }}
              >
                <div className="m2-identity-card-header">
                  <div>
                    <span>身份信息</span>
                    <h4>建立身份坐标</h4>
                  </div>
                  <b>{completedCount} / {IDENTITY_FIELDS.length}</b>
                </div>

                <div className="m2-identity-progress" aria-hidden="true">
                  <motion.i
                    animate={{ scaleX: completedCount / IDENTITY_FIELDS.length }}
                    transition={{ duration: 0.42, ease: EASE }}
                  />
                </div>

                <div className="m2-identity-fields">
                  {IDENTITY_FIELDS.map((field) => (
                    <IdentityField
                      key={field.key}
                      field={field}
                      value={form[field.key]}
                      onChange={onChange}
                    />
                  ))}
                </div>

                {formError ? <p className="m2-identity-error">{formError}</p> : null}

                <motion.button
                  type="button"
                  className="m2-identity-submit"
                  disabled={!isReady}
                  onClick={onSubmit}
                  whileHover={isReady ? { y: -2 } : undefined}
                  whileTap={isReady ? { scale: 0.99 } : undefined}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                >
                  <span><Satellite size={16} strokeWidth={1.5} /> 匹配我的卫星</span>
                  <ArrowUpRight size={17} strokeWidth={1.7} />
                </motion.button>
              </motion.div>
            ) : null}

            {formStep === 'matching' || formStep === 'generating' ? (
              <LoadingState formStep={formStep} />
            ) : null}

            {formStep === 'result' && satellite ? (
              <ResultState satellite={satellite} openingStory={openingStory} onReset={onReset} />
            ) : null}
          </AnimatePresence>
        </div>
      </motion.article>
    </section>
  )
}
