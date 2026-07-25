import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import useAppStore from '../store/useAppStore'
import './StageNav.css'

const STAGES = [
  { id: 'm1', code: 'M1', label: '太空垃圾' },
  { id: 'm3', code: 'M3', label: '历史事件' },
  { id: 'm2', code: 'M2', label: '轨道环境' },
  { id: 'm4', code: 'M4', label: '生存任务' },
  { id: 'law', code: 'M5', label: '法律边界' },
  { id: 'm6', code: 'M6', label: '清理方法' },
  { id: 'm7', code: 'M7', label: '科普总结' },
]

const EMPTY_GEOMETRY = { width: 0, height: 0, nodes: [] }

function round(value) {
  return Number(value.toFixed(2))
}

function createNavigationPath(geometry, emphasizedIndex) {
  const { height, nodes } = geometry
  if (!height || !nodes.length) return ''

  const topNeck = round(Math.min(9, height * 0.22))
  const bottomNeck = round(height - topNeck)
  const midpoint = round(height / 2)
  const path = [`M ${round(nodes[0].left)} ${midpoint}`]

  nodes.forEach((node, index) => {
    const left = node.left
    const right = node.left + node.width
    const shoulder = Math.min(13, Math.max(9, node.width * 0.18))
    const top = index === emphasizedIndex ? 0 : 2.4

    path.push(
      index === 0
        ? `C ${round(left)} ${round(top + (midpoint - top) * 0.42)} ${round(left + shoulder * 0.42)} ${round(top)} ${round(left + shoulder)} ${round(top)}`
        : `C ${round(left + 3)} ${topNeck} ${round(left + shoulder * 0.44)} ${round(top)} ${round(left + shoulder)} ${round(top)}`,
      `H ${round(right - shoulder)}`,
      index === nodes.length - 1
        ? `C ${round(right - shoulder * 0.42)} ${round(top)} ${round(right)} ${round(top + (midpoint - top) * 0.42)} ${round(right)} ${midpoint}`
        : `C ${round(right - shoulder * 0.44)} ${round(top)} ${round(right - 3)} ${topNeck} ${round(right)} ${topNeck}`,
    )
  })

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    const left = node.left
    const right = node.left + node.width
    const shoulder = Math.min(13, Math.max(9, node.width * 0.18))
    const bottom = index === emphasizedIndex ? height : height - 2.4

    path.push(
      index === nodes.length - 1
        ? `C ${round(right)} ${round(bottom - (bottom - midpoint) * 0.42)} ${round(right - shoulder * 0.42)} ${round(bottom)} ${round(right - shoulder)} ${round(bottom)}`
        : `C ${round(right - 3)} ${bottomNeck} ${round(right - shoulder * 0.44)} ${round(bottom)} ${round(right - shoulder)} ${round(bottom)}`,
      `H ${round(left + shoulder)}`,
      index === 0
        ? `C ${round(left + shoulder * 0.42)} ${round(bottom)} ${round(left)} ${round(bottom - (bottom - midpoint) * 0.42)} ${round(left)} ${midpoint}`
        : `C ${round(left + shoulder * 0.44)} ${round(bottom)} ${round(left + 3)} ${bottomNeck} ${round(left)} ${bottomNeck}`,
    )
  }

  path.push('Z')
  return path.join(' ')
}

