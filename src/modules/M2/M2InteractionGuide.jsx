import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { MousePointer2 } from 'lucide-react'
import {
  M2_GUIDE_ENTER_DELAY_SECONDS,
  M2_GUIDE_REPEAT_DELAY_SECONDS,
  clampGuideLabelPoint,
  getRelativeGuidePoint,
} from './interactionGuide.js'

const TRACE_SELECTOR = '[data-m2-guide-target="trace"]'
const SATELLITE_SELECTOR = '[data-m2-guide-target="satellite"]'

export default function M2InteractionGuide({ active, visitKey, visualRef, language = 'zh' }) {
  const copy = language === 'en'
    ? {
        reduced: 'Drag the Earth or select a target',
        rotate: 'Drag to rotate',
        fall: 'Select a re-entry record',
        satellite: 'Select a historical satellite',
      }
    : {
        reduced: '拖动地球或点击目标查看详情',
        rotate: '拖动旋转',
        fall: '点击坠落记录',
        satellite: '点击历史卫星',
      }
  const rootRef = useRef(null)
  const cursorRef = useRef(null)
  const rippleRef = useRef(null)
  const labelRef = useRef(null)
  const labelIndexRef = useRef(null)
  const labelCopyRef = useRef(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const visual = visualRef.current
    const cursor = cursorRef.current
    const ripple = rippleRef.current
    const label = labelRef.current
    const labelIndex = labelIndexRef.current
    const labelCopy = labelCopyRef.current
    if (!root || !visual || !cursor || !ripple || !label || !labelIndex || !labelCopy) {
      return undefined
    }

    gsap.killTweensOf([root, cursor, ripple, label])

    if (!active) {
      gsap.to(root, { autoAlpha: 0, duration: 0.18, overwrite: true })
      return undefined
    }

    const media = gsap.matchMedia()
    const targetPoint = { current: null }

    const findTarget = (selector) => {
      const candidates = [...visual.querySelectorAll(selector)]
      if (!candidates.length) return null

      const visualRect = visual.getBoundingClientRect()
      const visibleLeft = Math.max(visualRect.left, 0) + 24
      const visibleRight = Math.min(visualRect.right, window.innerWidth) - 24
      const visibleTop = Math.max(visualRect.top, 0) + 24
      const visibleBottom = Math.min(visualRect.bottom, window.innerHeight) - 24
      const idealX = visibleLeft + (visibleRight - visibleLeft) * 0.58
      const idealY = visibleTop + (visibleBottom - visibleTop) * 0.5

      const visibleCandidates = candidates
        .map((element) => {
          const rect = element.getBoundingClientRect()
          const x = rect.left + rect.width / 2
          const y = rect.top + rect.height / 2
          return { element, x, y, score: Math.hypot(x - idealX, y - idealY) }
        })
        .filter(({ x, y }) => (
          x >= visibleLeft && x <= visibleRight && y >= visibleTop && y <= visibleBottom
        ))

      if (selector !== SATELLITE_SELECTOR) return visibleCandidates[0]?.element ?? null
      return visibleCandidates.sort((first, second) => first.score - second.score)[0]?.element ?? null
    }

    const readPoint = (selector, offset = {}) => {
      const target = findTarget(selector)
      if (!target) return null
      return getRelativeGuidePoint(
        visual.getBoundingClientRect(),
        target.getBoundingClientRect(),
        offset,
      )
    }

    const setBeat = (selector, index, copy, offset = {}) => {
      targetPoint.current = readPoint(selector, offset)
      if (!targetPoint.current) {
        gsap.set([cursor, ripple, label], { autoAlpha: 0 })
        return
      }

      labelIndex.textContent = index
      labelCopy.textContent = copy
      const labelPoint = clampGuideLabelPoint(
        targetPoint.current,
        { width: visual.clientWidth, height: visual.clientHeight },
        {
          width: Math.min(label.offsetWidth || 132, 132),
          height: label.offsetHeight || 44,
        },
      )
      gsap.set(label, { x: labelPoint.x, y: labelPoint.y, autoAlpha: 1 })
    }

    const destination = (axis) => () => (
      targetPoint.current?.[axis] ?? (Number(gsap.getProperty(cursor, axis)) || 0)
    )

    const addClickBeat = (timeline, selector, index, copy, travelDuration) => {
      timeline
        .call(() => setBeat(selector, index, copy))
        .to(cursor, {
          x: destination('x'),
          y: destination('y'),
          autoAlpha: () => targetPoint.current ? 1 : 0,
          scale: 1,
          duration: travelDuration,
          ease: 'power3.inOut',
        })
        .call(() => setBeat(selector, index, copy))
        .to(cursor, {
          x: destination('x'),
          y: destination('y'),
          autoAlpha: () => targetPoint.current ? 1 : 0,
          duration: 0.14,
          ease: 'power2.out',
        })
        .to(cursor, { scale: 0.78, duration: 0.12, ease: 'power2.in' })
        .call(() => {
          setBeat(selector, index, copy)
          if (targetPoint.current) {
            gsap.set(cursor, {
              x: targetPoint.current.x,
              y: targetPoint.current.y,
              autoAlpha: 1,
            })
            gsap.fromTo(
              ripple,
              { autoAlpha: 0.72, scale: 0.45 },
              { autoAlpha: 0, scale: 1.55, duration: 0.34, ease: 'power2.out' },
            )
          }
        })
        .to({}, { duration: 0.34 })
        .to(cursor, { scale: 1, duration: 0.2, ease: 'back.out(2)' }, '-=0.18')
    }

    media.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        reduced: '(prefers-reduced-motion: reduce)',
      },
      ({ conditions }) => {
        gsap.set(root, { autoAlpha: 0 })
        gsap.set([cursor, ripple, label], { autoAlpha: 0 })

        if (conditions.reduced) {
          const staticTracePoint = readPoint(TRACE_SELECTOR)
          const staticSelector = staticTracePoint ? TRACE_SELECTOR : SATELLITE_SELECTOR
          const staticPoint = staticTracePoint ?? readPoint(SATELLITE_SELECTOR)
          if (!staticPoint) return undefined
          targetPoint.current = staticPoint
          setBeat(staticSelector, '01', copy.reduced)
          gsap.set(root, { autoAlpha: 0.56 })
          gsap.set(cursor, { x: staticPoint.x, y: staticPoint.y, autoAlpha: 1 })
          return undefined
        }

        let timeline
        let nextLoop

        const playLoop = (delay = 0) => {
          timeline = gsap.timeline({
            delay,
            onComplete: () => {
              nextLoop = gsap.delayedCall(M2_GUIDE_REPEAT_DELAY_SECONDS, () => playLoop())
            },
          })

          timeline
            .set(root, { autoAlpha: 1 })
            .set([cursor, ripple, label], { autoAlpha: 0 })
            .call(() => setBeat(TRACE_SELECTOR, '01', copy.rotate, { x: -38, y: -14 }))
            .to(cursor, {
              x: destination('x'),
              y: destination('y'),
              autoAlpha: () => targetPoint.current ? 1 : 0,
              duration: 0.48,
              ease: 'power3.inOut',
            })
            .to(cursor, { scale: 0.78, duration: 0.12, ease: 'power2.in' })
            .to(ripple, { autoAlpha: 0.58, scale: 0.55, duration: 0.12 }, '<')
            .to(cursor, {
              x: () => (targetPoint.current?.x ?? 0) + 36,
              y: () => (targetPoint.current?.y ?? 0) + 12,
              duration: 0.58,
              ease: 'power2.inOut',
            })
            .to(ripple, { autoAlpha: 0, scale: 1.05, duration: 0.24 }, '<')
            .to(cursor, { scale: 1, duration: 0.2, ease: 'back.out(2)' })

          addClickBeat(timeline, TRACE_SELECTOR, '02', copy.fall, 0.48)
          addClickBeat(timeline, SATELLITE_SELECTOR, '03', copy.satellite, 0.78)
          timeline.to([cursor, ripple, label], { autoAlpha: 0, duration: 0.28 })
        }

        playLoop(M2_GUIDE_ENTER_DELAY_SECONDS)

        return () => {
          timeline?.kill()
          nextLoop?.kill()
        }
      },
      root,
    )

    return () => media.revert()
  }, [active, copy.fall, copy.reduced, copy.rotate, copy.satellite, visitKey, visualRef])

  return (
    <div ref={rootRef} className="m2-interaction-guide" aria-hidden="true">
      <div ref={labelRef} className="m2-interaction-guide-label">
        <span ref={labelIndexRef}>01</span>
        <b ref={labelCopyRef}>{copy.rotate}</b>
      </div>
      <div ref={cursorRef} className="m2-interaction-guide-cursor">
        <i ref={rippleRef} />
        <MousePointer2 size={24} strokeWidth={1.7} />
      </div>
    </div>
  )
}
