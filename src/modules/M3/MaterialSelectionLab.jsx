import { Suspense, useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
} from 'framer-motion'
import {
  ArrowRight,
  Check,
  Layers3,
  Sparkles,
} from 'lucide-react'
import { GLBSatelliteModel } from '../M1/SatelliteModel'
import useI18n from '../../i18n/useI18n'
import { CanvasErrorBoundary, PARTS, PART_ACCENT } from './SceneMaterial'
import './material-selection-lab.css'

const EASE = [0.16, 1, 0.3, 1]

const TRADEOFF_META = {
  very_low: { label: '很低', labelEn: 'VERY LOW', level: 1 },
  low: { label: '低', labelEn: 'LOW', level: 1 },
  medium: { label: '中', labelEn: 'MEDIUM', level: 2 },
  high: { label: '高', labelEn: 'HIGH', level: 3 },
}

const PROFILE_META = {
  low: { label: '较低', labelEn: 'LOW' },
  medium: { label: '中等', labelEn: 'MEDIUM' },
  high: { label: '较高', labelEn: 'HIGH' },
}

export default function MaterialSelectionLab({
  materials,
  allDone,
  aiState,
  materialAnalysis,
  onSelect,
  onAnalyze,
  onContinue,
}) {
  const { language, pick } = useI18n()
  const [activePartIndex, setActivePartIndex] = useState(0)
  const [modelVisible, setModelVisible] = useState(false)
  const modelRef = useRef(null)
  const advanceTimerRef = useRef(0)

  const activePart = PARTS[activePartIndex]
  const selectedCount = PARTS.filter((part) => Boolean(materials[part.id])).length
  const selectedOptionId = materials[activePart.id]
  const interactionLocked = aiState === 'loading' || aiState === 'done'
  const controlsLocked = interactionLocked
  const analysisAvailable = Number.isFinite(materialAnalysis?.fuel)
    && Number.isFinite(materialAnalysis?.armor)
    && materialAnalysis?.profiles

  useEffect(() => {
    const element = modelRef.current
    if (!element || !('IntersectionObserver' in window)) {
      setModelVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setModelVisible(true)
      observer.disconnect()
    }, { rootMargin: '160px' })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current)
  }, [])

  const handlePartChange = (index) => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = 0
    setActivePartIndex(index)
  }

  const handleOptionSelect = (optionId) => {
    onSelect(activePart.id, optionId)
    if (activePartIndex >= PARTS.length - 1) return

    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = window.setTimeout(() => {
      setActivePartIndex((current) => current === activePartIndex ? current + 1 : current)
      advanceTimerRef.current = 0
    }, 320)
  }

  return (
    <section className="m3-material-lab">
      <header className="m3-material-heading">
        <span>03 · MATERIAL SELECTION</span>
        <h3>{pick('为卫星选择材料', 'Choose Materials for Your Satellite')}</h3>
        <p>{pick('不同材料会改变卫星的重量和耐受能力，也会影响后续任务中的燃料与防护表现。完成选择后，你还会看到这些材料在卫星报废后的另一面。', 'Different materials change the satellite’s mass and structural resilience, which will affect its starting fuel and armor in the later mission. After completing the build, you will also see what these choices could mean when the satellite eventually re-enters the atmosphere.')}</p>
      </header>

      <div className="m3-material-workspace">
        <aside className="m3-material-model-panel">
          <div ref={modelRef} className="m3-material-model">
            {modelVisible ? (
              <CanvasErrorBoundary fallback={<div className="m3-material-model-fallback" />}>
                <Suspense fallback={<div className="m3-material-model-fallback" />}>
                  <GLBSatelliteModel
                    accent={PART_ACCENT[activePart.id]}
                    activePart={activePart.id}
                  />
                </Suspense>
              </CanvasErrorBoundary>
            ) : null}
          </div>

          <div className="m3-material-part-copy">
            <span>{String(activePartIndex + 1).padStart(2, '0')} / 04 · {activePart.labelEn}</span>
            <h4>{pick(activePart.label, activePart.labelEn)}</h4>
            <p>{pick(activePart.desc, activePart.descEn)}</p>
          </div>

        </aside>

        <div className="m3-material-interaction">
          <div className="m3-material-selection-card">
            <div className="m3-material-part-tabs" role="tablist" aria-label={pick('选择卫星材料部件', 'Select a satellite component')}>
              {PARTS.map((part, index) => {
                const active = index === activePartIndex
                const complete = Boolean(materials[part.id])
                return (
                  <button
                    key={part.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={controlsLocked}
                    className={`${active ? 'is-active' : ''}${complete ? ' is-complete' : ''}`}
                    style={{ '--m3-tab-layer': PARTS.length - index }}
                    onClick={() => handlePartChange(index)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <b>{pick(part.label, part.labelEn)}</b>
                    {complete ? <Check size={11} strokeWidth={2.2} /> : null}
                  </button>
                )
              })}
            </div>

            <div className="m3-material-folder-body">
              <div className="m3-material-deck-head">
                <span><Layers3 size={15} strokeWidth={1.4} /> {pick('材料候选', 'MATERIAL CANDIDATES')}</span>
                <span>{selectedCount} / 04 · {String(activePart.options.length).padStart(2, '0')} {pick('项', 'OPTIONS')}</span>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.fieldset
                  key={activePart.id}
                  className="m3-material-radio-group"
                  disabled={controlsLocked}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.24, ease: EASE }}
                >
                  <legend>{pick(`${activePart.label}材料选项`, `${activePart.labelEn} material options`)}</legend>
                  {activePart.options.map((option, optionIndex) => {
                    const selected = selectedOptionId === option.id
                    const mass = TRADEOFF_META[option.massBurden]
                    const resilience = TRADEOFF_META[option.resilience]

                    return (
                      <label key={option.id} className={`m3-material-radio-option${selected ? ' is-selected' : ''}`}>
                        <input
                          type="radio"
                          name={`material-${activePart.id}`}
                          value={option.id}
                          checked={selected}
                          onChange={() => handleOptionSelect(option.id)}
                        />
                        <span className="m3-material-radio-control" aria-hidden="true"><i /></span>
                        <span className="m3-material-radio-copy">
                          <small>{language === 'en' ? `MATERIAL ${String(optionIndex + 1).padStart(2, '0')}` : option.en}</small>
                          <b>{pick(option.label, option.en)}</b>
                          <span>{pick(option.shortFeature ?? option.feature, option.shortFeatureEn ?? option.featureEn)}</span>
                        </span>
                        <span className="m3-material-radio-metrics">
                          {[
                            { label: pick('质量负担', 'Mass burden'), meta: mass },
                            { label: pick('结构耐受', 'Structural resilience'), meta: resilience },
                          ].map((metric) => (
                            <span key={metric.label} className="m3-material-tradeoff">
                              <small>{metric.label}</small>
                              <b>{pick(metric.meta.label, metric.meta.labelEn)}</b>
                              <span className="m3-material-risk-meter" aria-label={`${metric.label} ${pick(metric.meta.label, metric.meta.labelEn)}`}>
                                {[1, 2, 3].map((level) => (
                                  <i key={level} className={level <= metric.meta.level ? 'is-filled' : ''} />
                                ))}
                              </span>
                            </span>
                          ))}
                          </span>
                      </label>
                    )
                  })}
                </motion.fieldset>
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {allDone && aiState === 'idle' ? (
              <motion.div
                key="analysis-launch"
                className="m3-material-analysis-launch"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <span>
                  <Sparkles size={17} strokeWidth={1.5} />
                  <span><b>{pick('材料组合已完成', 'Material set complete')}</b><small>{pick('查看工程状态与材料后果', 'Review build status and material outcomes')}</small></span>
                </span>
                <button type="button" onClick={onAnalyze}>{pick('生成材料分析', 'Analyze materials')} <ArrowRight size={16} strokeWidth={1.6} /></button>
              </motion.div>
            ) : null}

            {aiState === 'loading' ? (
              <motion.div
                key="analysis-loading"
                className="m3-material-analysis-loading"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <span aria-hidden="true"><i /><i /><i /></span>
                <div><b>{pick('正在计算材料剖面', 'Analyzing material profile')}</b><small>ANALYZING MATERIAL PROFILE</small></div>
              </motion.div>
            ) : null}

            {aiState === 'done' || aiState === 'error' ? (
              <motion.article
                key="analysis-report"
                className="m3-material-report"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <div className="m3-material-report-head">
                  <span>BUILD &amp; RE-ENTRY PROFILE · 03</span>
                  <b>{pick('材料分析', 'Material analysis')}</b>
                </div>
                {aiState === 'done' && analysisAvailable ? (
                  <div className="m3-material-report-body">
                    <div className="m3-material-report-metrics">
                      <div>
                        <span>{pick('初始燃料', 'Initial Fuel')}</span>
                        <strong>{materialAnalysis.fuel}</strong>
                      </div>
                      <div>
                        <span>{pick('初始护甲', 'Initial Armor')}</span>
                        <strong>{materialAnalysis.armor}</strong>
                      </div>
                    </div>
                    <p>{pick(
                      '这两个数值会作为后续轨道游戏的初始状态。',
                      'These values will be used as the starting state for the later orbital game.',
                    )}</p>
                    <div className="m3-material-profile-head">
                      <b>{pick('残片留下的可能性', 'Likelihood of surviving fragments')}</b>
                      <p>{pick(
                        '指卫星重返大气层后，部件留下未完全烧蚀残片的相对可能性。',
                        'A qualitative indication of how likely a component is to leave surviving fragments after atmospheric re-entry.',
                      )}</p>
                    </div>
                    <div className="m3-material-profile-grid">
                      {PARTS.map((part) => {
                        const option = part.options.find((item) => item.id === materials[part.id])
                        const profile = PROFILE_META[materialAnalysis.profiles[part.id]]
                        return (
                          <div key={part.id}>
                            <span>{pick(part.label, part.labelEn)}</span>
                            <small>{pick(option?.label, option?.en)}</small>
                            <b>{pick(profile?.label, profile?.labelEn)}</b>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="m3-material-report-error">{pick(
                    '材料分析暂时失败，故事状态尚未推进。你的选择仍保留在当前页面，可直接重试。',
                    'Material analysis failed and the story did not advance. Your current selections remain available for a retry.',
                  )}</p>
                )}
                <button type="button" onClick={aiState === 'done' ? onContinue : onAnalyze}>
                  {aiState === 'done' ? pick('进入任务选择', 'Continue to mission') : pick('重试材料分析', 'Retry analysis')}
                  {' '}
                  <ArrowRight size={16} strokeWidth={1.6} />
                </button>
              </motion.article>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
