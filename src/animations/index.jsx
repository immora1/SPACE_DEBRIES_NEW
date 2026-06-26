import { useEffect, useMemo, useRef, useState } from 'react'

function useRevealOnce(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return undefined
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { rootMargin, threshold: 0.01 })

    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin, visible])

  return [ref, visible]
}

function transitionStyle(visible, delay, duration, transformHidden, extra = {}) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translate3d(0,0,0) rotateX(0deg)' : transformHidden,
    transition: `opacity ${duration}s ease, transform ${duration}s cubic-bezier(0.16, 1, 0.3, 1), filter ${duration}s ease`,
    transitionDelay: `${delay}s`,
    willChange: visible ? 'auto' : 'transform, opacity',
    ...extra,
  }
}

export function AnimateChars({
  text,
  as: Tag = 'h2',
  style,
  className,
  delay = 0,
  stagger = 0.03,
  start: _start = 'top 88%',
}) {
  const [ref, visible] = useRevealOnce()
  const chars = useMemo(() => String(text || '').split(''), [text])

  return (
    <Tag ref={ref} className={className} style={{ perspective: '500px', ...style }}>
      {chars.map((char, index) => (
        <span
          key={`${char}-${index}`}
          style={transitionStyle(
            visible,
            delay + index * stagger,
            0.7,
            'translate3d(0,28px,0) rotateX(-45deg)',
            { display: 'inline-block' },
          )}
        >
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </Tag>
  )
}

export function AnimateWords({
  text,
  as: Tag = 'p',
  style,
  className,
  delay = 0,
  stagger = 0.06,
  start: _start = 'top 90%',
}) {
  const [ref, visible] = useRevealOnce()
  const words = useMemo(() => String(text || '').split(' '), [text])

  return (
    <Tag ref={ref} className={className} style={style}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} style={{ display: 'inline-block' }}>
          <span
            style={transitionStyle(
              visible,
              delay + index * stagger,
              0.6,
              'translate3d(0,18px,0)',
              { display: 'inline-block', filter: visible ? 'blur(0)' : 'blur(4px)' },
            )}
          >
            {word}
          </span>
          {index < words.length - 1 ? '\u00a0' : null}
        </span>
      ))}
    </Tag>
  )
}

export function ScrollReveal({
  children,
  style,
  className,
  delay = 0,
  y = 28,
  duration = 0.7,
  start: _start = 'top 88%',
}) {
  const [ref, visible] = useRevealOnce()

  return (
    <div
      ref={ref}
      className={className}
      style={transitionStyle(visible, delay, duration, `translate3d(0,${y}px,0)`, style)}
    >
      {children}
    </div>
  )
}

export function StaggerList({
  children,
  style,
  className,
  stagger = 0.08,
  y = 24,
  start: _start = 'top 88%',
}) {
  const [ref, visible] = useRevealOnce()

  return (
    <div ref={ref} className={className} style={style}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <div
              key={child?.key ?? index}
              data-stagger
              style={transitionStyle(visible, index * stagger, 0.6, `translate3d(0,${y}px,0)`)}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  )
}