import { forwardRef, useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

function MouseReactiveVeil() {
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const smoothX = useSpring(pointerX, { stiffness: 52, damping: 24, mass: 0.8 })
  const smoothY = useSpring(pointerY, { stiffness: 52, damping: 24, mass: 0.8 })

  const gridX = useTransform(smoothX, (v) => `${v * 22}px`)
  const gridY = useTransform(smoothY, (v) => `${v * 16}px`)

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reduceMotion?.matches) return undefined

    const handlePointerMove = (event) => {
      const width = window.innerWidth || 1
      const height = window.innerHeight || 1
      pointerX.set((event.clientX / width - 0.5) * 2)
      pointerY.set((event.clientY / height - 0.5) * 2)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [pointerX, pointerY])

  return (
    <>
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.1,
          mixBlendMode: 'screen',
          backgroundImage: [
            'linear-gradient(90deg, rgba(107,127,255,0.10) 1px, transparent 1px)',
            'linear-gradient(0deg, rgba(107,127,255,0.06) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '112px 112px',
          backgroundPositionX: gridX,
          backgroundPositionY: gridY,
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
        }}
      />
    </>
  )
}

function ModuleLineDivider() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 1,
        zIndex: 2,
        pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent, rgba(107,127,255,0.42) 18%, rgba(232,232,248,0.34) 50%, rgba(107,127,255,0.42) 82%, transparent)',
      }}
    />
  )
}

/* ── ModuleWrapper ──────────────────────────────────────────────────────── */
const ModuleWrapper = forwardRef(function ModuleWrapper(
  { isUnlocked, connector, children, noAnimation, archDivider, mouseReactive },
  ref
) {
  if (!isUnlocked) return null

  // archDivider 可以是 string（颜色）或 { color, flip }
  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: noAnimation ? 0 : 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.72, ease: EASE }}
        style={{ position: 'relative', isolation: 'isolate' }}
      >
        {archDivider && <ModuleLineDivider />}

        <div style={{ position: 'relative', zIndex: 1 }}>
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
        </div>

        {mouseReactive && <MouseReactiveVeil />}
      </motion.div>
    </div>
  )
})

export default ModuleWrapper
