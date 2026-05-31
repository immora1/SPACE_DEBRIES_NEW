import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, Suspense } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import useAppStore from '../../store/useAppStore'
import DebrisEarth from './DebrisEarth'
import DebrisEarthCountries from './DebrisEarthCountries'

const ZH   = "'PingFang SC', 'Microsoft YaHei', sans-serif"
const MONO = "'Space Mono', monospace"
const LEX  = "'Lexend', sans-serif"
const EASE = [0.16, 1, 0.3, 1]

// 字符 span 工厂 — GSAP 通过 .sh-char 选择器批量动画
function charSpans(text) {
  return text.split('').map((ch, i) => (
    <span key={i} className="sh-char" style={{ display: 'inline-block', willChange: 'transform, opacity, filter' }}>
      {ch}
    </span>
  ))
}

const TREND = [
  { year: 1960, count: 100   }, { year: 1970, count: 2000  },
  { year: 1980, count: 5000  }, { year: 1990, count: 8000  },
  { year: 2000, count: 10000 }, { year: 2007, count: 14000 },
  { year: 2009, count: 19000 }, { year: 2015, count: 23000 },
  { year: 2021, count: 36200 }, { year: 2026, count: 46000 },
]

const TREND_EVENTS = {
  2007: { label: '风云一号C', detail: '中国反卫星武器测试，单次制造碎片最多的人为事件。', delta: '+3,500' },
  2009: { label: '铱星-33 × Cosmos-2251', detail: '首次大型卫星间高速碰撞，凯斯勒效应的现实验证。', delta: '+2,000' },
}

const TIMELINE_EVENTS = [
  { year: 1978, label: 'Kosmos 954 坠落', delta: '首次核污染', color: '#fbbf24', raise: 0 },
  { year: 1996, label: 'Cerise 首例碰撞', delta: '人类历史首次', color: '#a78bfa', raise: 0 },
  { year: 2007, label: '风云一号C', delta: '+3,500', color: '#f87171', raise: 0 },
  { year: 2009, label: '铱星-33 × Cosmos', delta: '+2,000', color: '#6b7fff', raise: 56 },
  { year: 2021, label: 'Starlink 扩张', delta: '+4,000', color: '#34d399', raise: 0 },
]

const SIZE_TIERS = [
  {
    size: '> 10 cm', count: '36,500+', label: '可追踪', badge: 'TRACKED',
    desc: '被地面雷达持续编目，卫星需主动规避。当数量超过临界密度，规避消耗的燃料将超过卫星设计寿命所需。',
    color: '#f87171',
  },
  {
    size: '1 – 10 cm', count: '~500,000', label: '雷达盲区', badge: 'UNDETECTABLE',
    desc: '当前技术无法追踪，也无法预警。一次撞击可在毫秒内摧毁整颗卫星，同时产生数百个新碎片。',
    color: '#fbbf24',
  },
  {
    size: '< 1 mm', count: '~1.3 亿', label: '微粒云', badge: 'PERVASIVE',
    desc: '油漆碎片、金属粉尘、冷冻推进剂液滴。无法规避，无法清除，长期侵蚀航天器表面和太阳能电池板。',
    color: '#6b7fff',
  },
]

const COUNTRIES = [
  { name: 'USA',          count: 25786, detail: '含冷战时期大量测试碎片和现役商业卫星遗留' },
  { name: 'RUSSIA / CIS', count: 25144, detail: '苏联时代军事卫星残骸占主要来源' },
  { name: 'CHINA',        count: 8774,  detail: '2007 年反卫星测试单次贡献约 3,500 块' },
  { name: 'OTHERS',       count: 6528,  detail: '欧洲、日本、印度等国家的卫星遗留' },
]

