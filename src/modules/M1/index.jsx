import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateMaterialFeedback } from '../../services/ai'
import SatelliteModel from './SatelliteModel'

const EASE = [0.16, 1, 0.3, 1]

const PART_ACCENT = {
  frame:      '#c8b89a',
  solar:      '#4e88bf',
  insulation: '#c8a040',
  propulsion: '#45b8c2',
}

// ── 数据 ─────────────────────────────────────────────────────────────────────

const PARTS = [
  {
    id: 'frame',
    label: '主框架结构',
    labelEn: 'PRIMARY STRUCTURE',
    desc: '卫星承力骨架，质量占比最大，决定碰撞后碎片存活率。',
    options: [
      { id: 'aluminum', label: '铝合金',         en: 'Aluminum Alloy 6061-T6',       feature: '熔点约 660°C，再入时基本在大气层燃烧，地面存活率低',             risk: 'low'    },
      { id: 'titanium', label: '钛合金',         en: 'Titanium Alloy Ti-6Al-4V',     feature: '熔点 1,670°C，大块存活概率最高，可穿透建筑屋顶',                 risk: 'high'   },
      { id: 'cfrp',     label: '碳纤维复合材料', en: 'Carbon Fiber Composite CFRP',  feature: '约 800°C 分解，部分以纤维状存活，分布范围广于金属碎片',          risk: 'medium' },
    ],
  },
  {
    id: 'solar',
    label: '太阳能电池板',
    labelEn: 'SOLAR ARRAY',
    desc: '面积最大的外露构件，也是在轨微小碎片的主要来源之一。',
    options: [
      { id: 'silicon',  label: '硅基电池板',     en: 'Silicon Cell + Glass Cover',   feature: '玻璃盖片再入碎裂，硅灰烬分散，地面风险低',                      risk: 'low'    },
      { id: 'gaas',     label: '砷化镓电池板',   en: 'GaAs Cell + Al Substrate',     feature: '铝基底燃烧，电池层可能形成液态滴落，部分存活',                   risk: 'medium' },
      { id: 'flexible', label: '柔性薄膜电池板', en: 'Flexible Thin-Film Array',     feature: '再入时几乎完全燃烧，但在轨薄膜剥离频繁产生微粒',                risk: 'low'    },
    ],
  },
  {
    id: 'insulation',
    label: '多层隔热毯',
    labelEn: 'THERMAL INSULATION',
    desc: '每天 16 次冷热循环，隔热毯持续剥离，是低轨微粒污染的主要来源之一。',
    options: [
      { id: 'mli',       label: '多层铝箔隔热毯', en: 'Multi-Layer Insulation MLI',  feature: '再入时完全燃烧，但在轨产生微粒数量在所有部件中最多',            risk: 'high'   },
      { id: 'honeycomb', label: '铝蜂窝板',       en: 'Aluminum Honeycomb Panel',    feature: '结构强度高，碰撞后产生碎片，再入时铝基本燃烧，综合风险中等',    risk: 'medium' },
      { id: 'kevlar',    label: '凯夫拉吸收层',   en: 'Kevlar Whipple Shield',       feature: '凯夫拉熔点高，再入后碎片存活概率较高，可能完整落地',            risk: 'high'   },
    ],
  },
  {
    id: 'propulsion',
    label: '推进系统贮箱',
    labelEn: 'PROPULSION TANK',
    desc: '历史上落地次数最多的卫星部件，球形厚壁高密度，再入存活率极高。',
    options: [
      { id: 'ti_tank', label: '钛合金球形贮箱',   en: 'Titanium Spherical Tank',      feature: '几乎必然完整存活落地，1997 年击中 Lottie Williams 的即为此类', risk: 'high'   },
      { id: 'al_tank', label: '铝合金贮箱',       en: 'Aluminum Propellant Tank',     feature: '壁薄，再入时大部分燃烧，地面落点风险低，但在轨碎片事件多',     risk: 'low'    },
      { id: 'copv',    label: '复合材料缠绕贮箱', en: 'COPV (Composite Overwrapped)', feature: '碳纤维层燃烧，内衬金属可能存活，释放时存在爆炸风险',            risk: 'medium' },
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

const SIZE_TIERS = [
  { size: '> 10 cm',   count: '36,500+', label: '可追踪',  desc: '被地面雷达持续编目，卫星需主动规避' },
  { size: '1 – 10 cm', count: '~500,000',label: '雷达盲区',desc: '无法预警，一次撞击即可摧毁整颗卫星' },
  { size: '< 1 mm',    count: '~1.3 亿', label: '微粒云',  desc: '油漆碎片与金属粉尘，长期侵蚀航天器表面' },
]

const COUNTRIES = [
  { name: 'USA',          count: 25786 },
  { name: 'RUSSIA / CIS', count: 25144 },
  { name: 'CHINA',        count: 8774  },
  { name: 'OTHERS',       count: 6528  },
]

const SOURCES = [
  { img: '/source_1.png', title: '失效卫星',   desc: '失去姿态控制的金属残骸，在轨道上无序翻滚，无法操控，无法清除。' },
  { img: '/source_2.png', title: '碰撞与爆炸', desc: '最致命的增量来源。一次碰撞在毫秒之间产生数千个新弹片，每一片都是下一次碰撞的种子。' },
  { img: '/source_3.png', title: '操作性遗留', desc: '丢失的手套、螺栓、镜头盖，乃至火箭级段——人类每一次进入太空都会留下些什么。' },
]

const RISK_COLOR = { low: '#3a5a3a', medium: '#5a4a2a', high: '#5a2a2a' }
const RISK_TEXT  = { low: '低',      medium: '中',      high: '高'      }

// ── 子组件 ────────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: '#6b6b66',
      marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid #1a1a18',
    }}>
      {children}
    </div>
  )
}

