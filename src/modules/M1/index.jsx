import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, Suspense } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import DebrisEarth from './DebrisEarth'
import DebrisEarthCountries from './DebrisEarthCountries'
import useI18n from '../../i18n/useI18n'
import './index.css'

const ZH   = "'PingFang SC', 'Microsoft YaHei', sans-serif"
const MONO = "'Space Mono', 'PingFang SC', 'Microsoft YaHei', monospace"
const LEX  = "'Lexend', 'PingFang SC', 'Microsoft YaHei', sans-serif"
const EASE = [0.16, 1, 0.3, 1]

gsap.registerPlugin(SplitText)

const M1_REVEAL_EXCLUSIONS = [
  '[data-m1-no-reveal]',
  '[aria-hidden="true"]',
  'script', 'style', 'svg', 'canvas', 'input', 'textarea', 'select', 'option',
].join(',')

function useM1WordReveal(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const records = new Map()
    let scanFrame = 0

    const reset = (record) => {
      gsap.killTweensOf(record.units)
      if (reduceMotion) {
        gsap.set(record.units, { autoAlpha: 1, y: 0, filter: 'blur(0px)' })
        return
      }
      gsap.set(record.units, {
        autoAlpha: 0,
        y: 18,
        filter: 'blur(7px)',
      })
    }

    const reveal = (record) => {
      if (reduceMotion) {
        gsap.set(record.units, { autoAlpha: 1, y: 0, filter: 'blur(0px)' })
        return
      }

      gsap.to(record.units, {
        autoAlpha: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.72,
        delay: record.delay,
        ease: 'power3.out',
        stagger: { each: 0.035, from: 'start' },
        overwrite: 'auto',
        onStart: () => gsap.set(record.units, { willChange: 'transform, opacity, filter' }),
        onComplete: () => gsap.set(record.units, { clearProps: 'willChange' }),
      })
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const record = records.get(entry.target)
        if (!record) return
        if (entry.isIntersecting) reveal(record)
        else reset(record)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' })

    const getDelay = (element) => {
      const explicit = element.closest('[data-m1-reveal-delay]')?.dataset.m1RevealDelay
      if (explicit !== undefined) return Math.max(0, Number(explicit) || 0)
      const viewportPosition = Math.max(0, element.getBoundingClientRect().top) % window.innerHeight
      return Math.min(0.24, (viewportPosition / window.innerHeight) * 0.24)
    }

    const register = (element) => {
      if (records.has(element) || element.matches(M1_REVEAL_EXCLUSIONS) || element.closest(M1_REVEAL_EXCLUSIONS)) return

      let split = null
      let units = []

      if (element.matches('.sh-line1, .sh-line2, .sh-sub')) {
        units = [...element.querySelectorAll('.sh-char')]
      } else {
        const directText = [...element.childNodes].some(
          node => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
        )
        const onlyLineBreakChildren = [...element.children].every(child => child.tagName === 'BR')
      if (!directText || (element.children.length > 0 && !onlyLineBreakChildren) || element.matches('.sh-char')) return

        element.dataset.m1WordReveal = 'true'
        split = SplitText.create(element, {
          type: 'words,chars',
          wordsClass: 'm1-reveal-word',
          charsClass: 'm1-reveal-char',
          aria: 'auto',
        })
        const text = element.textContent.trim()
        const useWords = !/[\u3400-\u9fff]/.test(text) && /\s/.test(text)
        units = useWords && split.words.length > 1 ? split.words : split.chars
      }

      if (!units.length) {
        split?.revert()
        return
      }

      element.dataset.m1WordReveal = 'true'
      const record = { split, units, delay: getDelay(element) }
      records.set(element, record)
      reset(record)
      observer.observe(element)
    }

    const scan = () => {
      scanFrame = 0
      records.forEach((record, element) => {
        if (element.isConnected) return
        observer.unobserve(element)
        gsap.killTweensOf(record.units)
        records.delete(element)
      })

      root.querySelectorAll('.sh-line1, .sh-line2, .sh-sub, *').forEach(register)
    }

    const scheduleScan = () => {
      if (!scanFrame) scanFrame = window.requestAnimationFrame(scan)
    }

    scan()
    const mutationObserver = new MutationObserver(scheduleScan)
    mutationObserver.observe(root, { childList: true, subtree: true })

    return () => {
      if (scanFrame) window.cancelAnimationFrame(scanFrame)
      mutationObserver.disconnect()
      observer.disconnect()
      records.forEach(({ split, units }) => {
        gsap.killTweensOf(units)
        split?.revert()
      })
      records.clear()
    }
  }, [rootRef])
}

// 字符 span 工厂 — GSAP 通过 .sh-char 选择器批量动画
function charSpans(text) {
  let characterIndex = 0
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)

  return words.map((word, wordIndex) => (
    <span key={`${word}-${wordIndex}`} className="sh-word" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
      {[...word].map((char) => {
        const index = characterIndex++
        return (
          <span key={`${char}-${index}`} className="sh-char" style={{ display: 'inline-block' }}>
            {char}
          </span>
        )
      })}
      {wordIndex < words.length - 1 ? '\u00a0' : null}
    </span>
  ))
}

function M1Backdrop() {
  return (
    <div className="m1-space-backdrop" aria-hidden="true">
      <span className="m1-bg-orbit is-a" />
      <span className="m1-bg-orbit is-b" />
      <span className="m1-bg-orbit is-c" />
      <span className="m1-bg-axis is-vertical" />
      <span className="m1-bg-axis is-diagonal" />
      <span className="m1-bg-axis is-diagonal-alt" />
    </div>
  )
}

const TREND = [
  { year: 1960, count: 100   }, { year: 1970, count: 2000  },
  { year: 1980, count: 5000  }, { year: 1990, count: 8000  },
  { year: 2000, count: 10000 }, { year: 2007, count: 14000 },
  { year: 2009, count: 19000 }, { year: 2015, count: 23000 },
  { year: 2021, count: 36200 }, { year: 2026, count: 46000 },
]

const TIMELINE_EVENTS = [
  {
    year: 1961,
    label: 'Ablestar 火箭级爆炸',
    labelEn: 'Ablestar Rocket Stage Explosion',
    result: '产生近 300 个已识别碎片',
    resultEn: 'Nearly 300 identified fragments',
    raise: 0,
    align: 'start',
  },
  {
    year: 2007,
    label: '风云一号 C 被击毁',
    labelEn: 'Fengyun-1C Destroyed',
    result: '新增 3,300+ 个可追踪碎片',
    resultEn: '3,300+ trackable fragments created',
    raise: 0,
    align: 'start',
  },
  {
    year: 2009,
    label: 'Iridium 33 与 Cosmos 2251 相撞',
    labelEn: 'Iridium 33–Cosmos 2251 Collision',
    result: '产生 2,000+ 个大型碎片',
    resultEn: '2,000+ large fragments created',
    raise: 72,
    align: 'start',
  },
  {
    year: 2021,
    label: 'Cosmos 1408 被击毁',
    labelEn: 'Cosmos 1408 Destroyed',
    result: '产生 1,500+ 个可追踪碎片',
    resultEn: '1,500+ trackable fragments created',
    raise: 36,
    align: 'end',
  },
  {
    year: 2022,
    label: 'CZ-6A 火箭上面级解体',
    labelEn: 'CZ-6A Upper Stage Breakup',
    result: '已编目 793 个大型碎片',
    resultEn: '793 large fragments catalogued',
    raise: 112,
    connectorHeight: 8,
    align: 'end',
  },
]

const timelineYearPct = year => (year - 1960) / (2026 - 1960) * 100

const SIZE_TIERS = [
  {
    size: '> 10 cm', count: '36,500+', label: '可追踪', labelEn: 'Trackable', badge: 'TRACKED',
    desc: '被地面雷达持续编目，卫星需主动规避。当数量超过临界密度，规避消耗的燃料将超过卫星设计寿命所需。',
    descEn: 'Ground radar continuously catalogues these objects, forcing satellites to maneuver. Beyond a critical density, avoidance fuel can exceed the mission reserve.',
    color: '#f87171',
  },
  {
    size: '1 – 10 cm', count: '~500,000', label: '雷达盲区', labelEn: 'Radar blind spot', badge: 'UNDETECTABLE',
    desc: '当前技术无法追踪，也无法预警。一次撞击可在毫秒内摧毁整颗卫星，同时产生数百个新碎片。',
    descEn: 'Current systems cannot reliably track or warn against them. One impact can destroy a satellite in milliseconds and create hundreds of new fragments.',
    color: '#fbbf24',
  },
  {
    size: '< 1 mm', count: '~130M', label: '微粒云', labelEn: 'Particle cloud', badge: 'PERVASIVE',
    desc: '油漆碎片、金属粉尘、冷冻推进剂液滴。无法规避，无法清除，长期侵蚀航天器表面和太阳能电池板。',
    descEn: 'Paint flakes, metal dust, and frozen propellant droplets cannot be avoided or removed, steadily eroding spacecraft surfaces and solar panels.',
    color: '#6b7fff',
  },
]

