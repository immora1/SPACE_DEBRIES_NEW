import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateReentryEnding } from '../../services/ai'

const MONO = 'Space Mono, monospace'
const SERIF = 'Noto Serif SC, serif'
const SANS = 'Noto Sans SC, sans-serif'
const EASE = [0.16, 1, 0.3, 1]

const MATERIAL_SURVIVAL = {
  '铝合金':      { rate: '~10%', flame: '#ffa040', note: '熔点 660°C，主结构在 80–90km 高度完全烧蚀' },
  '钛合金':      { rate: '~35%', flame: '#ff6030', note: '熔点 1668°C，致密结构可穿过大气层到达地面' },
  '碳纤维':      { rate: '~5%',  flame: '#a0c8ff', note: '升华点超 3600°C，但层间剥离快，碎片极细碎' },
  '太阳能电池板': { rate: '~20%', flame: '#ffd060', note: '玻璃纤维框架部分存活，硅片在高温下碎化' },
}

const BURN_TABLE = [
  { part: '铝合金结构',   fate: '烧蚀', note: '熔点 660°C，85km 高度完全消融',         ok: true  },
  { part: '钛合金贮箱',   fate: '存活', note: '熔点 1668°C，致密件穿过大气层',           ok: false },
  { part: '碳纤维面板',   fate: '烧蚀', note: '升华但结构快速解体，碎片细小',             ok: true  },
  { part: '玻璃纤维框架', fate: '部分', note: '依厚度和再入角度，存活概率差异大',         ok: null  },
  { part: '隔热毯',       fate: '烧蚀', note: '柔性材料在 70km 高度解体',                ok: true  },
  { part: '不锈钢紧固件', fate: '存活', note: '小质量高密度，是最常见的地面落片',         ok: false },
]

const CASES = [
  {
    id: 'kosmos', year: 1978, color: '#c84840', tag: '核污染',
    title: 'Kosmos 954', subtitle: '核动力卫星失控坠落',
    location: '加拿大西北领地', lat: 62.5, lng: -113.5,
    summary: '苏联侦察卫星失控再入，铀-235 碎片散落加拿大 600km。清理费 1400 万美元，赔偿仅 300 万。',
    detail: '1978年1月24日，Kosmos 954 因冷却系统故障失控再入，核反应堆在距地约 60km 处解体，放射性碎片散落西北领地与萨斯喀彻温省。加拿大出动军队耗时 4 个月清理，共回收约 50 件放射性碎片。此案第一次将"轨道物体再入损害赔偿责任"从理论推上国际法庭，但最终赔付额仅为实际损失的五分之一，执行机制的缺陷由此暴露。',
  },
  {
    id: 'lottie', year: 1997, color: '#4888c8', tag: '人员接触',
    title: 'Lottie Williams', subtitle: '唯一被太空垃圾击中的人',
    location: '美国俄克拉荷马州', lat: 36.1, lng: -95.9,
    summary: '清晨晨跑时被 Delta II 火箭不锈钢碎片（约 140g）击中肩部，无大碍。',
    detail: '1997年1月22日，Lottie Williams 在塔尔萨市晨跑时感觉肩膀被轻拍，地面发现一块约手掌大小的烧蚀金属。经鉴定来自 1996 年发射的 Delta II 火箭燃料箱——高熔点不锈钢（~1400°C）未被大气完全烧蚀，重约 140g。她是迄今有文字记录、唯一被再入太空碎片直接接触的人类。统计学估计此类事件发生于特定个人身上的概率约为被雷击的百分之一。',
  },
  {
    id: 'florida', year: 2024, color: '#c89040', tag: '法律悬案',
    title: '佛罗里达屋顶穿透事件', subtitle: 'ISS 废弃电池组件',
    location: '美国佛罗里达州那不勒斯', lat: 26.1, lng: -81.7,
    summary: 'ISS 废弃镍氢电池托盘碎片（约 725g）穿透民宅屋顶及两层楼板。NASA 确认来源，诉讼进行中。',
    detail: '2024年3月8日，一块重约 725g 的金属从天穿透那不勒斯市某居民屋顶，贯穿两层楼板后停在一楼。NASA 数周后确认该碎片来自 2021 年从 ISS 抛入轨道的废旧镍氢电池托盘，原预计完全烧蚀，但实际大量残存。业主 Alejandro Otero 聘请律师向 NASA 提出民事索赔，成为美国本土首例涉及 NASA 的太空碎片民事诉讼。此案结果将直接影响国际空间法中再入损害赔偿条款的实际执行力。诉讼至今未有终审结果。',
  },
  {
    id: 'skylab', year: 1979, color: '#408880', tag: '轨迹偏差',
    title: 'Skylab 天空实验室', subtitle: '首个空间站失控再入',
    location: '澳大利亚西部荒漠', lat: -28.5, lng: 119.5,
    summary: '77 吨空间站失控，碎片偏离预定南印度洋落点，散落澳大利亚。当地市政向 NASA 开出垃圾罚款。',
    detail: '1979年7月11日，NASA Skylab（总重 77.1 吨）因轨道自然衰减失控再入。姿态调整失效，碎片散落西澳大利亚埃斯佩兰斯地区，最重单块约 900kg，无人员伤亡。埃斯佩兰斯市政以"违规倾倒垃圾"为由向 NASA 开出 400 澳元罚单，NASA 在 30 年后才想起寄出这笔钱。这是人类历史上第一次大型空间站非受控再入，其经历成为此后所有空间站离轨规划的参照样本。',
  },
]

