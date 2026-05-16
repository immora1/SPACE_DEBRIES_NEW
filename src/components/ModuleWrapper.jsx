import { forwardRef } from 'react'
import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

/* ── 梯形分隔器 ──────────────────────────────────────────────────────────── */
function ArchDivider({ color = '#04040f', flip = false }) {
  const H = 80

  // flip=false → 窄上宽下（Entrance→M1）: 顶部从 x=200~1240，底部全宽 0~1440
  // flip=true  → 宽上窄下（M1→M2）:       顶部全宽 0~1440，底部从 x=240~1200
  const d = flip
    ? `M0,0 H1440 L1200,${H} H240 Z`
    : `M200,0 H1240 L1440,${H} H0 Z`

  return (
    <div style={{ lineHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 1, marginTop: -1 }}>
      <svg
        viewBox={`0 0 1440 ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: H }}
        aria-hidden="true"
      >
        <path d={d} fill={color} />
      </svg>
    </div>
  )
}

/* ── ModuleWrapper ──────────────────────────────────────────────────────── */
const ModuleWrapper = forwardRef(function ModuleWrapper(
  { isUnlocked, connector, children, noAnimation, archDivider },
  ref
) {
  if (!isUnlocked) return null

  // archDivider 可以是 string（颜色）或 { color, flip }
  const dividerColor = archDivider?.color ?? archDivider
  const dividerFlip  = archDivider?.flip  ?? false

  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: noAnimation ? 0 : 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {archDivider && <ArchDivider color={dividerColor} flip={dividerFlip} />}

        {!archDivider && connector && (
          <div style={{
            padding: '72px 32px',
            textAlign: 'center',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: '10%', right: '10%',
              height: 1,
              background: 'linear-gradient(to right, transparent, rgba(107,127,255,0.28), transparent)',
            }} />
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
