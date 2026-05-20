import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateMissionStory } from '../../services/ai'
import OrbitGlobe from './OrbitGlobe'

const EASE = [0.16, 1, 0.3, 1]

// ── 太空碎片 icon（不规则角形碎块 + 裂缝 + 溅射小片）──────────────────────────
function DebrisIcon({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 主碎块：不规则八边形 */}
      <polygon
        points="10,1.5 15.5,4 17.5,9.5 14.5,16.5 9,18 3.5,15 2,8.5 5.5,3"
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="miter"
        fill="none"
        opacity="0.9"
      />
      {/* 裂缝 1 */}
      <line x1="7" y1="6.5" x2="12.5" y2="11.5" stroke={color} strokeWidth="0.75" opacity="0.4" />
      {/* 裂缝 2 */}
      <line x1="11" y1="5.5" x2="9" y2="14" stroke={color} strokeWidth="0.75" opacity="0.32" />
      {/* 溅射小碎块（右上） */}
      <polygon
        points="16,0.5 19,2 17.5,4.5 15,3"
        stroke={color}
        strokeWidth="0.8"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      {/* 溅射点（左下） */}
      <circle cx="1.5" cy="16" r="0.9" fill={color} opacity="0.5" />
    </svg>
  )
}

const ORBITS = [
  {
    id: 'leo', name: 'LEO', full: '低地球轨道',
    alt: '200 – 2,000 km', period: '90 – 127 min',
    use: '地球观测、空间站、星座互联网',
    debris: 28000, debrisLabel: '28,000+', risk: '极高', riskColor: '#6b7fff',
    note: '最拥挤的轨道区域，铱星与 Cosmos-2251 碰撞发生于此。',
    color: '#6b7fff',
  },
  {
    id: 'meo', name: 'MEO', full: '中地球轨道',
    alt: '2,000 – 35,786 km', period: '2 – 24 h',
    use: 'GPS / GNSS 导航、部分气象',
    debris: 2000, debrisLabel: '~2,000', risk: '中等', riskColor: '#8b6cf8',
    note: '导航星座密集，碎片少但单颗卫星价值极高。',
    color: '#8b6cf8',
  },
  {
    id: 'geo', name: 'GEO', full: '地球同步轨道',
    alt: '35,786 km', period: '24 h（静止）',
    use: '广播电视、通信、气象（静止）',
    debris: 900, debrisLabel: '~900', risk: '低·持久', riskColor: 'rgba(139,108,248,0.55)',
    note: '无大气阻力，碎片永久停留；坟墓轨道用于退役卫星。',
    color: '#8b6cf8',
  },
]

const MISSIONS = [
  { id: 'weather',  label: '气象监测', labelEn: 'WEATHER MONITORING',  desc: '实时追踪大气层云系、温度场与风速，为地面预报提供原始数据。', orbit: '极轨太阳同步 800–1000 km', example: '风云三号、NOAA-20' },
  { id: 'comms',   label: '通信中继', labelEn: 'COMMUNICATION RELAY', desc: '在轨道充当无线电中继，为偏远区域、船只或飞机提供网络覆盖。', orbit: 'LEO 星座或 GEO 35,786 km',  example: '铱星系列、Starlink'  },
  { id: 'imaging', label: '地球成像', labelEn: 'EARTH OBSERVATION',   desc: '拍摄可见光或合成孔径雷达图像，用于灾害监测与资源普查。',     orbit: '太阳同步 LEO 400–800 km', example: '哨兵-2A、LANDSAT 8'  },
  { id: 'science', label: '科学探测', labelEn: 'SCIENTIFIC RESEARCH', desc: '搭载精密仪器观测宇宙射线、地磁场或太阳粒子。',               orbit: '视载荷需求，各轨道均有', example: 'Swarm、GRACE-FO'      },
]