const COUNTRIES = [
  {
    name: '中国', nameEn: 'CHINA', count: 4471,
    support: '编目在轨碎片', supportEn: 'Catalogued orbital debris',
    detail: '2007 年风云一号 C 反卫星试验产生了大量长期在轨碎片，是目前最大的单一碎片来源之一。',
    detailEn: 'The 2007 Fengyun-1C anti-satellite test created a large cloud of long-lived debris and remains one of the largest individual sources of orbital debris.',
  },
  {
    name: '俄罗斯 / 前苏联', nameEn: 'RUSSIA / USSR', count: 4159,
    support: '编目在轨碎片', supportEn: 'Catalogued orbital debris',
    detail: '长期航天活动留下的废弃火箭级和航天器解体碎片，构成了重要的历史碎片来源。',
    detailEn: 'Decades of space activity, including spent rocket stages and spacecraft breakups, account for a significant share of historical orbital debris.',
  },
  {
    name: '美国', nameEn: 'UNITED STATES', count: 3820,
    support: '编目在轨碎片', supportEn: 'Catalogued orbital debris',
    detail: '废弃火箭级、航天器解体和长期航天活动留下了大量仍在轨运行的碎片。',
    detailEn: 'Spent rocket stages, spacecraft breakups, and debris accumulated over decades of space activity remain important sources of orbital debris.',
  },
  {
    name: '其他国家 / 机构', nameEn: 'OTHER COUNTRIES / ORGANIZATIONS', count: null,
    support: '合计约占 5%', supportEn: 'About 5% combined',
    detail: '法国、印度、日本、欧洲空间局等也产生了编目碎片，但总体数量明显少于前三个来源。',
    detailEn: 'France, India, Japan, ESA, and other space actors also contribute catalogued debris, but in much smaller numbers.',
  },
]

const SOURCES = [
  {
    img: '/source_1.png',
    video: '/Vedio-卫星残骸.mp4',
    title: '碰撞、爆炸产生的碎片', titleEn: 'Fragments from collisions and explosions', label: '01 · ROCKET STAGE',
    meta: [
      { k: '在轨数量', kEn: 'IN ORBIT', v: '>2,000 件', vEn: '>2,000' },
      { k: '危害等级', kEn: 'RISK LEVEL', v: '极高', vEn: 'VERY HIGH', color: '#f87171' },
      { k: '轨道寿命', kEn: 'ORBITAL LIFE', v: '数十至数百年', vEn: 'DECADES–CENTURIES' },
    ],
    desc: '卫星或火箭发生碰撞、爆炸或被击毁时，一个完整物体可能瞬间变成大量碎片。2007 年风云一号 C 被击毁后，就产生了 3,300 多个可追踪碎片。',
    descEn: 'When a satellite or rocket collides, explodes, or is destroyed, one intact object can instantly break into many fragments. After Fengyun-1C was destroyed in 2007, more than 3,300 trackable fragments were created.',
    emphasis: '这类碎裂事件最容易让轨道碎片数量在短时间内快速增加。',
    emphasisEn: 'These fragmentation events are the most likely to cause a rapid increase in debris in a short period of time.',
    detail: '',
    detailEn: '',
  },
  {
    img: '/source_2.png',
    video: '/Video-报废卫星.mp4',
    title: '报废后留在轨道的卫星和火箭', titleEn: 'Retired satellites and rockets left in orbit', label: '02 · DEFUNCT SAT',
    meta: [
      { k: '在轨总量', kEn: 'IN ORBIT', v: '~3,000 颗', vEn: '~3,000' },
      { k: '危害等级', kEn: 'RISK LEVEL', v: '中等', vEn: 'MEDIUM', color: '#fbbf24' },
      { k: '主要分布', kEn: 'MAIN ORBITS', v: 'LEO · GEO', vEn: 'LEO · GEO' },
    ],
    desc: '卫星失效、火箭完成任务后，如果没有及时离轨，就会继续以完整物体留在轨道中。它们通常不会一下产生大量碎片，但未来发生碰撞或解体时，还可能制造新的碎片。',
    descEn: 'After a mission ends, inactive satellites and rocket stages may remain in orbit if they are not removed in time. They do not usually create many fragments at once, but they can become future sources of debris if they later collide or break apart.',
    detail: '',
    detailEn: '',
  },
  {
    img: '/source_3.png',
    video: '/Video-操作遗留.mp4',
    title: '任务中释放或遗落的零件', titleEn: 'Parts released or lost during missions', label: '03 · LEGACY',
    meta: [
      { k: '已编目遗留', kEn: 'CATALOGUED', v: '数万件', vEn: 'TENS OF THOUSANDS' },
      { k: '危害等级', kEn: 'RISK LEVEL', v: '低至中', vEn: 'LOW–MEDIUM', color: '#34d399' },
      { k: '增速', kEn: 'GROWTH', v: '每次任务 +数百', vEn: 'HUNDREDS / MISSION' },
    ],
    desc: '发射、卫星部署或舱外活动过程中，保护盖、适配器、工具等物体可能被释放或意外遗落。这类物体通常零散产生，单次数量较少，但随着任务不断进行，也会逐渐累积。',
    descEn: 'During launch, satellite deployment, or spacewalks, objects such as covers, adapters, and tools may be released or accidentally lost. These objects are usually created in small numbers at a time, but they can still build up over time as more missions take place.',
    detail: '',
    detailEn: '',
  },
]

const ZONE_STATS = [
  { value: '28,000', unit: 'km/h', label: '平均碰撞速度', sub: '子弹速度的 10 倍',
    zone: 'LEO', zoneColor: '#c8d0f8', zoneDesc: '300–2000 KM' },
  { value: '~1.3亿', unit: '',     label: '在轨碎片总量', sub: '大多无法追踪',
    zone: 'MEO', zoneColor: '#8b9fff', zoneDesc: '2K–35K KM' },
  { value: '1957',   unit: '',     label: '轨道污染起点', sub: 'Sputnik 升空同年',
    zone: 'GEO', zoneColor: '#6b7fff', zoneDesc: '35,786 KM' },
]

/* -- Scene 0: Hero -- */
function SceneHero({ normX, normY }) {
  const { language, pick } = useI18n()
  const containerRef = useRef()
  const ghostNumRef  = useRef()
  const ghostX = useTransform(normX, [-1, 1], ['-50px', '50px'])
  const ghostY = useTransform(normY, [-1, 1], ['-28px', '28px'])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const q  = gsap.utils.selector(containerRef)
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    // 顶部标签：从上方 16px 滑入
    tl.from(q('.sh-tag'), { opacity: 0, y: -16, duration: 0.65 }, 0.05)

    // 正文段落：渐入 + 微量上移
    tl.from(q('.sh-body'), { opacity: 0, y: 14, duration: 0.72 }, 0.46)

    // 分割线：从左向右 scaleX 展开
    tl.from(q('.sh-divider'), {
      scaleX: 0, opacity: 0, duration: 0.85,
      transformOrigin: 'left center',
    }, 0.64)

    // ghost 数字 count-up：0 → 28,000（大气装饰）
    const proxy = { val: 0 }
    tl.to(proxy, {
      val: 28000,
      duration: 3.2,
      ease: 'power2.out',
      onUpdate() {
        if (ghostNumRef.current) {
          ghostNumRef.current.textContent = Math.round(proxy.val).toLocaleString()
        }
      },
    }, 0.18)

    // 右侧散落装饰：依次渐入
    tl.from(q('.sh-deco'), {
      opacity: 0, y: 8, stagger: 0.09, duration: 0.72,
    }, 0.56)

    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>

      {/* Ghost parallax 数字 — motion.div 保留视差，内部 span 由 GSAP count-up */}
      <div style={{
        position: 'absolute', top: '44%', left: '60%',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none', userSelect: 'none', zIndex: 0,
      }}>
        <motion.div style={{
          fontFamily: MONO, fontSize: 'clamp(110px,19vw,210px)', fontWeight: 700,
          color: 'rgba(232,232,248,0.018)', letterSpacing: '-0.04em', lineHeight: 1,
          whiteSpace: 'nowrap', x: ghostX, y: ghostY,
        }}>
          <span ref={ghostNumRef} data-m1-no-reveal>0</span>
        </motion.div>
      </div>

      {/* 顶部模块标签 — 外层 div 负责居中定位，内层 .sh-tag 交给 GSAP */}
      <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)' }}>
        <div className="sh-tag" style={{
          fontFamily: LEX, fontSize: 8, fontWeight: 700, color: '#484878',
          letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          {pick('M1 · 太空垃圾是什么', 'M1 · WHAT IS SPACE DEBRIS')}
        </div>
      </div>

      {/* 左侧文字列 */}
      <div className={`m1-hero-copy${language === 'en' ? ' is-en' : ''}`} style={{
        display: 'flex', flexDirection: 'column',
      }}>
        {/* H1 第一行 */}
        <span className="sh-line1" style={{
          display: 'block', perspective: '600px',
          fontFamily: ZH, fontSize: 'var(--m1-hero-title-size)', fontWeight: 700,
          color: '#ffffff', lineHeight: 1.08, marginBottom: 2,
        }}>
          {charSpans(pick('SPACE DEBRIS', 'SPACE DEBRIS'))}
        </span>

        {/* H1 第二行 */}
        <span className="sh-line2" style={{
          display: 'block', perspective: '600px',
          fontFamily: ZH, fontSize: 'var(--m1-hero-headline-size)', fontWeight: 700,
          color: '#ffffff', lineHeight: 1.08, marginBottom: 26,
        }}>
          {charSpans(pick('垃圾，其实已经包围了地球', 'Space debris has already surrounds the Earth.'))}
        </span>

        {/* 细线分割 */}
        <div className="sh-divider" style={{
          height: 1,
          background: 'linear-gradient(to right, rgba(107,127,255,0.45), transparent)',
          marginBottom: 22,
        }} />

        {/* H2 副标题 */}
        <span className="sh-sub" style={{
          display: 'block', perspective: '600px',
          fontFamily: ZH, fontSize: 'var(--m1-hero-sub-size)', fontWeight: 700,
          color: '#ffffff', lineHeight: 1.6, marginBottom: 12,
        }}>
          {charSpans(pick('什么是太空垃圾？', 'What is space debris?'))}
        </span>

        {/* 正文 */}
        <div className="sh-body" style={{
          fontFamily: ZH, fontSize: 'var(--m1-hero-body-size)',
          color: 'rgba(232,232,248,0.48)', lineHeight: 1.9, marginBottom: 36,
        }}>
          {pick(
            '太空垃圾，是仍留在地球轨道上的废弃人造物体，包括报废卫星、火箭部件和各种碎片。它们离我们并不遥远——国际空间站就在约 400 公里高的轨道上运行，而大量碎片也穿行在地球周围，威胁着仍在工作的航天器。',
            'Space debris refers to defunct human-made objects left in Earth orbit, including retired satellites, rocket parts, and fragments. It is closer than it seems—the International Space Station orbits only about 400 km above Earth, while debris continues to travel around the planet, posing collision risks to active spacecraft.',
          )}
        </div>
      </div>

      {/* 右侧散落装饰文字 */}
      <div className="sh-deco" style={{
        position: 'absolute', top: '7%', right: '5%',
        fontFamily: MONO, fontSize: 8, color: '#2a2a4a', letterSpacing: '0.12em',
      }}>
        SINCE 1957
      </div>

      <div className="sh-deco" style={{
        position: 'absolute', top: '28%', right: '3%',
        fontFamily: MONO, fontSize: 8, color: 'rgba(107,127,255,0.18)', letterSpacing: '0.06em',
      }}>
        {language === 'en' ? '~130M FRAGMENTS' : '~1.3亿 FRAGMENTS'}
      </div>

      <div className="sh-deco" style={{
        position: 'absolute', bottom: '28%', right: '5%',
        fontFamily: MONO, fontSize: 8, color: 'rgba(232,232,248,0.10)', letterSpacing: '0.08em',
      }}>
        LEO · MEO · GEO
      </div>

      <div className="sh-deco" style={{
        position: 'absolute', bottom: '14%', right: '8%',
        fontFamily: MONO, fontSize: 8, color: 'rgba(107,127,255,0.14)', letterSpacing: '0.06em',
      }}>
        KESSLER SYNDROME
      </div>

      <div className="sh-deco" style={{
        position: 'absolute', bottom: '5%', right: '4%',
        fontFamily: LEX, fontSize: 8, color: '#2a2a4a', letterSpacing: '0.10em',
      }}>
        — →
      </div>
    </div>
  )
}