const MAP_MARKERS = [
  { id: 'kosmos',   lat: 62.5,  lng: -113.5, year: 1978, name: 'Kosmos 954',      color: '#c84840' },
  { id: 'lottie',   lat: 36.1,  lng: -95.9,  year: 1997, name: 'Lottie Williams', color: '#4888c8' },
  { id: 'florida',  lat: 26.1,  lng: -81.7,  year: 2024, name: '佛罗里达事件',    color: '#c89040' },
  { id: 'skylab',   lat: -28.5, lng: 119.5,  year: 1979, name: 'Skylab',          color: '#408880' },
  { id: 'mir',      lat: -44,   lng: -150,   year: 2001, name: 'Mir 受控再入',     color: '#606090' },
  { id: 'columbia', lat: 31.5,  lng: -95,    year: 2003, name: 'Columbia 碎片',   color: '#906060' },
]

function latLngToXY(lat, lng) {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  }
}

// ─── Geometry constants (shared center → concentric) ─────────────────────────
// ViewBox 560×280. Earth+Orbit share center (100, 500) off bottom-left.
// Earth surface arc: from (0,82) curving to (469,280)
// Orbit arc: enters top at (413,0), passes (490,70), exits right ~(560,130)
// Satellite on orbit: (490, 70)
// Impact on Earth surface (30° from vertical): (315, 128)
// Track: quadratic bezier P0→CP→P2 — single control, guaranteed smooth arc
const GEO = {
  ECX: 100, ECY: 500, ER: 430,    // Earth
  OR: 590,                          // Orbit radius (same center)
  SAT_X: 490, SAT_Y: 70,           // satellite on orbit
  IMP_X: 315, IMP_Y: 128,          // impact on Earth surface
  CP_X: 400,  CP_Y: 130,           // bezier control (slightly below straight line)
  // Phase positions along bezier (t=0, 0.35, 0.65, 1)
  POS: [
    [490, 70],
    [428, 104],
    [375, 122],
    [315, 128],
  ],
}

