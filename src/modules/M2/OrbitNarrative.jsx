import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

function NarrativeSection({ section }) {
  return (
    <div className="m2-orbit-narrative-section">
      <h4>{section.title}</h4>
      <p>
        {section.segments.map((segment, index) => (
          segment.emphasis ? (
            <mark key={`${segment.text}-${index}`} className="m2-orbit-narrative-highlight">
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
  const shouldReduceMotion = useReducedMotion()

  if (!orbit) return null

  return (
    <section className="m2-orbit-narrative" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={orbit.id}
          className="m2-orbit-narrative-content"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.4, ease: EASE }}
        >
          <header className="m2-orbit-narrative-heading">
            <span>{orbit.name}</span>
            <h3>{orbit.full}</h3>
          </header>

          <NarrativeSection section={orbit.composition} />
          <NarrativeSection section={orbit.history} />
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