/* ── TierGroup (Scene 1) ── */
function TierGroup({ tier, position, rawX, rawY, delay = 0, easing }) {
  const { pick } = useI18n()
  const [near, setNear] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const check = () => {
      if (!ref.current) return
      const r = ref.current.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const dx = rawX.get() - cx, dy = rawY.get() - cy
      setNear(Math.sqrt(dx * dx + dy * dy) < 240)
    }
    const unsubX = rawX.on('change', check)
    const unsubY = rawY.on('change', check)
    return () => { unsubX(); unsubY() }
  }, [rawX, rawY])

  const entryTransition = easing ? { ...easing, delay } : { duration: 0.65, delay }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={entryTransition}
      style={{ position: 'absolute', maxWidth: 310, ...position }}
    >

      {/* Size class label */}
      <div style={{
        fontFamily: LEX, fontSize: 8, fontWeight: 700, color: tier.color,
        letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, opacity: 0.7,
      }}>
        {tier.size}
      </div>

      {/* Accent-bar + count row — bar stretches to match count height via alignItems:stretch */}
      <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 8 }}>
        <motion.div
          animate={{ opacity: near ? 1 : 0.28, scaleY: near ? 1 : 0.6 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: 3, marginRight: 14, borderRadius: 2, flexShrink: 0,
            background: `linear-gradient(to bottom, ${tier.color}, ${tier.color}33)`,
            transformOrigin: 'top',
          }}
        />
        <div style={{
          fontFamily: MONO, fontSize: 'clamp(44px,5.6vw,70px)', fontWeight: 700,
          color: tier.color, letterSpacing: '-0.04em', lineHeight: 1,
        }}>
          {tier.count}
        </div>
      </div>

      {/* Label + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 17 }}>
        <span style={{ fontFamily: ZH, fontSize: 12, color: 'rgba(232,232,248,0.45)' }}>
          {pick(tier.label, tier.labelEn)}
        </span>
        <span style={{
          fontFamily: LEX, fontSize: 7, fontWeight: 700, color: tier.color,
          border: `1px solid ${tier.color}44`, padding: '2px 6px',
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          {tier.badge}
        </span>
      </div>

      {/* Proximity-revealed description */}
      <motion.div
        animate={{ opacity: near ? 1 : 0, y: near ? 0 : 8 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontSize: 11, fontFamily: ZH, color: 'rgba(232,232,248,0.55)',
          lineHeight: 1.85, maxWidth: 270, paddingLeft: 17,
        }}
      >
        {pick(tier.desc, tier.descEn)}
      </motion.div>
    </motion.div>
  )
}

/* ── Scene 1: SCALE ── */
function SceneScale() {
  const { pick } = useI18n()
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

      {/* Section tag */}
      <div style={{
        position: 'absolute', top: '4%', left: '4%', zIndex: 10,
        fontFamily: LEX, fontSize: 8, fontWeight: 700,
        color: 'rgba(107,127,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase',
      }}>
        {pick('01 · SCALE / 规模', '01 · SCALE')}
      </div>

      {/* Left context block */}
      <div style={{
        position: 'absolute', left: '4%', top: '16%', width: '30%', zIndex: 10,
      }}>
        <div
          data-m1-reveal-delay="0.06"
          aria-label={pick('轨道空间，正在变得越来越拥挤', "Earth's orbit is getting increasingly crowded")}
          style={{
            fontFamily: ZH, fontSize: 'clamp(24px,2.8vw,38px)', fontWeight: 700,
            color: '#e8e8f8', lineHeight: 1.22, whiteSpace: 'pre-line', marginBottom: 20,
          }}>
          {pick(
            '轨道空间，\n正在变得越来越拥挤',
            "Earth's orbit is getting increasingly crowded",
          )}
        </div>
        <div style={{
          height: 1, background: 'linear-gradient(to right, rgba(107,127,255,0.35), transparent)',
          marginBottom: 18,
        }} />
        <div data-m1-reveal-delay="0.20" style={{
          fontFamily: ZH, fontSize: 13, color: 'rgba(232,232,248,0.42)',
          lineHeight: 2.0, marginBottom: 16,
        }}>
          {pick(
            <>
              地球轨道中的碎片还在持续积累。目前只有数万个空间物体能够被持续追踪，而 1 mm–1 cm 的小碎片估计已有约 1.4 亿个。地面雷达和光学设备可以观测这些物体，但<strong style={{ fontWeight: 800, color: 'rgba(232,232,248,0.72)' }}>碎片尺寸越小，产生的雷达回波和反射光就越弱，也越难稳定探测并持续确定其轨道。</strong>
            </>,
            <>
              Debris continues to accumulate in Earth orbit. Only tens of thousands of space objects can currently be tracked continuously, while an estimated 140 million fragments measuring 1 mm–1 cm may already be in orbit. Ground-based radar and optical systems can observe these objects, but <strong style={{ fontWeight: 800, color: 'rgba(232,232,248,0.72)' }}>as fragments become smaller, their radar echoes and reflected light become weaker, making them increasingly difficult to detect reliably and track continuously.</strong>
            </>,
          )}
        </div>
      </div>

    </div>
  )
}

