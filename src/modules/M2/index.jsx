import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateMissionStory } from '../../services/ai'
import OrbitGlobe from './OrbitGlobe'

const EASE = [0.16, 1, 0.3, 1]

// ── 数据 ─────────────────────────────────────────────────────────────────────

const ORBITS = [
  {
    id: 'leo', name: 'LEO', full: '低地球轨道',
    alt: '200 – 2,000 km', period: '90 – 127 min',
    use: '地球观测、空间站、星座互联网',
    debris: 28000, debrisLabel: '28,000+', risk: '极高', riskColor: '#6a5a48',
    note: '最拥挤的轨道区域，铱星与 Cosmos-2251 碰撞发生于此',
  },
  {
    id: 'meo', name: 'MEO', full: '中地球轨道',
    alt: '2,000 – 35,786 km', period: '2 – 24 h',
    use: 'GPS / GNSS 导航、部分气象',
    debris: 2000, debrisLabel: '~2,000', risk: '中等', riskColor: '#4a4840',
    note: '导航星座密集，碎片少但单颗卫星价值极高',
  },
  {
    id: 'geo', name: 'GEO', full: '地球同步轨道',
    alt: '35,786 km', period: '24 h（静止）',
    use: '广播电视、通信、气象（静止）',
    debris: 900, debrisLabel: '~900', risk: '低·持久', riskColor: '#3a3830',
    note: '无大气阻力，碎片永久停留；坟墓轨道用于退役卫星',
  },
]

const MISSIONS = [
  { id: 'weather',  label: '气象监测', labelEn: 'WEATHER MONITORING',   desc: '实时追踪大气层云系、温度场与风速，为地面预报提供原始数据。', orbit: '极轨太阳同步 800–1000 km', example: '风云三号、NOAA-20' },
  { id: 'comms',   label: '通信中继', labelEn: 'COMMUNICATION RELAY',  desc: '在轨道充当无线电中继，为偏远区域、船只或飞机提供网络覆盖。', orbit: 'LEO 星座或 GEO 35,786 km',  example: '铱星系列、Starlink'  },
  { id: 'imaging', label: '地球成像', labelEn: 'EARTH OBSERVATION',    desc: '拍摄可见光或合成孔径雷达图像，用于灾害监测与资源普查。',     orbit: '太阳同步 LEO 400–800 km', example: '哨兵-2A、LANDSAT 8'  },
  { id: 'science', label: '科学探测', labelEn: 'SCIENTIFIC RESEARCH',  desc: '搭载精密仪器观测宇宙射线、地磁场或太阳粒子。',                 orbit: '视载荷需求，各轨道均有', example: 'Swarm、GRACE-FO'      },
]