const SOURCES = [
  {
    img: '/source_1.png',
    video: '/Vedio-卫星残骸.mp4',
    title: '火箭残骸', label: '01 · ROCKET STAGE',
    meta: [
      { k: '在轨数量',  v: '>2,000 件' },
      { k: '危害等级',  v: '极高',   color: '#f87171' },
      { k: '轨道寿命',  v: '数十至数百年' },
    ],
    desc: '每次发射后被抛弃的上面级火箭是单体最大的轨道碎片来源。残余推进剂遇热膨胀会引发在轨自爆，毫秒间释放数百件新弹片——碰撞与爆炸级联效应的主要触发机制正源于此。',
    detail: '苏联 Zenit 上面级长达 9 米，至今漂浮于 LEO。2007 年中国反卫试验在 850 km 轨道带制造了超 3,500 件可追踪碎片，是史上最大单次人为增量事件，至今仍是 ISS 规避机动的主要威胁源之一。',
  },
  {
    img: '/source_2.png',
    video: '/Video-报废卫星.mp4',
    title: '废弃卫星', label: '02 · DEFUNCT SAT',
    meta: [
      { k: '在轨总量',  v: '~3,000 颗' },
      { k: '危害等级',  v: '中等',   color: '#fbbf24' },
      { k: '主要分布',  v: 'LEO · GEO' },
    ],
    desc: '失去姿态控制的金属残骸在轨道上无序翻滚，无法操控，无法清除。大型废弃卫星本身就是潜在碰撞目标——2009 年铱星 33 与报废的 Cosmos 2251 相撞，单次产生超 2,000 件可追踪碎片。',
    detail: '欧空局 Envisat 重达 8 吨，2012 年通讯中断后仍以 800 km 高度每 98 分钟绕地一周，无法机动规避。LEO 区域超过 3,000 颗已失效卫星中，数百颗体积超过一辆汽车，任何一次碰撞都可触发凯斯勒效应链式反应。',
  },
  {
    img: '/source_3.png',
    video: '/Video-操作遗留.mp4',
    title: '操作遗留', label: '03 · LEGACY',
    meta: [
      { k: '已编目遗留', v: '数万件' },
      { k: '危害等级',   v: '低至中',  color: '#34d399' },
      { k: '增速',       v: '每次任务 +数百' },
    ],
    desc: '丢失的手套、螺栓、镜头盖，乃至分离的火箭级段——人类每一次进入太空都会留下些什么。这不是事故，而是现有工程流程无法消除的结构性副产品，且随任务频率加速积累。',
    detail: '1965 年 Ed White 太空行走时丢失一只手套，此类遗失至今仍在发生。ISS 各次 EVA 已记录逾 100 件工具及硬件遗失。油漆碎片以 7 km/s 撞击玻璃的冲击力等同于一颗子弹，是低轨航天器表面损伤的首要来源。',
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

/* ── CustomCursor ── */
function CustomCursor({ mouseX, mouseY, smoothX, smoothY }) {
  const dotL  = useTransform(mouseX,  v => v - 3)
  const dotT  = useTransform(mouseY,  v => v - 3)
  const ringL = useTransform(smoothX, v => v - 16)
  const ringT = useTransform(smoothY, v => v - 16)
  return (
    <>
      <motion.div style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 9999,
        width: 6, height: 6, borderRadius: '50%', background: '#e8e8f8',
        left: dotL, top: dotT,
      }} />
      <motion.div style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 9998,
        width: 32, height: 32, borderRadius: '50%',
        border: '1px solid rgba(107,127,255,0.55)',
        left: ringL, top: ringT,
      }} />
    </>
  )
}

/* ── Scene 0: HERO — GSAP timeline ── */
function SceneHero({ normX, normY }) {
  const containerRef = useRef()
  const ghostNumRef  = useRef()
  const ghostX = useTransform(normX, [-1, 1], ['-50px', '50px'])
  const ghostY = useTransform(normY, [-1, 1], ['-28px', '28px'])

  useGSAP(() => {
    const q  = gsap.utils.selector(containerRef)
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    // 顶部标签：从上方 16px 滑入
    tl.from(q('.sh-tag'), { opacity: 0, y: -16, duration: 0.65 }, 0.05)

    // H1 第一行：逐字 3D 翻转入场（X 轴旋转 + 上移 + 模糊）
    tl.from(q('.sh-line1 .sh-char'), {
      opacity: 0, y: 44, rotationX: -75, filter: 'blur(6px)',
      stagger: { each: 0.055, ease: 'power2.inOut' },
      duration: 0.82,
    }, 0.10)

    // H1 第二行：稍晚 0.22s
    tl.from(q('.sh-line2 .sh-char'), {
      opacity: 0, y: 44, rotationX: -75, filter: 'blur(6px)',
      stagger: { each: 0.055, ease: 'power2.inOut' },
      duration: 0.82,
    }, 0.32)

    // 正文段落：渐入 + 微量上移
    tl.from(q('.sh-body'), { opacity: 0, y: 14, duration: 0.72 }, 0.46)

    // 分割线：从左向右 scaleX 展开
    tl.from(q('.sh-divider'), {
      scaleX: 0, opacity: 0, duration: 0.85,
      transformOrigin: 'left center',
    }, 0.64)

    // H2 副标题：逐字翻转，节奏更紧凑
    tl.from(q('.sh-sub .sh-char'), {
      opacity: 0, y: 36, rotationX: -65, filter: 'blur(5px)',
      stagger: { each: 0.042, ease: 'power2.inOut' },
      duration: 0.78,
    }, 0.78)

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

  }, { scope: containerRef })

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
          <span ref={ghostNumRef}>0</span>
        </motion.div>
      </div>

      {/* 顶部模块标签 — 外层 div 负责居中定位，内层 .sh-tag 交给 GSAP */}
      <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)' }}>
        <div className="sh-tag" style={{
          fontFamily: LEX, fontSize: 8, fontWeight: 700, color: '#484878',
          letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          M1 · 太空垃圾是什么
        </div>
      </div>

      {/* 左侧文字列 */}
      <div style={{
        position: 'absolute', left: '6%', top: '13%', width: '44%',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* H1 第一行 */}
        <span className="sh-line1" style={{
          display: 'block', perspective: '600px',
          fontFamily: ZH, fontSize: 'clamp(50px,7.2vw,78px)', fontWeight: 700,
          color: '#ffffff', lineHeight: 1.08, marginBottom: 2,
        }}>
          {charSpans('太空垃圾')}
        </span>

        {/* H1 第二行 */}
        <span className="sh-line2" style={{
          display: 'block', perspective: '600px',
          fontFamily: ZH, fontSize: 'clamp(50px,7.2vw,78px)', fontWeight: 700,
          color: '#ffffff', lineHeight: 1.08, marginBottom: 26,
        }}>
          {charSpans('不是比喻，')}
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
          fontFamily: ZH, fontSize: 18, fontWeight: 700,
          color: '#ffffff', lineHeight: 1.6, marginBottom: 12,
        }}>
          {charSpans('是真实存在的物理威胁。')}
        </span>

        {/* 正文 */}
        <div className="sh-body" style={{
          fontFamily: ZH, fontSize: 13,
          color: 'rgba(232,232,248,0.48)', lineHeight: 1.9, marginBottom: 36,
        }}>
          自 1957 年第一颗卫星升空，人类已在轨道上累积了数以亿计的碎片。
          它们以超音速运行，无法回收，无法清除，且持续增加。
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
        ~1.3亿 FRAGMENTS
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
          {tier.label}
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
        {tier.desc}
      </motion.div>
    </motion.div>
  )
}

