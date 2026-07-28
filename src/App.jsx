import { createElement, lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useAppStore from './store/useAppStore'
import ModuleWrapper from './components/ModuleWrapper'
import StageNav from './components/StageNav'
import AIStoryRail from './components/AIStoryRail'
import useI18n from './i18n/useI18n'
import { restoreStorySession } from './services/ai'

const M1 = lazy(() => import('./modules/M1'))
const M2 = lazy(() => import('./modules/M2'))
const M3 = lazy(() => import('./modules/M3'))
const M4 = lazy(() => import('./modules/M4/M4New'))
const M5 = lazy(() => import('./modules/M5'))
const M6 = lazy(() => import('./modules/M6'))
const M7 = lazy(() => import('./modules/M7'))
const M8 = lazy(() => import('./modules/M8'))

const MODULES = [
  { id: 'm1', Component: M1, connector: null },
  { id: 'm2', Component: M2, connector: null },
  { id: 'm3', Component: M3, connector: null },
  { id: 'm4', Component: M4, connector: null },
  { id: 'm5', Component: M5, connector: null },
  { id: 'm6', Component: M6, connector: null },
  { id: 'm7', Component: M7 },
]

function ModuleLoader() {
  return <div style={{ height: 120 }} />
}

function DeferredModule({ Component, eager = false, onComplete, componentProps }) {
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
          {createElement(Component, { ...componentProps, onComplete })}
        </Suspense>
      ) : (
        <ModuleLoader />
      )}
    </div>
  )
}

const MemoDeferredModule = memo(DeferredModule)

function OptionalModuleCard({ Component, isVisible, onDecision }) {
  const [expanded, setExpanded] = useState(false)
  const setCurrentModule = useAppStore((state) => state.setCurrentModule)
  const { pick } = useI18n()

  if (!isVisible) return null

  return (
    <div className={`optional-module-shell${expanded ? ' is-expanded' : ''}`}>

      {!expanded ? (
        <div className="optional-module-card">
          <div className="optional-module-copy">
            <div className="optional-module-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080b16" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2" strokeDasharray="3 3" />
                <path d="M12 7v2M12 15v2M7 12H5M19 12h-2" />
              </svg>
            </div>
            <div className="optional-module-text">
              <div className="optional-module-kicker">
                MODULE 08 / FIELD OBSERVATION
              </div>
              <div className="optional-module-title">
                {pick('是否进入观测教学？', 'Enter observation training?')}
              </div>
              <div className="optional-module-description">
                {pick(
                  '学会区分太空垃圾再入、流星与卫星，并提交你的目击报告。',
                  'Learn to distinguish debris re-entry, meteors, and satellites, then submit your sighting report.',
                )}
              </div>
            </div>
          </div>

          <div className="optional-module-actions">
            <button
              type="button"
              className="optional-module-action optional-module-action--primary"
              onClick={() => {
                onDecision(true)
                setExpanded(true)
                setCurrentModule('m8')
              }}
            >
              {pick('进入教学', 'Start training')}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="optional-module-expanded-bar">
            <div className="optional-module-expanded-label">
              MODULE 08 / FIELD OBSERVATION
            </div>
            <button
              type="button"
              className="optional-module-action optional-module-action--secondary optional-module-action--compact"
              onClick={() => {
                setExpanded(false)
                setCurrentModule('m7')
              }}
            >
              {pick('收起', 'Collapse')}
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
  const setScrollLocked = useAppStore((s) => s.setScrollLocked)
  const unlockModule = useAppStore((s) => s.unlockModule)
  const markModuleComplete = useAppStore((s) => s.markModuleComplete)
  const storyId = useAppStore((s) => s.storyId)

  const unlockedSet = useMemo(() => new Set(unlockedModules), [unlockedModules])
  const completedSet = useMemo(() => new Set(completedModules), [completedModules])
  const allModuleIds = useMemo(() => MODULES.map((module) => module.id), [])

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    if (!storyId) return
    restoreStorySession().catch((error) => {
      console.warn('[story] restore failed:', error.code || error.message)
    })
  }, [storyId])

  useEffect(() => {
    document.body.style.overflow = scrollLocked ? 'hidden' : ''
    document.documentElement.style.overflow = scrollLocked ? 'hidden' : ''

    const preventScroll = (event) => event.preventDefault()
    if (scrollLocked) {
      window.addEventListener('wheel', preventScroll, { passive: false })
      window.addEventListener('touchmove', preventScroll, { passive: false })
    }

    return () => {
      window.removeEventListener('wheel', preventScroll)
      window.removeEventListener('touchmove', preventScroll)
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [scrollLocked])

  useEffect(() => {
    MODULES.forEach((module, idx) => {
      const next = MODULES[idx + 1]
      if (next && completedSet.has(module.id) && !unlockedSet.has(next.id)) {
        unlockModule(next.id)
      }
    })
  }, [completedSet, unlockedSet, unlockModule])

  const scrollToModuleTarget = useCallback((id, behavior = 'smooth') => {
    const el = document.querySelector(`[data-module="${id}"]`)
    if (!el) return

    const headerHeight = document.querySelector('[data-site-header]')?.getBoundingClientRect().height || 0
    const targetTop = window.scrollY + el.getBoundingClientRect().top - headerHeight - 12
    const distance = targetTop - window.scrollY
    const resolvedBehavior = behavior === 'smart'
      ? Math.abs(distance) <= Math.min(window.innerHeight * 1.25, 1200) ? 'smooth' : 'auto'
      : behavior

    window.scrollTo({ top: Math.max(0, targetTop), behavior: resolvedBehavior })
  }, [])

  const handleComplete = useCallback((currentId, options = {}) => {
    markModuleComplete(currentId)
    const idx = MODULES.findIndex((m) => m.id === currentId)
    if (idx === -1 || idx >= MODULES.length - 1) return

    const nextId = MODULES[idx + 1].id
    unlockModule(nextId)
    if (options.autoScroll === false) return

    window.setTimeout(() => {
      scrollToModuleTarget(nextId)
    }, 150)
  }, [markModuleComplete, scrollToModuleTarget, unlockModule])

  const isModuleNavigable = useCallback((id) => (
    allModuleIds.includes(id)
  ), [allModuleIds])

  const scrollToModule = useCallback((id) => {
    if (!isModuleNavigable(id)) return
    if (scrollLocked) setScrollLocked(false)
    scrollToModuleTarget(id, 'smart')
  }, [isModuleNavigable, scrollLocked, scrollToModuleTarget, setScrollLocked])

  const availableModules = useMemo(() => (
    allModuleIds
  ), [allModuleIds])

  const handleM8Decision = useCallback(() => {
    handleComplete('m7', { autoScroll: false })
  }, [handleComplete])

  return (
    <main className="app-main">
      <StageNav
        completedModules={completedModules}
        availableModules={availableModules}
        onStageClick={scrollToModule}
      />
      <AIStoryRail />
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
              componentProps={id === 'm7'
                ? {
                    teachingEntry: (
                      <OptionalModuleCard
                        Component={M8}
                        isVisible
                        onDecision={handleM8Decision}
                      />
                    ),
                  }
                : undefined}
            />
          </ModuleWrapper>
        )
      })}
    </main>
  )
}