export default function M2({ onComplete }) {
  const satellite       = useAppStore((s) => s.satellite)
  const user            = useAppStore((s) => s.user)
  const storyOutline    = useAppStore((s) => s.storyOutline)
  const materials       = useAppStore((s) => s.materials)
  const setMission      = useAppStore((s) => s.setMission)
  const setStoryChapter = useAppStore((s) => s.setStoryChapter)

  const [mission,        setMissionLocal]  = useState(null)
  const [aiState,        setAiState]       = useState('idle')
  const [story,          setStory]         = useState('')
  const [currentStep,    setCurrentStep]   = useState(0)
  const [activeOrbit,    setActiveOrbit]   = useState(null)
  const [hoveredMission, setHoveredMission] = useState(null)
  const [btnHov,         setBtnHov]        = useState(false)

  // 三章节 ref
  const chapterRef0 = useRef(null)
  const chapterRef1 = useRef(null)
  const chapterRef2 = useRef(null)

  // 进度条 DOM ref（直接操作，不经 React 状态，保证 60fps 丝滑）
  const indicatorRef = useRef(null)
  const fillRef      = useRef(null)
  const labelRef     = useRef(null)
  const BAR_H        = 400  // 进度条总高度(px)
  // 折线分隔 DOM ref
  const notchRef     = useRef(null)

  useEffect(() => {
    let ticking = false
    function update() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const vMid   = window.innerHeight / 2
        const rects  = [chapterRef0, chapterRef1, chapterRef2].map(
          (r) => r.current?.getBoundingClientRect() ?? null
        )

        // ── 连续进度（0→1）：视口中心在三章节之间的相对位置
        if (rects[0] && rects[2]) {
          const c0    = rects[0].top + rects[0].height / 2
          const c2    = rects[2].top + rects[2].height / 2
          const range = c2 - c0
          if (range !== 0) {
            const prog   = Math.max(0, Math.min(1, (vMid - c0) / range))
            const dotTop = prog * (BAR_H - 12)  // 12 = 圆点直径
            // 直接操作 DOM，不触发 React 重渲
            if (indicatorRef.current)
              indicatorRef.current.style.transform = `translateY(${dotTop}px)`
            if (fillRef.current)
              fillRef.current.style.height = `${dotTop + 3}px`
            if (labelRef.current)
              labelRef.current.style.transform = `translateY(${dotTop}px)`
            // 折线随滚动移动：prog 0→1 映射到 10%→88%
            if (notchRef.current)
              notchRef.current.style.top = `${10 + prog * 78}%`
          }
        }

        // ── 离散 step（仅用于章节透明度，频率低）
        const dists = [chapterRef0, chapterRef1, chapterRef2].map((r) => {
          if (!r.current) return Infinity
          const rect = r.current.getBoundingClientRect()
          return Math.abs(rect.top + rect.height / 2 - vMid)
        })
        const next = dists.indexOf(Math.min(...dists))
        setCurrentStep((prev) => (prev !== next ? next : prev))

        ticking = false
      })
    }
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  async function handleMissionSelect(missionId) {
    if (aiState !== 'idle') return
    setMissionLocal(missionId)
    setMission(missionId)
    setAiState('loading')
    try {
      const result = await generateMissionStory({
        mission: MISSIONS.find((m) => m.id === missionId)?.label ?? missionId,
        satellite, user, material: materials?.frame ?? '铝合金', storyOutline,
      })
      const text = result.story ?? ''
      setStory(text)
      setStoryChapter('m2', text)
      setAiState('done')
    } catch {
      setAiState('error')
    }
  }

  const alt       = satellite?.altitudeKm ?? 836
  const orbitZone = alt < 2000 ? 'LEO' : alt < 35786 ? 'MEO' : 'GEO'
  const maxDebris = Math.max(...ORBITS.map((o) => o.debris))

  // 章节容器通用样式
  const chapterWrap = (step) => ({
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    padding: '80px 28px 80px 28px',
    opacity: currentStep === step ? 1 : 0.28,
    transition: 'opacity 0.55s ease',
  })

  return (
    <div style={{ background: 'transparent', color: '#e8e8f8', position: 'relative' }}>

      {/* ── 顶部标题区 ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: EASE }}
        style={{ padding: '44px 32px 40px', borderBottom: '1px solid #1a1a35', maxWidth: 640 }}
      >
        <div style={{
          fontFamily: '"Space Mono", monospace', fontSize: 8,
          color: '#484878', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16,
        }}>
          02 · ORBIT · 轨道是什么
        </div>
        <h2 style={{
          fontFamily: '"Noto Serif SC", serif',
          fontSize: 'clamp(22px, 2.6vw, 32px)',
          fontWeight: 400, color: '#e8e8f8', lineHeight: 1.55, marginBottom: 14, letterSpacing: '0.01em',
        }}>
          轨道不是一条路，<br />是一个必须持续维护的状态。
        </h2>
        <p style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: 13, color: 'rgba(232,232,248,0.5)', lineHeight: 1.9, maxWidth: 560, margin: 0,
        }}>
          卫星以 7–8 km/s 的速度持续下坠，恰好与地球曲率匹配，形成轨道。
          停下来就意味着坠落。三层轨道区域，碎片风险各不相同。
        </p>
      </motion.div>

      {/* ── 主体双栏 ─────────────────────────────────────────
          左列：三个 ~100vh 的滚动章节
          右列：position: sticky，地球在模块内保持固定
      ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>


        {/* 左列：flex 自然伸展，paddingRight 给右侧地球留空间 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', paddingRight: '50%', paddingLeft: 24 }}>

          {/* ── 章节进度指示器（极简线形）── */}
          <div style={{
            width: 32,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ position: 'relative', width: 32, height: BAR_H }}>

              {/* 轨道底线（极暗） */}
              <div style={{
                position: 'absolute', left: 6, top: 0,
                width: 1, height: BAR_H,
                background: 'rgba(232,232,248,0.07)',
              }} />

              {/* 填充线（ref 控制高度，亮色） */}
              <div ref={fillRef} style={{
                position: 'absolute', left: 6, top: 0,
                width: 1, height: 0,
                background: '#6b7fff',
                boxShadow: '0 0 5px rgba(107,127,255,0.55)',
              }} />

              {/* 末端小点（ref 控制 transform） */}
              <div ref={indicatorRef} style={{
                position: 'absolute', left: 3, top: -3,
                width: 7, height: 7, borderRadius: '50%',
                background: '#6b7fff',
                boxShadow: '0 0 8px rgba(107,127,255,0.8)',
                transform: 'translateY(0px)',
              }} />

              {/* 跟随数字（ref 控制 transform，内容用 state 更新） */}
              <div ref={labelRef} style={{
                position: 'absolute', left: 16, top: -6,
                transform: 'translateY(0px)',
                pointerEvents: 'none',
              }}>
                <span style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: 9, color: 'rgba(107,127,255,0.65)',
                  letterSpacing: '0.12em',
                }}>
                  {String(currentStep + 1).padStart(2, '0')}
                </span>
              </div>

            </div>
          </div>

          {/* 章节内容区 */}
          <div style={{ flex: 1, minWidth: 0 }}>

          {/* ═══════════════════════════════════════════════
              章节 0 · 三层轨道分类
          ═══════════════════════════════════════════════ */}
          <div ref={chapterRef0} style={chapterWrap(0)}>
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <div style={{
                fontFamily: '"Space Mono", monospace', fontSize: 8,
                color: '#6b7fff', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                01 · ORBIT CLASSIFICATION
              </div>
              {/* 装饰性幽灵大字 */}
              <div style={{
                position: 'relative',
                marginBottom: 6,
              }}>
                <div style={{
                  position: 'absolute', top: -8, left: -4,
                  fontFamily: '"Space Mono", monospace',
                  fontSize: 'clamp(72px, 10vw, 110px)',
                  letterSpacing: '-0.04em', lineHeight: 1,
                  color: '#6b7fff', opacity: 0.04,
                  pointerEvents: 'none', userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}>
                  ORBIT
                </div>
                <h3 style={{
                  fontFamily: '"Noto Serif SC", serif',
                  fontSize: 'clamp(22px, 2.4vw, 30px)',
                  fontWeight: 400, color: '#e8e8f8', lineHeight: 1.5,
                  position: 'relative', zIndex: 1,
                  margin: 0,
                }}>
                  三层轨道分类
                </h3>
              </div>
              <p style={{
                fontFamily: '"Noto Sans SC", sans-serif',
                fontSize: 13, color: 'rgba(232,232,248,0.48)', lineHeight: 1.9,
                marginBottom: 36, maxWidth: 400,
              }}>
                地球轨道按高度划分为三个主要区域，各有不同的用途与碎片风险等级。
                悬停卡片，右侧地球将高亮对应轨道带。
              </p>

              {/* 轨道卡片 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {ORBITS.map((orb, i) => {
                  const isHov = activeOrbit === orb.id
                  return (
                    <motion.div
                      key={orb.id}
                      initial={{ opacity: 0, y: 28 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.62, ease: EASE, delay: i * 0.13 }}
                      viewport={{ once: true, amount: 0.25 }}
                      onMouseEnter={() => setActiveOrbit(orb.id)}
                      onMouseLeave={() => setActiveOrbit(null)}
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        padding: '22px 22px 18px',
                        background: isHov ? 'rgba(10,10,24,0.90)' : 'rgba(8,8,26,0.65)',
                        border: `1px solid ${isHov ? orb.color + '40' : '#1a1a35'}`,
                        borderTop: i === 0 ? undefined : 'none',
                        transition: 'background 0.3s ease, border-color 0.3s ease',
                        cursor: 'default',
                      }}
                    >
                      {/* 幽灵大字背景装饰（极淡，固定不变） */}
                      <div style={{
                        position: 'absolute', right: 20, top: '50%',
                        transform: 'translateY(-50%)',
                        fontFamily: '"Space Mono", monospace',
                        fontSize: 110, letterSpacing: '-0.04em', lineHeight: 1,
                        color: orb.color, opacity: 0.03,
                        pointerEvents: 'none', userSelect: 'none',
                      }}>
                        {orb.name}
                      </div>

                      {/* 主内容（z 层高于幽灵字） */}
                      <div style={{ position: 'relative', zIndex: 1 }}>

                        {/* 顶行：名称 + 风险标签 */}
                        <div style={{
                          display: 'flex', alignItems: 'flex-start',
                          justifyContent: 'space-between', marginBottom: 20,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                            <span style={{
                              fontFamily: '"Space Mono", monospace', fontSize: 26,
                              color: isHov ? orb.color : '#e8e8f8',
                              letterSpacing: '-0.03em', lineHeight: 1,
                              transition: 'color 0.35s ease',
                            }}>
                              {orb.name}
                            </span>
                            <span style={{
                              fontFamily: '"Noto Sans SC", sans-serif', fontSize: 12,
                              color: 'rgba(232,232,248,0.3)',
                            }}>
                              {orb.full}
                            </span>
                          </div>
                          <DebrisIcon color={orb.riskColor} size={22} />
                        </div>

                        {/* 主数据行：碎片数（主角大字）+ 分割 + 高度 + 分割 + 周期 */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 16 }}>
                          <div>
                            <div style={{
                              fontFamily: '"Space Mono", monospace',
                              fontSize: 40, lineHeight: 1, letterSpacing: '-0.03em',
                              color: isHov ? orb.color : 'rgba(232,232,248,0.9)',
                              transition: 'color 0.35s ease',
                            }}>
                              {orb.debrisLabel}
                            </div>
                            <div style={{
                              fontFamily: '"Space Mono", monospace', fontSize: 7,
                              color: '#484878', letterSpacing: '0.15em',
                              textTransform: 'uppercase', marginTop: 6,
                            }}>
                              已编目碎片
                            </div>
                          </div>

                          <div style={{ width: 1, height: 44, background: '#1a1a35', flexShrink: 0, marginBottom: 18 }} />

                          <div>
                            <div style={{
                              fontFamily: '"Space Mono", monospace', fontSize: 13,
                              color: 'rgba(232,232,248,0.62)', lineHeight: 1.4,
                            }}>
                              {orb.alt}
                            </div>
                            <div style={{
                              fontFamily: '"Space Mono", monospace', fontSize: 7,
                              color: '#484878', letterSpacing: '0.15em',
                              textTransform: 'uppercase', marginTop: 6,
                            }}>
                              轨道高度
                            </div>
                          </div>

                          <div style={{ width: 1, height: 44, background: '#1a1a35', flexShrink: 0, marginBottom: 18 }} />

                          <div>
                            <div style={{
                              fontFamily: '"Space Mono", monospace', fontSize: 13,
                              color: 'rgba(232,232,248,0.62)', lineHeight: 1.4,
                            }}>
                              {orb.period}
                            </div>
                            <div style={{
                              fontFamily: '"Space Mono", monospace', fontSize: 7,
                              color: '#484878', letterSpacing: '0.15em',
                              textTransform: 'uppercase', marginTop: 6,
                            }}>
                              轨道周期
                            </div>
                          </div>
                        </div>

                        {/* 碎片密度条 */}
                        <div style={{
                          height: 2, background: '#1a1a35',
                          marginBottom: 18, overflow: 'hidden',
                        }}>
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${(orb.debris / maxDebris) * 100}%` }}
                            transition={{ duration: 1.7, ease: EASE, delay: 0.25 + i * 0.18 }}
                            viewport={{ once: true }}
                            style={{
                              height: '100%',
                              background: orb.color,
                              opacity: isHov ? 0.9 : 0.5,
                              transition: 'opacity 0.3s ease',
                            }}
                          />
                        </div>

                        {/* 描述 */}
                        <div style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                          fontSize: 12,
                          color: isHov ? 'rgba(232,232,248,0.52)' : 'rgba(232,232,248,0.3)',
                          lineHeight: 1.85,
                          transition: 'color 0.35s ease',
                        }}>
                          {orb.note}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </div>

          {/* ═══════════════════════════════════════════════
              章节 1 · 你的卫星
          ═══════════════════════════════════════════════ */}
          <div ref={chapterRef1} style={chapterWrap(1)}>
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <div style={{
                fontFamily: '"Space Mono", monospace', fontSize: 8,
                color: '#8b6cf8', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 22,
              }}>
                02 · YOUR SATELLITE
              </div>
              <h3 style={{
                fontFamily: '"Noto Serif SC", serif', fontSize: 24,
                fontWeight: 400, color: '#e8e8f8', marginBottom: 10, lineHeight: 1.5,
              }}>
                你的卫星轨道状态
              </h3>
              <p style={{
                fontFamily: '"Noto Sans SC", sans-serif',
                fontSize: 13, color: 'rgba(232,232,248,0.52)', lineHeight: 1.85,
                marginBottom: 32, maxWidth: 420,
              }}>
                右侧地球上，你的卫星轨道已被高亮标注。此刻它正以约{' '}
                <span style={{ fontFamily: '"Space Mono", monospace', color: '#8b6cf8' }}>
                  {(7800 - alt * 0.08).toFixed(0)} m/s
                </span>{' '}
                的速度运行。
              </p>

              {satellite ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* ── 主卫星卡片 ── */}
                  <div style={{
                    borderLeft: '2px solid rgba(107,127,255,0.35)',
                    paddingLeft: 20,
                  }}>
                    {/* 标识行 */}
                    <div style={{
                      fontFamily: '"Space Mono", monospace', fontSize: 7,
                      color: '#484878', letterSpacing: '0.14em', textTransform: 'uppercase',
                      marginBottom: 10,
                    }}>
                      {orbitZone} · NORAD #{satellite.noradId}
                    </div>

                    {/* 卫星名称 */}
                    <div style={{
                      fontFamily: '"Noto Serif SC", serif', fontSize: 20,
                      color: '#e8e8f8', lineHeight: 1.25, marginBottom: 24,
                      fontWeight: 300,
                    }}>
                      {satellite.name}
                    </div>

                    {/* 两个主指标 */}
                    <div style={{ display: 'flex', gap: 36, marginBottom: 24 }}>
                      <div>
                        <div style={{
                          fontFamily: '"Space Mono", monospace', fontSize: 7,
                          color: '#484878', letterSpacing: '0.14em', textTransform: 'uppercase',
                          marginBottom: 7,
                        }}>
                          轨道高度
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{
                            fontFamily: '"Space Mono", monospace', fontSize: 34,
                            lineHeight: 1, letterSpacing: '-0.02em', color: '#c8c8e8',
                          }}>
                            {satellite.altitudeKm}
                          </span>
                          <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 12, color: '#484878' }}>km</span>
                        </div>
                      </div>
                      <div>
                        <div style={{
                          fontFamily: '"Space Mono", monospace', fontSize: 7,
                          color: '#484878', letterSpacing: '0.14em', textTransform: 'uppercase',
                          marginBottom: 7,
                        }}>
                          运行速度
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{
                            fontFamily: '"Space Mono", monospace', fontSize: 34,
                            lineHeight: 1, letterSpacing: '-0.02em', color: '#8b6cf8',
                          }}>
                            {(7800 - alt * 0.08).toFixed(0)}
                          </span>
                          <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 12, color: '#484878' }}>m/s</span>
                        </div>
                      </div>
                    </div>

                    {/* 细分割线 */}
                    <div style={{ height: 1, background: 'rgba(107,127,255,0.10)', marginBottom: 18 }} />

                    {/* 三个次要指标 */}
                    <div style={{ display: 'flex', gap: 28 }}>
                      {[
                        { label: '倾角', value: `${satellite.inclination}°` },
                        { label: '周期', value: `${satellite.periodMin} min` },
                        { label: '发射年份', value: `${satellite.launchYear}` },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{
                            fontFamily: '"Space Mono", monospace', fontSize: 7,
                            color: '#484878', letterSpacing: '0.12em', textTransform: 'uppercase',
                            marginBottom: 5,
                          }}>
                            {label}
                          </div>
                          <div style={{
                            fontFamily: '"Space Mono", monospace', fontSize: 13, color: '#c8c8e8',
                          }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── 碎片风险条 ── */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: 380 }}>
                    <svg width="11" height="10" viewBox="0 0 12 11" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M6 1L11 10H1L6 1Z" stroke="#f87171" strokeWidth="0.9" fill="none" />
                      <line x1="6" y1="4.5" x2="6" y2="7.5" stroke="#f87171" strokeWidth="0.9" />
                      <circle cx="6" cy="9" r="0.5" fill="#f87171" />
                    </svg>
                    <p style={{
                      fontFamily: '"Noto Sans SC", sans-serif',
                      fontSize: 11, color: 'rgba(232,232,248,0.42)', lineHeight: 1.75, margin: 0,
                    }}>
                      {orbitZone === 'LEO' && '你的卫星位于碎片最密集的 LEO 区域。全球 28,000+ 颗已编目碎片大多数在此轨道层，2009 年铱星碰撞事件发生于同一区域。'}
                      {orbitZone === 'MEO' && '中轨道区域碎片约 2,000 颗，但 GPS、北斗等关键导航基础设施均运行于此，任何碰撞都可能造成大规模通信中断。'}
                      {orbitZone === 'GEO' && '同步轨道碎片约 900 颗，无大气阻力，所有碎片将永久留存。退役卫星通常被送入「坟墓轨道」（+300 km）以避让活跃卫星。'}
                    </p>
                  </div>

                </div>
              ) : (
                <div style={{
                  borderRadius: 10,
                  padding: '40px', background: 'rgba(8,8,26,0.72)',
                  border: '1px solid #1a1a35', textAlign: 'center',
                }}>
                  <p style={{
                    fontFamily: '"Noto Sans SC", sans-serif',
                    fontSize: 13, color: '#484878', margin: 0,
                  }}>
                    请先在入口处匹配卫星。
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          {/* ═══════════════════════════════════════════════
              章节 2 · 任务指派
          ═══════════════════════════════════════════════ */}
          <div ref={chapterRef2} style={chapterWrap(2)}>
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <div style={{
                fontFamily: '"Space Mono", monospace', fontSize: 8,
                color: '#8b6cf8', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 22,
              }}>
                03 · MISSION SELECT
              </div>
              <h3 style={{
                fontFamily: '"Noto Serif SC", serif', fontSize: 24,
                fontWeight: 400, color: '#e8e8f8', marginBottom: 10, lineHeight: 1.5,
              }}>
                为卫星指定任务
              </h3>
              <p style={{
                fontFamily: '"Noto Sans SC", sans-serif',
                fontSize: 13, color: 'rgba(232,232,248,0.52)', lineHeight: 1.85,
                marginBottom: 32, maxWidth: 420,
              }}>
                选择一项主任务。它将决定故事走向与 M4 游戏的背景设定。
                这是全站第二个有后果的选择。
              </p>

              {/* 任务选择——终端行设计（无矩形框） */}
              <div style={{ marginBottom: 28 }}>
                {/* 顶部单线 */}
                <div style={{ height: 1, background: '#1a1a35' }} />

                {MISSIONS.map((m, idx) => {
                  const isSel    = mission === m.id
                  const isHov    = hoveredMission === m.id
                  const isActive = isSel || isHov
                  const isLocked = aiState !== 'idle' && !isSel
                  return (
                    <div key={m.id}>
                      <div
                        onClick={() => !isLocked && aiState === 'idle' && handleMissionSelect(m.id)}
                        onMouseEnter={() => !isLocked && setHoveredMission(m.id)}
                        onMouseLeave={() => setHoveredMission(null)}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          cursor: isLocked ? 'default' : 'pointer',
                          opacity: isLocked ? 0.18 : 1,
                          transition: 'opacity 0.25s',
                        }}
                      >
                        {/* 左侧激活竖线（选中时展开） */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                          background: '#8b6cf8',
                          transform: isSel ? 'scaleY(1)' : 'scaleY(0)',
                          transformOrigin: 'center',
                          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
                          pointerEvents: 'none',
                        }} />

                        {/* 背景扫光（hover/选中） */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: isActive
                            ? 'linear-gradient(to right, rgba(139,108,248,0.06) 0%, transparent 65%)'
                            : 'transparent',
                          transition: 'background 0.4s ease',
                          pointerEvents: 'none',
                        }} />

                        {/* 主内容行 */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 18,
                          padding: isSel ? '22px 16px 22px 20px' : '18px 16px 18px 20px',
                          position: 'relative',
                          transition: 'padding 0.35s ease',
                        }}>
                          {/* 轨道圆形指示器 */}
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            position: 'relative',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {/* 外环 */}
                            <div style={{
                              position: 'absolute', inset: 0, borderRadius: '50%',
                              border: `1px solid ${isSel ? '#8b6cf8' : isHov ? 'rgba(139,108,248,0.35)' : '#2a2a48'}`,
                              transition: 'border-color 0.3s ease',
                            }} />
                            {/* 内核点（选中时填充） */}
                            <div style={{
                              width: isSel ? 10 : 4, height: isSel ? 10 : 4,
                              borderRadius: '50%',
                              background: isSel ? '#8b6cf8' : isHov ? 'rgba(139,108,248,0.4)' : '#2a2a48',
                              transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                            }} />
                            {/* 序号 */}
                            <span style={{
                              position: 'absolute',
                              fontFamily: '"Space Mono", monospace', fontSize: 8,
                              color: isSel ? '#8b6cf8' : '#484878',
                              letterSpacing: '0.05em', lineHeight: 1,
                              bottom: -14,
                              transition: 'color 0.35s ease',
                            }}>
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </div>

                          {/* 连接短线 */}
                          <div style={{
                            width: isActive ? 14 : 8, height: 1,
                            background: isSel ? '#8b6cf8' : '#2a2a48',
                            flexShrink: 0,
                            transition: 'all 0.35s ease',
                          }} />

                          {/* 文字内容 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                              <span style={{
                                fontFamily: '"Space Mono", monospace', fontSize: 8,
                                color: isSel ? '#8b6cf8' : isHov ? 'rgba(139,108,248,0.55)' : '#484878',
                                letterSpacing: '0.14em', textTransform: 'uppercase',
                                transition: 'color 0.3s ease',
                              }}>
                                {m.labelEn}
                              </span>
                              <span style={{
                                fontFamily: '"Noto Serif SC", serif', fontSize: 15,
                                color: isActive ? '#e8e8f8' : 'rgba(232,232,248,0.5)',
                                transition: 'color 0.3s ease',
                              }}>
                                {m.label}
                              </span>
                            </div>
                            <div style={{
                              fontFamily: '"Noto Sans SC", sans-serif', fontSize: 12,
                              color: isSel ? 'rgba(232,232,248,0.62)' : isHov ? 'rgba(232,232,248,0.38)' : 'rgba(232,232,248,0.22)',
                              lineHeight: 1.78,
                              maxHeight: isActive ? '80px' : '0px',
                              overflow: 'hidden',
                              transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1), color 0.3s ease',
                            }}>
                              {m.desc}
                            </div>

                            {/* 选中展开详情 */}
                            {isSel && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                transition={{ duration: 0.38, ease: EASE }}
                                style={{ display: 'flex', gap: 28, marginTop: 12, overflow: 'hidden' }}
                              >
                                {[{ l: '典型案例', v: m.example }, { l: '轨道偏好', v: m.orbit }].map(({ l, v }) => (
                                  <div key={l}>
                                    <div style={{
                                      fontFamily: '"Space Mono", monospace', fontSize: 7,
                                      color: '#484878', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
                                    }}>
                                      {l}
                                    </div>
                                    <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 12, color: '#8b6cf8' }}>
                                      {v}
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </div>

                          {/* 右侧箭头指示（选中/hover时出现） */}
                          <div style={{
                            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                            opacity: isActive ? 1 : 0,
                            transform: isActive ? 'translateX(0)' : 'translateX(-10px)',
                            transition: 'opacity 0.3s ease, transform 0.35s ease',
                          }}>
                            <div style={{ width: 18, height: 1, background: isSel ? '#8b6cf8' : 'rgba(139,108,248,0.4)' }} />
                            <div style={{ width: 5, height: 5, borderTop: '1px solid #8b6cf8', borderRight: '1px solid #8b6cf8', transform: 'rotate(45deg)', opacity: isSel ? 1 : 0.5 }} />
                          </div>
                        </div>
                      </div>
                      {/* 每行底部单线 */}
                      <div style={{ height: 1, background: '#1a1a35' }} />
                    </div>
                  )
                })}
              </div>

              {/* AI 加载状态 */}
              <AnimatePresence>
                {aiState === 'loading' && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '16px 20px', background: 'rgba(8,8,26,0.72)',
                      border: '1px solid #1a1a35',
                    }}
                  >
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%', background: '#8b6cf8',
                      animation: 'blink 1.2s ease infinite', flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: '"Space Mono", monospace', fontSize: 8,
                      color: '#484878', letterSpacing: '0.14em',
                    }}>
                      GENERATING MISSION NARRATIVE...
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI 故事 + 继续按钮 */}
              <AnimatePresence>
                {(aiState === 'done' || aiState === 'error') && (
                  <motion.div
                    key="story"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: EASE }}
                  >
                    {/* 任务元信息 */}
                    {mission && (() => {
                      const sel = MISSIONS.find((m) => m.id === mission)
                      return (
                        <div style={{ display: 'flex', gap: 24, marginBottom: 18, flexWrap: 'wrap' }}>
                          {[{ l: '轨道', v: sel.orbit }, { l: '典型案例', v: sel.example }].map(({ l, v }) => (
                            <div key={l} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                              <span style={{
                                fontFamily: '"Space Mono", monospace', fontSize: 7,
                                color: '#484878', letterSpacing: '0.1em', textTransform: 'uppercase',
                              }}>
                                {l}
                              </span>
                              <span style={{
                                fontFamily: '"Noto Sans SC", sans-serif',
                                fontSize: 12, color: 'rgba(232,232,248,0.5)',
                              }}>
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* 故事文本 */}
                    <div style={{ borderTop: '1px solid #1a1a35', paddingTop: 22, marginBottom: 24 }}>
                      <div style={{
                        fontFamily: '"Space Mono", monospace', fontSize: 8,
                        color: '#8b6cf8', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16,
                      }}>
                        第二段 · 任务展开 · {satellite?.name ?? ''}
                      </div>
                      <p className="story-text" style={{ margin: 0 }}>
                        {aiState === 'done' ? story : '叙事生成失败，任务已记录，继续下一章。'}
                      </p>
                    </div>

                    {/* 继续按钮——轨道线箭头设计（非矩形） */}
                    <div
                      onClick={onComplete}
                      onMouseEnter={() => setBtnHov(true)}
                      onMouseLeave={() => setBtnHov(false)}
                      style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', gap: 8, userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* 左侧引导线 */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                        }}>
                          {[0, 1, 2].map((k) => (
                            <div key={k} style={{
                              height: 1,
                              width: btnHov ? (k === 2 ? 16 : 8) : 5,
                              background: `rgba(139,108,248,${0.3 + k * 0.2})`,
                              transition: `width ${0.3 + k * 0.08}s ease`,
                            }} />
                          ))}
                        </div>

                        {/* 文字 */}
                        <span style={{
                          fontFamily: '"Space Mono", monospace', fontSize: 10,
                          letterSpacing: '0.16em', textTransform: 'uppercase',
                          color: btnHov ? '#e8e8f8' : '#8b6cf8',
                          transition: 'color 0.3s ease',
                        }}>
                          进入下一章 · M3 历史事件
                        </span>

                        {/* 右侧箭头序列 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <div style={{
                            width: btnHov ? 24 : 12, height: 1,
                            background: '#8b6cf8',
                            transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
                          }} />
                          {/* 箭头头 */}
                          <div style={{
                            width: 6, height: 6,
                            borderTop: '1.5px solid #8b6cf8',
                            borderRight: '1.5px solid #8b6cf8',
                            transform: `rotate(45deg) translateX(${btnHov ? 3 : 0}px)`,
                            transition: 'transform 0.35s ease',
                          }} />
                        </div>
                      </div>

                      {/* 底部扫线 */}
                      <div style={{
                        height: 1,
                        width: btnHov ? '100%' : '48%',
                        background: '#8b6cf8',
                        transition: 'width 0.55s cubic-bezier(0.16,1,0.3,1)',
                      }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </div>

          </div>{/* 章节内容区 end */}
        </div>{/* 左列 end */}

        {/* ── 右列：脱离文档流，absolute 外壳 + sticky 内层 ── */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '48%',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
        <div style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          pointerEvents: 'auto',
        }}>

          {/* 3D 地球 — absolute 固定居中，不受下方 UI 影响 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100% - 40px)',
          }}>
            <OrbitGlobe
              satellite={satellite}
              height={420}
              activeOrbit={activeOrbit}
              currentStep={currentStep}
              mission={mission}
            />
          </div>

          {/* 信息面板统一锚定到底部 */}
          <div style={{ position: 'absolute', bottom: 24, left: 16, right: 24 }}>

          {/* ── hover 轨道信息浮层（step 0 专属）── */}
          <AnimatePresence mode="wait">
            {currentStep === 0 && activeOrbit && (() => {
              const orb = ORBITS.find((o) => o.id === activeOrbit)
              return (
                <motion.div
                  key={activeOrbit}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.28 }}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: '14px 16px',
                    background: 'rgba(8,8,26,0.88)',
                    border: `1px solid ${orb.color}30`,
                    borderLeft: `2px solid ${orb.color}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      fontFamily: '"Space Mono", monospace', fontSize: 20,
                      color: orb.color, letterSpacing: '-0.02em', lineHeight: 1,
                    }}>
                      {orb.name}
                    </span>
                    <span style={{
                      fontFamily: '"Noto Sans SC", sans-serif', fontSize: 11,
                      color: 'rgba(232,232,248,0.38)',
                    }}>
                      {orb.full}
                    </span>
                    <span style={{
                      marginLeft: 'auto',
                      fontFamily: '"Space Mono", monospace', fontSize: 8,
                      color: orb.riskColor, letterSpacing: '0.1em',
                    }}>
                      {orb.risk}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {[
                      { l: '碎片', v: orb.debrisLabel },
                      { l: '高度', v: orb.alt },
                      { l: '周期', v: orb.period },
                    ].map(({ l, v }) => (
                      <div key={l}>
                        <div style={{
                          fontFamily: '"Space Mono", monospace', fontSize: 7,
                          color: '#484878', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3,
                        }}>{l}</div>
                        <div style={{
                          fontFamily: '"Space Mono", monospace', fontSize: 11,
                          color: orb.color,
                        }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })()}
          </AnimatePresence>

          {/* 动态图例（随步骤切换） */}
          <div style={{ width: '100%', marginTop: activeOrbit ? 8 : 14 }}>
            <AnimatePresence mode="wait">
              {currentStep === 0 && (
                <motion.div
                  key="leg-0"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  {[
                    { id: null,   l: `${satellite?.name ?? 'YOUR SAT'} · ${alt} KM`, c: '#6b7fff', w: 20 },
                    { id: 'leo',  l: 'LEO · 200–2,000 KM',    c: '#6b7fff', w: 18 },
                    { id: 'meo',  l: 'MEO · 2,000–35,786 KM', c: '#8b6cf8', w: 18 },
                    { id: 'geo',  l: 'GEO · 35,786 KM',        c: '#8b6cf8', w: 18 },
                  ].map(({ id, l, c, w }) => {
                    const isActive = id !== null && activeOrbit === id
                    const isDimmed = activeOrbit !== null && id !== null && activeOrbit !== id
                    return (
                      <div key={l} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        opacity: isDimmed ? 0.28 : 1,
                        transition: 'opacity 0.3s ease',
                      }}>
                        <div style={{
                          width: isActive ? 28 : w, height: isActive ? 2 : 1,
                          background: c,
                          flexShrink: 0,
                          transition: 'all 0.35s ease',
                        }} />
                        <span style={{
                          fontFamily: '"Space Mono", monospace', fontSize: 8,
                          color: isActive ? c : '#484878',
                          letterSpacing: '0.08em',
                          transition: 'color 0.3s ease',
                        }}>
                          {l}
                        </span>
                      </div>
                    )
                  })}
                  <div style={{
                    fontFamily: '"Space Mono", monospace', fontSize: 7,
                    color: '#2a2a40', marginTop: 2, letterSpacing: '0.06em',
                  }}>
                    * 轨道半径非等比例缩放
                  </div>
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div
                  key="leg-1"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
                  style={{
                    padding: '14px 18px', background: 'rgba(139,108,248,0.05)',
                    border: '1px solid rgba(139,108,248,0.18)',
                  }}
                >
                  <div style={{
                    fontFamily: '"Space Mono", monospace', fontSize: 8,
                    color: '#8b6cf8', letterSpacing: '0.14em', marginBottom: 8,
                  }}>
                    {satellite?.name ?? 'SATELLITE'} · {orbitZone}
                  </div>
                  <div style={{
                    fontFamily: '"Space Mono", monospace', fontSize: 20,
                    color: '#6b7fff', marginBottom: 4,
                  }}>
                    {alt} km
                  </div>
                  <div style={{
                    fontFamily: '"Noto Sans SC", sans-serif',
                    fontSize: 11, color: 'rgba(232,232,248,0.42)', lineHeight: 1.7,
                  }}>
                    倾角 {satellite?.inclination ?? '--'}° · 周期 {satellite?.periodMin ?? '--'} min
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="leg-2"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
                  style={{
                    padding: '14px 18px', background: 'rgba(139,108,248,0.04)',
                    border: '1px solid rgba(139,108,248,0.16)',
                  }}
                >
                  <div style={{
                    fontFamily: '"Space Mono", monospace', fontSize: 8,
                    color: '#8b6cf8', letterSpacing: '0.14em', marginBottom: 8,
                  }}>
                    {mission ? 'MISSION ASSIGNED' : 'AWAITING ASSIGNMENT'}
                  </div>
                  <div style={{
                    fontFamily: '"Noto Serif SC", serif', fontSize: 16,
                    color: '#e8e8f8',
                  }}>
                    {mission
                      ? MISSIONS.find((m) => m.id === mission)?.label ?? mission
                      : '— 请从左侧选择任务 —'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          </div>{/* 信息面板 end */}
        </div>
        </div>{/* absolute outer end */}
      </div>
    </div>
  )
}