/* ── Scene 1: SCALE ── */
function SceneScale() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

      {/* Section tag */}
      <div style={{
        position: 'absolute', top: '4%', left: '4%', zIndex: 10,
        fontFamily: LEX, fontSize: 8, fontWeight: 700,
        color: 'rgba(107,127,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase',
      }}>
        01 · SCALE / 规模
      </div>

      {/* Left context block */}
      <div style={{
        position: 'absolute', left: '4%', top: '16%', width: '30%', zIndex: 10,
      }}>
        <div style={{
          fontFamily: ZH, fontSize: 'clamp(24px,2.8vw,38px)', fontWeight: 700,
          color: '#e8e8f8', lineHeight: 1.22, marginBottom: 20,
        }}>
          轨道碎片不是假设，<br />是已成事实的威胁。
        </div>
        <div style={{
          height: 1, background: 'linear-gradient(to right, rgba(107,127,255,0.35), transparent)',
          marginBottom: 18,
        }} />
        <div style={{
          fontFamily: ZH, fontSize: 13, color: 'rgba(232,232,248,0.42)',
          lineHeight: 2.0, marginBottom: 16,
        }}>
          速度让每次碰撞具有毁灭性，<br />
          数量让规避几乎不可能，<br />
          不可见性让预警成为奢望。
        </div>
        <div style={{ fontFamily: ZH, fontSize: 11, color: '#484878', lineHeight: 1.75 }}>
          自 1957 年持续累积，目前尚无有效的批量清除方案。
        </div>
      </div>

    </div>
  )
}

