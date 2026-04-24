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

function ColorLegend() {
  const items = [
    { id: 'frame',      label: '主框架' },
    { id: 'solar',      label: '太阳能板' },
    { id: 'insulation', label: '隔热毯' },
    { id: 'propulsion', label: '推进贮箱' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', padding: '16px 0' }}>
      {items.map(({ id, label }) => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: PART_ACCENT[id], flexShrink: 0 }} />
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#4a4a48', letterSpacing: '0.08em' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// 折叠面板
function PartPanel({ part, value, onSelect, isOpen, onToggle }) {
  const accent = PART_ACCENT[part.id]
  const selectedOpt = part.options.find((o) => o.id === value)

  return (
    <div style={{ borderBottom: '1px solid #1a1a18' }}>
      {/* 标题行 */}
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 0', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: value ? accent : '#2a2a28',
          boxShadow: value ? `0 0 8px ${accent}80` : 'none',
          transition: 'all 0.3s ease',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'monospace', fontSize: 8, color: value ? accent : '#4a4a48',
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5,
            transition: 'color 0.3s',
          }}>
            {part.labelEn}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 15, color: '#f5f4f0' }}>
              {part.label}
            </span>
            {selectedOpt && !isOpen && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  fontFamily: 'monospace', fontSize: 8, color: accent,
                  letterSpacing: '0.07em', padding: '2px 8px',
                  border: `1px solid ${accent}40`, background: `${accent}14`,
                }}
              >
                {selectedOpt.label}
              </motion.span>
            )}
          </div>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, color: '#3a3a38', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
        >
          <polyline points="2,4 6,8 10,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* 展开内容 */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBottom: 24 }}>
              <p style={{ fontSize: 12, color: '#4a4a48', lineHeight: 1.8, marginBottom: 18 }}>
                {part.desc}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {part.options.map((opt) => {
                  const isSel = value === opt.id
                  return (
                    <div
                      key={opt.id}
                      onClick={() => onSelect(part.id, opt.id)}
                      style={{
                        padding: '16px 20px', userSelect: 'none', cursor: 'pointer',
                        border: isSel ? `1px solid ${accent}70` : '1px solid #222220',
                        borderLeft: isSel ? `3px solid ${accent}` : '3px solid transparent',
                        background: isSel ? `${accent}12` : '#0e0e0d',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                            <div style={{
                              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                              border: `1px solid ${isSel ? accent : '#3a3a38'}`,
                              background: isSel ? accent : 'transparent',
                              transition: 'all 0.18s',
                            }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 8, color: isSel ? accent : '#3a3a38', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {opt.en}
                            </span>
                          </div>
                          <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 15, color: isSel ? accent : '#e0e0dc', marginBottom: 8, transition: 'color 0.18s' }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 11, color: '#555552', lineHeight: 1.8 }}>
                            {opt.feature}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right', paddingTop: 2 }}>
                          <div style={{ width: 32, height: 3, marginBottom: 5, background: RISK_COLOR[opt.risk], opacity: isSel ? 1 : 0.4, transition: 'opacity 0.18s' }} />
                          <div style={{ fontFamily: 'monospace', fontSize: 8, color: RISK_COLOR[opt.risk], letterSpacing: '0.06em', opacity: isSel ? 1 : 0.3 }}>
                            RISK · {RISK_TEXT[opt.risk]}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function M1({ onComplete }) {
  const satellite       = useAppStore((s) => s.satellite)
  const user            = useAppStore((s) => s.user)
  const storyOutline    = useAppStore((s) => s.storyOutline)
  const materials       = useAppStore((s) => s.materials)
  const setMaterialPart = useAppStore((s) => s.setMaterialPart)

  // 始终保持一个面板展开，不允许全部收起
  const [activePartId, setActivePartId] = useState(PARTS[0].id)
  const [aiState,      setAiState]      = useState('idle')
  const [feedback,     setFeedback]     = useState('')

  const selectedCount = Object.values(materials).filter(Boolean).length
  const allDone       = selectedCount === 4

  function handleSelect(partId, optionId) {
    setMaterialPart(partId, optionId)
    const idx = PARTS.findIndex((p) => p.id === partId)
    if (idx < PARTS.length - 1) {
      // 自动推进到下一个面板
      setTimeout(() => setActivePartId(PARTS[idx + 1].id), 380)
    }
    // 最后一项选完后保持当前面板展开，生成按钮出现在下方
  }

  function handleToggle(partId) {
    // 点击已展开的面板不关闭（始终保持至少一个展开）
    if (activePartId === partId) return
    setActivePartId(partId)
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

      {/* ── 05 材料选择（无分隔线，直接衔接，宽布局）── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 80px' }}>

        <SectionLabel>05 · 为你的卫星选择各部位材料</SectionLabel>

        <div style={{ display: 'flex', gap: 56, alignItems: 'flex-start' }}>

          {/* 左：3D 模型（无边框，flex:1，sticky） */}
          <div style={{ flex: 1, minWidth: 0, position: 'sticky', top: 60 }}>

            {/* 卫星名称标签 */}
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#3a3a38', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
              {satellite?.name ?? 'SATELLITE'} · 3D PREVIEW · DRAG TO ROTATE
            </div>

            {/* 3D 画布，无边框 */}
            <SatelliteModel selections={materials} height={480} />

            {/* 颜色图例（无边框） */}
            <ColorLegend />

            {/* 选择进度 */}
            <div style={{ borderTop: '1px solid #1a1a18', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#3a3a38', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  SELECTION PROGRESS
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: allDone ? '#c8b89a' : '#4a4a48', transition: 'color 0.3s' }}>
                  {selectedCount} / 4
                </span>
              </div>
              <div style={{ height: 2, background: '#1a1a18' }}>
                <div style={{ height: '100%', background: '#c8b89a', width: `${(selectedCount / 4) * 100}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>

          {/* 右：折叠选择面板（flex:1） */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, color: '#6b6b66', lineHeight: 1.9, marginBottom: 36 }}>
              {satellite?.name ?? '你的卫星'} 正在装配。逐一为四个关键部位选择材料。<br />
              这些选择会影响卫星的未来——但现在，你还不知道这些。选错了随时可以重新展开修改。
            </p>

            {/* 四个折叠面板 */}
            <div style={{ borderTop: '1px solid #1a1a18', marginBottom: 24 }}>
              {PARTS.map((part) => (
                <div key={part.id} style={{ padding: '0 4px' }}>
                  <PartPanel
                    part={part}
                    value={materials[part.id]}
                    onSelect={handleSelect}
                    isOpen={activePartId === part.id}
                    onToggle={() => handleToggle(part.id)}
                  />
                </div>
              ))}
            </div>

            {/* 全选后：生成报告按钮 */}
            <AnimatePresence>
              {allDone && aiState === 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <button
                    onClick={handleGenerateFeedback}
                    style={{
                      width: '100%', fontFamily: 'monospace', fontSize: 11,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      padding: '16px 28px', background: 'transparent',
                      border: '1px solid rgba(200,184,154,0.45)', color: '#c8b89a',
                      cursor: 'pointer',
                    }}
                  >
                    生成材料分析报告 →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI 反馈 */}
            <AnimatePresence>
              {(aiState === 'loading' || aiState === 'done' || aiState === 'error') && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                  style={{
                    border: '1px solid #1a1a18',
                    borderLeft: '3px solid rgba(200,184,154,0.35)',
                    background: '#0d0d0c',
                    padding: '28px',
                    marginTop: 8,
                  }}
                >
                  {aiState === 'loading' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c8b89a', animation: 'blink 1.2s ease infinite' }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#4a4a48', letterSpacing: '0.14em' }}>
                        ANALYZING MATERIAL CONFIGURATION...
                      </span>
                    </div>
                  )}
                  {(aiState === 'done' || aiState === 'error') && (
                    <>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#c8b89a', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 18 }}>
                        材料档案 · {satellite?.name ?? '卫星'}
                      </div>
                      <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 14, color: 'rgba(245,244,240,0.75)', lineHeight: 2.1, marginBottom: 36 }}>
                        {aiState === 'done' ? feedback : '材料分析服务暂时不可用，材料组合已记录。'}
                      </p>
                      <div
                        onClick={onComplete}
                        style={{
                          display: 'inline-block', fontFamily: 'monospace', fontSize: 11,
                          letterSpacing: '0.12em', textTransform: 'uppercase',
                          padding: '14px 28px', cursor: 'pointer',
                          border: '1px solid rgba(200,184,154,0.4)', color: '#c8b89a',
                        }}
                      >
                        进入下一章：轨道是什么 →
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

    </div>
  )
}
