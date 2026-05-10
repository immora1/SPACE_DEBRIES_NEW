import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateMaterialFeedback } from '../../services/ai'
import SatelliteModel from './SatelliteModel'

const EASE = [0.16, 1, 0.3, 1]

/* ── Accent colours per part ─────────────────────────────────────────── */
const PART_ACCENT = {
  frame:      '#6b7fff',
  solar:      '#38bdf8',
  insulation: '#fbbf24',
  propulsion: '#34d399',
}

/* ── Data ───────────────────────────────────────────────────────────── */
const PARTS = [
  {
    id: 'frame', label: '主框架结构', labelEn: 'PRIMARY STRUCTURE',
    desc: '卫星承力骨架，质量占比最大，决定碰撞后碎片存活率。',
    options: [
      { id: 'aluminum', label: '铝合金',         en: 'Aluminum Alloy 6061-T6',
        feature: '熔点约 660°C，再入时基本在大气层燃烧，地面存活率低。质轻、成本低，是 LEO 卫星最常见选择。',
        shortFeature: '再入燃烧，地面风险低', risk: 'low' },
      { id: 'titanium', label: '钛合金',         en: 'Titanium Alloy Ti-6Al-4V',
        feature: '熔点 1,670°C，大块存活概率最高，可穿透建筑屋顶。1997 年击中 Lottie Williams 的球形贮箱即为此类。',
        shortFeature: '存活率极高，地面危险', risk: 'high' },
      { id: 'cfrp',     label: '碳纤维复合材料', en: 'Carbon Fiber Composite CFRP',
        feature: '约 800°C 分解，部分以纤维状存活，分布范围广于金属碎片。纤维状碎片可能渗入建筑结构。',
        shortFeature: '纤维状存活，分布广', risk: 'medium' },
    ],
  },
  {
    id: 'solar', label: '太阳能电池板', labelEn: 'SOLAR ARRAY',
    desc: '面积最大的外露构件，也是在轨微小碎片的主要来源之一。',
    options: [
      { id: 'silicon',  label: '硅基电池板',     en: 'Silicon Cell + Glass Cover',
        feature: '玻璃盖片再入碎裂成粉尘，硅灰烬分散，地面风险极低。最成熟的航天光伏方案。',
        shortFeature: '基本完全燃烧，安全', risk: 'low' },
      { id: 'gaas',     label: '砷化镓电池板',   en: 'GaAs Multi-Junction Cell',
        feature: '铝基底燃烧，砷化镓电池层可能形成液态滴落，部分存活。转换效率最高，常用于高轨卫星。',
        shortFeature: '液态滴落，部分存活', risk: 'medium' },
      { id: 'flexible', label: '柔性薄膜电池板', en: 'Flexible Thin-Film Array',
        feature: '再入时几乎完全燃烧，但在轨薄膜剥离频繁产生微粒云，是 LEO 碎片的主要增量。',
        shortFeature: '在轨剥离严重产生微粒', risk: 'low' },
    ],
  },
  {
    id: 'insulation', label: '多层隔热毯', labelEn: 'THERMAL INSULATION',
    desc: '每天 16 次冷热循环，隔热毯持续剥离，是低轨微粒污染的主要来源之一。',
    options: [
      { id: 'mli',       label: '多层铝箔隔热毯', en: 'Multi-Layer Insulation MLI',
        feature: '再入时完全燃烧，但在轨产生微粒数量在所有部件中最多。ISS 外壁上已检测到数千次微粒撞击痕。',
        shortFeature: '在轨微粒最多，再入无害', risk: 'high' },
      { id: 'honeycomb', label: '铝蜂窝板',       en: 'Aluminum Honeycomb Panel',
        feature: '结构强度高，碰撞后产生规则碎片，再入时铝基本燃烧，综合风险处于中等水平。',
        shortFeature: '碰撞碎片规则，综合中等', risk: 'medium' },
      { id: 'kevlar',    label: '凯夫拉防护层',   en: 'Kevlar Whipple Shield',
        feature: '凯夫拉熔点高，再入后部分碎片存活概率较高，最厚处可完整落地，无法燃烧。',
        shortFeature: '再入存活率较高', risk: 'high' },
    ],
  },
  {
    id: 'propulsion', label: '推进贮箱', labelEn: 'PROPULSION TANK',
    desc: '历史上落地次数最多的卫星部件，球形厚壁高密度，再入存活率极高。',
    options: [
      { id: 'ti_tank', label: '钛合金球形贮箱',   en: 'Titanium Spherical Tank',
        feature: '几乎必然完整存活落地。1997 年击中 Lottie Williams 的正是这类贮箱，落点在德克萨斯州。',
        shortFeature: '几乎必然完整落地', risk: 'high' },
      { id: 'al_tank', label: '铝合金贮箱',       en: 'Aluminum Propellant Tank',
        feature: '壁薄，再入时大部分燃烧，地面落点风险低。但在轨碎片事件发生率高于钛合金。',
        shortFeature: '大部分燃烧，落地风险低', risk: 'low' },
      { id: 'copv',    label: '复合缠绕贮箱',     en: 'COPV (Composite Overwrapped)',
        feature: '碳纤维层燃烧，内衬金属可能存活；高压状态下再入存在爆炸风险。SpaceX 猎鹰9曾有相关事故记录。',
        shortFeature: '内衬存活，高压爆炸风险', risk: 'medium' },
    ],
  },
]

