import React, { useState, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGLTF } from '@react-three/drei'
import SatelliteModel, { GLBSatelliteModel } from '../M1/SatelliteModel'
import { generateMaterialFeedback } from '../../services/ai'

useGLTF.preload('/simple_satellite_low_poly_free.glb')

const ZH   = "'PingFang SC', 'Microsoft YaHei', sans-serif"
const MONO = "'Space Mono', monospace"

export const PART_ACCENT = {
  frame:      '#6b7fff',
  solar:      '#38bdf8',
  insulation: '#fbbf24',
  propulsion: '#34d399',
}
const RISK_COLORS = { low: '#34d399', medium: '#fbbf24', high: '#f87171' }
const RISK_LABEL  = { low: 'LOW',     medium: 'MED',     high: 'HIGH'    }

export const PARTS = [
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

const OPT_GRADIENT = {
  frame:      [
    'radial-gradient(ellipse at 25% 60%, #0d2035 0%, #040c18 75%)',
    'radial-gradient(ellipse at 75% 40%, #120828 0%, #060313 75%)',
    'radial-gradient(ellipse at 50% 75%, #081510 0%, #040d08 75%)',
  ],
  solar:      [
    'radial-gradient(ellipse at 40% 30%, #081e30 0%, #040c18 75%)',
    'radial-gradient(ellipse at 60% 70%, #1c0c04 0%, #0d0602 75%)',
    'radial-gradient(ellipse at 35% 55%, #041818 0%, #020c0c 75%)',
  ],
  insulation: [
    'radial-gradient(ellipse at 50% 25%, #101820 0%, #060c14 75%)',
    'radial-gradient(ellipse at 65% 65%, #151208 0%, #0a0a05 75%)',
    'radial-gradient(ellipse at 30% 50%, #1a1406 0%, #0c0a03 75%)',
  ],
  propulsion: [
    'radial-gradient(ellipse at 50% 40%, #220808 0%, #100404 75%)',
    'radial-gradient(ellipse at 45% 60%, #060c18 0%, #030810 75%)',
    'radial-gradient(ellipse at 55% 40%, #1c0e04 0%, #0d0802 75%)',
  ],
}

export class CanvasErrorBoundary extends React.Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) return this.props.fallback ?? null
    return this.props.children
  }
}

export function PartSchematic({ activePart, scale = 1 }) {
  const accent  = PART_ACCENT[activePart] ?? '#6b7fff'
  const dim     = 'rgba(107,127,255,0.18)'
  const dimFill = 'rgba(107,127,255,0.03)'
  const c  = (part) => activePart === part ? accent        : dim
  const f  = (part) => activePart === part ? accent + '1a' : dimFill
  const sw = (part) => activePart === part ? 1.5           : 0.7

  return (
    <div style={{ pointerEvents: 'none' }}>
      <svg viewBox="0 0 118 64" width={Math.round(118 * scale)} height={Math.round(64 * scale)} style={{ overflow: 'visible' }}>
        <rect x="1" y="20" width="24" height="20" rx="2"
          fill={f('solar')} stroke={c('solar')} strokeWidth={sw('solar')} />
        {[6,11,16,21].map(x => (
          <line key={x} x1={x} y1="20" x2={x} y2="40"
            stroke={c('solar')} strokeWidth={0.4} opacity={activePart==='solar'?0.6:0.2}/>
        ))}
        <line x1="25" y1="30" x2="33" y2="30" stroke={c('solar')} strokeWidth={sw('solar')} />
        <rect x="33" y="14" width="52" height="32" rx="6"
          fill={f('insulation')} stroke={c('insulation')} strokeWidth={sw('insulation')} />
        <rect x="37" y="18" width="44" height="24" rx="4"
          fill={f('frame')} stroke={c('frame')} strokeWidth={sw('frame')} />
        {[46,55,64,73].map(x => (
          <line key={x} x1={x} y1="18" x2={x} y2="42"
            stroke={c('frame')} strokeWidth={0.4} opacity={activePart==='frame'?0.5:0.15}/>
        ))}
        <line x1="59" y1="46" x2="59" y2="51" stroke={c('propulsion')} strokeWidth={sw('propulsion')} />
        <polygon points="59,51 51,62 67,62"
          fill={f('propulsion')} stroke={c('propulsion')} strokeWidth={sw('propulsion')} />
        <line x1="85" y1="30" x2="93" y2="30" stroke={c('solar')} strokeWidth={sw('solar')} />
        <rect x="93" y="20" width="24" height="20" rx="2"
          fill={f('solar')} stroke={c('solar')} strokeWidth={sw('solar')} />
        {[99,104,109,114].map(x => (
          <line key={x} x1={x} y1="20" x2={x} y2="40"
            stroke={c('solar')} strokeWidth={0.4} opacity={activePart==='solar'?0.6:0.2}/>
        ))}
        {activePart === 'frame' && (
          <rect x="37" y="18" width="44" height="24" rx="4"
            fill="none" stroke={accent} strokeWidth={2.5} opacity={0.18} />
        )}
        {activePart === 'solar' && (
          <>
            <rect x="1" y="20" width="24" height="20" rx="2" fill="none" stroke={accent} strokeWidth={2.5} opacity={0.18}/>
            <rect x="93" y="20" width="24" height="20" rx="2" fill="none" stroke={accent} strokeWidth={2.5} opacity={0.18}/>
          </>
        )}
        {activePart === 'insulation' && (
          <rect x="33" y="14" width="52" height="32" rx="6" fill="none" stroke={accent} strokeWidth={2.5} opacity={0.18}/>
        )}
        {activePart === 'propulsion' && (
          <polygon points="59,51 51,62 67,62" fill="none" stroke={accent} strokeWidth={2.5} opacity={0.18}/>
        )}
      </svg>
      <div style={{
        marginTop: 5, fontFamily: MONO,
        fontSize: 7, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: accent, textAlign: 'center',
      }}>
        {PARTS.find(p => p.id === activePart)?.labelEn ?? ''}
      </div>
    </div>
  )
}

