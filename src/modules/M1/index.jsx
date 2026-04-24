import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateMaterialFeedback } from '../../services/ai'

const EASE = [0.16, 1, 0.3, 1]

// ── 数据 ─────────────────────────────────────────────────────────────────────

const SIZE_TIERS = [
  { size: '> 10 cm',  count: '36,500+',  label: '可追踪',  desc: '被地面雷达持续编目，卫星需主动规避' },
  { size: '1 – 10 cm', count: '~500,000', label: '雷达盲区', desc: '无法预警，一次撞击即可摧毁整颗卫星' },
  { size: '< 1 mm',  count: '~1.3 亿',  label: '微粒云',  desc: '油漆碎片与金属粉尘，长期侵蚀航天器表面' },
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

const MATERIALS = [
  { id: 'aluminum',     label: '铝合金',         en: 'Aluminum Alloy 6061-T6',      desc: '最普遍的卫星结构材料，重量轻，易加工' },
  { id: 'titanium',     label: '钛合金',         en: 'Titanium Alloy Ti-6Al-4V',    desc: '用于推进系统与高强度连接件，熔点极高' },
  { id: 'carbon_fiber', label: '碳纤维复合材料', en: 'Carbon Fiber Composite CFRP', desc: '轻质高强，用于结构板、天线支架和遮光罩' },
  { id: 'solar_panel',  label: '太阳能电池板',   en: 'Solar Panel Array GaAs',      desc: '展开面积最大的外露部件，覆盖砷化镓电池' },
]

const TREND = [
  { year: 1960, count: 100  }, { year: 1970, count: 2000  },
  { year: 1980, count: 5000 }, { year: 1990, count: 8000  },
  { year: 2000, count: 10000}, { year: 2007, count: 14000 },
  { year: 2009, count: 19000}, { year: 2015, count: 23000 },
  { year: 2021, count: 36200}, { year: 2025, count: 45000 },
]

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
  const maxCount = 48000
  const toX = (y) => ((y - 1960) / (2025 - 1960)) * W
  const toY = (c) => padT + (1 - c / maxCount) * (H - padT - padB)

  const linePath = useMemo(() =>
    TREND.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.year).toFixed(1)} ${toY(d.count).toFixed(1)}`).join(' ')
  , [])

  const areaPath = `${linePath} L ${toX(2025)} ${H - padB} L ${toX(1960)} ${H - padB} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="m1grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="#c8b89a" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#c8b89a" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#m1grad)" />
      <path d={linePath} fill="none" stroke="#c8b89a" strokeWidth="1.5"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

      {[1960, 1980, 2000, 2007, 2009, 2025].map((y) => (
        <text key={y} x={toX(y)} y={H - 8} textAnchor="middle"
          fill="#3a3a38" fontSize="9" fontFamily="monospace">{y}</text>
      ))}

      {[{ year: 2007, count: 14000, label: '+3,500' }, { year: 2009, count: 19000, label: '+2,000' }].map((ev) => (
        <g key={ev.year}>
          <line x1={toX(ev.year)} x2={toX(ev.year)}
            y1={toY(ev.count) - 2} y2={H - padB}
            stroke="#c8b89a" strokeWidth="1" strokeDasharray="3 3"
            strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
          <text x={toX(ev.year)} y={toY(ev.count) - 6}
            textAnchor="middle" fill="#c8b89a" fontSize="9"
            fontFamily="monospace" opacity="0.6">{ev.label}</text>
        </g>
      ))}

      <circle cx={toX(2025)} cy={toY(45000)} r="3" fill="#c8b89a" opacity="0.7" />
      <text x={toX(2025) - 5} y={toY(45000) - 7}
        textAnchor="end" fill="#c8b89a" fontSize="9" fontFamily="monospace">45,000</text>
    </svg>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function M1({ onComplete }) {
  const satellite    = useAppStore((s) => s.satellite)
  const user         = useAppStore((s) => s.user)
  const storyOutline = useAppStore((s) => s.storyOutline)
  const setMaterial  = useAppStore((s) => s.setMaterial)

  const [selected, setSelected] = useState(null)
  const [hovered,  setHovered]  = useState(null)
  const [aiState,  setAiState]  = useState('idle')   // idle | loading | done | error
  const [feedback, setFeedback] = useState('')

  const maxCount = Math.max(...COUNTRIES.map((c) => c.count))

  async function handleSelect(materialId) {
    if (selected) return
    setSelected(materialId)
    setMaterial(materialId)
    setAiState('loading')

    const mat = MATERIALS.find((m) => m.id === materialId)
    try {
      const result = await generateMaterialFeedback({
        material: mat.label,
        satellite,
        user,
        storyOutline,
      })
      setFeedback(result.feedback ?? '')
      setAiState('done')
    } catch {
      setAiState('error')
    }
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', minHeight: '100vh' }}>

      {/* 顶部标题栏 */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #2a2a28' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          SPACE_DEBRIES · M1 · 太空垃圾是什么
        </span>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 32px' }}>

        {/* ── 导言 ── */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{
            fontFamily: '"Noto Serif SC", serif', fontSize: 26,
            fontWeight: 400, color: '#f5f4f0', lineHeight: 1.6,
            marginBottom: 16, letterSpacing: '0.02em',
          }}>
            太空垃圾不是比喻，<br />是真实存在的物理威胁。
          </h2>
          <p style={{ fontSize: 13, color: '#6b6b66', lineHeight: 1.9, maxWidth: 480 }}>
            自 1957 年第一颗卫星升空，人类已在轨道上留下了数以亿计的碎片。
            它们不会自然消失，也没有任何机构有权力强制清除。
          </p>
        </div>

        {/* ── 01 规模 ── */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>01 · 规模</SectionLabel>

          {/* 三格网格 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#1a1a18', marginBottom: 1 }}>
            {SIZE_TIERS.map((tier, i) => (
              <div key={i} style={{ background: '#0a0a0a', padding: '28px 20px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c8b89a', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {tier.size}
                </div>
                <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 22, color: '#f5f4f0', marginBottom: 4, letterSpacing: '-0.02em' }}>
                  {tier.count}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#4a4a48', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {tier.label}
                </div>
                <div style={{ fontSize: 12, color: '#3a3a38', lineHeight: 1.8 }}>
                  {tier.desc}
                </div>
              </div>
            ))}
          </div>

          {/* 速度信息卡 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '28px', border: '1px solid #1a1a18', background: '#0d0d0c' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 38, color: '#f5f4f0', letterSpacing: '-0.03em', lineHeight: 1 }}>
                28,000
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c8b89a', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>
                km / h · 平均相对速度
              </div>
            </div>
            <div style={{ width: 1, height: 48, background: '#1a1a18', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#6b6b66', lineHeight: 1.9, margin: 0 }}>
              子弹速度的 <span style={{ color: '#c8b89a', fontFamily: 'monospace' }}>10 倍</span>。
              一颗直径 1 cm 的碎片携带的动能，相当于一枚
              <span style={{ color: '#f5f4f0' }}>手榴弹</span>的爆炸当量。
            </p>
          </div>
        </div>

        {/* ── 02 来源 ── */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>02 · 来源</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }}>
            {SOURCES.map((src, i) => (
              <div key={i}>
                <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <img src={src.img} alt={src.title}
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', filter: 'brightness(0.8) saturate(0.7)' }} />
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c8b89a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {src.title}
                </div>
                <div style={{ fontSize: 12, color: '#4a4a48', lineHeight: 1.8 }}>
                  {src.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 03 各国贡献 ── */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>03 · 各国贡献排名（已编目碎片数）</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {COUNTRIES.map((c, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b6b66', letterSpacing: '0.1em' }}>{c.name}</span>
                  <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: '#f5f4f0' }}>
                    {c.count.toLocaleString()}
                  </span>
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

        {/* ── 04 趋势 ── */}
        <div style={{ marginBottom: 80 }}>
          <SectionLabel>04 · 数量趋势 1960 – 2025</SectionLabel>
          <TrendChart />
          <p style={{ fontSize: 11, color: '#3a3a38', lineHeight: 1.8, marginTop: 16 }}>
            两次事件将数量瞬间抬高：2007 年风云一号C 反卫星测试（+3,500 块），
            2009 年铱星-33 与 Cosmos-2251 碰撞（+2,000 块）。
            碰撞产生碎片，碎片再次碰撞——凯斯勒效应一旦触发，无法逆转。
          </p>
        </div>

        {/* ── 05 材料选择 ── */}
        <div>
          <SectionLabel>05 · 为你的卫星选择主要材料</SectionLabel>

          <p style={{ fontSize: 13, color: '#6b6b66', lineHeight: 1.9, marginBottom: 32 }}>
            这个选择会影响卫星未来的命运——包括它解体时产生什么碎片，以及再入大气层时能否燃烧殆尽。
            但现在，你还不知道这些。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {MATERIALS.map((mat) => {
              const isSelected = selected === mat.id
              const isDisabled = !!selected && !isSelected
              const isHovered  = hovered === mat.id && !selected

              return (
                <div
                  key={mat.id}
                  onClick={() => !selected && handleSelect(mat.id)}
                  onMouseEnter={() => !selected && setHovered(mat.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: '24px 20px',
                    border: isSelected
                      ? '1px solid rgba(200,184,154,0.6)'
                      : isHovered ? '1px solid #3a3a38' : '1px solid #2a2a28',
                    borderLeft: isSelected ? '3px solid #c8b89a' : undefined,
                    background: isSelected
                      ? 'rgba(200,184,154,0.06)'
                      : isHovered ? '#111110' : '#0e0e0d',
                    cursor: selected ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.3 : 1,
                    transition: 'all 0.2s ease',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      border: '1px solid',
                      borderColor: isSelected ? '#c8b89a' : '#3a3a38',
                      background: isSelected ? '#c8b89a' : 'transparent',
                      transition: 'all 0.2s ease',
                    }} />
                    <div style={{ fontFamily: 'monospace', fontSize: 8, color: isSelected ? '#c8b89a' : '#4a4a48', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {mat.en}
                    </div>
                  </div>

                  <div style={{
                    fontFamily: '"Noto Serif SC", serif', fontSize: 17,
                    color: isSelected ? '#c8b89a' : '#f5f4f0',
                    marginBottom: 10, fontWeight: 400,
                    transition: 'color 0.2s ease',
                  }}>
                    {mat.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#5a5a58', lineHeight: 1.8 }}>
                    {mat.desc}
                  </div>
                </div>
              )
            })}
          </div>

          {/* AI 反馈区 */}
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                marginTop: 12,
                border: '1px solid #1a1a18',
                borderLeft: '3px solid rgba(200,184,154,0.3)',
                background: '#0d0d0c',
                padding: '28px 24px',
              }}
            >
              {aiState === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c8b89a', animation: 'blink 1.2s ease infinite' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#4a4a48', letterSpacing: '0.14em' }}>
                    ANALYZING MATERIAL...
                  </span>
                </div>
              )}

              {(aiState === 'done' || aiState === 'error') && (
                <>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c8b89a', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                    材料档案 · {MATERIALS.find((m) => m.id === selected)?.label}
                  </div>
                  <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 14, color: 'rgba(245,244,240,0.72)', lineHeight: 2, marginBottom: 36 }}>
                    {aiState === 'done'
                      ? feedback
                      : `${MATERIALS.find((m) => m.id === selected)?.label}是卫星设计中的关键结构材料。其熔点与密度特性直接决定了再入大气层时的燃烧概率，以及能否在地面存留碎片。`
                    }
                  </p>
                  <div
                    onClick={onComplete}
                    style={{
                      display: 'inline-block',
                      fontFamily: 'monospace', fontSize: 11,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      padding: '14px 28px',
                      border: '1px solid rgba(200,184,154,0.4)',
                      color: '#c8b89a', cursor: 'pointer',
                    }}
                  >
                    进入下一章：轨道是什么 →
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  )
}