function StageNav({ completedModules, availableModules = [], onStageClick }) {
  const completedSet = useMemo(() => new Set(completedModules), [completedModules])
  const availableSet = useMemo(() => new Set(availableModules), [availableModules])
  const [activeStage, setActiveStage] = useState(STAGES[0].id)
  const [previewStage, setPreviewStage] = useState(null)
  const [geometry, setGeometry] = useState(EMPTY_GEOMETRY)
  const capsulesRef = useRef(null)
  const itemRefs = useRef([])
  const navigationTargetRef = useRef(null)
  const navigationUnlockTimerRef = useRef(0)
  const navigationPaintFrameRef = useRef(0)
  const reduceMotion = useReducedMotion()
  const setCurrentModule = useAppStore((state) => state.setCurrentModule)

  useEffect(() => {
    setCurrentModule(activeStage)
  }, [activeStage, setCurrentModule])

  useEffect(() => {
    const header = document.querySelector('[data-site-header]')
    const moduleElements = STAGES
      .map((stage) => document.querySelector(`[data-module="${stage.id}"]`))
      .filter(Boolean)
    if (!moduleElements.length) return undefined

    let frameId = 0
    const updateActiveStage = () => {
      frameId = 0
      const headerHeight = header?.getBoundingClientRect().height || 0
      const marker = headerHeight + Math.min(window.innerHeight * 0.28, 220)
      const navigationTarget = navigationTargetRef.current

      if (navigationTarget) {
        const targetElement = moduleElements.find((element) => element.dataset.module === navigationTarget)
        const targetTop = targetElement?.getBoundingClientRect().top
        if (typeof targetTop === 'number' && Math.abs(targetTop - headerHeight - 12) > 48) return

        navigationTargetRef.current = null
        if (navigationUnlockTimerRef.current) {
          window.clearTimeout(navigationUnlockTimerRef.current)
          navigationUnlockTimerRef.current = 0
        }
      }

      let current = moduleElements[0]

      moduleElements.forEach((element) => {
        if (element.getBoundingClientRect().top <= marker) current = element
      })

      const nextStage = current?.dataset.module
      if (nextStage) setActiveStage((previous) => previous === nextStage ? previous : nextStage)
    }
    const scheduleUpdate = () => {
      if (!frameId) frameId = window.requestAnimationFrame(updateActiveStage)
    }

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(scheduleUpdate, { rootMargin: '-8% 0px -74% 0px', threshold: [0, 0.15, 0.5] })
      : null

    moduleElements.forEach((element) => observer?.observe(element))
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    updateActiveStage()

    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frameId) window.cancelAnimationFrame(frameId)
      if (navigationUnlockTimerRef.current) window.clearTimeout(navigationUnlockTimerRef.current)
      if (navigationPaintFrameRef.current) window.cancelAnimationFrame(navigationPaintFrameRef.current)
    }
  }, [])

  const measureNavigation = useCallback(() => {
    const capsules = capsulesRef.current
    const items = itemRefs.current.filter(Boolean)
    if (!capsules || items.length !== STAGES.length) return

    const capsuleRect = capsules.getBoundingClientRect()
    const nextGeometry = {
      width: round(capsuleRect.width),
      height: round(capsuleRect.height),
      nodes: items.map((item) => {
        const itemRect = item.getBoundingClientRect()
        return {
          left: round(itemRect.left - capsuleRect.left),
          width: round(itemRect.width),
        }
      }),
    }

    setGeometry((current) => {
      const currentSignature = JSON.stringify(current)
      const nextSignature = JSON.stringify(nextGeometry)
      return currentSignature === nextSignature ? current : nextGeometry
    })
  }, [])

  useLayoutEffect(() => {
    let frameId = 0
    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(measureNavigation)
    }

    measureNavigation()
    const observer = 'ResizeObserver' in window ? new ResizeObserver(scheduleMeasure) : null
    if (capsulesRef.current) observer?.observe(capsulesRef.current)
    itemRefs.current.forEach((item) => item && observer?.observe(item))
    window.addEventListener('resize', scheduleMeasure)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [measureNavigation])

  const emphasizedStage = previewStage ?? activeStage
  const emphasizedIndex = STAGES.findIndex((stage) => stage.id === emphasizedStage)
  const shapePath = useMemo(
    () => createNavigationPath(geometry, emphasizedIndex),
    [emphasizedIndex, geometry],
  )
  const shapeTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 360, damping: 32, mass: 0.68 }

  function handleStageClick(id) {
    if (!availableSet.has(id)) return
    navigationTargetRef.current = id
    if (navigationUnlockTimerRef.current) window.clearTimeout(navigationUnlockTimerRef.current)
    navigationUnlockTimerRef.current = window.setTimeout(() => {
      navigationTargetRef.current = null
      navigationUnlockTimerRef.current = 0
    }, 1300)
    setActiveStage(id)
    setPreviewStage(id)

    if (navigationPaintFrameRef.current) window.cancelAnimationFrame(navigationPaintFrameRef.current)
    navigationPaintFrameRef.current = window.requestAnimationFrame(() => {
      navigationPaintFrameRef.current = window.requestAnimationFrame(() => {
        navigationPaintFrameRef.current = 0
        onStageClick?.(id)
      })
    })
  }

  return (
    <header className="stage-nav" data-site-header>
      <div className="stage-nav__inner">
        <button
          type="button"
          className="stage-nav__brand"
          aria-label="返回首页"
          onClick={() => handleStageClick('m1')}
        >
          <svg className="stage-nav__logo" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
            <path fill="currentColor" fillRule="evenodd" d="M18 2.5A15.5 15.5 0 1 1 18 33.5A15.5 15.5 0 0 1 18 2.5Zm0 6A9.5 9.5 0 1 0 18 27.5A9.5 9.5 0 0 0 18 8.5Z" />
            <path d="M7 24.5c5.7-1.2 11.7-4.8 16.7-10.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="m25.5 9.5 3 1-1 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="stage-nav__brand-text"><span>RE·SET</span><i aria-hidden="true">｜</i><b>SPACE DEBRIS</b></span>
        </button>

        <nav className="stage-nav__navigation" aria-label="页面阶段导航">
          <div className="stage-nav__scroller">
            <div ref={capsulesRef} className="stage-nav__capsules">
              <svg
                className="stage-nav__shape"
                viewBox={`0 0 ${geometry.width || 1} ${geometry.height || 1}`}
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <motion.path
                  initial={false}
                  animate={{ d: shapePath }}
                  transition={shapeTransition}
                />
              </svg>

              <div className="stage-nav__items">
                {STAGES.map((stage, index) => {
                  const isCompleted = completedSet.has(stage.id)
                  const isAvailable = availableSet.has(stage.id)
                  const isActive = activeStage === stage.id

                  return (
                    <button
                      ref={(node) => { itemRefs.current[index] = node }}
                      key={stage.id}
                      type="button"
                      className={[
                        'stage-nav__item',
                        isActive && 'is-active',
                        isCompleted && 'is-completed',
                        !isAvailable && 'is-disabled',
                      ].filter(Boolean).join(' ')}
                      disabled={!isAvailable}
                      aria-current={isActive ? 'step' : undefined}
                      aria-disabled={!isAvailable}
                      onPointerEnter={() => setPreviewStage(stage.id)}
                      onPointerLeave={() => setPreviewStage(null)}
                      onFocus={() => setPreviewStage(stage.id)}
                      onBlur={() => setPreviewStage(null)}
                      onClick={() => handleStageClick(stage.id)}
                      title={stage.label}
                    >
                      <span className="stage-nav__item-copy">
                        <span className="stage-nav__code">{stage.code}</span>
                        <span className="stage-nav__label">{stage.label}</span>
                      </span>
                      <span className="stage-nav__active-dots" aria-hidden="true">
                        <i /><i /><i />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}

export default memo(StageNav)