// ─── Re-entry diagram — vintage engraving + image-2 composition ──────────────
function ReentryVis({ material }) {
  const info = MATERIAL_SURVIVAL[material] || MATERIAL_SURVIVAL['铝合金']
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 900)
    const t2 = setTimeout(() => setPhase(2), 2700)
    const t3 = setTimeout(() => setPhase(3), 4600)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [])

  const { ECX, ECY, ER, OR, SAT_X, SAT_Y, IMP_X, IMP_Y, CP_X, CP_Y, POS } = GEO
  const [px, py] = POS[Math.min(phase, 3)]

  // 14 dots along quadratic bezier: P0→CP→P2 (single control = no S-curve)
  const dots = useMemo(() => {
    const n = 14
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1)
      const mt = 1 - t
      return {
        x: mt * mt * SAT_X + 2 * mt * t * CP_X + t * t * IMP_X,
        y: mt * mt * SAT_Y + 2 * mt * t * CP_Y + t * t * IMP_Y,
        t,
      }
    })
  }, [])

  const INK     = '#d8cfbc'
  const INK_DIM = '#6a6055'

  return (
    <div style={{
      position: 'relative',
      background: '#0a0906',
      border: '1px solid #2a2520',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 4,
    }}>
      {/* Scanline texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 3px)',
      }} />

      <svg width="100%" viewBox="0 0 560 280" style={{ display: 'block' }}>
        <defs>
          <clipPath id="earthClipM5">
            <circle cx={ECX} cy={ECY} r={ER} />
          </clipPath>
        </defs>

        {/* ── Star field: engraving cross-marks ── */}
        {[
          [35,18],[95,12],[175,30],[255,10],[335,24],[420,8],[505,35],[545,15],
          [55,65],[160,52],[240,42],[340,60],[450,48],[530,70],
          [75,108],[200,92],[310,105],[430,95],[510,115],
          [30,155],[140,142],[260,158],[380,145],
        ].map(([sx, sy], i) => (
          <g key={i} opacity={0.28 + (i % 4) * 0.08}>
            <line x1={sx-2} y1={sy} x2={sx+2} y2={sy} stroke={INK} strokeWidth="0.8"/>
            <line x1={sx} y1={sy-2} x2={sx} y2={sy+2} stroke={INK} strokeWidth="0.8"/>
          </g>
        ))}

        {/* ── Earth: filled + diagonal hatch ── */}
        <circle cx={ECX} cy={ECY} r={ER} fill="#100e0a"/>
        {Array.from({ length: 32 }, (_, i) => (
          <line key={i}
            x1={ECX - ER + i * 28} y1={ECY - ER}
            x2={ECX - ER + i * 28 - 90} y2={ECY + ER}
            stroke={INK_DIM} strokeWidth="0.55" opacity="0.18"
            clipPath="url(#earthClipM5)"
          />
        ))}
        {/* Earth outline */}
        <circle cx={ECX} cy={ECY} r={ER}
          fill="none" stroke={INK} strokeWidth="1.6"/>
        {/* Atmosphere halos (same center) */}
        <circle cx={ECX} cy={ECY} r={ER + 16}
          fill="none" stroke={INK} strokeWidth="0.5" opacity="0.20" strokeDasharray="5 9"/>
        <circle cx={ECX} cy={ECY} r={ER + 30}
          fill="none" stroke={INK} strokeWidth="0.35" opacity="0.11" strokeDasharray="3 11"/>

        {/* ── Orbit: SAME center, larger radius ── */}
        <circle cx={ECX} cy={ECY} r={OR}
          fill="none" stroke={INK} strokeWidth="1.1" opacity="0.52"/>

        {/* ── Labels ── */}
        {/* EARTH */}
        <text x="52" y="180" fill={INK} fontSize="14"
          fontFamily="Georgia, serif" letterSpacing="3" opacity="0.68">
          EARTH
        </text>

        {/* ORBIT — leader line from orbit arc at ~(450,26) */}
        <line x1="450" y1="28" x2="432" y2="14"
          stroke={INK} strokeWidth="0.8" opacity="0.45"/>
        <text x="378" y="12" fill={INK} fontSize="12"
          fontFamily="Georgia, serif" letterSpacing="2" opacity="0.62">
          ORBIT
        </text>

        {/* ── Track dots (quadratic bezier, monotone arc) ── */}
        {dots.map((d, i) => {
          const vis = d.t <= phase / 2.5
          return (
            <motion.circle
              key={i}
              cx={d.x} cy={d.y}
              r={1.3 + (1 - d.t) * 0.5}
              fill={INK}
              initial={{ opacity: 0 }}
              animate={{ opacity: vis ? (0.38 + d.t * 0.42) : 0 }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            />
          )
        })}

        {/* TRACK label — midpoint of bezier at t=0.5 ≈ (401,115) */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <line x1="403" y1="116" x2="424" y2="103"
                stroke={INK} strokeWidth="0.7" opacity="0.4"/>
              <text x="426" y="101" fill={INK} fontSize="11"
                fontFamily="Georgia, serif" letterSpacing="2" opacity="0.52">
                TRACK
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Satellite — centered at (0,0), group translated to position ── */}
        <motion.g
          initial={{ x: SAT_X, y: SAT_Y, rotate: 0 }}
          animate={{
            x: px, y: py,
            rotate: phase >= 2 ? 40 : phase >= 1 ? 14 : 0,
          }}
          transition={{ duration: phase === 1 ? 1.8 : phase === 2 ? 1.9 : 0.3, ease: 'easeIn' }}
          style={{ opacity: phase >= 3 ? 0 : 1 }}
        >
          {/* Solar panels */}
          {phase < 2 && <>
            <rect x="-24" y="-4" width="12" height="8"
              fill="#100e0a" stroke={INK} strokeWidth="0.9" opacity="0.72"/>
            <line x1="-24" y1="0" x2="-12" y2="0"
              stroke={INK} strokeWidth="0.4" opacity="0.3"/>
            <rect x="12" y="-4" width="12" height="8"
              fill="#100e0a" stroke={INK} strokeWidth="0.9" opacity="0.72"/>
            <line x1="12" y1="0" x2="24" y2="0"
              stroke={INK} strokeWidth="0.4" opacity="0.3"/>
          </>}
          {/* Body — cross-hatched square */}
          <rect x="-11" y="-11" width="22" height="22"
            fill="#100e0a"
            stroke={INK} strokeWidth={phase >= 1 ? '0.8' : '1.4'}
            opacity={phase >= 2 ? 0.55 : 1}/>
          {phase < 1 && <>
            <line x1="-11" y1="-11" x2="11" y2="11"
              stroke={INK} strokeWidth="0.5" opacity="0.32"/>
            <line x1="11" y1="-11" x2="-11" y2="11"
              stroke={INK} strokeWidth="0.5" opacity="0.32"/>
          </>}
          {/* Antenna */}
          {phase < 1 && (
            <line x1="0" y1="-11" x2="0" y2="-20"
              stroke={INK} strokeWidth="0.8" opacity="0.55"/>
          )}
          {/* Ablation — engraving tapered strokes */}
          {phase >= 1 && (
            <motion.g
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.32, repeat: Infinity }}
            >
              <line x1="-4" y1="11" x2="-10" y2="30"
                stroke={INK} strokeWidth="1.1" opacity={phase >= 2 ? 0.9 : 0.65}/>
              <line x1="0" y1="11" x2="0" y2="35"
                stroke={INK} strokeWidth="1.4" opacity={phase >= 2 ? 1 : 0.75}/>
              <line x1="4" y1="11" x2="9" y2="29"
                stroke={INK} strokeWidth="1.1" opacity={phase >= 2 ? 0.9 : 0.65}/>
              {phase >= 2 && <>
                <line x1="-8" y1="13" x2="-18" y2="42"
                  stroke={INK} strokeWidth="0.7" opacity="0.4"/>
                <line x1="8" y1="13" x2="17" y2="40"
                  stroke={INK} strokeWidth="0.7" opacity="0.4"/>
              </>}
            </motion.g>
          )}
        </motion.g>

        {/* SATELLITE label — only visible on orbit (phase < 2) */}
        <AnimatePresence>
          {phase < 2 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <line x1={SAT_X + 13} y1={SAT_Y - 5} x2={SAT_X + 28} y2={SAT_Y - 16}
                stroke={INK} strokeWidth="0.7" opacity="0.45"/>
              <text x={SAT_X + 30} y={SAT_Y - 12} fill={INK} fontSize="11"
                fontFamily="Georgia, serif" letterSpacing="1.5" opacity="0.65">
                SATELLITE
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Impact crater ── */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <ellipse cx={IMP_X} cy={IMP_Y + 3} rx="12" ry="5"
                fill="none" stroke={INK} strokeWidth="0.9" opacity="0.55"/>
              <ellipse cx={IMP_X} cy={IMP_Y + 3} rx="5.5" ry="2.3"
                fill="none" stroke={INK} strokeWidth="0.65" opacity="0.35"/>
              {[[-15,-7],[-7,-19],[3,-14],[12,-6],[-2,-21]].map(([dx, dy], i) => (
                <line key={i}
                  x1={IMP_X} y1={IMP_Y + 3}
                  x2={IMP_X + dx} y2={IMP_Y + dy}
                  stroke={INK} strokeWidth="0.6" opacity="0.4"/>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Status + material note ── */}
        <motion.text
          key={phase} x="32" y="270"
          fill={INK_DIM} fontSize="10"
          fontFamily="'Space Mono', monospace" letterSpacing="1.5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        >
          {phase === 0 && 'ORBITAL DECAY'}
          {phase === 1 && 'ATMOSPHERIC ENTRY'}
          {phase === 2 && 'ABLATION IN PROGRESS'}
          {phase >= 3 && `IMPACT  ·  SURVIVAL  ${info.rate}`}
        </motion.text>

        <AnimatePresence>
          {phase >= 3 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <rect x="165" y="40" width="248" height="66" rx="1"
                fill="#100e0a" stroke={INK} strokeWidth="0.8" opacity="0.92"/>
              {[[165,40],[413,40],[165,106],[413,106]].map(([rx, ry], i) => (
                <g key={i}>
                  <line
                    x1={rx + (i % 2 === 0 ? 4 : -4)} y1={ry}
                    x2={rx + (i % 2 === 0 ? 10 : -10)} y2={ry}
                    stroke={INK} strokeWidth="0.6" opacity="0.38"/>
                  <line
                    x1={rx} y1={ry + (i < 2 ? 4 : -4)}
                    x2={rx} y2={ry + (i < 2 ? 10 : -10)}
                    stroke={INK} strokeWidth="0.6" opacity="0.38"/>
                </g>
              ))}
              <text x="181" y="61" fill={INK} fontSize="10"
                fontFamily="'Space Mono', monospace" letterSpacing="1" opacity="0.80">
                {material}  ·  {info.rate} SURVIVES
              </text>
              <foreignObject x="181" y="69" width="214" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'Georgia, serif', fontSize: '10px',
                  color: '#7a7060', lineHeight: 1.55,
                }}>
                  {info.note}
                </div>
              </foreignObject>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Double border frame ── */}
        <rect x="5" y="5" width="550" height="270" rx="1"
          fill="none" stroke={INK} strokeWidth="0.6" opacity="0.17"/>
        <rect x="9" y="9" width="542" height="262" rx="1"
          fill="none" stroke={INK} strokeWidth="0.3" opacity="0.09"/>
      </svg>
    </div>
  )
}

