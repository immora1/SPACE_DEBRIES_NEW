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
            padding: '80px 32px',
            textAlign: 'center',
            borderTop: '1px solid #1a1a18',
          }}>
            <p style={{
              fontFamily: '"Noto Serif SC", serif',
              fontSize: 16,
              color: 'rgba(245,244,240,0.35)',
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
