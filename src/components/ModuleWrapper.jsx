import { forwardRef } from 'react'
import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

const ModuleWrapper = forwardRef(function ModuleWrapper(
  { isUnlocked, connector, children },
  ref
) {
  if (!isUnlocked) return null

  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {connector && (
          <div style={{
            padding: '72px 32px',
            textAlign: 'center',
            position: 'relative',
          }}>
            {/* gradient divider above */}
            <div style={{
              position: 'absolute', top: 0, left: '10%', right: '10%',
              height: 1,
              background: 'linear-gradient(to right, transparent, rgba(107,127,255,0.28), transparent)',
            }} />

            {/* small orbit icon */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid rgba(107,127,255,0.22)',
              background: 'rgba(107,127,255,0.06)',
              marginBottom: 22,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'rgba(107,127,255,0.55)',
              }} />
            </div>

            <p style={{
              fontFamily: '"Noto Serif SC", serif',
              fontSize: 15,
              color: 'rgba(232,232,248,0.32)',
              lineHeight: 1.8,
              letterSpacing: '0.05em',
              maxWidth: 480,
              margin: '0 auto',
            }}>
              {connector}
            </p>
          </div>
        )}
        {children}
      </motion.div>
    </div>
  )
})

export default ModuleWrapper