export default function SceneMaterial({ satellite, user, storyOutline, materials, setMaterialPart, onComplete }) {
  const [partIdx,  setPartIdx]  = useState(0)
  const [hov,      setHov]      = useState(null)
  const [aiState,  setAiState]  = useState('idle')
  const [feedback, setFeedback] = useState('')

  const activePart    = PARTS[partIdx]
  const accent        = PART_ACCENT[activePart.id]
  const safeMatls     = materials ?? {}
  const selectedCount = Object.values(safeMatls).filter(Boolean).length
  const allDone       = selectedCount === 4

  const goToPart = useCallback((idx) => {
    setPartIdx(Math.max(0, Math.min(PARTS.length - 1, idx)))
    setHov(null)
  }, [])

  async function handleGenerateFeedback() {
    if (!allDone || aiState !== 'idle') return
    setAiState('loading')
    try {
      const result = await generateMaterialFeedback({ materials, satellite, user, storyOutline })
      setFeedback(result.feedback ?? '')
      setAiState('done')
    } catch { setAiState('error') }
  }

  const gradients = OPT_GRADIENT[activePart.id] ?? []

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#02030e', display: 'flex', flexDirection: 'column' }}>

      {/* ── Section header ── */}
      <div style={{
        flexShrink: 0, height: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid rgba(107,127,255,0.10)',
        background: 'rgba(4,4,15,0.85)',
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 7, fontWeight: 700,
          color: 'rgba(107,127,255,0.45)', letterSpacing: '0.20em', textTransform: 'uppercase',
        }}>
          04 · MATERIAL SELECTION / 卫星材料
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 7,
          color: 'rgba(107,127,255,0.22)', letterSpacing: '0.12em',
        }}>
          {selectedCount} / 4 CONFIGURED
        </span>
      </div>

      {/* ── Main body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: 3D GLB model */}
        <div style={{ position: 'relative', width: '45%', flexShrink: 0, height: '100%', background: '#02030e' }}>
          <CanvasErrorBoundary fallback={
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SatelliteModel fill selections={materials} activePart={null} />
            </div>
          }>
            <Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#02030e' }} />}>
              <GLBSatelliteModel accent={accent} activePart={activePart.id} />
            </Suspense>
          </CanvasErrorBoundary>

          {/* Part info overlay */}
          <div style={{ position: 'absolute', bottom: 56, left: 28, pointerEvents: 'none' }}>
            <motion.div key={activePart.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div style={{ fontFamily: MONO, fontSize: 7, color: `${accent}55`, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
                {String(partIdx + 1).padStart(2, '0')} · {PARTS.length} &nbsp;|&nbsp; {activePart.labelEn}
              </div>
              <div style={{ fontFamily: ZH, fontSize: 'clamp(18px, 2vw, 26px)', fontWeight: 700, color: accent, lineHeight: 1.1 }}>
                {activePart.label}
              </div>
              <div style={{ fontFamily: ZH, fontSize: 11, color: 'rgba(232,232,248,0.32)', marginTop: 6, maxWidth: 240, lineHeight: 1.7 }}>
                {activePart.desc}
              </div>
            </motion.div>
          </div>

          {/* Part progress dots */}
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'all',
          }}>
            {PARTS.map((p, i) => (
              <motion.div key={p.id}
                onClick={() => goToPart(i)}
                animate={{
                  width: i === partIdx ? 24 : 6,
                  background: i === partIdx
                    ? PART_ACCENT[p.id]
                    : safeMatls[p.id] ? PART_ACCENT[p.id] + '80' : 'rgba(255,255,255,0.12)',
                }}
                transition={{ duration: 0.25 }}
                style={{ height: 2, borderRadius: 1, cursor: 'pointer' }}
              />
            ))}
          </div>

          {/* Satellite schematic overlay */}
          <motion.div
            key={activePart.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'absolute', top: 18, right: 18, zIndex: 10,
              pointerEvents: 'none', padding: '10px 12px',
              background: 'rgba(2,3,14,0.72)',
              border: `1px solid ${accent}28`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <PartSchematic activePart={activePart.id} />
          </motion.div>

          {/* Vertical divider */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
            background: 'linear-gradient(to bottom, transparent, rgba(107,127,255,0.12) 20%, rgba(107,127,255,0.12) 80%, transparent)',
          }} />
        </div>

        {/* RIGHT: accordion + CTA */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>

          {/* Accordion area */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>

            {/* Top label */}
            <div style={{
              position: 'absolute', top: 14, left: 18, right: 18, zIndex: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(107,127,255,0.22)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                SELECT MATERIAL
              </span>
            </div>

            {/* Option panels */}
            {activePart.options.map((opt, i) => {
              const isSel    = safeMatls[activePart.id] === opt.id
              const isHov    = hov === i
              const isActive = isHov || isSel
              const riskColor = RISK_COLORS[opt.risk]

              return (
                <motion.div
                  key={activePart.id + '-' + opt.id}
                  animate={{ flex: isHov ? 3.0 : hov !== null ? 0.7 : 1 }}
                  transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => setHov(i)}
                  onMouseLeave={() => setHov(null)}
                  onClick={() => {
                    setMaterialPart(activePart.id, opt.id)
                    if (partIdx < PARTS.length - 1) setTimeout(() => goToPart(partIdx + 1), 480)
                  }}
                  style={{
                    position: 'relative', overflow: 'hidden', cursor: 'pointer',
                    borderRight: i < activePart.options.length - 1 ? '1px solid rgba(107,127,255,0.07)' : 'none',
                  }}
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.05 : 1 }}
                    transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                    style={{ position: 'absolute', inset: 0, background: gradients[i] ?? '#04040f' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(2,3,14,0.97) 0%, rgba(2,3,14,0.40) 55%, rgba(2,3,14,0.12) 100%)',
                  }} />
                  {isSel && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `linear-gradient(to bottom, ${accent}1a 0%, transparent 45%)`,
                      pointerEvents: 'none',
                    }} />
                  )}
                  <div style={{
                    position: 'absolute', top: 46, left: 16,
                    fontFamily: MONO, fontSize: 7.5, fontWeight: 700,
                    color: isActive ? accent : 'rgba(107,127,255,0.25)',
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    transition: 'color 0.4s',
                  }}>
                    {String(i + 1).padStart(2, '0')} · {opt.en.split(' ')[0]}
                  </div>
                  <div style={{ position: 'absolute', top: 46, right: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: isActive ? riskColor : 'rgba(107,127,255,0.18)',
                      boxShadow: isActive ? `0 0 7px ${riskColor}` : 'none',
                      transition: 'background 0.4s, box-shadow 0.4s',
                    }} />
                    <span style={{
                      fontFamily: MONO, fontSize: 7, letterSpacing: '0.09em', textTransform: 'uppercase',
                      color: isActive ? riskColor : 'rgba(107,127,255,0.15)',
                      transition: 'color 0.4s',
                    }}>
                      {RISK_LABEL[opt.risk]}
                    </span>
                  </div>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -60%)',
                    fontFamily: MONO, fontWeight: 700,
                    fontSize: 'clamp(64px, 10vw, 120px)',
                    color: isActive ? `${accent}08` : 'rgba(107,127,255,0.02)',
                    userSelect: 'none', pointerEvents: 'none',
                    lineHeight: 1, letterSpacing: '-0.04em',
                    transition: 'color 0.5s',
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <motion.div
                    animate={{ opacity: isHov ? 1 : 0, y: isHov ? 0 : 14 }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      position: 'absolute', top: '36%', left: 16, right: 16,
                      textAlign: 'center', pointerEvents: 'none',
                    }}
                  >
                    <div style={{ fontFamily: MONO, fontSize: 6.5, color: `${accent}55`, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
                      RE-ENTRY PROFILE
                    </div>
                    <div style={{ fontFamily: ZH, fontSize: 'clamp(12px, 1.2vw, 15px)', color: 'rgba(232,232,248,0.68)', lineHeight: 1.85 }}>
                      {opt.shortFeature}
                    </div>
                  </motion.div>
                  <div style={{ position: 'absolute', bottom: 52, left: 16, right: 12 }}>
                    <motion.div
                      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 10 }}
                      transition={{ duration: 0.35 }}
                      style={{ fontFamily: MONO, fontSize: 6.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: `${accent}55`, marginBottom: 7 }}
                    >
                      {opt.en}
                    </motion.div>
                    <div style={{
                      fontFamily: ZH, fontWeight: 700,
                      fontSize: isActive ? 'clamp(18px, 2vw, 26px)' : 'clamp(13px, 1.3vw, 18px)',
                      color: isSel ? accent : '#e8e8f8',
                      lineHeight: 1.1, transition: 'font-size 0.4s, color 0.3s',
                    }}>
                      {isSel ? '✦ ' : ''}{opt.label}
                    </div>
                  </div>
                  {isSel && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                      background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
                    }} />
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* CTA button */}
          <AnimatePresence>
            {allDone && aiState === 'idle' && (
              <motion.div
                key="gen-cta"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 56 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                onClick={handleGenerateFeedback}
                whileHover={{ background: 'rgba(139,108,248,0.14)' }}
                style={{
                  flexShrink: 0, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
                  borderTop: '1px solid rgba(139,108,248,0.22)',
                  background: 'rgba(139,108,248,0.07)',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700,
                  color: '#b8b0ff', letterSpacing: '0.22em', textTransform: 'uppercase',
                }}>
                  GENERATE ANALYSIS
                </span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ fontFamily: MONO, fontSize: 16, color: '#8b6cf8', lineHeight: 1 }}
                >
                  →
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI overlay */}
          {aiState !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
              style={{
                position: 'absolute', inset: 0, zIndex: 50,
                background: 'rgba(2,3,14,0.94)', backdropFilter: 'blur(20px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '40px 32px',
              }}
            >
              {aiState === 'loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b6cf8', animation: 'blink 1.2s ease infinite', boxShadow: '0 0 10px #8b6cf8' }} />
                  <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(139,108,248,0.55)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    ANALYZING RE-ENTRY PROFILE...
                  </span>
                </div>
              )}

              {(aiState === 'done' || aiState === 'error') && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: 0, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(107,127,255,0.08)' }}>
                    {PARTS.map((p, pi) => {
                      const sel = p.options.find(o => o.id === safeMatls[p.id])
                      if (!sel) return null
                      return (
                        <div key={p.id} style={{ flex: 1, paddingRight: 14, paddingLeft: pi > 0 ? 14 : 0, borderRight: pi < PARTS.length - 1 ? '1px solid rgba(107,127,255,0.07)' : 'none' }}>
                          <div style={{ fontFamily: MONO, fontSize: 6, color: 'rgba(107,127,255,0.28)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
                            {p.labelEn}
                          </div>
                          <div style={{ fontFamily: ZH, fontSize: 11, fontWeight: 700, color: PART_ACCENT[p.id] }}>
                            {sel.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ fontFamily: ZH, fontSize: 12, color: 'rgba(232,232,248,0.68)', lineHeight: 2.0, margin: '0 0 24px', borderLeft: '2px solid rgba(139,108,248,0.2)', paddingLeft: 14 }}>
                    {aiState === 'done' ? feedback : '材料分析服务暂时不可用，材料组合已记录。'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                      onClick={onComplete}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(139,108,248,0.14)'; e.currentTarget.style.borderColor='rgba(139,108,248,0.7)' }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(139,108,248,0.06)'; e.currentTarget.style.borderColor='rgba(139,108,248,0.40)' }}
                      style={{
                        fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                        padding: '10px 22px', cursor: 'pointer',
                        border: '1px solid rgba(139,108,248,0.40)', color: '#8b6cf8',
                        background: 'rgba(139,108,248,0.06)', transition: 'background 0.2s, border-color 0.2s',
                      }}
                    >
                      NEXT CHAPTER · M3 →
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
