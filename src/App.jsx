import { createElement, lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useAppStore from './store/useAppStore'
import ProgressBar from './components/ProgressBar'
import ModuleWrapper from './components/ModuleWrapper'
import StageNav from './components/StageNav'

const M1 = lazy(() => import('./modules/M1'))
const M2 = lazy(() => import('./modules/M2'))
const M3 = lazy(() => import('./modules/M3'))
const M4 = lazy(() => import('./modules/M4/M4New'))
const LegalTreaties = lazy(() => import('./modules/LegalTreaties'))
const M6 = lazy(() => import('./modules/M6'))
const M7 = lazy(() => import('./modules/M7'))
const M8 = lazy(() => import('./modules/M8'))

const MODULES = [
  { id: 'm1', Component: M1, connector: null, archDivider: '#04040f' },
  { id: 'm3', Component: M3, connector: null },
  { id: 'm2', Component: M2, connector: null },
  { id: 'm4', Component: M4, connector: null },
  { id: 'law', Component: LegalTreaties, connector: null },
  { id: 'm6', Component: M6, connector: null },
  { id: 'm7', Component: M7 },
]

function ModuleLoader() {
  return <div style={{ height: 120 }} />
}

function DeferredModule({ Component, eager = false, onComplete }) {
  const rootRef = useRef(null)
  const [shouldRender, setShouldRender] = useState(eager)

  useEffect(() => {
    if (shouldRender) return undefined
    const el = rootRef.current
    if (!el) return undefined

    if (!('IntersectionObserver' in window)) {
      setShouldRender(true)
      return undefined
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShouldRender(true)
        io.disconnect()
      },
      { rootMargin: '900px 0px' },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [shouldRender])

  return (
    <div
      ref={rootRef}
      data-module-scroll-target
      style={shouldRender ? undefined : { minHeight: 'clamp(420px, 70vh, 760px)' }}
    >
      {shouldRender ? (
        <Suspense fallback={<ModuleLoader />}>
          {createElement(Component, { onComplete })}
        </Suspense>
      ) : (
        <ModuleLoader />
      )}
    </div>
  )
}

const MemoDeferredModule = memo(DeferredModule)

function OptionalModuleCard({ Component, isVisible }) {
  const [expanded, setExpanded] = useState(false)

  if (!isVisible) return null

  return (
    <div
      style={{ margin: '0 auto', maxWidth: expanded ? 'none' : 1080, padding: expanded ? '0 0 80px' : '0 24px 80px' }}
    >
      <div style={{
        height: 1,
        background: 'linear-gradient(to right, transparent, rgba(232,232,248,0.18), transparent)',
        marginBottom: 40,
      }} />

      {!expanded ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: '24px 28px',
            background: 'rgba(8, 10, 28, 0.78)',
            border: '1px solid rgba(232,232,248,0.14)',
            borderRadius: 0,
            color: '#e8e8f8',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 0, flexShrink: 0,
              border: '1px solid rgba(232,232,248,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(232,232,248,0.04)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(232,232,248,0.82)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2" strokeDasharray="3 3" />
                <path d="M12 7v2M12 15v2M7 12H5M19 12h-2" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'rgba(232,232,248,0.42)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>
                MODULE 08 / FIELD OBSERVATION
              </div>
              <div style={{ fontFamily: 'Noto Serif SC, serif', fontSize: 20, color: '#e8e8f8', fontWeight: 300, marginBottom: 3 }}>
                观测教学与社区
              </div>
              <div style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: 12, color: 'rgba(232,232,248,0.48)', lineHeight: 1.6 }}>
                学会区分太空垃圾再入、流星与卫星，并提交你的目击报告。
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(232,232,248,0.42)', letterSpacing: '0.08em' }}>
              选读
            </span>
            <div
              style={{
                padding: '9px 20px',
                border: '1px solid rgba(232,232,248,0.22)',
                borderRadius: 0,
                fontFamily: 'Space Mono, monospace',
                fontSize: 10,
                color: '#e8e8f8',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              进入探索
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px clamp(18px, 3.2vw, 56px)', marginBottom: 0,
            background: '#050713',
            borderTop: '1px solid rgba(232,232,248,0.14)',
            borderBottom: '1px solid rgba(232,232,248,0.14)',
          }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'rgba(232,232,248,0.66)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              MODULE 08 / FIELD OBSERVATION
            </div>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: 'transparent', border: '1px solid rgba(232,232,248,0.22)', borderRadius: 0,
                color: '#e8e8f8', fontFamily: 'Space Mono, monospace', fontSize: 9,
                letterSpacing: '0.08em', padding: '6px 12px', cursor: 'pointer',
              }}
            >
              收起
            </button>
          </div>
          <Suspense fallback={<ModuleLoader />}>
            {createElement(Component, { onComplete: () => {} })}
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const unlockedModules = useAppStore((s) => s.unlockedModules)
  const completedModules = useAppStore((s) => s.completedModules)
  const scrollLocked = useAppStore((s) => s.scrollLocked)
  const unlockModule = useAppStore((s) => s.unlockModule)
  const markModuleComplete = useAppStore((s) => s.markModuleComplete)

  const unlockedSet = useMemo(() => new Set(unlockedModules), [unlockedModules])
  const completedSet = useMemo(() => new Set(completedModules), [completedModules])
  const allModuleIds = useMemo(() => MODULES.map((module) => module.id), [])

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    document.body.style.overflow = scrollLocked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [scrollLocked])

  useEffect(() => {
    MODULES.forEach((module, idx) => {
      const next = MODULES[idx + 1]
      if (next && completedSet.has(module.id) && !unlockedSet.has(next.id)) {
        unlockModule(next.id)
      }
    })
  }, [completedSet, unlockedSet, unlockModule])

  const handleComplete = useCallback((currentId, options = {}) => {
    markModuleComplete(currentId)
    const idx = MODULES.findIndex((m) => m.id === currentId)
    if (idx === -1 || idx >= MODULES.length - 1) return

    const nextId = MODULES[idx + 1].id
    unlockModule(nextId)
    if (options.autoScroll === false) return

    window.setTimeout(() => {
      const nextEl = document.querySelector(`[data-module="${nextId}"]`)
      const scrollTarget = nextEl?.querySelector?.('[data-module-scroll-target]') ?? nextEl
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }, [markModuleComplete, unlockModule])

  const isModuleNavigable = useCallback((id) => (
    allModuleIds.includes(id)
  ), [allModuleIds])

  const scrollToModule = useCallback((id) => {
    if (scrollLocked || !isModuleNavigable(id)) return
    const el = document.querySelector(`[data-module="${id}"]`)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, 600)
  }, [isModuleNavigable, scrollLocked])

  const availableModules = useMemo(() => (
    scrollLocked
      ? []
      : allModuleIds
  ), [allModuleIds, scrollLocked])

  const showM8 = completedSet.has('m7')

  return (
    <div style={{ minHeight: '100vh' }}>
      <ProgressBar completed={completedModules.length} total={MODULES.length} />
      <StageNav
        completedModules={completedModules}
        availableModules={availableModules}
        onStageClick={scrollToModule}
      />

      {MODULES.map(({ id, Component, connector, archDivider, boundaryDivider }) => {
        return (
          <ModuleWrapper
            key={id}
            isUnlocked
            connector={connector}
            archDivider={archDivider}
            boundaryDivider={boundaryDivider}
            mouseReactive={id === 'm1'}
            moduleId={id}
          >
            <MemoDeferredModule
              Component={Component}
              eager={id === 'm1'}
              onComplete={(options) => handleComplete(id, options)}
            />
          </ModuleWrapper>
        )
      })}

      <OptionalModuleCard Component={M8} isVisible={showM8} />
    </div>
  )
}