const TREND = [
  { year: 1960, count: 100   }, { year: 1970, count: 2000  },
  { year: 1980, count: 5000  }, { year: 1990, count: 8000  },
  { year: 2000, count: 10000 }, { year: 2007, count: 14000 },
  { year: 2009, count: 19000 }, { year: 2015, count: 23000 },
  { year: 2021, count: 36200 }, { year: 2025, count: 45000 },
]

const TREND_EVENTS = {
  2007: { label: '风云一号C', detail: '中国反卫星武器测试，单次制造碎片最多的人为事件。', delta: '+3,500' },
  2009: { label: '铱星-33 × Cosmos-2251', detail: '首次大型卫星间高速碰撞，凯斯勒效应的现实验证。', delta: '+2,000' },
}

const SIZE_TIERS = [
  {
    size: '> 10 cm', count: '36,500+', label: '可追踪',
    badge: 'TRACKED',
    desc: '被地面雷达持续编目，卫星需主动规避。当数量超过临界密度，规避消耗的燃料将超过卫星设计寿命所需。',
    color: '#f87171',
  },
  {
    size: '1 – 10 cm', count: '~500,000', label: '雷达盲区',
    badge: 'UNDETECTABLE',
    desc: '当前技术无法追踪，也无法预警。一次撞击可在毫秒内摧毁整颗卫星，同时产生数百个新碎片。',
    color: '#fbbf24',
  },
  {
    size: '< 1 mm', count: '~1.3 亿', label: '微粒云',
    badge: 'PERVASIVE',
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
    img: '/source_1.png', title: '失效卫星',
    tag: 'DEFUNCT',
    stat: '~3,000 颗 在轨',
    desc: '失去姿态控制的金属残骸，在轨道上无序翻滚，无法操控，无法清除。大型失效卫星本身也是潜在碰撞目标。',
  },
  {
    img: '/source_2.png', title: '碰撞与爆炸',
    tag: 'COLLISION',
    stat: '历史最大单次来源',
    desc: '最致命的增量来源。一次碰撞在毫秒之间产生数千个新弹片，每一片都是下一次碰撞的种子——这正是凯斯勒效应的起点。',
  },
  {
    img: '/source_3.png', title: '操作性遗留',
    tag: 'OPERATIONAL',
    stat: '每次任务都在增加',
    desc: '丢失的手套、螺栓、镜头盖，乃至分离的火箭级段。人类每一次进入太空都会留下些什么，这是工程流程无法消除的副产品。',
  },
]

const RISK_COLORS = { low: '#34d399', medium: '#fbbf24', high: '#f87171' }
const RISK_LABEL  = { low: 'LOW',     medium: 'MED',     high: 'HIGH'    }
const RISK_TEXT   = { low: '低',      medium: '中',      high: '高'      }

/* ─────────────────────────────────────────────────────────────────────
   Helper
───────────────────────────────────────────────────────────────────── */
function hexToRgbStr(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.substring(i, i + 2), 16)).join(',')
}