function TrendChart() {
  const W = 600, H = 160, padB = 28, padT = 12
  const max = 48000
  const toX = (y) => ((y - 1960) / (2025 - 1960)) * W
  const toY = (c) => padT + (1 - c / max) * (H - padT - padB)
  const linePath = useMemo(() =>
    TREND.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.year).toFixed(1)} ${toY(d.count).toFixed(1)}`).join(' ')
  , [])
  const areaPath = `${linePath} L ${toX(2025)} ${H - padB} L ${toX(1960)} ${H - padB} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="tg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="#c8b89a" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#c8b89a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#tg)" />
      <path d={linePath} fill="none" stroke="#c8b89a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {[1960, 1980, 2000, 2007, 2009, 2025].map((y) => (
        <text key={y} x={toX(y)} y={H - 8} textAnchor="middle" fill="#3a3a38" fontSize="9" fontFamily="monospace">{y}</text>
      ))}
      {[{ year: 2007, count: 14000, label: '+3,500' }, { year: 2009, count: 19000, label: '+2,000' }].map((ev) => (
        <g key={ev.year}>
          <line x1={toX(ev.year)} x2={toX(ev.year)} y1={toY(ev.count) - 2} y2={H - padB}
            stroke="#c8b89a" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
          <text x={toX(ev.year)} y={toY(ev.count) - 6} textAnchor="middle" fill="#c8b89a" fontSize="9" fontFamily="monospace" opacity="0.6">{ev.label}</text>
        </g>
      ))}
      <circle cx={toX(2025)} cy={toY(45000)} r="3" fill="#c8b89a" opacity="0.7" />
      <text x={toX(2025) - 5} y={toY(45000) - 7} textAnchor="end" fill="#c8b89a" fontSize="9" fontFamily="monospace">45,000</text>
    </svg>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

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

  function handleSelect(partId, optionId) {
    setMaterialPart(partId, optionId)
    const idx = PARTS.findIndex((p) => p.id === partId)
    if (idx < PARTS.length - 1) {
      setTimeout(() => setActivePartId(PARTS[idx + 1].id), 350)
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

  const maxCount = Math.max(...COUNTRIES.map((c) => c.count))
  const activePart = PARTS.find((p) => p.id === activePartId)

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', minHeight: '100vh' }}>

      {/* 顶部标题栏 */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #1a1a18' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          SPACE_DEBRIES · M1 · 太空垃圾是什么
        </span>
      </div>

      {/* ── 科普内容 01–04 ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 32px 0' }}>

        <div style={{ marginBottom: 80 }}>
          <h2 style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 26, fontWeight: 400, color: '#f5f4f0', lineHeight: 1.6, marginBottom: 16, letterSpacing: '0.02em' }}>
            太空垃圾不是比喻，<br />是真实存在的物理威胁。
          </h2>
          <p style={{ fontSize: 13, color: '#6b6b66', lineHeight: 1.9, maxWidth: 480 }}>
            自 1957 年第一颗卫星升空，人类已在轨道上留下了数以亿计的碎片。它们不会自然消失，也没有任何机构有权力强制清除。
          </p>
        </div>

        {/* 01 规模 */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>01 · 规模</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#1a1a18', marginBottom: 1 }}>
            {SIZE_TIERS.map((tier, i) => (
              <div key={i} style={{ background: '#0a0a0a', padding: '28px 20px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c8b89a', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>{tier.size}</div>
                <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 22, color: '#f5f4f0', marginBottom: 4, letterSpacing: '-0.02em' }}>{tier.count}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#4a4a48', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{tier.label}</div>
                <div style={{ fontSize: 12, color: '#3a3a38', lineHeight: 1.8 }}>{tier.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '28px', border: '1px solid #1a1a18', background: '#0d0d0c' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 38, color: '#f5f4f0', letterSpacing: '-0.03em', lineHeight: 1 }}>28,000</div>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c8b89a', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>km / h · 平均相对速度</div>
            </div>
            <div style={{ width: 1, height: 48, background: '#1a1a18', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#6b6b66', lineHeight: 1.9, margin: 0 }}>
              子弹速度的 <span style={{ color: '#c8b89a', fontFamily: 'monospace' }}>10 倍</span>。一颗直径 1 cm 的碎片携带的动能，相当于一枚<span style={{ color: '#f5f4f0' }}>手榴弹</span>的爆炸当量。
            </p>
          </div>
        </div>

        {/* 02 来源 */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>02 · 来源</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }}>
            {SOURCES.map((src, i) => (
              <div key={i}>
                <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <img src={src.img} alt={src.title} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', filter: 'brightness(0.8) saturate(0.7)' }} />
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c8b89a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>{src.title}</div>
                <div style={{ fontSize: 12, color: '#4a4a48', lineHeight: 1.8 }}>{src.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 03 各国贡献 */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>03 · 各国贡献排名（已编目碎片数）</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {COUNTRIES.map((c, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b6b66', letterSpacing: '0.1em' }}>{c.name}</span>
                  <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: '#f5f4f0' }}>{c.count.toLocaleString()}</span>
                </div>
                <div style={{ height: 2, background: '#1a1a18' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(c.count / maxCount) * 100}%` }}
                    transition={{ duration: 1.2, ease: EASE, delay: i * 0.1 }}
                    viewport={{ once: true }}
                    style={{ height: '100%', background: i === 0 ? '#c8b89a' : '#2a2a28' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#3a3a38', lineHeight: 1.8, marginTop: 20 }}>
            三国合计贡献全球约 96% 的已编目垃圾。责任集中，但现行国际法律框架无法强制任何国家清理本国碎片。
          </p>
        </div>

        {/* 04 趋势图 */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>04 · 数量趋势 1960 – 2025</SectionLabel>
          <TrendChart />
          <p style={{ fontSize: 11, color: '#3a3a38', lineHeight: 1.8, marginTop: 16 }}>
            2007 年风云一号C 反卫星测试（+3,500 块），2009 年铱星-33 与 Cosmos-2251 碰撞（+2,000 块）。凯斯勒效应一旦触发，无法逆转。
          </p>
        </div>

      </div>

      {/* ── 05 材料选择：3D 卫星全屏背景 + 固定尺寸 HUD ── */}
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>

        {/* 3D 卫星作为全屏背景，无任何边框 */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <SatelliteModel selections={materials} fill />
        </div>

        {/* 从左至右渐变遮罩：左侧文字可读，右侧卫星透出 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(100deg, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.88) 32%, rgba(10,10,10,0.50) 58%, rgba(10,10,10,0.08) 80%, rgba(10,10,10,0) 100%)',
        }} />

        {/* HUD 内容层，尺寸完全固定，不随任何交互变化 */}
        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: 1100, margin: '0 auto',
          padding: '72px 48px 80px',
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>

          {/* 节标题 */}
          <div style={{
            fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#6b6b66',
            marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)',
            width: 520,
          }}>
            05 · 为你的卫星选择各部位材料
          </div>

          {/* 左列固定宽度，UI 全部在此 */}
          <div style={{ width: 520 }}>

            {/* 介绍文字（固定高度，不换行） */}
            <p style={{ fontSize: 12, color: '#6b6b66', lineHeight: 1.8, marginBottom: 24 }}>
              {satellite?.name ?? '你的卫星'} 正在装配。这些选择会影响卫星的未来。
            </p>

            {/* 部位标签页（固定高度，横向排列） */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'nowrap' }}>
              {PARTS.map((part) => {
                const isActive = activePartId === part.id
                const isDone   = !!materials[part.id]
                const accent   = PART_ACCENT[part.id]
                return (
                  <div
                    key={part.id}
                    onClick={() => aiState === 'idle' && setActivePartId(part.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 13px',
                      border: `1px solid ${isActive ? accent : 'rgba(255,255,255,0.08)'}`,
                      background: isActive ? `${accent}18` : 'rgba(10,10,10,0.6)',
                      cursor: aiState === 'idle' ? 'pointer' : 'default',
                      transition: 'all 0.18s ease',
                      userSelect: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                      background: isDone ? accent : 'transparent',
                      border: `1px solid ${isDone ? accent : 'rgba(255,255,255,0.2)'}`,
                      transition: 'all 0.2s',
                    }} />
                    <span style={{
                      fontFamily: 'monospace', fontSize: 8,
                      color: isActive ? accent : '#4a4a48',
                      letterSpacing: '0.10em', textTransform: 'uppercase',
                      transition: 'color 0.18s',
                    }}>
                      {part.id === 'frame' ? 'FRAME' : part.id === 'solar' ? 'SOLAR' : part.id === 'insulation' ? 'MLI' : 'PROP'}
                    </span>
                  </div>
                )
              })}

              {/* 进度 */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {PARTS.map((p) => (
                  <div key={p.id} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: materials[p.id] ? PART_ACCENT[p.id] : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s',
                  }} />
                ))}
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#4a4a48', letterSpacing: '0.08em', marginLeft: 4 }}>
                  {selectedCount}/4
                </span>
              </div>
            </div>

            {/* ── 固定高度内容区（316px），切换时仅淡入淡出 ── */}
            <div style={{ height: 316, position: 'relative' }}>

              {/* [idle] 三个选项卡 */}
              <AnimatePresence mode="wait">
                {aiState === 'idle' && (
                  <motion.div
                    key={activePartId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {activePart?.options.map((opt) => {
                      const isSel  = materials[activePartId] === opt.id
                      const accent = PART_ACCENT[activePartId]
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelect(activePartId, opt.id)}
                          style={{
                            flex: 1,
                            padding: '14px 18px',
                            background: isSel ? `rgba(10,10,10,0.90)` : 'rgba(10,10,10,0.72)',
                            border: isSel ? `1px solid ${accent}80` : '1px solid rgba(255,255,255,0.06)',
                            borderLeft: isSel ? `3px solid ${accent}` : '3px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.16s ease',
                            userSelect: 'none',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                              <div style={{
                                width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                                background: isSel ? accent : 'transparent',
                                border: `1px solid ${isSel ? accent : 'rgba(255,255,255,0.2)'}`,
                                transition: 'all 0.16s',
                              }} />
                              <span style={{ fontFamily: 'monospace', fontSize: 8, color: isSel ? accent : '#3a3a38', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                {opt.en}
                              </span>
                            </div>
                            <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 14, color: isSel ? accent : '#d0d0cc', marginBottom: 5, transition: 'color 0.16s' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize: 11, color: '#484846', lineHeight: 1.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {opt.feature}
                            </div>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <div style={{ width: 28, height: 2, background: RISK_COLOR[opt.risk], opacity: isSel ? 1 : 0.35, marginBottom: 4 }} />
                            <div style={{ fontFamily: 'monospace', fontSize: 8, color: RISK_COLOR[opt.risk], opacity: isSel ? 1 : 0.3 }}>
                              {RISK_TEXT[opt.risk]}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </motion.div>
                )}

                {/* [loading] */}
                {aiState === 'loading' && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(10,10,10,0.82)',
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '0 24px',
                    }}
                  >
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c8b89a', animation: 'blink 1.2s ease infinite', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#4a4a48', letterSpacing: '0.14em' }}>
                      ANALYZING MATERIAL CONFIGURATION...
                    </span>
                  </motion.div>
                )}

                {/* [done / error] 反馈文字 */}
                {(aiState === 'done' || aiState === 'error') && (
                  <motion.div
                    key="feedback"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(10,10,10,0.88)',
                      borderLeft: '3px solid rgba(200,184,154,0.35)',
                      padding: '24px 22px',
                      overflow: 'auto',
                    }}
                  >
                    <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#c8b89a', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
                      材料档案 · {satellite?.name ?? '卫星'}
                    </div>
                    <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 13, color: 'rgba(245,244,240,0.78)', lineHeight: 2.0 }}>
                      {aiState === 'done' ? feedback : '材料分析服务暂时不可用，材料组合已记录。'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── 底部操作行（固定高度，始终占位）── */}
            <div style={{ height: 60, display: 'flex', alignItems: 'center', marginTop: 12 }}>
              {aiState === 'idle' && (
                <button
                  onClick={allDone ? handleGenerateFeedback : undefined}
                  style={{
                    fontFamily: 'monospace', fontSize: 10,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    padding: '13px 28px', background: 'transparent',
                    border: `1px solid ${allDone ? 'rgba(200,184,154,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: allDone ? '#c8b89a' : '#3a3a38',
                    cursor: allDone ? 'pointer' : 'not-allowed',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {allDone ? '生成材料分析报告 →' : `还需选择 ${4 - selectedCount} 个部位`}
                </button>
              )}
              {(aiState === 'done' || aiState === 'error') && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  onClick={onComplete}
                  style={{
                    fontFamily: 'monospace', fontSize: 10,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '13px 28px', cursor: 'pointer',
                    border: '1px solid rgba(200,184,154,0.45)', color: '#c8b89a',
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
