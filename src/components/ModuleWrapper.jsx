import { forwardRef, useEffect, useRef } from 'react'

function MouseReactiveVeil() {
  const veilRef = useRef(null)
  const frameRef = useRef(0)
  const veilVisibleRef = useRef(false)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia?.('(pointer: coarse)')
    if (reduceMotion?.matches || coarsePointer?.matches) return undefined

    const visibilityObserver = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => {
          veilVisibleRef.current = entry.isIntersecting
          if (!entry.isIntersecting && frameRef.current) {
            cancelAnimationFrame(frameRef.current)
            frameRef.current = 0
          }
        }, { rootMargin: '120px 0px' })
      : null

    if (veilRef.current && visibilityObserver) visibilityObserver.observe(veilRef.current)
    else veilVisibleRef.current = true

    const update = () => {
      if (!veilVisibleRef.current) {
        frameRef.current = 0
        return
      }
      const current = currentRef.current
      const target = targetRef.current
      current.x += (target.x - current.x) * 0.12
      current.y += (target.y - current.y) * 0.12
      veilRef.current?.style.setProperty('--grid-x', `${current.x * 22}px`)
      veilRef.current?.style.setProperty('--grid-y', `${current.y * 16}px`)

      if (Math.abs(target.x - current.x) > 0.002 || Math.abs(target.y - current.y) > 0.002) {
        frameRef.current = requestAnimationFrame(update)
      } else {
        frameRef.current = 0
      }
    }

    const handlePointerMove = (event) => {
      if (!veilVisibleRef.current) return
      const width = window.innerWidth || 1
      const height = window.innerHeight || 1
      targetRef.current = {
        x: (event.clientX / width - 0.5) * 2,
        y: (event.clientY / height - 0.5) * 2,
      }
      if (!frameRef.current) frameRef.current = requestAnimationFrame(update)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      visibilityObserver?.disconnect()
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <div
      ref={veilRef}
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
        backgroundPosition: 'var(--grid-x, 0px) var(--grid-y, 0px)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
      }}
    />
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

function ModuleBoundaryDivider() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        height: 'clamp(76px, 10vh, 128px)',
        placeItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 'min(960px, calc(100% - 48px))',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(107,127,255,0.18) 12%, rgba(232,232,248,0.34) 50%, rgba(107,127,255,0.18) 88%, transparent)',
          boxShadow: '0 1px 0 rgba(4,4,15,0.62), 0 0 34px rgba(107,127,255,0.12)',
        }}
      />
    </div>
  )
}

const ModuleWrapper = forwardRef(function ModuleWrapper(
  { isUnlocked, connector, children, archDivider, boundaryDivider, mouseReactive, moduleId },
  ref,
) {
  const isVisible = isUnlocked

  return (
    <div
      ref={ref}
      data-module={moduleId}
      style={{
        visibility: isVisible ? 'visible' : 'hidden',
        pointerEvents: isVisible ? 'auto' : 'none',
        contentVisibility: isVisible ? 'auto' : undefined,
        containIntrinsicSize: '900px',
      }}
    >
      <div style={{ position: 'relative', isolation: 'isolate' }}>
        {archDivider && <ModuleLineDivider />}
        {boundaryDivider && <ModuleBoundaryDivider />}

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
      </div>
    </div>
  )
})

export default ModuleWrapper