// ── 子组件 ────────────────────────────────────────────────────────────────────

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: '#484878',
      marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #1a1a18',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function M2({ onComplete }) {
  const satellite       = useAppStore((s) => s.satellite)
  const user            = useAppStore((s) => s.user)
  const storyOutline    = useAppStore((s) => s.storyOutline)
  const materials       = useAppStore((s) => s.materials)
  const setMission      = useAppStore((s) => s.setMission)
  const setStoryChapter = useAppStore((s) => s.setStoryChapter)

  const [mission,     setMissionLocal] = useState(null)
  const [aiState,     setAiState]      = useState('idle')
  const [story,       setStory]        = useState('')
  const [activeOrbit, setActiveOrbit]  = useState(null)

  const maxDebris = Math.max(...ORBITS.map((o) => o.debris))

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

  return (
    <div style={{ background: 'transparent', color: '#e8e8f8', minHeight: '100vh' }}>

      {/* 顶部标题栏 */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #1a1a18' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#484878', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          SPACE_DEBRIES · M2 · 轨道是什么
        </span>
      </div>

      {/* 导言 */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 32px 56px' }}>
        <h2 style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 24, fontWeight: 400, color: '#e8e8f8', lineHeight: 1.6, marginBottom: 12, letterSpacing: '0.02em' }}>
          轨道不是一条路，<br />是一个必须持续维护的状态。
        </h2>
        <p style={{ fontSize: 12, color: '#484878', lineHeight: 1.9, maxWidth: 460 }}>
          卫星以 7–8 km/s 的速度持续下坠，恰好与地球曲率匹配，形成轨道。停下来就意味着坠落。
        </p>
      </div>

      {/* ── 主体：左（科普）+ 右（地球 + 任务选择）── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 80px', display: 'flex', gap: 56, alignItems: 'flex-start' }}>

        {/* ── 左列：压缩科普内容 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* 01 三层轨道 */}
          <SectionLabel>01 · 三层轨道分类</SectionLabel>
          <div style={{ marginBottom: 48 }}>
            {ORBITS.map((orb) => {
              const isHover = activeOrbit === orb.id
              return (
                <div
                  key={orb.id}
                  onMouseEnter={() => setActiveOrbit(orb.id)}
                  onMouseLeave={() => setActiveOrbit(null)}
                  style={{
                    padding: '16px 0 16px 14px',
                    borderBottom: '1px solid #151514',
                    borderLeft: `2px solid ${isHover ? 'rgba(107,127,255,0.55)' : 'transparent'}`,
                    transition: 'border-color 0.2s ease',
                    cursor: 'default',
                  }}
                >
                  {/* 名称行 */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                    <span style={{
                      fontFamily: '"Space Mono", monospace', fontSize: 16,
                      color: isHover ? '#6b7fff' : '#e8e8f8',
                      letterSpacing: '-0.02em', transition: 'color 0.2s ease',
                    }}>{orb.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#2e2e2c', letterSpacing: '0.08em' }}>{orb.full}</span>
                    <span style={{
                      marginLeft: 'auto', fontFamily: 'monospace', fontSize: 8,
                      color: orb.riskColor, border: `1px solid ${orb.riskColor}55`,
                      padding: '1px 6px', letterSpacing: '0.06em',
                    }}>{orb.risk}</span>
                  </div>
                  {/* 参数单行 */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#6b7fff' }}>{orb.alt}</span>
                    <span style={{ fontSize: 11, color: '#484840' }}>·</span>
                    <span style={{ fontSize: 11, color: '#605850' }}>{orb.period}</span>
                    <span style={{ fontSize: 11, color: '#484840' }}>·</span>
                    <span style={{ fontSize: 11, color: '#605850' }}>{orb.debrisLabel} 已编目碎片</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#282826', lineHeight: 1.7 }}>{orb.note}</div>
                </div>
              )
            })}
          </div>

          {/* 02 你的卫星 */}
          <SectionLabel>02 · 你的卫星轨道状态</SectionLabel>
          <div style={{ marginBottom: 48 }}>
            {satellite ? (
              <div>
                {/* 名称行 */}
                <div style={{ padding: '10px 0 10px 14px', borderBottom: '1px solid #151514', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 15, color: '#e8e8f8' }}>{satellite.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#2e2e2c', letterSpacing: '0.08em' }}>NORAD #{satellite.noradId}</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#6b7fff', border: '1px solid rgba(107,127,255,0.3)', padding: '2px 8px', letterSpacing: '0.08em' }}>
                    {orbitZone}
                  </span>
                </div>
                {/* 参数行 */}
                {[
                  { l: '轨道高度', v: `${satellite.altitudeKm} km` },
                  { l: '轨道倾角', v: `${satellite.inclination}°` },
                  { l: '轨道周期', v: `${satellite.periodMin} min` },
                  { l: '发射年份', v: `${satellite.launchYear}` },
                ].map(({ l, v }) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0 9px 14px', borderBottom: '1px solid #111110' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#2e2e2c', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</span>
                    <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, color: '#6b7fff' }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#4a4a48' }}>请先在入口处匹配卫星。</p>
            )}
          </div>

          {/* 03 碎片密度 */}
          <SectionLabel>03 · 各轨道碎片密度</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {ORBITS.map((orb, i) => (
              <div key={orb.id} style={{ padding: '12px 0 12px 14px', borderBottom: '1px solid #111110' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#706860', letterSpacing: '0.06em' }}>{orb.name} · {orb.full}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: '#e8e8f8' }}>{orb.debrisLabel}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 8, color: orb.riskColor, padding: '1px 6px', border: `1px solid ${orb.riskColor}50`, letterSpacing: '0.06em' }}>{orb.risk}</span>
                  </span>
                </div>
                <div style={{ height: 2, background: '#1a1a35' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(orb.debris / maxDebris) * 100}%` }}
                    transition={{ duration: 1.2, ease: EASE, delay: i * 0.15 }}
                    viewport={{ once: true }}
                    style={{ height: '100%', background: '#6a5a48' }}
                  />
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ── 右列：3D 地球 + 任务选择 ── */}
        <div style={{ width: 430, flexShrink: 0 }}>

          {/* 3D 地球 */}
          <OrbitGlobe satellite={satellite} height={360} activeOrbit={activeOrbit} />

          {/* 图例 */}
          <div style={{ paddingTop: 10, paddingBottom: 20, borderBottom: '1px solid #1a1a18', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: `${satellite?.name ?? 'YOUR SATELLITE'} · ${alt} KM`, opacity: 1 },
              { label: 'LEO · 200–2,000 KM',    opacity: 0.62 },
              { label: 'MEO · 2,000–35,786 KM', opacity: 0.40 },
              { label: 'GEO · 35,786 KM',        opacity: 0.24 },
            ].map(({ label, opacity }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 2, background: '#6b7fff', flexShrink: 0, opacity }} />
                <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#2e2e2c', letterSpacing: '0.08em' }}>{label}</span>
              </div>
            ))}
            <div style={{ fontFamily: 'monospace', fontSize: 7, color: '#1e1e1c', letterSpacing: '0.06em', marginTop: 1 }}>* 轨道半径非等比例缩放</div>
          </div>

          {/* 04 任务选择 */}
          <div style={{ paddingTop: 20 }}>
            <SectionLabel style={{ marginBottom: 10 }}>04 · 为卫星指定任务</SectionLabel>
            <p style={{ fontSize: 11, color: '#4a4a48', lineHeight: 1.8, marginBottom: 14 }}>
              选择一项主任务，它将影响接下来的故事走向。
            </p>

            {/* 细长任务条 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {MISSIONS.map((m) => {
                const isSel    = mission === m.id
                const isLocked = aiState !== 'idle' && !isSel
                return (
                  <div
                    key={m.id}
                    onClick={() => !isLocked && aiState === 'idle' && handleMissionSelect(m.id)}
                    style={{
                      padding: '12px 14px',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      background: isSel ? 'rgba(107,127,255,0.07)' : '#0d0d0c',
                      borderLeft: isSel ? '2px solid #6b7fff' : '2px solid #1a1a18',
                      cursor: isLocked ? 'default' : 'pointer',
                      opacity: isLocked ? 0.28 : 1,
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                      background: isSel ? '#6b7fff' : 'transparent',
                      border: `1px solid ${isSel ? '#6b7fff' : '#303030'}`,
                      transition: 'all 0.15s',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 8, color: isSel ? '#6b7fff' : '#303028', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                          {m.labelEn}
                        </span>
                        <span style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 13, color: isSel ? '#6b7fff' : '#908880' }}>
                          {m.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: isSel ? '#484878' : '#383634', lineHeight: 1.7 }}>
                        {m.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>

        </div>
      </div>

      {/* ── AI 故事 + 继续按钮 — 两列下方全宽 ── */}
      <AnimatePresence>
        {aiState === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 32px' }}
          >
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6b7fff', animation: 'blink 1.2s ease infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#4a4a48', letterSpacing: '0.14em' }}>
              GENERATING MISSION NARRATIVE...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(aiState === 'done' || aiState === 'error') && (
          <motion.div
            key="story-full"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            {/* 故事文本 — 居中窄列 */}
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 32px' }}>
              <div style={{ borderTop: '1px solid #1a1a18', paddingTop: 28, marginBottom: 32 }}>
                {/* 任务元信息 */}
                {mission && (() => {
                  const sel = MISSIONS.find((m) => m.id === mission)
                  return (
                    <div style={{ display: 'flex', gap: 28, marginBottom: 20, flexWrap: 'wrap' }}>
                      {[{ l: '轨道', v: sel.orbit }, { l: '典型案例', v: sel.example }].map(({ l, v }) => (
                        <div key={l} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#2e2e2c', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</span>
                          <span style={{ fontSize: 11, color: '#5a5248' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#6b7fff', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
                  第二段 · 任务展开 · {satellite?.name ?? ''}
                </div>
                <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 15, color: 'rgba(245,244,240,0.80)', lineHeight: 2.1 }}>
                  {aiState === 'done' ? story : '叙事生成失败，任务已记录，继续下一章。'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 继续按钮 — 底部居中 */}
      <AnimatePresence>
        {(aiState === 'done' || aiState === 'error') && (
          <motion.div
            key="proceed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
            style={{ textAlign: 'center', padding: '40px 32px 72px' }}
          >
            <div
              onClick={onComplete}
              style={{
                display: 'inline-block',
                fontFamily: 'monospace', fontSize: 11,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '16px 48px', cursor: 'pointer',
                border: '1px solid rgba(107,127,255,0.45)', color: '#6b7fff',
                transition: 'background 0.18s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(107,127,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              进入下一章：重大历史事件 →
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}