/* ── Scene 2: SOURCES ── */
// Zero React state for hover — all DOM mutations via refs + CSS transitions only.
// This eliminates re-renders on every mouse enter/leave (the main lag cause).
function SceneSources() {
  const { pick } = useI18n()
  const panelRefs     = useRef([null, null, null])
  const overlayRefs   = useRef([null, null, null])
  const descRefs      = useRef([null, null, null])
  const detailRefs    = useRef([null, null, null])
  const metaRefs      = useRef([null, null, null])
  const headlineRef   = useRef(null)
  const videoRefs     = useRef([null, null, null])
  const canvasRefs    = useRef([null, null, null])
  const numberDivRefs = useRef([null, null, null])
  const ripplesRef    = useRef([[], [], []])
  const lastPosRef    = useRef([{x:0,y:0},{x:0,y:0},{x:0,y:0}])
  const lastRippleAtRef = useRef([0, 0, 0])
  const panelRectRefs = useRef([null, null, null])
  const activePanelRef = useRef(-1)
  const rafRef        = useRef(null)
  const requestDrawRef = useRef(() => {})
  const sourcesContainerRef = useRef(null)
  const sourcesVisRef       = useRef(false)

  // Draw only the active panel and stop the RAF as soon as its ripples expire.
  useEffect(() => {
    const DOT_GAP   = 26
    const DOT_R     = 1.4
    const DOT_COLOR = 'rgba(107,127,255,0.22)'
    const DPR       = Math.min(window.devicePixelRatio || 1, 1.25)
    const dims      = [{w:0,h:0},{w:0,h:0},{w:0,h:0}]
    const resizeTimers = [null, null, null]
    let lastPaint = 0

    const resizeCanvas = (canvas, panel, i, width, height) => {
      const nextWidth = Math.max(1, Math.round(width * DPR))
      const nextHeight = Math.max(1, Math.round(height * DPR))
      if (canvas.width !== nextWidth) canvas.width = nextWidth
      if (canvas.height !== nextHeight) canvas.height = nextHeight
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      dims[i] = { w: width, h: height }
      panelRectRefs.current[i] = panel.getBoundingClientRect()
      requestDrawRef.current()
    }

    const observers = canvasRefs.current.map((canvas, i) => {
      if (!canvas) return null
      const panel = panelRefs.current[i]
      if (!panel) return null
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (!dims[i].w || !dims[i].h) {
            resizeCanvas(canvas, panel, i, width, height)
            continue
          }
          if (resizeTimers[i]) window.clearTimeout(resizeTimers[i])
          resizeTimers[i] = window.setTimeout(() => {
            resizeTimers[i] = null
            resizeCanvas(canvas, panel, i, width, height)
          }, 90)
        }
      })
      ro.observe(panel)
      return ro
    })

    const draw = (timestamp) => {
      rafRef.current = null
      const activeIndex = activePanelRef.current
      if (!sourcesVisRef.current || activeIndex < 0) return
      if (timestamp - lastPaint < 30) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastPaint = timestamp

      const now = performance.now()
      const canvas = canvasRefs.current[activeIndex]
      const ctx = canvas?.getContext('2d')
      const { w, h } = dims[activeIndex]
      if (!canvas || !ctx || !w || !h) return

      ripplesRef.current[activeIndex] = ripplesRef.current[activeIndex]
        .filter(ripple => (now - ripple.born) < 1200)
      const ripples = ripplesRef.current[activeIndex]

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      ctx.beginPath()

      for (let x = DOT_GAP / 2; x < w; x += DOT_GAP) {
        for (let y = DOT_GAP / 2; y < h; y += DOT_GAP) {
          let scale = 1
          for (const ripple of ripples) {
            const age = (now - ripple.born) / 1000
            const waveFront = age * 220
            const distance = Math.hypot(x - ripple.x, y - ripple.y)
            const difference = Math.abs(distance - waveFront)
            if (difference < 38) {
              const intensity = (1 - difference / 38) * Math.exp(-age * 2.2)
              scale += intensity * 2.8
            }
          }
          const radius = DOT_R * scale
          ctx.moveTo(x + radius, y)
          ctx.arc(x, y, radius, 0, Math.PI * 2)
        }
      }
      ctx.fillStyle = DOT_COLOR
      ctx.fill()

      if (ripples.length > 0) rafRef.current = requestAnimationFrame(draw)
    }

    const requestDraw = () => {
      if (sourcesVisRef.current && activePanelRef.current >= 0 && !rafRef.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }
    requestDrawRef.current = requestDraw

    const srcVisIo = new IntersectionObserver(([entry]) => {
      sourcesVisRef.current = entry.isIntersecting
      if (entry.isIntersecting) {
        requestDraw()
      } else if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }, { rootMargin: '100px' })

    if (sourcesContainerRef.current) {
      srcVisIo.observe(sourcesContainerRef.current)
    } else {
      sourcesVisRef.current = true
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      resizeTimers.forEach(timer => timer && window.clearTimeout(timer))
      observers.forEach(ro => ro && ro.disconnect())
      srcVisIo.disconnect()
      requestDrawRef.current = () => {}
    }
  }, [])

  const applyHover = useCallback((idx) => {
    activePanelRef.current = idx
    if (idx >= 0) {
      panelRectRefs.current[idx] = panelRefs.current[idx]?.getBoundingClientRect() ?? null
      requestDrawRef.current()
    } else {
      ripplesRef.current.forEach((_, index) => { ripplesRef.current[index] = [] })
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    panelRefs.current.forEach((el, j) => {
      if (!el) return
      el.style.flex = idx < 0 ? '1' : j === idx ? '3' : '0.65'
    })
    overlayRefs.current.forEach((el, j) => {
      if (!el) return
      el.style.opacity = idx < 0 ? '0.02' : j === idx ? '0' : '0.20'
    })
    descRefs.current.forEach((el, j) => {
      if (!el) return
      const active = idx >= 0 && j === idx
      el.style.opacity = active ? '1' : '0'
      el.style.transform = active ? 'translateY(0)' : 'translateY(12px)'
    })
    detailRefs.current.forEach((el, j) => {
      if (!el) return
      const active = idx >= 0 && j === idx
      el.style.opacity = active ? '0.88' : '0'
      el.style.transform = active ? 'translateY(0)' : 'translateY(8px)'
    })
    if (headlineRef.current) {
      headlineRef.current.style.opacity = idx < 0 ? '1' : '0'
      headlineRef.current.style.transform =
        `translate(-50%,-50%) translateY(${idx < 0 ? 0 : -8}px)`
    }
    metaRefs.current.forEach((el, j) => {
      if (!el) return
      const active = idx >= 0 && j === idx
      el.style.opacity = active ? '1' : '0'
      el.style.transform = active ? 'translateY(0)' : 'translateY(-4px)'
    })
    videoRefs.current.forEach((el, j) => {
      if (!el) return
      if (idx >= 0 && j === idx) {
        if (el.ended) el.currentTime = 0
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    })
    // Dot grid: show on hovered panel, hidden otherwise
    canvasRefs.current.forEach((el, j) => {
      if (!el) return
      el.style.opacity = (idx >= 0 && j === idx) ? '1' : '0'
    })
    // Ghost number: hide on hovered panel, show on others
    numberDivRefs.current.forEach((el, j) => {
      if (!el) return
      if (idx < 0)        el.style.opacity = '1'
      else if (j === idx) el.style.opacity = '0'
      else                el.style.opacity = '0.6'
    })
  }, [])

  const handleMouseMove = useCallback((e, i) => {
    if (activePanelRef.current !== i) return
    const now = performance.now()
    if (now - lastRippleAtRef.current[i] < 40) return
    const rect = panelRectRefs.current[i]
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const last = lastPosRef.current[i]
    const dx = x - last.x, dy = y - last.y
    if (dx * dx + dy * dy > 144) {
      ripplesRef.current[i].push({ x, y, born: now })
      if (ripplesRef.current[i].length > 6) ripplesRef.current[i].shift()
      lastRippleAtRef.current[i] = now
      requestDrawRef.current()
    }
    lastPosRef.current[i] = { x, y }
  }, [])

  const handlePanelTransitionEnd = useCallback((event, i) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'flex-grow') return
    const panel = panelRefs.current[i]
    if (!panel) return
    panelRectRefs.current[i] = panel.getBoundingClientRect()
    requestDrawRef.current()
  }, [])

  return (
    <div ref={sourcesContainerRef} style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden', background: '#050713' }}>

      {/* Chapter headline */}
      <div
        ref={headlineRef}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 20, pointerEvents: 'none', textAlign: 'center',
          opacity: 1,
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}
      >
        <div style={{
          fontFamily: LEX, fontSize: 8, fontWeight: 700, color: 'rgba(107,127,255,0.5)',
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          {pick('03 · ORIGIN / 来源', '03 · ORIGIN')}
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 'clamp(22px,3vw,38px)', fontWeight: 700,
          color: '#e8e8f8', lineHeight: 1.25, whiteSpace: 'nowrap',
        }}>
          {pick('每次进入太空，都会留下些什么。', 'Every journey into space leaves something behind.')}
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 12, color: '#484878', marginTop: 14, lineHeight: 1.75,
        }}>
          {pick('失效卫星、碰撞碎片、操作性遗留——三种来源，持续积累。', 'Defunct satellites, collision fragments, and operational leftovers continue to accumulate.')}
        </div>
      </div>

      {SOURCES.map((src, i) => (
        <div
          className="m1-source-panel"
          key={i}
          ref={el => { panelRefs.current[i] = el }}
          onMouseEnter={() => applyHover(i)}
          onMouseLeave={() => { applyHover(-1); lastPosRef.current[i] = {x:0,y:0} }}
          onMouseMove={(e) => handleMouseMove(e, i)}
          onTransitionEnd={(event) => handlePanelTransitionEnd(event, i)}
          style={{
            flex: 1, overflow: 'hidden', position: 'relative',
            cursor: 'default', minWidth: 0,
            transition: 'flex 0.55s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Background — video if available, otherwise static image */}
          {src.video ? (
            <video
              className="m1-source-media"
              ref={el => { videoRefs.current[i] = el }}
              src={src.video}
              muted
              playsInline
              preload="metadata"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                opacity: 0.76,
              }}
            />
          ) : (
            <div className="m1-source-media" style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${src.img})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: 0.76,
            }} />
          )}

          {/* Blue tint overlay — static, GPU layer cached */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(5,7,19,0.9), rgba(7,10,25,0.34))',
          }} />

          {/* Brightness overlay — only this animates (opacity = compositor only) */}
          <div
            ref={el => { overlayRefs.current[i] = el }}
            style={{
              position: 'absolute', inset: 0,
              background: '#050713',
              opacity: 0.02,
              transition: 'opacity 0.45s ease',
            }}
          />

          {/* Dot grid canvas — hidden by default, appears on hover with ripple */}
          <canvas
            ref={el => { canvasRefs.current[i] = el }}
            style={{
              position: 'absolute', inset: 0,
              pointerEvents: 'none',
              opacity: 0,
              transition: 'opacity 0.45s ease',
            }}
          />

          {/* Ghost panel number — large faded index, fades when panel is focused */}
          <div
            ref={el => { numberDivRefs.current[i] = el }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              fontFamily: MONO, fontSize: 'clamp(64px,9vw,114px)',
              fontWeight: 700, color: 'rgba(107,127,255,0.08)',
              userSelect: 'none', pointerEvents: 'none',
              letterSpacing: '-0.04em', lineHeight: 1,
              transition: 'opacity 0.45s ease',
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </div>

          {/* Bottom gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(5,7,19,0.93) 0%, rgba(5,7,19,0.14) 52%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {i < SOURCES.length - 1 && (
            <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 1, background: 'rgba(107,127,255,0.12)' }} />
          )}

          {/* Category label */}
          <div className="m1-source-label" style={{
            position: 'absolute', left: 18,
            fontFamily: LEX, fontSize: 7.5, fontWeight: 700,
            color: 'rgba(107,127,255,0.7)', border: '1px solid rgba(107,127,255,0.35)',
            padding: '3px 8px', letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            {src.label}
          </div>

          {/* Meta row — hidden by default, revealed on hover */}
          <div
            className="m1-source-meta"
            ref={el => { metaRefs.current[i] = el }}
            style={{
              position: 'absolute', right: 18,
              display: 'flex', gap: 28, alignItems: 'flex-start',
              opacity: 0, transform: 'translateY(-4px)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
            }}
          >
            {src.meta.map((m, mi) => (
              <div key={mi} style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: LEX, fontSize: 7, fontWeight: 600,
                  color: 'rgba(107,127,255,0.45)', letterSpacing: '0.1em',
                  textTransform: 'uppercase', marginBottom: 4,
                }}>
                  {pick(m.k, m.kEn)}
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700,
                  color: m.color ?? 'rgba(232,232,248,0.72)',
                  letterSpacing: '0.04em',
                }}>
                  {pick(m.v, m.vEn)}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom content */}
          <div style={{ position: 'absolute', bottom: 32, left: 20, right: 20 }}>
            <div style={{
              fontFamily: ZH, fontSize: 26, fontWeight: 700,
              color: '#e8e8f8', marginBottom: 12, lineHeight: 1.25,
            }}>
              {pick(src.title, src.titleEn)}
            </div>

            {/* desc — CSS transition, no Framer Motion */}
            <div
              ref={el => { descRefs.current[i] = el }}
              style={{
                fontFamily: ZH, fontSize: 13, color: 'rgba(232,232,248,0.72)',
                lineHeight: 1.85, marginBottom: 14,
                opacity: 0, transform: 'translateY(12px)',
                transition: 'opacity 0.38s ease, transform 0.38s ease',
              }}
            >
              <span data-m1-no-reveal>{pick(src.desc, src.descEn)}</span>
              {src.emphasis && (
                <>
                  {' '}
                  <strong
                    data-m1-no-reveal
                    style={{ fontWeight: 700, color: 'rgba(232,232,248,0.96)' }}
                  >
                    {pick(src.emphasis, src.emphasisEn)}
                  </strong>
                </>
              )}
            </div>

            {/* detail — staggered via transition-delay */}
            <div
              ref={el => { detailRefs.current[i] = el }}
              style={{
                fontFamily: ZH, fontSize: 11, color: 'rgba(180,190,255,0.52)',
                lineHeight: 1.8,
                borderLeft: '2px solid rgba(107,127,255,0.28)', paddingLeft: 10,
                opacity: 0, transform: 'translateY(8px)',
                transition: 'opacity 0.38s 0.07s ease, transform 0.38s 0.07s ease',
              }}
            >
              {pick(src.detail, src.detailEn)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Scene 3: COUNTRIES ── */
const COUNTRY_COLORS = ['#f87171', '#6b7fff', '#fbbf24', '#8b9fff']
const COUNTRY_ROWS = COUNTRIES.map((country, i) => ({
  ...country,
  color: COUNTRY_COLORS[i],
}))
const TOTAL_CATALOGUED_DEBRIS = '≈ 13,100'


function SceneCountries({ hovIdxRef }) {
  const { language, pick } = useI18n()
  const detailRefs = useRef([null, null, null, null])
  const rowRefs    = useRef([null, null, null, null])
  const cNameRef   = useRef(null)
  const cCountRef  = useRef(null)
  const cPctRef    = useRef(null)

  const applyHover = useCallback((idx) => {
    hovIdxRef.current = idx

    detailRefs.current.forEach((el, j) => {
      if (!el) return
      const on = idx >= 0 && j === idx
      el.style.opacity = on ? '1' : '0'
    })
    rowRefs.current.forEach((el, j) => {
      if (!el) return
      const c  = COUNTRY_ROWS[j].color
      const on = idx >= 0 && j === idx
      el.style.background = on ? `${c}0d` : 'transparent'
      el.style.boxShadow  = on ? `inset 3px 0 0 ${c}` : 'none'
    })
    const selected = idx < 0 ? null : COUNTRY_ROWS[idx]
    if (cNameRef.current)
      cNameRef.current.textContent = selected
        ? pick(selected.name, selected.nameEn)
        : pick('全球总量', 'GLOBAL TOTAL')
    if (cCountRef.current)
      cCountRef.current.textContent = selected
        ? (selected.count ? selected.count.toLocaleString() : pick('约 5%', 'ABOUT 5%'))
        : TOTAL_CATALOGUED_DEBRIS
    if (cPctRef.current)
      cPctRef.current.textContent = selected && !selected.count
        ? pick('合计', 'COMBINED')
        : pick('编目在轨碎片', 'CATALOGUED ORBITAL DEBRIS')
  }, [hovIdxRef, pick])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      {/* Left panel */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: '36%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 4% 0 5%',
      }}>
        <div data-m1-reveal-delay="0.16" style={{
          fontFamily: LEX, fontSize: 8, fontWeight: 700,
          color: 'rgba(107,127,255,0.5)', letterSpacing: '0.18em',
          textTransform: 'uppercase', marginBottom: 10, pointerEvents: 'none',
        }}>
          {pick('02 · CONTRIBUTORS / 各国贡献', '02 · CONTRIBUTORS')}
        </div>
        <div
          data-m1-reveal-delay="0.28"
          aria-label={pick(
            '全球大部分在轨碎片，来自少数几个航天国家',
            'Most orbital debris comes from a small number of spacefaring nations',
          )}
          style={{
            fontFamily: ZH, fontSize: 'clamp(20px,2vw,28px)', fontWeight: 700,
            color: '#e8e8f8', lineHeight: 1.22, maxWidth: 360,
            whiteSpace: 'pre-line', marginBottom: 8, pointerEvents: 'none',
          }}>
          {pick(
            '全球大部分在轨碎片，\n来自少数几个航天国家',
            'Most orbital debris comes from a small number of spacefaring nations',
          )}
        </div>
        <div
          data-m1-reveal-delay="0.42"
          aria-label={pick(
            '中国、俄罗斯及前苏联和美国，是当前编目在轨碎片的三个主要来源。大量碎片来自废弃火箭级、失效航天器，以及历史上的解体、碰撞和反卫星试验。',
            'China, Russia and the former Soviet Union, and the United States are the three largest sources of catalogued orbital debris. Much of it comes from spent rocket stages, defunct spacecraft, breakups, collisions, and past anti-satellite tests.',
          )}
          style={{
            fontFamily: ZH, fontSize: 12, color: 'rgba(185,185,211,0.72)',
            lineHeight: 1.65, maxWidth: 360,
            whiteSpace: 'pre-line', marginBottom: 14, pointerEvents: 'none',
          }}>
          {pick(
            '中国、俄罗斯及前苏联和美国，\n是当前编目在轨碎片的三个主要来源。\n大量碎片来自废弃火箭级、失效航天器，\n以及历史上的解体、碰撞和反卫星试验。',
            'China, Russia and the former Soviet Union, and the United States are the three largest sources of catalogued orbital debris. Much of it comes from spent rocket stages, defunct spacecraft, breakups, collisions, and past anti-satellite tests.',
          )}
        </div>

        {/* Compact country matrix */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          borderTop: '1px solid rgba(107,127,255,0.08)',
          borderBottom: '1px solid rgba(107,127,255,0.08)',
        }}>
          {COUNTRY_ROWS.map((seg, i) => (
            <div key={seg.nameEn}
              data-m1-reveal-delay={0.52 + i * 0.1}
              ref={el => { rowRefs.current[i] = el }}
              style={{
                position: 'relative', minHeight: 112, padding: '14px 14px 12px', cursor: 'pointer',
                borderRight: i % 2 === 0 ? '1px solid rgba(107,127,255,0.07)' : 'none',
                borderBottom: i < 2 ? '1px solid rgba(107,127,255,0.07)' : 'none',
                transition: 'background 0.22s ease, box-shadow 0.22s ease',
              }}
              onMouseEnter={() => applyHover(i)}
              onMouseLeave={() => applyHover(-1)}
            >
              {/* Country header row — index + name */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{
                  flex: '0 0 auto', fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  color: seg.color, opacity: 0.52, lineHeight: 1.6,
                }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{
                  fontFamily: language === 'zh' ? ZH : LEX,
                  fontSize: language === 'zh' ? 16 : 14, fontWeight: 700,
                  color: seg.color, letterSpacing: 0, lineHeight: 1.35,
                }}>{pick(seg.name, seg.nameEn)}</span>
              </div>

              {/* Primary data */}
              <div style={{ marginTop: 12 }}>
                {seg.count ? (
                  <>
                    <div style={{
                      fontFamily: MONO, fontSize: 28, fontWeight: 700,
                      color: '#e8e8f8', letterSpacing: 0, lineHeight: 1,
                    }}>{seg.count.toLocaleString()}</div>
                    <div style={{
                      marginTop: 6, fontFamily: language === 'zh' ? ZH : LEX,
                      fontSize: 10, fontWeight: 500,
                      color: 'rgba(232,232,248,0.42)', lineHeight: 1.4, letterSpacing: 0,
                    }}>{pick(seg.support, seg.supportEn)}</div>
                  </>
                ) : (
                  <div style={{
                    fontFamily: language === 'zh' ? ZH : LEX,
                    fontSize: language === 'zh' ? 15 : 13, fontWeight: 700,
                    color: 'rgba(232,232,248,0.72)', lineHeight: 1.4, letterSpacing: 0,
                  }}>{pick(seg.support, seg.supportEn)}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Shared hover detail keeps the matrix height stable */}
        <div style={{ position: 'relative', height: 38, marginTop: 10, pointerEvents: 'none' }}>
          {COUNTRY_ROWS.map((seg, i) => (
            <div
              key={`detail-${seg.nameEn}`}
              ref={el => { detailRefs.current[i] = el }}
              title={pick(seg.detail, seg.detailEn)}
              style={{
                position: 'absolute', inset: 0,
                fontFamily: ZH, fontSize: 10, color: 'rgba(232,232,248,0.52)',
                lineHeight: 1.65, maxWidth: 360, opacity: 0, overflow: 'hidden',
                display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                transition: 'opacity 0.25s ease',
              }}
            >{pick(seg.detail, seg.detailEn)}</div>
          ))}
        </div>

        {/* Source note */}
        <div style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: ZH, fontSize: 8,
            color: 'rgba(232,232,248,0.3)', lineHeight: 1.5, letterSpacing: 0,
          }}>
            {pick(
              '数据来源：SPACE-TRACK.ORG Satellite Catalog · 统计截至 2025 年 4 月',
              'SPACE-TRACK.ORG Satellite Catalog · Data through April 2025',
            )}
          </div>
        </div>
      </div>
      {/* Stats overlay — 直接用全宽容器，left 精确定位到地球圆心上方 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '61.5%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', zIndex: 10,
        }}>
          <div ref={cCountRef} data-m1-no-reveal style={{
            fontFamily: MONO, fontSize: 36, fontWeight: 700,
            color: '#e8e8f8', letterSpacing: '-0.03em',
          }}>{TOTAL_CATALOGUED_DEBRIS}</div>
          <div ref={cNameRef} data-m1-no-reveal style={{
            fontFamily: LEX, fontSize: 16, fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.8)', letterSpacing: '0.16em',
            textTransform: 'uppercase', marginBottom: 6,
          }}>{pick('全球总量', 'GLOBAL TOTAL')}</div>
          <div ref={cPctRef} data-m1-no-reveal style={{
            fontFamily: LEX, fontSize: 12,
            color: 'rgba(255, 255, 255, 0.8)', letterSpacing: '0.1em',
            marginTop: 4,
          }}>{pick('编目在轨碎片', 'CATALOGUED ORBITAL DEBRIS')}</div>
        </div>
      </div>

    </div>
  )
}

/* ── Trend helpers (module-level, stable across renders) ── */
function trendCountAtYear(year) {
  if (year <= TREND[0].year) return TREND[0].count * Math.max(0, (year - 1957) / (TREND[0].year - 1957))
  if (year >= TREND[TREND.length - 1].year) return TREND[TREND.length - 1].count
  for (let i = 0; i < TREND.length - 1; i++) {
    if (year >= TREND[i].year && year <= TREND[i + 1].year) {
      const t = (year - TREND[i].year) / (TREND[i + 1].year - TREND[i].year)
      return TREND[i].count + t * (TREND[i + 1].count - TREND[i].count)
    }
  }
  return 0
}

function trendBirthYear(idx, total) {
  const maxCount = TREND[TREND.length - 1].count
  // Square-root distribution: early years get proportionally more particles
  // so 1990 (count=8000/46000≈17%) shows ~42% of particles instead of 17%
  const target = Math.pow(idx / total, 2) * maxCount
  if (target <= 0) return 1957
  if (target <= TREND[0].count) return 1957 + (target / TREND[0].count) * (TREND[0].year - 1957)
  if (target >= maxCount) return TREND[TREND.length - 1].year
  for (let j = 0; j < TREND.length - 1; j++) {
    if (target >= TREND[j].count && target <= TREND[j + 1].count) {
      const t = (target - TREND[j].count) / (TREND[j + 1].count - TREND[j].count)
      return TREND[j].year + t * (TREND[j + 1].year - TREND[j].year)
    }
  }
  return TREND[TREND.length - 1].year
}

const SAT_TYPES = ['rect', 'rect', 'round', 'round', 'station', 'cube', 'cube', 'cylinder']

function drawSatelliteShape(ctx, type) {
  if (type === 'rect') {
    ctx.fillRect(-7, -2, 14, 4)
    ctx.beginPath()
    ctx.moveTo(-3, -2); ctx.lineTo(-3, -7); ctx.moveTo(-3, 2); ctx.lineTo(-3, 7)
    ctx.moveTo( 3, -2); ctx.lineTo( 3, -7); ctx.moveTo( 3, 2); ctx.lineTo( 3, 7)
    ctx.moveTo(-6.5, -5.5); ctx.lineTo(6.5, -5.5)
    ctx.moveTo(-6.5,  5.5); ctx.lineTo(6.5,  5.5)
    ctx.stroke()
  } else if (type === 'round') {
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-1.5, -4); ctx.lineTo(-1.5, -8); ctx.moveTo(1.5, -4); ctx.lineTo(1.5, -8)
    ctx.moveTo(-1.5,  4); ctx.lineTo(-1.5,  8); ctx.moveTo(1.5,  4); ctx.lineTo(1.5,  8)
    ctx.moveTo(-4, -6.5); ctx.lineTo(4, -6.5)
    ctx.moveTo(-4,  6.5); ctx.lineTo(4,  6.5)
    ctx.stroke()
  } else if (type === 'station') {
    ctx.fillRect(-14, -1.2, 28, 2.4)   // truss
    ctx.fillRect(-4.5, -4, 9, 8)       // central hab
    ctx.beginPath()
    // Left solar arrays
    ctx.moveTo(-12, -1.2); ctx.lineTo(-12, -6); ctx.moveTo(-12, 1.2); ctx.lineTo(-12, 6)
    ctx.moveTo( -8, -1.2); ctx.lineTo( -8, -6); ctx.moveTo( -8, 1.2); ctx.lineTo( -8, 6)
    // Right solar arrays
    ctx.moveTo(  8, -1.2); ctx.lineTo(  8, -6); ctx.moveTo(  8, 1.2); ctx.lineTo(  8, 6)
    ctx.moveTo( 12, -1.2); ctx.lineTo( 12, -6); ctx.moveTo( 12, 1.2); ctx.lineTo( 12, 6)
    ctx.moveTo(-14, -4.8); ctx.lineTo(-5, -4.8); ctx.moveTo(-14, 4.8); ctx.lineTo(-5, 4.8)
    ctx.moveTo(  5, -4.8); ctx.lineTo(14, -4.8); ctx.moveTo(  5, 4.8); ctx.lineTo(14, 4.8)
    ctx.stroke()
  } else if (type === 'cube') {
    ctx.fillRect(-3.5, -3.5, 7, 7)
    ctx.beginPath()
    ctx.moveTo(-1.2, -3.5); ctx.lineTo(-1.2, -7.5)
    ctx.moveTo( 1.2, -3.5); ctx.lineTo( 1.2, -7.5)
    ctx.moveTo(-3.2, -6); ctx.lineTo(3.2, -6)
    ctx.stroke()
  } else {   // cylinder
    ctx.fillRect(-11, -2, 22, 4)
    ctx.beginPath()
    ctx.moveTo( 7, -1); ctx.lineTo(13, -5)
    ctx.moveTo( 7,  1); ctx.lineTo(13,  5)
    ctx.moveTo(-7, -1); ctx.lineTo(-12, 0)
    ctx.stroke()
  }
}

/* ── Scene 4: TREND — canvas particle accumulation ── */
function SceneTrend() {
  const { pick } = useI18n()
  const canvasRef      = useRef()
  const sceneRef       = useRef()
  const yearRef        = useRef(1960)
  const isUserScrub    = useRef(false)
  const lastStateUpd   = useRef(0)
  const driftRef       = useRef(0)
  const satellitesRef  = useRef([])
  const spawnAccumRef  = useRef(0)
  const trendVisRef    = useRef(false)
  const [displayYear,  setDisplayYear]  = useState(1960)
  const [displayCount, setDisplayCount] = useState(100)

  const particles = useMemo(() => {
    const N = 1200
    let seed = 12345
    const lcg = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0xffffffff
    }
    return Array.from({ length: N }, (_, i) => ({
      birthYear:   trendBirthYear(i, N),
      x:           lcg(),
      y:           0.01 + lcg() * 0.98,
      size:        1.2 + lcg() * 2.8,
      baseOpacity: 0.35 + lcg() * 0.55,
      glow:        lcg() < 0.18,
    })).map(p => ({
      ...p,
      // Larger (closer) particles drift faster; smaller (farther) drift slower — parallax
      driftMult: 0.82 + ((p.size - 1.2) / 2.8) * 0.36,
    }))
  }, [])

  /* Canvas draw loop */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let rafId = 0
    let lastFrameTime = performance.now()
    const draw = (now = performance.now()) => {
      if (!trendVisRef.current) {
        rafId = 0
        return
      }
      const dt = Math.min((now - lastFrameTime) / 1000, 0.05)
      lastFrameTime = now
      // Slow leftward drift — 0.7% of screen width per second (base)
      driftRef.current = (driftRef.current + 0.007 * dt) % 1
      const drift = driftRef.current

      const year = yearRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.shadowBlur = 0
      for (const p of particles) {
        if (p.birthYear > year) continue
        const fade  = Math.min(1, (year - p.birthYear) / 2.5)
        const alpha = p.baseOpacity * fade
        // Per-particle drift speed — larger (closer) particles move faster
        const ex = ((p.x - drift * p.driftMult) % 1 + 1) % 1
        if (p.glow) {
          ctx.shadowBlur  = 7
          ctx.shadowColor = `rgba(107,127,255,${(alpha * 0.8).toFixed(3)})`
        } else {
          ctx.shadowBlur = 0
        }
        ctx.beginPath()
        ctx.arc(ex * canvas.width, p.y * canvas.height, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(107,127,255,${alpha.toFixed(3)})`
        ctx.fill()
      }
      ctx.shadowBlur = 0

      /* ── Satellites ── */
      const cw = canvas.width, ch = canvas.height
      const spawnRate = 0.025 + Math.pow(Math.max(0, year - 1960) / (2026 - 1960), 1.4) * 0.48
      spawnAccumRef.current += spawnRate * dt
      while (spawnAccumRef.current >= 1 && satellitesRef.current.length < 10) {
        spawnAccumRef.current -= 1
        const speed = 90 + Math.random() * 70
        const roll  = Math.random()
        let sx, sy, svx, svy
        if (roll < 0.65) {
          const a = (Math.random() * 22 - 11) * Math.PI / 180
          sx = cw + 20 + Math.random() * 40; sy = Math.random() * ch
          svx = -speed * Math.cos(a); svy = speed * Math.sin(a)
        } else if (roll < 0.82) {
          sx = cw * (0.55 + Math.random() * 0.45); sy = -18
          svx = -(speed * (0.82 + Math.random() * 0.18)); svy = speed * (0.12 + Math.random() * 0.22)
        } else {
          sx = cw * (0.55 + Math.random() * 0.45); sy = ch + 18
          svx = -(speed * (0.82 + Math.random() * 0.18)); svy = -(speed * (0.12 + Math.random() * 0.22))
        }
        satellitesRef.current.push({
          x: sx, y: sy, vx: svx, vy: svy, opacity: 0,
          size: 0.65 + Math.random() * 0.55,
          type: SAT_TYPES[Math.floor(Math.random() * SAT_TYPES.length)],
          trail: [], trailAlpha: 0, bodyGone: false,
        })
      }
      // Keep satellites until their lingering trail fully fades
      satellitesRef.current = satellitesRef.current.filter(s => s.trailAlpha > 0.005 || !s.bodyGone)
      const fadeEdge = 90
      for (const sat of satellitesRef.current) {
        if (!sat.bodyGone) {
          // Record trail point before moving (max 90 points ≈ ~1.5s of travel)
          sat.trail.push({ x: sat.x, y: sat.y })
          if (sat.trail.length > 90) sat.trail.shift()
          sat.x += sat.vx * dt; sat.y += sat.vy * dt
          const rF = sat.x > cw - fadeEdge ? Math.max(0, (cw - sat.x) / fadeEdge) : 1
          const lF = sat.x < fadeEdge      ? Math.max(0, sat.x / fadeEdge)        : 1
          const tF = sat.y < fadeEdge      ? Math.max(0, sat.y / fadeEdge)        : 1
          const bF = sat.y > ch - fadeEdge ? Math.max(0, (ch - sat.y) / fadeEdge) : 1
          sat.opacity = Math.min(rF, lF, tF, bF)
          // Mark body as gone once fully off-screen
          if (sat.x < -120 || sat.x > cw + 120 || sat.y < -120 || sat.y > ch + 120) {
            sat.bodyGone = true
          }
          // Trail alpha tracks body while alive
          sat.trailAlpha = sat.opacity
        } else {
          // Body gone — trail lingers and fades at 0.38/s (≈2.6s fade-out)
          sat.trailAlpha = Math.max(0, sat.trailAlpha - 0.38 * dt)
        }

        // Draw trail
        if (sat.trail.length >= 2) {
          const t0 = sat.trail[0]
          const tEnd = sat.bodyGone ? sat.trail[sat.trail.length - 1] : { x: sat.x, y: sat.y }
          const grad = ctx.createLinearGradient(t0.x, t0.y, tEnd.x, tEnd.y)
          grad.addColorStop(0, 'rgba(140,160,255,0)')
          grad.addColorStop(0.55, `rgba(160,185,255,${(sat.trailAlpha * 0.20).toFixed(3)})`)
          grad.addColorStop(1,    `rgba(210,225,255,${(sat.trailAlpha * 0.60).toFixed(3)})`)
          ctx.beginPath()
          ctx.moveTo(t0.x, t0.y)
          for (let ti = 1; ti < sat.trail.length; ti++) ctx.lineTo(sat.trail[ti].x, sat.trail[ti].y)
          if (!sat.bodyGone) ctx.lineTo(sat.x, sat.y)
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.5 * sat.size
          ctx.shadowBlur = 0
          ctx.stroke()
        }

        // Draw satellite body (only while still on screen)
        if (!sat.bodyGone && sat.opacity > 0.01) {
          const angle = Math.atan2(sat.vy, sat.vx)
          ctx.save()
          ctx.globalAlpha = sat.opacity
          ctx.translate(sat.x, sat.y)
          ctx.rotate(angle)
          ctx.scale(sat.size, sat.size)
          ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(210,225,255,0.9)'
          ctx.fillStyle   = 'rgba(235,242,255,1)'
          ctx.strokeStyle = 'rgba(107,127,255,0.88)'
          ctx.lineWidth   = 1.2
          drawSatelliteShape(ctx, sat.type)
          ctx.restore()
        }
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0

      // State update: throttled only during autoplay; scrub updates are handled in handleMouseMove
      if (!isUserScrub.current) {
        const now = performance.now()
        if (now - lastStateUpd.current > 66) {
          lastStateUpd.current = now
          const y = Math.min(2026, Math.max(1957, year))
          setDisplayYear(Math.floor(y))
          setDisplayCount(Math.round(trendCountAtYear(y)))
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    const visIo = new IntersectionObserver(([entry]) => {
      trendVisRef.current = entry.isIntersecting
      if (entry.isIntersecting) {
        if (!rafId) rafId = requestAnimationFrame(draw)
      } else if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }, { rootMargin: '100px' })

    if (sceneRef.current) {
      visIo.observe(sceneRef.current)
    } else {
      trendVisRef.current = true
      rafId = requestAnimationFrame(draw)
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      ro.disconnect()
      visIo.disconnect()
    }
  }, [particles])

  /* Autoplay 1960 → 2026 in 4s, stops on first mousemove */
  useEffect(() => {
    const dur = 4000, start = performance.now()
    let rafId
    const tick = (now) => {
      if (isUserScrub.current) return
      const t  = Math.min(1, (now - start) / dur)
      const et = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      yearRef.current = 1960 + et * (2026 - 1960)
      if (t < 1) rafId = requestAnimationFrame(tick)
      else yearRef.current = 2026
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!sceneRef.current) return
    isUserScrub.current = true
    const rect = sceneRef.current.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = 1960 + t * (2026 - 1960)
    yearRef.current = y
    // Update display state synchronously on scrub so count always matches year
    setDisplayYear(Math.floor(y))
    setDisplayCount(Math.round(trendCountAtYear(y)))
  }, [])


  return (
    <div ref={sceneRef} style={{ position: 'absolute', inset: 0 }} onMouseMove={handleMouseMove}>

      {/* Header block */}
      <div style={{ position: 'absolute', top: '4%', left: '4%', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{
          fontFamily: LEX, fontSize: 8, fontWeight: 700,
          color: 'rgba(107,127,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          {pick('04 · TIMELINE / 数量趋势', '04 · TIMELINE')}
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 'clamp(22px,2.8vw,34px)', fontWeight: 700,
          color: '#e8e8f8', lineHeight: 1.2, marginBottom: 8,
        }}>
          {pick('轨道碎片的历史积累', 'The accumulation of orbital debris')}
        </div>
        <div style={{ fontFamily: ZH, fontSize: 12, color: '#484878', lineHeight: 1.75, maxWidth: 280 }}>
          {pick('一旦触发凯斯勒效应，链式碰撞将无法逆转。', 'Once the Kessler cascade begins, collision growth may become irreversible.')}
        </div>
      </div>

      {/* Ghost year watermark */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        fontFamily: MONO, fontWeight: 700, fontSize: 'clamp(90px,16vw,180px)',
        color: 'rgba(107,127,255,0.04)', userSelect: 'none', pointerEvents: 'none',
        lineHeight: 1, whiteSpace: 'nowrap', zIndex: 1,
      }}>
        {displayYear}
      </div>

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }} />

      {/* Count readout + persistent hint */}
      <div style={{
        position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', pointerEvents: 'none', zIndex: 10,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 'clamp(36px,5vw,56px)', fontWeight: 700,
          color: '#e8e8f8', letterSpacing: '-0.03em', lineHeight: 1,
        }}>
          {displayCount.toLocaleString()}
        </div>
        <div style={{
          fontFamily: LEX, fontSize: 8, fontWeight: 700, color: '#6b7fff',
          letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6,
        }}>
          {pick('跟踪对象', 'TRACKED OBJECTS')}
        </div>

        {/* Interaction hint — permanent, lives below the count label */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {/* Track rail with bouncing dot */}
          <div style={{ position: 'relative', width: 160, height: 2 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(107,127,255,0.35)', borderRadius: 1 }} />
            <div style={{ position: 'absolute', left: -3, top: '50%',
              width: 5, height: 5, borderLeft: '1.5px solid rgba(107,127,255,0.55)', borderBottom: '1.5px solid rgba(107,127,255,0.55)',
              transform: 'translateY(-50%) rotate(45deg)' }} />
            <div style={{ position: 'absolute', right: -3, top: '50%',
              width: 5, height: 5, borderRight: '1.5px solid rgba(107,127,255,0.55)', borderTop: '1.5px solid rgba(107,127,255,0.55)',
              transform: 'translateY(-50%) rotate(45deg)' }} />
            <motion.div
              animate={{ left: ['8%', '88%', '8%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                width: 6, height: 6, borderRadius: '50%',
                background: '#6b7fff', boxShadow: '0 0 8px rgba(107,127,255,0.8)',
              }}
            />
          </div>
          <div style={{
            fontFamily: LEX, fontSize: 11, fontWeight: 600,
            color: 'rgba(140,160,255,0.8)', letterSpacing: '0.06em', whiteSpace: 'nowrap',
          }}>
            {pick('横向移动鼠标，穿越历史时间轴', 'MOVE HORIZONTALLY THROUGH THE TIMELINE')}
          </div>
        </div>
      </div>

      {/* Year axis + timeline event markers */}
      <div style={{
        position: 'absolute', bottom: '3%', left: '4%', right: '4%',
        zIndex: 10, pointerEvents: 'none',
      }}>
        {/* Event callout cards — anchored by year position */}
        <AnimatePresence>
          {TIMELINE_EVENTS.map(ev => {
            if (displayYear < ev.year) return null
            const pct = timelineYearPct(ev.year)
            const defaultTickH = 8 + (ev.raise || 0)
            const tickH = ev.connectorHeight ?? defaultTickH
            const markerBottom = 22 + (ev.raise || 0) + (defaultTickH - tickH)
            const isEndAligned = ev.align === 'end'
            const alignSelf = ev.align === 'start'
              ? 'flex-start'
              : isEndAligned
                ? 'flex-end'
                : 'center'
            return (
              <motion.div key={ev.year}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute',
                  bottom: markerBottom,
                  left: `${pct}%`,
                  width: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
              >
                <div style={{
                  alignSelf,
                  borderLeft: isEndAligned ? 'none' : '1px solid rgba(255,255,255,0.30)',
                  borderRight: isEndAligned ? '1px solid rgba(255,255,255,0.30)' : 'none',
                  paddingLeft: isEndAligned ? 0 : 8,
                  paddingRight: isEndAligned ? 8 : 0,
                  paddingBottom: 6, whiteSpace: 'nowrap',
                  textAlign: isEndAligned ? 'right' : 'left',
                }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 12, fontWeight: 500,
                    color: 'rgba(255,255,255,0.70)', lineHeight: 1.2,
                  }}>
                    {ev.year}
                  </div>
                  <div style={{
                    fontFamily: ZH, fontSize: 17, fontWeight: 700,
                    color: 'rgba(255,255,255,0.95)', marginTop: 6, lineHeight: 1.25,
                  }}>
                    {pick(ev.label, ev.labelEn)}
                  </div>
                  <div style={{
                    fontFamily: ZH, fontSize: 12, fontWeight: 500,
                    color: 'rgba(255,255,255,0.65)', marginTop: 6, lineHeight: 1.3,
                  }}>
                    {pick(ev.result, ev.resultEn)}
                  </div>
                </div>
                <div style={{
                  width: 1, height: tickH,
                  background: 'rgba(255,255,255,0.25)',
                  boxShadow: '0 0 4px rgba(255,255,255,0.12)',
                }} />
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Year label row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {[1960, 1970, 1980, 1990, 2000, 2010, 2020, 2026].map(y => (
            <div key={y} style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', whiteSpace: 'nowrap',
              color: 'rgba(180,190,220,0.75)', fontWeight: 500,
            }}>
              {y}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


/* ── Main M1 ── */
export default function M1() {
  const containerRef         = useRef()
  const sideEarthWrapRef     = useRef()
  const countryEarthWrapRef  = useRef()
  const countriesTextRef     = useRef()
  const countriesProgressRef = useRef(0)
  const hovIdxRef            = useRef(-1)
  const [scaleVisible, setScaleVisible] = useState(false)
  const scaleRef = useRef()

  useM1WordReveal(containerRef)

  const rawX    = useMotionValue(0)
  const rawY    = useMotionValue(0)
  const normX   = useTransform(rawX, [0, typeof window !== 'undefined' ? window.innerWidth  : 1], [-1, 1])
  const normY   = useTransform(rawY, [0, typeof window !== 'undefined' ? window.innerHeight : 1], [-1, 1])

  useEffect(() => {
    const h = e => { rawX.set(e.clientX); rawY.set(e.clientY) }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [rawX, rawY])

  // 在首次绘制前同步设置过渡层初始 opacity，防止 React 重渲染覆盖 DOM 修改
  useLayoutEffect(() => {
    if (countryEarthWrapRef.current) countryEarthWrapRef.current.style.opacity = '0'
    if (countriesTextRef.current)    countriesTextRef.current.style.opacity    = '0'
  }, [])

  const m1InViewRef = useRef(false)

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      m1InViewRef.current = entry.isIntersecting
    }, { threshold: 0.01 })
    if (containerRef.current) io.observe(containerRef.current)
    return () => io.disconnect()
  }, [])

  // IntersectionObserver: Scale 注释随文字进入视口显示
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setScaleVisible(e.isIntersecting), { threshold: 0.4 })
    if (scaleRef.current) io.observe(scaleRef.current)
    return () => io.disconnect()
  }, [])

  // Scroll crossfade: 1.6vh–2.0vh（Scale 末尾开始，Countries 文字进入时已完成）
  // 文字与 3D 模型同步淡入，前后两个地球不同时可见
  useEffect(() => {
    const FADE_START = 1.6
    const FADE_DUR   = 0.4  // 40% vh 完成切换
    const onScroll = () => {
      if (!m1InViewRef.current) return
      const container = containerRef.current
      if (!container) return
      const scrolled = -container.getBoundingClientRect().top
      const vh = window.innerHeight
      const raw = (scrolled - FADE_START * vh) / (FADE_DUR * vh)
      const p   = Math.max(0, Math.min(1, raw))
      countriesProgressRef.current = p
      if (sideEarthWrapRef.current)
        sideEarthWrapRef.current.style.opacity    = String(1 - p)
      if (countryEarthWrapRef.current)
        countryEarthWrapRef.current.style.opacity = String(p)
      if (countriesTextRef.current)
        countriesTextRef.current.style.opacity    = String(p)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()  // 初始化，防止刷新后状态残留
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const s = { height: '100vh', position: 'relative', overflow: 'hidden', background: 'transparent' }

  return (
    <div ref={containerRef} className="m1-root" data-module-scroll-target style={{ position: 'relative', cursor: 'auto' }}>
      <M1Backdrop />

      {/* Section 0–2: 400vh 容器，sticky Earth 在前三页共享 */}
      <div style={{ position: 'relative', height: '400vh', background: 'transparent' }}>

        {/* 粘性地球层：两层叠加，scroll 驱动淡入淡出 */}
        <div style={{
          position: 'sticky', top: 0, height: '100vh',
          zIndex: 1, pointerEvents: 'none', overflow: 'hidden',
        }}>
          {/* 侧视地球 (Hero + Scale)：进入 Countries 时淡出 */}
          <div ref={sideEarthWrapRef} style={{ position: 'absolute', inset: 0 }}>
            <DebrisEarth showAnnotations={scaleVisible} />
          </div>
          {/* 俯视地球 (Countries)：进入 Countries 时淡入，相机 45°→90° 弧线 */}
          <div ref={countryEarthWrapRef} style={{ position: 'absolute', inset: 0 }}>
            <DebrisEarthCountries hovIdxRef={hovIdxRef} progressRef={countriesProgressRef} />
          </div>
        </div>

        {/* Hero 文字 — 第一个 100vh */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '100vh',
          zIndex: 3, overflow: 'hidden',
        }}>
          <SceneHero normX={normX} normY={normY} />
        </div>

        {/* Scale 文字 — 第二个 100vh */}
        <div ref={scaleRef} style={{
          position: 'absolute', top: '100vh', left: 0, right: 0, height: '100vh',
          zIndex: 3, overflow: 'hidden',
        }}>
          <SceneScale />
        </div>

        {/* Countries 文字 — 200vh，填满 400vh 容器末尾，内部 sticky 让内容固定 100vh */}
        <div ref={countriesTextRef} style={{
          position: 'absolute', top: '200vh', left: 0, right: 0, height: '200vh',
          zIndex: 3,
        }}>
          <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
            <SceneCountries hovIdxRef={hovIdxRef} />
          </div>
        </div>

      </div>
      <div style={{ ...s, position: 'relative' }}>
        <SceneTrend />
      </div>
      <div style={s}><SceneSources /></div>

    </div>
  )
}