/* ─────────────────────────────────────────────────────────────────────
   Section Header — small label + large statement
───────────────────────────────────────────────────────────────────── */
function SectionHeader({ index, title, statement }) {
  return (
    <div style={{ marginBottom: 40 }}>
      {/* number + label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 18, paddingBottom: 14,
        borderBottom: '1px solid #1a1a35',
      }}>
        <span style={{
          fontFamily: 'Space Mono, monospace', fontSize: 9,
          color: '#6b7fff', letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          {String(index).padStart(2, '0')} · {title}
        </span>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(107,127,255,0.18), transparent)' }} />
      </div>
      {/* Apple-scale statement line */}
      <h3 style={{
        fontFamily: 'Noto Serif SC, serif',
        fontSize: 30,
        fontWeight: 300,
        color: '#e8e8f8',
        lineHeight: 1.30,
        letterSpacing: '-0.01em',
        margin: 0,
      }}>
        {statement}
      </h3>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   01 · SIZE_TIERS interactive card
───────────────────────────────────────────────────────────────────── */
function SizeTierCard({ tier }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{
        background: hovered ? `rgba(${hexToRgbStr(tier.color)}, 0.06)` : '#08081a',
        borderColor: hovered ? `rgba(${hexToRgbStr(tier.color)}, 0.40)` : '#1a1a35',
      }}
      transition={{ duration: 0.22 }}
      style={{
        border: '1px solid #1a1a35',
        padding: '28px 24px 24px',
        cursor: 'default',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: hovered ? `0 8px 32px rgba(${hexToRgbStr(tier.color)}, 0.10)` : 'none',
        transition: 'box-shadow 0.3s',
      }}
    >
      {/* top accent bar on hover */}
      <motion.div
        animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(to right, ${tier.color}, transparent)`,
          transformOrigin: 'left',
        }}
      />

      <div>
        {/* size + badge row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9,
            color: tier.color, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {tier.size}
          </span>
          <motion.span
            animate={{ opacity: hovered ? 1 : 0.3 }}
            style={{
              fontFamily: 'Space Mono, monospace', fontSize: 7.5,
              color: tier.color, border: `1px solid rgba(${hexToRgbStr(tier.color)}, 0.35)`,
              padding: '2px 7px', letterSpacing: '0.10em',
            }}
          >
            {tier.badge}
          </motion.span>
        </div>

        {/* count — large Apple-scale number */}
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 38,
          fontWeight: 700,
          color: '#e8e8f8',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          {tier.count}
        </div>

        {/* label */}
        <div style={{
          fontFamily: 'Space Mono, monospace', fontSize: 9,
          color: '#484878', letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 18,
        }}>
          {tier.label}
        </div>
      </div>

      {/* description — slides up on hover */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 10 }}
        transition={{ duration: 0.25, ease: EASE }}
        style={{
          fontSize: 12, color: 'rgba(232,232,248,0.65)', lineHeight: 1.85,
          borderTop: `1px solid rgba(${hexToRgbStr(tier.color)}, 0.15)`,
          paddingTop: 14,
        }}
      >
        {tier.desc}
      </motion.div>

      {/* hover hint when not hovered */}
      <motion.div
        animate={{ opacity: hovered ? 0 : 0.4 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'absolute', bottom: 16, right: 16,
          fontFamily: 'Space Mono, monospace', fontSize: 8,
          color: '#484878', letterSpacing: '0.08em',
          pointerEvents: 'none',
        }}
      >
        悬停了解详情 →
      </motion.div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   02 · SOURCE interactive card
───────────────────────────────────────────────────────────────────── */
function SourceCard({ src }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#0d0d20',
        border: `1px solid ${hovered ? 'rgba(107,127,255,0.35)' : '#1a1a35'}`,
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'default',
        willChange: 'transform',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered ? '0 16px 48px rgba(0,0,0,0.5)' : 'none',
        transition: 'border-color 0.25s, transform 0.30s cubic-bezier(0.16,1,0.3,1), box-shadow 0.30s',
      }}
    >
      {/* image area */}
      <div style={{ height: 168, overflow: 'hidden', position: 'relative', background: '#080818' }}>
        <img
          src={src.img}
          alt={src.title}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            willChange: 'transform',
            /* hue-rotate is static — only brightness animates, avoiding per-frame rasterisation */
            filter: `brightness(${hovered ? 0.88 : 0.65}) saturate(0.45) hue-rotate(190deg)`,
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'brightness 0.4s ease, transform 0.55s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
        {/* gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(13,13,32,0.95) 0%, rgba(13,13,32,0.40) 55%, transparent 100%)',
        }} />
        {/* tag */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          fontFamily: 'Space Mono, monospace', fontSize: 7.5,
          color: '#6b7fff', border: '1px solid rgba(107,127,255,0.35)',
          padding: '3px 8px', letterSpacing: '0.10em',
          background: 'rgba(4,4,15,0.82)',
        }}>
          {src.tag}
        </div>
        {/* stat badge */}
        <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
          <div style={{
            fontFamily: 'Space Mono, monospace', fontSize: 8,
            color: 'rgba(232,232,248,0.45)', letterSpacing: '0.06em',
          }}>
            {src.stat}
          </div>
        </div>
      </div>

      {/* content */}
      <div style={{ padding: '18px 18px 20px' }}>
        <div style={{
          fontFamily: 'Noto Serif SC, serif', fontSize: 17, fontWeight: 300,
          color: '#e8e8f8', marginBottom: 12, lineHeight: 1.35,
          letterSpacing: '-0.01em',
        }}>
          {src.title}
        </div>
        {/* maxHeight CSS transition avoids layout reflow on every animation frame */}
        <div
          style={{
            fontSize: 12, color: '#484878', lineHeight: 1.85,
            overflow: 'hidden',
            opacity: hovered ? 1 : 0.45,
            maxHeight: hovered ? '120px' : '54px',
            transition: 'opacity 0.35s ease, max-height 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {src.desc}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   03 · COUNTRIES interactive bar row
   Hover state is local — avoids re-rendering the entire M1 tree on
   every mouse event (which previously triggered TrendChart repaints).
───────────────────────────────────────────────────────────────────── */
const CountryRow = React.memo(function CountryRow({ c, pct, sharePct, isFirst }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', padding: '16px 8px', cursor: 'default', borderRadius: 4,
        background: hovered ? 'rgba(107,127,255,0.04)' : 'transparent',
        transition: 'background 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#484878', letterSpacing: '0.10em',
          }}>
            {c.name}
          </span>
          <AnimatePresence>
            {hovered && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.18 }}
                style={{
                  fontFamily: 'Space Mono, monospace', fontSize: 8,
                  color: '#484878', letterSpacing: '0.06em',
                }}
              >
                {c.detail}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <AnimatePresence>
            {hovered && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  fontFamily: 'Space Mono, monospace', fontSize: 9,
                  color: '#6b7fff', letterSpacing: '0.06em',
                }}
              >
                {sharePct}%
              </motion.span>
            )}
          </AnimatePresence>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 11,
            color: hovered ? '#e8e8f8' : '#6a6a9a',
            transition: 'color 0.2s',
          }}>
            {c.count.toLocaleString()}
          </span>
        </div>
      </div>

      {/* bar track */}
      <div style={{ height: 3, background: '#1a1a35', borderRadius: 2 }}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          transition={{ duration: 1.3, ease: EASE, delay: 0 }}
          viewport={{ once: true }}
          style={{
            height: '100%', borderRadius: 2,
            background: isFirst
              ? 'linear-gradient(to right, #6b7fff, #8b6cf8)'
              : 'rgba(107,127,255,0.28)',
            boxShadow: isFirst && hovered ? '0 0 8px rgba(107,127,255,0.5)' : 'none',
            transition: 'box-shadow 0.3s',
          }}
        />
      </div>
    </div>
  )
})

/* ─────────────────────────────────────────────────────────────────────
   04 · TREND interactive SVG chart
───────────────────────────────────────────────────────────────────── */
function TrendChart() {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [expandedEvent, setExpandedEvent] = useState(null)

  const W = 680, H = 200, padB = 34, padT = 18, padL = 8, padR = 68
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const MAX = 50000

  const toX = useCallback((year) => padL + ((year - 1960) / (2025 - 1960)) * chartW, [])
  const toY = useCallback((count) => padT + (1 - count / MAX) * chartH, [])

  const linePath = useMemo(() =>
    TREND.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.year).toFixed(1)} ${toY(d.count).toFixed(1)}`).join(' ')
  , [toX, toY])
  const areaPath = `${linePath} L ${toX(2025)} ${H - padB} L ${toX(1960)} ${H - padB} Z`

  const hov = hoveredIdx !== null ? TREND[hoveredIdx] : null
  const tipX = hov ? toX(hov.year) : 0
  const tipY = hov ? toY(hov.count) : 0
  const tipLeft = tipX > (W - padR) * 0.75   // flip left if near right edge

  const eventYears = Object.keys(TREND_EVENTS).map(Number)

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="tg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#6b7fff" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#6b7fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {[0, 10000, 20000, 30000, 40000].map(v => (
          <line key={v}
            x1={padL} x2={W - padR} y1={toY(v)} y2={toY(v)}
            stroke="rgba(107,127,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaPath} fill="url(#tg)" />
        <path d={linePath} fill="none" stroke="#6b7fff" strokeWidth="1.5"
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

        {/* event markers */}
        {eventYears.map(year => {
          const d = TREND.find(t => t.year === year)
          const ev = TREND_EVENTS[year]
          const isOpen = expandedEvent === year
          return (
            <g key={year} onClick={() => setExpandedEvent(isOpen ? null : year)} style={{ cursor: 'pointer' }}>
              <line
                x1={toX(year)} x2={toX(year)} y1={toY(d.count) - 2} y2={H - padB}
                stroke={isOpen ? '#6b7fff' : 'rgba(107,127,255,0.35)'}
                strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
              />
              {/* clickable label */}
              <rect
                x={toX(year) - 16} y={toY(d.count) - 22}
                width={32} height={14} rx={2} ry={2}
                fill={isOpen ? '#6b7fff' : 'rgba(8,8,26,0.9)'}
                stroke="rgba(107,127,255,0.4)" strokeWidth={1}
              />
              <text
                x={toX(year)} y={toY(d.count) - 12}
                textAnchor="middle" fill={isOpen ? '#fff' : '#6b7fff'}
                fontSize="7.5" fontFamily="Space Mono, monospace"
              >
                {ev.delta}
              </text>
              {/* event detail box */}
              {isOpen && (
                <g>
                  <rect
                    x={toX(year) > W * 0.6 ? toX(year) - 140 : toX(year) + 6}
                    y={toY(d.count) - 2}
                    width={134} height={36} rx={3} ry={3}
                    fill="#0d0d20" stroke="rgba(107,127,255,0.4)" strokeWidth={1}
                  />
                  <text
                    x={(toX(year) > W * 0.6 ? toX(year) - 140 : toX(year) + 6) + 8}
                    y={toY(d.count) + 13}
                    fill="#6b7fff" fontSize="7.5" fontFamily="Space Mono, monospace"
                  >
                    {ev.label}
                  </text>
                  <text
                    x={(toX(year) > W * 0.6 ? toX(year) - 140 : toX(year) + 6) + 8}
                    y={toY(d.count) + 26}
                    fill="rgba(232,232,248,0.55)" fontSize="7" fontFamily="Noto Sans SC, sans-serif"
                  >
                    {ev.detail.substring(0, 28)}…
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* x-axis labels */}
        {[1960, 1980, 2000, 2007, 2009, 2025].map(y => (
          <text key={y} x={toX(y)} y={H - 8}
            textAnchor="middle" fill="#2a2a4a" fontSize="8.5"
            fontFamily="Space Mono, monospace"
          >{y}</text>
        ))}

        {/* interactive data points */}
        {TREND.map((d, i) => {
          const isH = hoveredIdx === i
          const isLast = i === TREND.length - 1
          return (
            <g key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'crosshair' }}
            >
              {/* invisible hit area */}
              <circle cx={toX(d.year)} cy={toY(d.count)} r={14} fill="transparent" />
              {/* visible dot */}
              <circle
                cx={toX(d.year)} cy={toY(d.count)}
                r={isH ? 5 : isLast ? 4 : 2.5}
                fill={isH ? '#fff' : '#6b7fff'}
                stroke={isH ? '#6b7fff' : 'transparent'}
                strokeWidth={isH ? 1.5 : 0}
                style={{ transition: 'r 0.15s, fill 0.15s' }}
              />
              {/* tooltip */}
              {isH && (
                <g>
                  <line
                    x1={toX(d.year)} x2={toX(d.year)}
                    y1={toY(d.count) + 6} y2={H - padB - 2}
                    stroke="rgba(107,127,255,0.28)" strokeWidth={1}
                    strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={tipLeft ? toX(d.year) - 86 : toX(d.year) + 8}
                    y={toY(d.count) - 24}
                    width={78} height={30} rx={3} ry={3}
                    fill="#0d0d20" stroke="rgba(107,127,255,0.45)" strokeWidth={1}
                  />
                  <text
                    x={(tipLeft ? toX(d.year) - 86 : toX(d.year) + 8) + 39}
                    y={toY(d.count) - 11}
                    textAnchor="middle" fill="#484878"
                    fontSize="8" fontFamily="Space Mono, monospace"
                  >{d.year}</text>
                  <text
                    x={(tipLeft ? toX(d.year) - 86 : toX(d.year) + 8) + 39}
                    y={toY(d.count) + 2}
                    textAnchor="middle" fill="#e8e8f8"
                    fontSize="9.5" fontFamily="Space Mono, monospace" fontWeight="700"
                  >{d.count.toLocaleString()}</text>
                </g>
              )}
            </g>
          )
        })}

        {/* last point label */}
        <text
          x={toX(2025) + 5} y={toY(45000) + 4}
          fill="#6b7fff" fontSize="9" fontFamily="Space Mono, monospace"
        >45,000</text>
      </svg>

      <p style={{
        fontFamily: 'Space Mono, monospace', fontSize: 8.5, color: '#2a2a4a',
        letterSpacing: '0.04em', lineHeight: 1.8, marginTop: 14,
      }}>
        悬停数据点查看年份详情 · 点击 <span style={{ color: 'rgba(107,127,255,0.7)' }}>+N 标记</span> 展开事件说明
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Material cards (unchanged)
───────────────────────────────────────────────────────────────────── */
function MaterialCard({ opt, partId, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const accent    = PART_ACCENT[partId]
  const riskColor = RISK_COLORS[opt.risk]

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(partId, opt.id)}
      animate={{
        borderColor: isSelected ? `${accent}90` : hovered ? `${accent}40` : 'rgba(26,26,53,0.9)',
        background: isSelected
          ? `rgba(${hexToRgbStr(accent)}, 0.07)`
          : hovered ? `rgba(${hexToRgbStr(accent)}, 0.035)` : 'rgba(8,8,26,0.80)',
      }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'relative', overflow: 'hidden',
        border: '1px solid #1a1a35', borderRadius: 5,
        cursor: 'pointer', userSelect: 'none', minHeight: 118, flexShrink: 0,
        boxShadow: isSelected ? `0 0 20px rgba(${hexToRgbStr(accent)}, 0.18)` : 'none',
        transition: 'box-shadow 0.3s',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: isSelected ? accent : 'transparent',
        transition: 'background 0.2s', borderRadius: '5px 0 0 5px',
      }} />

      {/* default view */}
      <motion.div
        animate={{ opacity: hovered ? 0 : 1, y: hovered ? -4 : 0 }}
        transition={{ duration: 0.18 }}
        style={{ position: 'absolute', inset: 0, padding: '13px 16px 13px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color: isSelected ? accent : '#484878', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>
            {opt.en}
          </div>
          <div style={{ fontFamily: 'Noto Serif SC, serif', fontSize: 15, color: isSelected ? '#e8e8f8' : '#c8c8e0', fontWeight: isSelected ? 400 : 300, marginBottom: 6 }}>
            {opt.label}
          </div>
          <div style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: 10.5, color: 'rgba(232,232,248,0.35)', lineHeight: 1.55 }}>
            {opt.shortFeature}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: i < (opt.risk === 'low' ? 1 : opt.risk === 'medium' ? 2 : 3) ? riskColor : 'rgba(255,255,255,0.08)',
              }} />
            ))}
          </div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: riskColor, letterSpacing: '0.06em', opacity: 0.8 }}>
            RISK {RISK_LABEL[opt.risk]}
          </span>
        </div>
      </motion.div>

      {/* hover view */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
        transition={{ duration: 0.20, ease: EASE }}
        style={{ position: 'absolute', inset: 0, padding: '12px 16px 12px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}
      >
        <div style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: 11, color: 'rgba(232,232,248,0.75)', lineHeight: 1.75 }}>
          {opt.feature}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 18, height: 1.5, background: riskColor, borderRadius: 1 }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: riskColor, letterSpacing: '0.06em' }}>
            再入风险 · {RISK_TEXT[opt.risk]}
          </span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#484878', letterSpacing: '0.06em', marginLeft: 'auto' }}>
            点击选择 →
          </span>
        </div>
      </motion.div>

      {isSelected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{
            position: 'absolute', top: 10, right: 12,
            width: 16, height: 16, borderRadius: '50%',
            background: `rgba(${hexToRgbStr(accent)}, 0.2)`,
            border: `1px solid ${accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4 L3.5 6 L6.5 2" stroke={accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Part Tab
───────────────────────────────────────────────────────────────────── */
function PartTab({ part, isActive, isDone, onClick }) {
  const accent = PART_ACCENT[part.id]
  return (
    <motion.div
      onClick={onClick}
      animate={{
        borderColor: isActive ? `${accent}60` : isDone ? `${accent}25` : 'rgba(26,26,53,0.8)',
        background: isActive ? `rgba(${hexToRgbStr(accent)}, 0.10)` : isDone ? `rgba(${hexToRgbStr(accent)}, 0.04)` : 'rgba(8,8,26,0.60)',
      }}
      transition={{ duration: 0.2 }}
      style={{
        flex: 1, padding: '10px 14px',
        border: '1px solid #1a1a35', borderRadius: 5,
        cursor: 'pointer', userSelect: 'none',
        boxShadow: isActive ? `0 0 16px rgba(${hexToRgbStr(accent)}, 0.15)` : 'none',
        transition: 'box-shadow 0.3s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: isDone ? accent : 'transparent',
          border: `1px solid ${isDone ? accent : isActive ? `${accent}80` : 'rgba(255,255,255,0.15)'}`,
          boxShadow: isDone ? `0 0 6px ${accent}` : 'none',
          transition: 'all 0.3s',
        }} />
        <span style={{
          fontFamily: 'Space Mono, monospace', fontSize: 7.5,
          color: isActive ? accent : isDone ? `${accent}bb` : '#484878',
          letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'color 0.2s',
        }}>
          {part.id === 'frame' ? 'FRAME' : part.id === 'solar' ? 'SOLAR' : part.id === 'insulation' ? 'INSUL' : 'PROP'}
        </span>
      </div>
      <div style={{
        fontFamily: 'Noto Sans SC, sans-serif', fontSize: 10,
        color: isActive ? 'rgba(232,232,248,0.8)' : '#484878',
        lineHeight: 1.4, transition: 'color 0.2s',
      }}>
        {part.label}
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════ */
export default function M1({ onComplete }) {
  const satellite       = useAppStore((s) => s.satellite)
  const user            = useAppStore((s) => s.user)
  const storyOutline    = useAppStore((s) => s.storyOutline)
  const materials       = useAppStore((s) => s.materials)
  const setMaterialPart = useAppStore((s) => s.setMaterialPart)

  const [activePartId, setActivePartId] = useState(PARTS[0].id)
  const [aiState,      setAiState]      = useState('idle')
  const [feedback,     setFeedback]     = useState('')

  const selectedCount = Object.values(materials).filter(Boolean).length
  const allDone       = selectedCount === 4
  const totalDebris   = COUNTRIES.reduce((a, c) => a + c.count, 0)
  const maxCount      = Math.max(...COUNTRIES.map((c) => c.count))
  const activePart    = PARTS.find((p) => p.id === activePartId)
  const accent        = PART_ACCENT[activePartId]

  function handleSelect(partId, optionId) {
    setMaterialPart(partId, optionId)
    const idx = PARTS.findIndex((p) => p.id === partId)
    if (idx < PARTS.length - 1) {
      setTimeout(() => setActivePartId(PARTS[idx + 1].id), 300)
    }
  }

  async function handleGenerateFeedback() {
    if (!allDone || aiState !== 'idle') return
    setAiState('loading')
    try {
      const result = await generateMaterialFeedback({ materials, satellite, user, storyOutline })
      setFeedback(result.feedback ?? '')
      setAiState('done')
    } catch {
      setAiState('error')
    }
  }

  return (
    <div style={{ color: '#e8e8f8', minHeight: '100vh' }}>

      {/* ── Module top bar ── */}
      <div style={{
        padding: '20px 32px', borderBottom: '1px solid #1a1a35',
        background: 'rgba(4,4,15,0.70)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6b7fff', boxShadow: '0 0 8px rgba(107,127,255,0.7)' }} />
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#484878', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          M1 · 太空垃圾是什么
        </span>
      </div>

      {/* ── Educational content ── */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 32px 0' }}>

        {/* ── Hero headline ── */}
        <div style={{ marginBottom: 96 }}>
          <div style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#484878',
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 22,
          }}>
            M1 · WHAT IS SPACE DEBRIS
          </div>
          <h2 style={{
            fontFamily: 'Noto Serif SC, serif',
            fontSize: 48,
            fontWeight: 300,
            color: '#e8e8f8',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            margin: '0 0 22px',
          }}>
            太空垃圾不是比喻，<br />
            是真实存在的物理威胁。
          </h2>
          <p style={{
            fontFamily: 'Noto Sans SC, sans-serif',
            fontSize: 15,
            color: 'rgba(232,232,248,0.48)',
            lineHeight: 1.75,
            maxWidth: 520,
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            自 1957 年第一颗卫星升空，人类已在轨道上留下了数以亿计的碎片。它们不会自然消失，也没有任何机构有权力强制清除。
          </p>
        </div>

        {/* ═══ 01 · 规模 ═══ */}
        <div style={{ marginBottom: 96 }}>
          <SectionHeader index={1} title="规模" statement="三类碎片，密度各异，威胁截然不同。" />

          {/* Three size tier cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, marginBottom: 2 }}>
            {SIZE_TIERS.map((tier) => (
              <SizeTierCard key={tier.size} tier={tier} />
            ))}
          </div>

          {/* Speed stat – full-width impact block */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1px 1fr',
            gap: 0,
            background: '#0d0d20',
            border: '1px solid #1a1a35',
            marginTop: 2,
          }}>
            <div style={{ padding: '32px 28px' }}>
              <div style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: 52,
                color: '#e8e8f8',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginBottom: 10,
              }}>
                28,000
              </div>
              <div style={{
                fontFamily: 'Space Mono, monospace', fontSize: 9,
                color: '#6b7fff', letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                km / h  ·  碎片平均相对速度
              </div>
            </div>
            <div style={{ background: '#1a1a35' }} />
            <div style={{ padding: '32px 28px', display: 'flex', alignItems: 'center' }}>
              <p style={{
                fontFamily: 'Noto Sans SC, sans-serif',
                fontSize: 14, color: '#484878', lineHeight: 1.85, margin: 0,
                letterSpacing: '-0.01em',
              }}>
                子弹速度的{' '}
                <span style={{ color: '#6b7fff', fontFamily: 'Space Mono, monospace', fontWeight: 700 }}>
                  10 倍
                </span>
                。一颗直径 1 cm 的碎片携带的动能，相当于一枚{' '}
                <span style={{ color: '#e8e8f8' }}>手榴弹</span>
                {' '}的爆炸当量——无论它有多小。
              </p>
            </div>
          </div>
        </div>

        {/* ═══ 02 · 来源 ═══ */}
        <div style={{ marginBottom: 96 }}>
          <SectionHeader index={2} title="来源" statement="每次发射，都会留下一些什么。" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {SOURCES.map((src) => (
              <SourceCard key={src.title} src={src} />
            ))}
          </div>
        </div>

        {/* ═══ 03 · 各国贡献 ═══ */}
        <div style={{ marginBottom: 96 }}>
          <SectionHeader index={3} title="各国贡献" statement="三国合计制造了全球 96% 的已编目垃圾。" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {COUNTRIES.map((c, i) => (
              <CountryRow
                key={c.name}
                c={c}
                pct={(c.count / maxCount) * 100}
                sharePct={((c.count / totalDebris) * 100).toFixed(1)}
                isFirst={i === 0}
              />
            ))}
          </div>

          <p style={{
            fontFamily: 'Noto Sans SC, sans-serif', fontSize: 12, color: '#2a2a4a',
            lineHeight: 1.8, marginTop: 20,
          }}>
            责任集中，但现行国际法律框架无法强制任何国家清理本国碎片。
            悬停各行查看来源说明。
          </p>
        </div>

        {/* ═══ 04 · 趋势 ═══ */}
        <div style={{ marginBottom: 96 }}>
          <SectionHeader index={4} title="数量趋势" statement="一旦触发凯斯勒效应，无法逆转。" />
          <TrendChart />
        </div>

      </div>

      {/* ═══ 05 · 3D 材料选择 ═══ */}
      <div style={{ borderTop: '1px solid #1a1a35', background: 'rgba(4,4,15,0.35)' }}>

        {/* section header */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '52px 48px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #1a1a35' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6b7fff', boxShadow: '0 0 6px #6b7fff', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#484878', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                05 · 为你的卫星选择各部位材料
              </span>
              <div style={{ width: 80, height: 1, background: 'linear-gradient(to right, rgba(107,127,255,0.20), transparent)' }} />
            </div>
            <h3 style={{ fontFamily: 'Noto Serif SC, serif', fontSize: 22, fontWeight: 300, color: '#e8e8f8', lineHeight: 1.45, letterSpacing: '-0.01em', margin: 0 }}>
              {satellite?.name ?? '你的卫星'} 正在装配。
              <span style={{ color: 'rgba(232,232,248,0.42)', fontWeight: 300 }}> 材料决定卫星碎片的命运与地面危害。</span>
            </h3>
          </div>
          {/* completion dots */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, paddingBottom: 4 }}>
            {PARTS.map((p) => (
              <div key={p.id} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', margin: '0 auto 5px',
                  background: materials[p.id] ? PART_ACCENT[p.id] : 'rgba(255,255,255,0.07)',
                  boxShadow: materials[p.id] ? `0 0 8px ${PART_ACCENT[p.id]}` : 'none',
                  transition: 'all 0.35s',
                }} />
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: materials[p.id] ? PART_ACCENT[p.id] : '#2a2a40', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {p.id === 'frame' ? 'FRM' : p.id === 'solar' ? 'SOL' : p.id === 'insulation' ? 'INS' : 'PRO'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two-column grid ── */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px 80px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>

          {/* ── LEFT: sticky 3D model panel ── */}
          <div style={{ position: 'sticky', top: 72 }}>
            <div style={{
              height: 560,
              background: 'rgba(6,6,18,0.85)',
              border: '1px solid #1a1a35',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <SatelliteModel selections={materials} fill />

              {/* bottom overlay: active part label + selection checkboxes */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '20px 22px',
                background: 'linear-gradient(to top, rgba(4,4,15,0.96) 0%, rgba(4,4,15,0.70) 55%, transparent 100%)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color: '#484878', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
                    ACTIVE PART
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePartId}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.20 }}
                      style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    >
                      {activePart?.labelEn}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PARTS.map((p) => (
                    <div key={p.id} style={{
                      width: 24, height: 24, borderRadius: 4,
                      background: materials[p.id] ? `rgba(${hexToRgbStr(PART_ACCENT[p.id])}, 0.12)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${materials[p.id] ? `rgba(${hexToRgbStr(PART_ACCENT[p.id])}, 0.50)` : '#1a1a35'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.3s',
                    }}>
                      {materials[p.id] && (
                        <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4 L3.5 6 L6.5 2" stroke={PART_ACCENT[p.id]} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Part tabs below model */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 8 }}>
              {PARTS.map((part) => (
                <PartTab
                  key={part.id}
                  part={part}
                  isActive={activePartId === part.id}
                  isDone={!!materials[part.id]}
                  onClick={() => aiState === 'idle' && setActivePartId(part.id)}
                />
              ))}
            </div>
          </div>

          {/* ── RIGHT: selection panel ── */}
          <div>
            {/* active part description */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activePartId + '-desc'}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                style={{
                  padding: '12px 16px 12px 18px',
                  background: `rgba(${hexToRgbStr(accent)}, 0.05)`,
                  borderLeft: `3px solid ${accent}`,
                  border: `1px solid rgba(${hexToRgbStr(accent)}, 0.15)`,
                  borderRadius: '0 6px 6px 0',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
                  {activePart?.labelEn}
                </div>
                <div style={{ fontSize: 12, color: '#484878', lineHeight: 1.75 }}>{activePart?.desc}</div>
              </motion.div>
            </AnimatePresence>

            {/* material cards */}
            <div style={{ position: 'relative', minHeight: 380 }}>
              <AnimatePresence mode="wait">
                {aiState === 'idle' && (
                  <motion.div
                    key={activePartId}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {activePart?.options.map((opt) => (
                      <MaterialCard
                        key={opt.id}
                        opt={opt}
                        partId={activePartId}
                        isSelected={materials[activePartId] === opt.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </motion.div>
                )}

                {aiState === 'loading' && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      background: 'rgba(8,8,26,0.82)', border: '1px solid #1a1a35', borderRadius: 5,
                      display: 'flex', alignItems: 'center', gap: 14, padding: '24px',
                      minHeight: 120, position: 'relative', overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6b7fff', animation: 'blink 1.2s ease infinite', boxShadow: '0 0 8px #6b7fff', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#484878', letterSpacing: '0.14em' }}>
                      ANALYZING MATERIAL CONFIGURATION...
                    </span>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, overflow: 'hidden', borderRadius: '0 0 4px 4px' }}>
                      <div style={{ position: 'absolute', top: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(107,127,255,0.6), transparent)', animation: 'shimmer 1.6s linear infinite' }} />
                    </div>
                  </motion.div>
                )}

                {(aiState === 'done' || aiState === 'error') && (
                  <motion.div
                    key="feedback"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
                    style={{
                      background: 'rgba(8,8,26,0.90)',
                      borderLeft: '3px solid rgba(107,127,255,0.40)',
                      border: '1px solid rgba(107,127,255,0.15)', borderRadius: 5,
                      padding: '22px', overflow: 'auto', minHeight: 200,
                    }}
                  >
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b7fff', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
                      材料档案 · {satellite?.name ?? '卫星'}
                    </div>
                    <p style={{ fontFamily: 'Noto Serif SC, serif', fontSize: 13, color: 'rgba(232,232,248,0.80)', lineHeight: 2.0, margin: 0 }}>
                      {aiState === 'done' ? feedback : '材料分析服务暂时不可用，材料组合已记录。'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* bottom action row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #1a1a35' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {PARTS.map((p) => (
                  <div key={p.id} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: materials[p.id] ? PART_ACCENT[p.id] : 'rgba(255,255,255,0.08)',
                    boxShadow: materials[p.id] ? `0 0 6px ${PART_ACCENT[p.id]}` : 'none',
                    transition: 'all 0.3s',
                  }} />
                ))}
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#484878', letterSpacing: '0.08em', marginLeft: 6 }}>
                  {selectedCount} / 4
                </span>
              </div>

              {aiState === 'idle' && (
                <motion.button
                  onClick={allDone ? handleGenerateFeedback : undefined}
                  whileHover={allDone ? { boxShadow: '0 0 20px rgba(107,127,255,0.25)' } : {}}
                  style={{
                    fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                    padding: '11px 24px', background: 'transparent',
                    border: `1px solid ${allDone ? 'rgba(107,127,255,0.55)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 4, color: allDone ? '#6b7fff' : '#2a2a4a',
                    cursor: allDone ? 'pointer' : 'not-allowed', transition: 'all 0.25s ease',
                  }}
                >
                  {allDone ? '生成材料分析报告 →' : `还需选择 ${4 - selectedCount} 个部位`}
                </motion.button>
              )}

              {(aiState === 'done' || aiState === 'error') && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  onClick={onComplete}
                  style={{
                    fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '11px 24px', cursor: 'pointer',
                    border: '1px solid rgba(107,127,255,0.45)', borderRadius: 4,
                    color: '#6b7fff', background: 'rgba(107,127,255,0.06)', transition: 'all 0.2s',
                  }}
                >
                  进入下一章：轨道是什么 →
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
