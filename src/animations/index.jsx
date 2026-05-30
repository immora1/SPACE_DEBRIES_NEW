/**
 * 全站动画工具组件
 * - AnimateChars  逐字入场（大标题专用）
 * - AnimateWords  逐词入场（副标题/引言）
 * - ScrollReveal  通用滚动淡入（替代 whileInView）
 * - StaggerList   卡片列表批量入场
 */
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// ── 共用缓动 ──────────────────────────────────────────────────────────────────
const EASE_OUT  = 'power3.out'
const EASE_EXPO = 'expo.out'

// ── AnimateChars — 大标题逐字入场 ────────────────────────────────────────────
/**
 * @param {string}   text       要动画的文字（纯字符串）
 * @param {string}   as         HTML 标签，默认 'h2'
 * @param {object}   style      透传给容器的 style
 * @param {string}   className  透传 className
 * @param {number}   delay      整体延迟（秒），默认 0
 * @param {number}   stagger    字间隔（秒），默认 0.03
 * @param {string}   start      ScrollTrigger start，默认 'top 88%'
 */
export function AnimateChars({
  text,
  as: Tag = 'h2',
  style,
  className,
  delay = 0,
  stagger = 0.03,
  start = 'top 88%',
}) {
  const containerRef = useRef(null)

  useGSAP(() => {
    if (!containerRef.current) return
    const chars = containerRef.current.querySelectorAll('.gsap-char')
    if (!chars.length) return

    gsap.fromTo(
      chars,
      { opacity: 0, y: 32, rotateX: -55, transformOrigin: '50% 0%' },
      {
        opacity: 1, y: 0, rotateX: 0,
        duration: 0.75,
        ease: EASE_EXPO,
        stagger,
        delay,
        scrollTrigger: {
          trigger: containerRef.current,
          start,
          once: true,
        },
      },
    )
  }, { scope: containerRef })

  return (
    <Tag
      ref={containerRef}
      className={className}
      style={{ perspective: '500px', ...style }}
    >
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className="gsap-char"
          style={{ display: 'inline-block', willChange: 'transform, opacity' }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </Tag>
  )
}

// ── AnimateWords — 副标题逐词入场 ────────────────────────────────────────────
/**
 * 支持字符串或 React children（仅纯文本）
 */
export function AnimateWords({
  text,
  as: Tag = 'p',
  style,
  className,
  delay = 0,
  stagger = 0.06,
  start = 'top 90%',
}) {
  const containerRef = useRef(null)

  useGSAP(() => {
    if (!containerRef.current) return
    const words = containerRef.current.querySelectorAll('.gsap-word')
    if (!words.length) return

    gsap.fromTo(
      words,
      { opacity: 0, y: 18, filter: 'blur(4px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)',
        duration: 0.65,
        ease: EASE_OUT,
        stagger,
        delay,
        scrollTrigger: {
          trigger: containerRef.current,
          start,
          once: true,
        },
      },
    )
  }, { scope: containerRef })

  const words = text.split(' ')

  return (
    <Tag ref={containerRef} className={className} style={style}>
      {words.map((word, i) => (
        <span key={i} style={{ display: 'inline-block' }}>
          <span
            className="gsap-word"
            style={{ display: 'inline-block', willChange: 'transform, opacity, filter' }}
          >
            {word}
          </span>
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </Tag>
  )
}

// ── ScrollReveal — 通用区块淡入上移 ─────────────────────────────────────────
/**
 * 替代 Framer Motion whileInView，性能更好
 * @param {number} delay  延迟（秒）
 * @param {number} y      起始 Y 偏移（px），默认 28
 * @param {string} start  ScrollTrigger start，默认 'top 88%'
 */
export function ScrollReveal({
  children,
  style,
  className,
  delay = 0,
  y = 28,
  duration = 0.7,
  start = 'top 88%',
}) {
  const ref = useRef(null)

  useGSAP(() => {
    if (!ref.current) return
    gsap.fromTo(
      ref.current,
      { opacity: 0, y },
      {
        opacity: 1, y: 0,
        duration,
        ease: EASE_OUT,
        delay,
        scrollTrigger: {
          trigger: ref.current,
          start,
          once: true,
        },
      },
    )
  }, { scope: ref })

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform, opacity', ...style }}>
      {children}
    </div>
  )
}

// ── StaggerList — 列表/卡片批量入场 ─────────────────────────────────────────
/**
 * 子元素带 data-stagger 属性时依次进场
 * 用法：在父容器上加 ref，子元素上加 data-stagger（任意值）
 */
export function StaggerList({
  children,
  style,
  className,
  stagger = 0.08,
  y = 24,
  start = 'top 88%',
}) {
  const ref = useRef(null)

  useGSAP(() => {
    if (!ref.current) return
    const items = ref.current.querySelectorAll('[data-stagger]')
    if (!items.length) return

    gsap.fromTo(
      items,
      { opacity: 0, y },
      {
        opacity: 1, y: 0,
        duration: 0.6,
        ease: EASE_OUT,
        stagger,
        scrollTrigger: {
          trigger: ref.current,
          start,
          once: true,
        },
      },
    )
  }, { scope: ref })

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