// ─── Case archive ────────────────────────────────────────────────────────────
function CaseArchive({ openedIds, onOpen }) {
  const [activeId, setActiveId] = useState(null)
  const active = CASES.find(c => c.id === activeId)

  function handleSelect(id) {
    const next = id === activeId ? null : id
    setActiveId(next)
    if (next && !openedIds.has(next)) onOpen(next)
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
        color: '#5a5a56', marginBottom: 14,
      }}>
        <span>INCIDENT ARCHIVE</span>
        <span style={{ color: '#1e1e1c', flexGrow: 1, overflow: 'hidden' }}>{'─'.repeat(40)}</span>
        <span>{openedIds.size}/{CASES.length} READ</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {CASES.map(c => {
          const isRead = openedIds.has(c.id)
          const isActive = activeId === c.id
          return (
            <motion.button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: '#0d0d0b',
                border: `1px solid ${isActive ? c.color + '80' : isRead ? c.color + '30' : '#222220'}`,
                borderTop: `3px solid ${c.color}`,
                borderRadius: 3,
                padding: '14px 16px',
                textAlign: 'left',
                cursor: 'pointer',
                position: 'relative',
                transition: 'border-color 0.2s',
              }}
            >
              {isRead && (
                <div style={{
                  position: 'absolute', top: 8, right: 10,
                  fontFamily: MONO, fontSize: 8,
                  color: c.color, letterSpacing: '0.1em',
                }}>
                  READ
                </div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 9, color: '#5a5a56', marginBottom: 6 }}>
                {c.year} · {c.tag}
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 14, color: '#f0efe8', marginBottom: 4, fontWeight: 400 }}>
                {c.title}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: '#7a7a74', lineHeight: 1.5 }}>
                {c.subtitle}
              </div>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{
              background: '#0d0d0b',
              border: `1px solid ${active.color}35`,
              borderLeft: `3px solid ${active.color}`,
              borderRadius: 3,
              padding: '20px 24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: active.color, letterSpacing: '0.1em', marginBottom: 6 }}>
                  {active.year} · {active.location}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 17, color: '#f0efe8', fontWeight: 400 }}>
                  {active.title}
                </div>
              </div>
              <button
                onClick={() => setActiveId(null)}
                style={{
                  background: 'none', border: 'none', color: '#5a5a56',
                  cursor: 'pointer', fontFamily: MONO, fontSize: 11,
                  padding: '0 4px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontFamily: SANS, fontSize: 13, color: '#9a9a92', lineHeight: 1.85, margin: '0 0 12px' }}>
              {active.summary}
            </p>
            <div style={{ width: '100%', height: 1, background: '#1c1c1a', margin: '12px 0' }} />
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#6a6a64', lineHeight: 1.85, margin: 0 }}>
              {active.detail}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── World map ────────────────────────────────────────────────────────────────
function WorldMap({ selectedId, onSelect }) {
  const selected = MAP_MARKERS.find(m => m.id === selectedId)

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 10 }}>
        DOCUMENTED FALL LOCATIONS
      </div>
      <div style={{
        position: 'relative',
        width: '100%', paddingBottom: '50%',
        background: '#060c10',
        border: '1px solid #142014',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 10,
      }}>
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
        >
          {/* Lat/lng grid */}
          {[-60, -30, 0, 30, 60].map(lat => {
            const y = ((90 - lat) / 180) * 50
            return <line key={lat} x1="0" y1={y} x2="100" y2={y}
              stroke={lat === 0 ? '#182818' : '#0c180c'} strokeWidth={lat === 0 ? 0.4 : 0.25} />
          })}
          {[-120, -60, 0, 60, 120].map(lng => {
            const x = ((lng + 180) / 360) * 100
            return <line key={lng} x1={x} y1="0" x2={x} y2="50"
              stroke="#0c180c" strokeWidth="0.25" />
          })}

          {/* Simplified continent silhouettes */}
          {/* North America */}
          <polygon points="10,5 14,4 20,5 26,6 27,10 25,16 20,20 16,19 13,15 10,10" fill="#0e180e" />
          {/* Greenland */}
          <polygon points="28,2 33,2 33,7 29,8 27,5" fill="#0e180e" />
          {/* South America */}
          <polygon points="20,23 27,21 30,26 28,34 24,39 19,38 17,32 18,26" fill="#0e180e" />
          {/* Europe */}
          <polygon points="46,4 54,4 55,8 53,12 50,14 47,12 45,8" fill="#0e180e" />
          {/* Africa */}
          <polygon points="47,14 55,13 57,18 56,28 53,36 49,36 46,28 45,20 46,14" fill="#0e180e" />
          {/* Middle East */}
          <polygon points="55,12 65,11 67,16 63,20 57,18 55,14" fill="#0e180e" />
          {/* Asia */}
          <polygon points="55,4 80,3 82,8 78,14 72,16 65,14 58,10 55,7" fill="#0e180e" />
          {/* SE Asia */}
          <polygon points="72,16 80,15 82,20 77,24 73,22 71,18" fill="#0e180e" />
          {/* Australia */}
          <polygon points="73,28 82,27 83,34 78,37 72,36 70,32" fill="#0e180e" />
        </svg>

        {/* Markers */}
        {MAP_MARKERS.map(m => {
          const pos = latLngToXY(m.lat, m.lng)
          const isSelected = selectedId === m.id
          return (
            <motion.button
              key={m.id}
              onClick={() => onSelect(isSelected ? null : m.id)}
              whileHover={{ scale: 1.5 }}
              style={{
                position: 'absolute',
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                background: 'none', border: 'none',
                cursor: 'pointer', padding: 5, zIndex: 2,
              }}
            >
              <motion.div
                animate={isSelected ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{
                  width: isSelected ? 10 : 7,
                  height: isSelected ? 10 : 7,
                  borderRadius: '50%',
                  background: m.color,
                  boxShadow: `0 0 ${isSelected ? 10 : 5}px ${m.color}`,
                  transition: 'all 0.2s',
                }}
              />
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: MONO, fontSize: 10, color: '#7a7a74',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: selected.color, flexShrink: 0 }} />
            <span style={{ color: selected.color }}>{selected.year}</span>
            <span style={{ color: '#2a2a28' }}>·</span>
            <span>{selected.name}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function M5({ onComplete }) {
  const { gameResult, materials, satellite, user, storyOutline, setStoryChapter } = useAppStore()

  const [ending, setEnding] = useState(null)
  const [loadingEnding, setLoadingEnding] = useState(false)
  const [openedCases, setOpenedCases] = useState(new Set())
  const [selectedMapId, setSelectedMapId] = useState(null)

  const material = materials?.frame || '铝合金'
  const result = gameResult?.result || 'failure'

  useEffect(() => {
    if (!satellite || !user) return
    setLoadingEnding(true)
    generateReentryEnding({ gameResult: result, material, satellite, user, storyOutline })
      .then(r => {
        setEnding(r.ending)
        setStoryChapter('m5', r.ending)
      })
      .catch(() => {
        const fallback = result === 'success'
          ? `${satellite?.name ?? '卫星'}按规定离轨，再入时大部分结构在高层大气烧蚀，少量残片落入南太平洋指定海域。${user?.importantEvent ?? '那件事'}，依然存在。`
          : `${satellite?.name ?? '卫星'}失控漂移，25年后仍在轨道中，成为新的统计数字。${user?.importantEvent ?? '那件事'}，已经悄悄改写了。`
        setEnding(fallback)
        setStoryChapter('m5', fallback)
      })
      .finally(() => setLoadingEnding(false))
  }, [])

  function handleOpenCase(id) {
    setOpenedCases(prev => new Set([...prev, id]))
  }

  const allCasesRead = openedCases.size >= CASES.length

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', padding: '80px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: '#5a5a56', marginBottom: 12 }}>
            MODULE 05 · REENTRY
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, color: '#f5f4f0', margin: '0 0 14px' }}>
            太空垃圾落地球
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: 0, lineHeight: 1.75 }}>
            每一颗卫星都有生命尽头。任务结束后，它们面临两种命运：受控离轨，或等待轨道衰减。
            无论哪种，再入大气层的过程都在地球上留下了痕迹。
          </p>
        </div>

        {/* Re-entry animation */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 10 }}>
            RE-ENTRY SIMULATION · {material}
          </div>
          <ReentryVis material={material} />
        </div>

        {/* What burns table */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            {BURN_TABLE.map(row => (
              <div key={row.part} style={{
                background: '#0d0d0b',
                border: '1px solid #1c1c1a',
                borderRadius: 3,
                padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: SANS, fontSize: 12, color: '#c0c0b8' }}>{row.part}</span>
                  <span style={{
                    fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
                    color: row.ok === true ? '#4a7a41' : row.ok === false ? '#c84840' : '#c8a040',
                  }}>
                    {row.fate}
                  </span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: '#5a5a56', lineHeight: 1.5 }}>{row.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Story ending */}
        <div style={{
          marginBottom: 52,
          padding: '24px 28px',
          background: '#0d0d0b',
          border: '1px solid #242420',
          borderLeft: `3px solid ${result === 'success' ? '#4a7a41' : '#c84840'}`,
          borderRadius: 3,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: '#5a5a56', marginBottom: 14 }}>
            PARALLEL TIMELINE · CHAPTER 05 · {result === 'success' ? 'MISSION SECURED' : 'MISSION LOST'}
          </div>
          {loadingEnding ? (
            <div style={{ fontFamily: MONO, fontSize: 11, color: '#5a5a56', letterSpacing: '0.08em' }}>
              GENERATING...
            </div>
          ) : (
            <p style={{ fontFamily: SERIF, fontSize: 14, color: '#aeaea6', lineHeight: 1.95, margin: 0, fontStyle: 'italic' }}>
              {ending}
            </p>
          )}
        </div>

        {/* 25-year rule + legal vacuum */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            INTERNATIONAL FRAMEWORK
          </div>
          <div style={{
            background: '#0d0d0b', border: '1px solid #222220',
            borderRadius: 3, padding: '20px 24px', marginBottom: 10,
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, color: '#f0efe8', marginBottom: 10, fontWeight: 400 }}>
              25 年离轨规定
            </div>
            <p style={{ fontFamily: SANS, fontSize: 13, color: '#8a8a82', lineHeight: 1.8, margin: '0 0 10px' }}>
              1995 年由 NASA 提出、后被联合国和平利用外层空间委员会（COPUOS）采纳的国际建议标准：
              LEO 卫星在任务结束后 <span style={{ color: '#c8b89a' }}>25 年内</span>必须离轨。
              超过这个时限，大气阻力已无法保证可预测的再入时间和落点。
            </p>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#5a5a56', lineHeight: 1.7, margin: 0 }}>
              问题在于：这只是建议，不是强制法律。统计显示目前约{' '}
              <span style={{ color: '#c8a040' }}>60% 的卫星</span>未能满足这一时限。
            </p>
          </div>
          <div style={{
            background: '#0d0d0b', border: '1px solid #222220',
            borderRadius: 3, padding: '20px 24px',
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, color: '#f0efe8', marginBottom: 10, fontWeight: 400 }}>
              法律真空：无国家有权强制清除他国碎片
            </div>
            <p style={{ fontFamily: SANS, fontSize: 13, color: '#8a8a82', lineHeight: 1.8, margin: '0 0 10px' }}>
              根据 1967 年《外层空间条约》，卫星在轨期间的所有权归发射国永久持有，即使失效后也不例外。
              这意味着：即便某颗废弃卫星正在向其他国家的航天器靠近，任何第三国或私人公司都无权
              在未经该国许可的情况下移动或清除它。
            </p>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#5a5a56', lineHeight: 1.7, margin: 0 }}>
              碎片清理的核心障碍，不是技术，是国际法。
            </p>
          </div>
        </div>

        {/* Archive */}
        <div style={{ marginBottom: 52 }}>
          <CaseArchive openedIds={openedCases} onOpen={handleOpenCase} />
        </div>

        {/* World map */}
        <div style={{ marginBottom: 52 }}>
          <WorldMap selectedId={selectedMapId} onSelect={setSelectedMapId} />
        </div>

        {/* Complete */}
        <div style={{ borderTop: '1px solid #1c1c1a', paddingTop: 36, textAlign: 'center' }}>
          {!allCasesRead && (
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#5a5a56', margin: '0 0 20px' }}>
              还有 {CASES.length - openedCases.size} 个档案未读
            </p>
          )}
          <motion.button
            onClick={onComplete}
            whileHover={{ opacity: 0.85 }}
            whileTap={{ scale: 0.97 }}
            style={{
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: '0.12em',
              color: '#0a0a0a',
              background: allCasesRead ? '#c8b89a' : '#5a5a56',
              border: 'none',
              borderRadius: 2,
              padding: '12px 40px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            {allCasesRead ? '前往 M6' : '跳过，前往 M6'}
          </motion.button>
        </div>

      </div>
    </div>
  )
}
