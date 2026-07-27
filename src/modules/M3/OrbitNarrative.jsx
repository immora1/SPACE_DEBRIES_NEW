import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import useI18n from '../../i18n/useI18n'

const EASE = [0.16, 1, 0.3, 1]

function NarrativeSection({ section }) {
  return (
    <div className="m3-orbit-narrative-section">
      <h4>{section.title}</h4>
      <p>
        {section.segments.map((segment, index) => (
          segment.emphasis ? (
            <mark key={`${segment.text}-${index}`} className="m3-orbit-narrative-highlight">
              {segment.text}
            </mark>
          ) : (
            <span key={`${segment.text}-${index}`}>{segment.text}</span>
          )
        ))}
      </p>
    </div>
  )
}

export default function OrbitNarrative({ orbit }) {
  const { language, pick } = useI18n()
  const shouldReduceMotion = useReducedMotion()

  if (!orbit) return null

  return (
    <section className="m3-orbit-narrative" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={orbit.id}
          className="m3-orbit-narrative-content"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.4, ease: EASE }}
        >
          <header className="m3-orbit-narrative-heading">
            <span>{orbit.name}</span>
            <h3>{pick(orbit.full, orbit.fullEn)}</h3>
          </header>

          {language === 'en' ? (
            <>
              <div className="m3-orbit-narrative-section"><h4>Primary debris</h4><p>{orbit.compositionEn}</p></div>
              <div className="m3-orbit-narrative-section"><h4>Historical record</h4><p>{orbit.historyEn}</p></div>
            </>
          ) : (
            <>
              <NarrativeSection section={orbit.composition} />
              <NarrativeSection section={orbit.history} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