/* ── Scene 2: SOURCES ── */
// Zero React state for hover — all DOM mutations via refs + CSS transitions only.
// This eliminates re-renders on every mouse enter/leave (the main lag cause).
function SceneSources() {
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
  const rafRef        = useRef(null)
  const sourcesContainerRef = useRef(null)
  const sourcesVisRef       = useRef(false)

  // Canvas dot-grid + ripple RAF loop
  useEffect(() => {
    const DOT_GAP   = 24
    const DOT_R     = 1.4
    const DOT_COLOR = 'rgba(107,127,255,0.22)'
    const dims      = [{w:0,h:0},{w:0,h:0},{w:0,h:0}]

    const observers = canvasRefs.current.map((canvas, i) => {
      if (!canvas) return null
      const panel = panelRefs.current[i]
      if (!panel) return null
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          const dpr = window.devicePixelRatio || 1
          canvas.width  = Math.round(width  * dpr)
          canvas.height = Math.round(height * dpr)
          canvas.style.width  = width  + 'px'
          canvas.style.height = height + 'px'
          dims[i] = { w: width, h: height }
        }
      })
      ro.observe(panel)
      return ro
    })

    const srcVisIo = new IntersectionObserver(([e]) => { sourcesVisRef.current = e.isIntersecting }, { rootMargin: '100px' })
    if (sourcesContainerRef.current) srcVisIo.observe(sourcesContainerRef.current)

    const draw = () => {
      if (!sourcesVisRef.current) { rafRef.current = requestAnimationFrame(draw); return }
      const now = performance.now()
      canvasRefs.current.forEach((canvas, i) => {
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const { w, h } = dims[i]
        if (!w || !h) return
        const dpr = window.devicePixelRatio || 1
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.scale(dpr, dpr)

        // Expire ripples older than 1.2 s
        ripplesRef.current[i] = ripplesRef.current[i].filter(r => (now - r.born) < 1200)

        const ripples = ripplesRef.current[i]
        for (let x = DOT_GAP / 2; x < w; x += DOT_GAP) {
          for (let y = DOT_GAP / 2; y < h; y += DOT_GAP) {
            let scale = 1
            for (const r of ripples) {
              const age      = (now - r.born) / 1000
              const waveFront = age * 220
              const dist     = Math.hypot(x - r.x, y - r.y)
              const diff     = Math.abs(dist - waveFront)
              if (diff < 38) {
                const intensity = (1 - diff / 38) * Math.exp(-age * 2.2)
                scale += intensity * 2.8
              }
            }
            ctx.beginPath()
            ctx.arc(x, y, DOT_R * scale, 0, Math.PI * 2)
            ctx.fillStyle = DOT_COLOR
            ctx.fill()
          }
        }
        ctx.restore()
      })
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      observers.forEach(ro => ro && ro.disconnect())
      srcVisIo.disconnect()
    }
  }, [])

  const applyHover = useCallback((idx) => {
    panelRefs.current.forEach((el, j) => {
      if (!el) return
      el.style.flex = idx < 0 ? '1' : j === idx ? '3' : '0.65'
    })
    overlayRefs.current.forEach((el, j) => {
      if (!el) return
      el.style.opacity = idx < 0 ? '0.42' : j === idx ? '0' : '0.62'
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
        el.currentTime = 0
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
    const panel = panelRefs.current[i]
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const last = lastPosRef.current[i]
    const dx = x - last.x, dy = y - last.y
    if (dx * dx + dy * dy > 16) {
      ripplesRef.current[i].push({ x, y, born: performance.now() })
      if (ripplesRef.current[i].length > 10) ripplesRef.current[i].shift()
    }
    lastPosRef.current[i] = { x, y }
  }, [])

  return (
    <div ref={sourcesContainerRef} style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>

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
          03 · ORIGIN / 来源
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 'clamp(22px,3vw,38px)', fontWeight: 700,
          color: '#e8e8f8', lineHeight: 1.25, whiteSpace: 'nowrap',
        }}>
          每次进入太空，都会留下些什么。
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 12, color: '#484878', marginTop: 14, lineHeight: 1.75,
        }}>
          失效卫星、碰撞碎片、操作性遗留——三种来源，持续积累。
        </div>
      </div>

      {SOURCES.map((src, i) => (
        <div
          key={i}
          ref={el => { panelRefs.current[i] = el }}
          onMouseEnter={() => applyHover(i)}
          onMouseLeave={() => { applyHover(-1); lastPosRef.current[i] = {x:0,y:0} }}
          onMouseMove={(e) => handleMouseMove(e, i)}
          style={{
            flex: 1, overflow: 'hidden', position: 'relative',
            cursor: 'none', minWidth: 0,
            transition: 'flex 0.55s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Background — video if available, otherwise static image */}
          {src.video ? (
            <video
              ref={el => { videoRefs.current[i] = el }}
              src={src.video}
              muted
              playsInline
              preload="metadata"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(0.88) brightness(0.5)',
              }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${src.img})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'grayscale(0.92) brightness(0.55)',
            }} />
          )}

          {/* Blue tint overlay — static, GPU layer cached */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(20, 35, 160, 0.28)',
          }} />

          {/* Brightness overlay — only this animates (opacity = compositor only) */}
          <div
            ref={el => { overlayRefs.current[i] = el }}
            style={{
              position: 'absolute', inset: 0,
              background: '#04040f',
              opacity: 0.42,
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
            background: 'linear-gradient(to top, rgba(4,4,15,0.96) 0%, rgba(4,4,15,0.18) 52%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {i < SOURCES.length - 1 && (
            <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 1, background: 'rgba(107,127,255,0.12)' }} />
          )}

          {/* Category label */}
          <div style={{
            position: 'absolute', top: 18, left: 18,
            fontFamily: LEX, fontSize: 7.5, fontWeight: 700,
            color: 'rgba(107,127,255,0.7)', border: '1px solid rgba(107,127,255,0.35)',
            padding: '3px 8px', letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            {src.label}
          </div>

          {/* Meta row — hidden by default, revealed on hover */}
          <div
            ref={el => { metaRefs.current[i] = el }}
            style={{
              position: 'absolute', top: 12, right: 18,
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
                  {m.k}
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700,
                  color: m.color ?? 'rgba(232,232,248,0.72)',
                  letterSpacing: '0.04em',
                }}>
                  {m.v}
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
              {src.title}
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
              {src.desc}
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
              {src.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Scene 3: COUNTRIES ── */
const COUNTRY_COLORS = ['#f87171', '#6b7fff', '#fbbf24', '#8b9fff']
const TOTAL_DEBRIS   = COUNTRIES.reduce((s, c) => s + c.count, 0)

const RING_SEGS = (() => {
  let cum = -Math.PI / 2
  const gap = 0.028
  return COUNTRIES.map((c, i) => {
    const pct  = c.count / TOTAL_DEBRIS
    const span = pct * 2 * Math.PI - gap
    const mid  = cum + span / 2
    const seg  = { ...c, pct, start: cum, end: cum + span, mid, color: COUNTRY_COLORS[i] }
    cum += span + gap
    return seg
  })
})()


function SceneCountries({ hovIdxRef }) {
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
      el.style.opacity   = on ? '1'   : '0'
      el.style.maxHeight = on ? '80px': '0'
    })
    rowRefs.current.forEach((el, j) => {
      if (!el) return
      const c  = RING_SEGS[j].color
      const on = idx >= 0 && j === idx
      el.style.background = on ? `${c}0d` : 'transparent'
      el.style.boxShadow  = on ? `inset 3px 0 0 ${c}` : 'none'
    })
    if (cNameRef.current)
      cNameRef.current.textContent = idx < 0 ? 'TOTAL TRACKED' : RING_SEGS[idx].name
    if (cCountRef.current)
      cCountRef.current.textContent = idx < 0
        ? TOTAL_DEBRIS.toLocaleString()
        : RING_SEGS[idx].count.toLocaleString()
    if (cPctRef.current)
      cPctRef.current.textContent = idx < 0
        ? 'OBJECTS IN ORBIT'
        : `${(RING_SEGS[idx].pct * 100).toFixed(1)}% OF TOTAL`
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      {/* Left panel */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: '36%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 4% 0 5%',
      }}>
        <div style={{
          fontFamily: LEX, fontSize: 8, fontWeight: 700,
          color: 'rgba(107,127,255,0.5)', letterSpacing: '0.18em',
          textTransform: 'uppercase', marginBottom: 14, pointerEvents: 'none',
        }}>
          02 · CONTRIBUTORS / 各国贡献
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 'clamp(22px,2.4vw,34px)', fontWeight: 700,
          color: '#e8e8f8', lineHeight: 1.22, marginBottom: 8, pointerEvents: 'none',
        }}>
          三国贡献了全球 96% 的碎片。
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 13, color: '#b9b9d3',
          lineHeight: 1.75, maxWidth: 320, marginBottom: 36, pointerEvents: 'none',
        }}>
          现行国际法律框架无法强制任何国家清理本国碎片。
        </div>

        {/* Bar chart — all 4 rows share a common scale with vertical endpoint lines */}
        <div style={{ position: 'relative' }}>

          {/* Vertical line at each country's bar endpoint — spans all rows */}
          {RING_SEGS.map((seg, i) => (
            <div key={`vl-${i}`} style={{
              position: 'absolute', zIndex: 1, pointerEvents: 'none',
              left: `${(seg.count / RING_SEGS[0].count) * 100}%`,
              top: 0, bottom: 32, width: 1,
              background: `${seg.color}55`,
            }} />
          ))}

          {RING_SEGS.map((seg, i) => (
            <div key={seg.name}
              ref={el => { rowRefs.current[i] = el }}
              style={{
                paddingTop: 12, paddingBottom: 12, cursor: 'pointer',
                borderTop: '1px solid rgba(107,127,255,0.10)',
                borderBottom: i === RING_SEGS.length - 1 ? '1px solid rgba(107,127,255,0.10)' : 'none',
                transition: 'background 0.22s ease, box-shadow 0.22s ease',
              }}
              onMouseEnter={() => applyHover(i)}
              onMouseLeave={() => applyHover(-1)}
            >
              {/* Country header row — index + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingLeft: 16 }}>
                <span style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  color: seg.color, opacity: 0.7,
                }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{
                  fontFamily: LEX, fontSize: 11, fontWeight: 700,
                  color: seg.color, letterSpacing: '0.10em', textTransform: 'uppercase',
                }}>{seg.name}</span>
              </div>

              {/* Bar — flat ends, no track */}
              <div style={{ height: 4, marginBottom: 9 }}>
                <div style={{
                  height: '100%',
                  width: `${(seg.count / RING_SEGS[0].count) * 100}%`,
                  background: seg.color,
                  boxShadow: `0 0 8px ${seg.color}77`,
                }} />
              </div>

              {/* Count + percentage — indented to avoid vertical line overlap */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingLeft: 16 }}>
                <span style={{
                  fontFamily: MONO, fontSize: 28, fontWeight: 700,
                  color: '#e8e8f8', letterSpacing: '-0.03em',
                }}>{seg.count.toLocaleString()}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 17, fontWeight: 700, color: seg.color,
                }}>{(seg.pct * 100).toFixed(1)}%</span>
              </div>

              {/* Detail — revealed on hover */}
              <div
                ref={el => { detailRefs.current[i] = el }}
                style={{
                  marginTop: 8, paddingLeft: 16,
                  fontFamily: ZH, fontSize: 12, color: 'rgba(232,232,248,0.5)',
                  lineHeight: 1.85, maxWidth: 320,
                  opacity: 0, maxHeight: 0, overflow: 'hidden',
                  transition: 'opacity 0.3s ease, max-height 0.35s ease',
                }}
              >{seg.detail}</div>
            </div>
          ))}
        </div>

        {/* Interaction affordance footer */}
        <div style={{
          marginTop: 14, fontFamily: LEX, fontSize: 7.5,
          color: 'rgba(107,127,255,0.28)', letterSpacing: '0.14em', textTransform: 'uppercase',
          pointerEvents: 'none',
        }}>⊙ 悬停查看历史详情</div>
      </div>
{/* 调位右侧数字位置关系、颜色 */}
      {/* Stats overlay — 直接用全宽容器，left 精确定位到地球圆心上方 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '61.5%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', zIndex: 10,
        }}>
          <div ref={cCountRef} style={{
            fontFamily: MONO, fontSize: 36, fontWeight: 700,
            color: '#e8e8f8', letterSpacing: '-0.03em',
          }}>{TOTAL_DEBRIS.toLocaleString()}</div>
          <div ref={cNameRef} style={{
            fontFamily: LEX, fontSize: 16, fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.8)', letterSpacing: '0.16em',
            textTransform: 'uppercase', marginBottom: 6,
          }}>TOTAL TRACKED</div>
          <div ref={cPctRef} style={{
            fontFamily: LEX, fontSize: 12,
            color: 'rgba(255, 255, 255, 0.8)', letterSpacing: '0.1em',
            marginTop: 4,
          }}>OBJECTS IN ORBIT</div>
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

    const visIo = new IntersectionObserver(([e]) => { trendVisRef.current = e.isIntersecting }, { rootMargin: '100px' })
    if (sceneRef.current) visIo.observe(sceneRef.current)

    let rafId, lastFrameTime = performance.now()
    const draw = (now = performance.now()) => {
      if (!trendVisRef.current) { rafId = requestAnimationFrame(draw); return }
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
    rafId = requestAnimationFrame(ts => draw(ts))
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); visIo.disconnect() }
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
          04 · TIMELINE / 数量趋势
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 'clamp(22px,2.8vw,34px)', fontWeight: 700,
          color: '#e8e8f8', lineHeight: 1.2, marginBottom: 8,
        }}>
          轨道碎片的历史积累
        </div>
        <div style={{ fontFamily: ZH, fontSize: 12, color: '#484878', lineHeight: 1.75, maxWidth: 280 }}>
          一旦触发凯斯勒效应，链式碰撞将无法逆转。
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
          跟踪对象
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
            横向移动鼠标，穿越历史时间轴
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
            const pct = (ev.year - 1960) / (2026 - 1960) * 100
            const tickH = 8 + (ev.raise || 0)
            return (
              <motion.div key={ev.year}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute',
                  bottom: 22 + (ev.raise || 0),
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                }}
              >
                <div style={{
                  borderLeft: `1.5px solid ${ev.color}`,
                  paddingLeft: 6, paddingBottom: 3, whiteSpace: 'nowrap',
                }}>
                  <div style={{
                    fontFamily: LEX, fontSize: 7, fontWeight: 700,
                    color: ev.color, letterSpacing: '0.10em', textTransform: 'uppercase',
                  }}>
                    {ev.year} · {ev.delta}
                  </div>
                  <div style={{
                    fontFamily: ZH, fontSize: 10, color: 'rgba(232,232,248,0.65)',
                    marginTop: 2, lineHeight: 1.4,
                  }}>
                    {ev.label}
                  </div>
                </div>
                <div style={{ width: 1, height: tickH, background: `${ev.color}55` }} />
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Year label row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {[1960, 1970, 1980, 1990, 2000, 2007, 2009, 2015, 2026].map(y => (
            <div key={y} style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
              color: (y === 2007 || y === 2009) ? 'rgba(107,127,255,1)' : 'rgba(180,190,220,0.75)',
              fontWeight: (y === 2007 || y === 2009) ? 700 : 500,
            }}>
              {y}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


/* ── 章节过渡：滚动驱动文字切换 ── */
function ChapterEndTransition({ onComplete }) {
  const containerRef = useRef()
  const line1Ref     = useRef()   // GSAP 完全控制，React 不渲染子节点
  const [phase, setPhase] = useState(0)
  const phaseRef     = useRef(0)
  const animatingRef = useRef(false)

  const PHASES = [
    { tag: '01 · SPACE DEBRIS · 本章总结', tagColor: '#484878',              title1: '太空垃圾' },
    { tag: '02 · ORBIT · 进入下一章',      tagColor: 'rgba(107,127,255,0.7)', title1: '轨道'    },
  ]

  // 填充 GSAP 控制的大字 DOM
  function populateLine1(el, text, startHidden) {
    el.innerHTML = ''
    for (const ch of text) {
      const span = document.createElement('span')
      span.className = 'cet-c'
      span.style.display = 'inline-block'
      span.style.willChange = 'transform, opacity, filter'
      if (startHidden) {
        span.style.opacity = '0'
        span.style.transform = 'translateY(80%)'
        span.style.filter = 'blur(4px)'
      }
      span.textContent = ch
      el.appendChild(span)
    }
  }

  // 滚动相位检测
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const inViewRef = { current: false }
    const io = new IntersectionObserver(([e]) => { inViewRef.current = e.isIntersecting }, { rootMargin: '120px' })
    io.observe(el)
    const onScroll = () => {
      if (!inViewRef.current) return
      const rect    = el.getBoundingClientRect()
      const scrolled = -rect.top
      const total    = rect.height - window.innerHeight
      const p = Math.max(0, Math.min(1, scrolled / total))
      setPhase(prev => {
        const next = p > 0.46 ? 1 : 0
        return prev !== next ? next : prev
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect() }
  }, [])

  // 初始挂载：填充第一帧大字
  useEffect(() => {
    if (line1Ref.current) populateLine1(line1Ref.current, PHASES[0].title1, false)
  }, [])

  // 相位切换：逐字向上替换动画（仅大字，其余元素不动）
  useEffect(() => {
    if (phaseRef.current === phase) return
    const el = line1Ref.current
    if (!el || animatingRef.current) return
    animatingRef.current = true

    const oldChars = [...el.querySelectorAll('.cet-c')]
    const newTitle = PHASES[phase].title1

    // 旧字：从右向左依次向上消失
    const exitAnim = gsap.to(oldChars, {
      y: '-90%', opacity: 0, filter: 'blur(5px)',
      stagger: { each: 0.042, from: 'end' },
      duration: 0.36, ease: 'power2.in',
      onComplete() {
        // 填入新字（初始隐藏在下方）
        populateLine1(el, newTitle, true)
        // 新字：从左向右依次向上进入
        gsap.to(el.querySelectorAll('.cet-c'), {
          y: '0%', opacity: 1, filter: 'blur(0px)',
          stagger: { each: 0.065, from: 'start' },
          duration: 0.72, ease: 'power3.out',
          onComplete() { animatingRef.current = false },
        })
      },
    })

    phaseRef.current = phase
    return () => exitAnim?.kill()
  }, [phase])

  const cur = PHASES[phase]

  return (
    <div ref={containerRef} style={{ height: '200vh', position: 'relative' }}>
      <div style={{
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        background: 'transparent',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 7vw', borderTop: '1px solid #1a1a35',
      }}>

        {/* 幽灵背景大数字 — CSS color transition，无 React 动画 */}
        <div style={{
          position: 'absolute', right: '5vw', top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: MONO, fontWeight: 700,
          fontSize: 'clamp(180px, 26vw, 360px)',
          color: `rgba(107,127,255,${phase === 0 ? '0.04' : '0.06'})`,
          lineHeight: 1, letterSpacing: '-0.07em',
          userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap',
          transition: 'color 0.8s ease',
        }}>
          {phase === 0 ? '01' : '02'}
        </div>

        {/* 标签行 — 绝对定位在顶部，不参与 flex 居中，不影响两条线位置 */}
        <motion.div
          key={`tag-${phase}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          style={{
            position: 'absolute', top: 36, left: '7vw',
            display: 'flex', alignItems: 'center', gap: 12,
            zIndex: 3,
          }}
        >
          <div style={{ width: 20, height: 1, background: cur.tagColor }} />
          <span style={{
            fontFamily: MONO, fontSize: 8, color: cur.tagColor,
            letterSpacing: '0.22em', textTransform: 'uppercase',
          }}>
            {cur.tag}
          </span>
        </motion.div>

        {/* 主内容 — 只有「线 + 间距 + 标题 + 间距 + 线」，上下完全对称，两线与数字等距 */}
        <div style={{ position: 'relative', zIndex: 2 }}>

          {/* 上分割线 */}
          <div style={{ height: 1, background: '#1a1a35', marginBottom: 48 }} />

          {/* 标题区 */}
          <div>
            {/* Line 1 — GSAP 独占 DOM，React 不渲染子节点 */}
            <div
              ref={line1Ref}
              style={{
                fontFamily: '"Noto Serif SC", serif',
                fontSize: 'clamp(40px, 6vw, 88px)',
                color: '#e8e8f8',
                fontWeight: 400, lineHeight: 1.15, letterSpacing: '0.01em',
                marginBottom: 4,
              }}
            />

            {/* Line 2 — 完全静止，永远显示 "数据知识" */}
            <div style={{
              fontFamily: '"Noto Serif SC", serif',
              fontSize: 'clamp(32px, 4.8vw, 70px)',
              color: 'rgba(232,232,248,0.55)',
              fontWeight: 400, lineHeight: 1.15, letterSpacing: '0.01em',
            }}>
              数据知识
            </div>
          </div>

          {/* 下分割线 — 完全静止 */}
          <div style={{ height: 1, background: '#1a1a35', marginTop: 48 }} />
        </div>

        {/* Phase 1 专属导航 — 绝对定位，不影响上方内容流，分割线永远不动 */}
        <AnimatePresence>
          {phase === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
              style={{ position: 'absolute', bottom: 80, left: '7vw' }}
            >
              <div
                onClick={() => onComplete({ autoScroll: false })}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 14, userSelect: 'none' }}
                onMouseEnter={e => { e.currentTarget.querySelector('span').style.color = '#e8e8f8' }}
                onMouseLeave={e => { e.currentTarget.querySelector('span').style.color = '#6b7fff' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {[0,1,2].map(k => (
                    <div key={k} style={{ height: 1, width: 5, background: `rgba(107,127,255,${0.3 + k * 0.2})` }} />
                  ))}
                </div>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6b7fff', transition: 'color 0.3s' }}>
                  进入下一章 · M2 轨道
                </span>
                <div style={{ width: 12, height: 1, background: '#6b7fff' }} />
                <div style={{ width: 5, height: 5, borderTop: '1.5px solid #6b7fff', borderRight: '1.5px solid #6b7fff', transform: 'rotate(45deg)' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部进度指示 — CSS transition 驱动，无 React 动画 */}
        <div style={{
          position: 'absolute', bottom: 36, left: '7vw',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              height: 1,
              width: phase === i ? 28 : 10,
              background: phase === i ? '#6b7fff' : 'rgba(107,127,255,0.2)',
              transition: 'width 0.4s ease, background 0.4s ease',
            }} />
          ))}
          <span style={{
            fontFamily: MONO, fontSize: 7, color: '#484878',
            letterSpacing: '0.14em', textTransform: 'uppercase', marginLeft: 4,
          }}>
            {phase === 0 ? 'SCROLL TO CONTINUE' : 'ENTERING ORBIT'}
          </span>
        </div>

      </div>
    </div>
  )
}

/* ── Main M1 ── */
export default function M1({ onComplete }) {
  const satellite       = useAppStore(s => s.satellite)
  const user            = useAppStore(s => s.user)
  const storyOutline    = useAppStore(s => s.storyOutline)

  const containerRef         = useRef()
  const sideEarthWrapRef     = useRef()
  const countryEarthWrapRef  = useRef()
  const countriesTextRef     = useRef()
  const countriesProgressRef = useRef(0)
  const hovIdxRef            = useRef(-1)
  const [showCursor,   setShowCursor]   = useState(false)
  const [scaleVisible, setScaleVisible] = useState(false)
  const scaleRef = useRef()

  const rawX    = useMotionValue(0)
  const rawY    = useMotionValue(0)
  const smoothX = useSpring(rawX, { stiffness: 80, damping: 22 })
  const smoothY = useSpring(rawY, { stiffness: 80, damping: 22 })
  const normX   = useTransform(rawX, [0, typeof window !== 'undefined' ? window.innerWidth  : 1], [-1, 1])
  const normY   = useTransform(rawY, [0, typeof window !== 'undefined' ? window.innerHeight : 1], [-1, 1])

  useEffect(() => {
    const h = e => { rawX.set(e.clientX); rawY.set(e.clientY) }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [])

  // 在首次绘制前同步设置过渡层初始 opacity，防止 React 重渲染覆盖 DOM 修改
  useLayoutEffect(() => {
    if (countryEarthWrapRef.current) countryEarthWrapRef.current.style.opacity = '0'
    if (countriesTextRef.current)    countriesTextRef.current.style.opacity    = '0'
  }, [])

  const m1InViewRef = useRef(false)

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      m1InViewRef.current = entry.isIntersecting
      setShowCursor(entry.isIntersecting)
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
    <div ref={containerRef} data-module-scroll-target style={{ position: 'relative', background: 'transparent', cursor: showCursor ? 'none' : 'auto' }}>

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

      <ChapterEndTransition onComplete={onComplete} />

      {showCursor && (
        <CustomCursor mouseX={rawX} mouseY={rawY} smoothX={smoothX} smoothY={smoothY} />
      )}
    </div>
  )
}
