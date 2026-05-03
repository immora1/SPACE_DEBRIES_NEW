import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, animate as fmAnimate, useMotionValue } from 'framer-motion'
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

// ─── Geometry — concentric Earth + Orbit, impact INSIDE Earth ────────────────
// ViewBox 560×280. Earth center (100,500) r=430 — only top arc visible.
// Orbit: same center r=590. Both ORB and ENT are exactly ON the orbit circle.
// ENT_Y = 500 − sqrt(590²−390²) ≈ 57  (verified: dist from center = 590 ✓)
// IMP: dist from center ≈290 (67% of radius) — clearly INSIDE Earth body.
const GEO = {
  ECX: 100, ECY: 500, ER: 430,
  OR: 590,
  ORB_X: 438, ORB_Y: 17,    // orbit start  (on orbit circle)
  ENT_X: 490, ENT_Y: 57,    // orbit end / re-entry start (on orbit circle)
  IMP_X: 175, IMP_Y: 220,   // impact — dist≈290 from center, INSIDE Earth
  CP_X:  380, CP_Y:  130,   // bezier control point
}

// n evenly-spaced points along the circular arc from angle θ1 to θ2
function computeArcPts(cx, cy, r, θ1, θ2, n) {
  return Array.from({ length: n }, (_, i) => {
    const θ = θ1 + (θ2 - θ1) * i / (n - 1)
    return { x: cx + r * Math.cos(θ), y: cy + r * Math.sin(θ) }
  })
}

// n evenly-spaced points along quadratic bezier P0→CP→P2
function computeBezPts(p0x, p0y, cpx, cpy, p2x, p2y, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), mt = 1 - t
    return {
      x: mt * mt * p0x + 2 * mt * t * cpx + t * t * p2x,
      y: mt * mt * p0y + 2 * mt * t * cpy + t * t * p2y,
    }
  })
}

// ─── Re-entry diagram — vintage engraving, looping animation ─────────────────
function ReentryVis({ material }) {
  // material key may be English (from store) or Chinese — map both
  const MAT_KEYS = { titanium: '钛合金', carbon: '碳纤维', solar: '太阳能电池板', aluminum: '铝合金' }
  const matKey  = MAT_KEYS[material] ?? material
  const info    = MATERIAL_SURVIVAL[matKey] || MATERIAL_SURVIVAL['铝合金']

  const [phase, setPhase] = useState(0)
  const [cycle, setCycle] = useState(0)

  const satX      = useMotionValue(GEO.ORB_X)
  const satY      = useMotionValue(GEO.ORB_Y)
  const satRotate = useMotionValue(0)

  // Drive satellite along orbit arc then bezier track using imperative keyframe animation.
  // Both paths are precomputed so the satellite's motion exactly follows the drawn lines.
  useEffect(() => {
    const { ECX, ECY, OR, ORB_X, ORB_Y, ENT_X, ENT_Y, CP_X, CP_Y, IMP_X, IMP_Y } = GEO

    satX.set(ORB_X); satY.set(ORB_Y); satRotate.set(0)
    setPhase(0)

    const θ1 = Math.atan2(ORB_Y - ECY, ORB_X - ECX)
    const θ2 = Math.atan2(ENT_Y - ECY, ENT_X - ECX)

    // 12 pts along orbit arc, 20 pts along bezier (ENT→IMP)
    const arcPts = computeArcPts(ECX, ECY, OR, θ1, θ2, 12)
    const bezPts = computeBezPts(ENT_X, ENT_Y, CP_X, CP_Y, IMP_X, IMP_Y, 20)

    const TOTAL = 10.2
    const T_ENT = 3.8 / TOTAL   // ≈0.373
    const T_IMP = 9.5 / TOTAL   // ≈0.931

    // Normalized times: arc (0→T_ENT), bezier (T_ENT→T_IMP), hold (T_IMP→1)
    // arcPts[11] = ENT = bezPts[0] → dedup junction by skipping bezPts[0] in xs/ys
    const arcTimes = arcPts.map((_, i) => (i / (arcPts.length - 1)) * T_ENT)
    const bezAllT  = bezPts.map((_, j) => T_ENT + (j / (bezPts.length - 1)) * (T_IMP - T_ENT))
    const times = [...arcTimes, ...bezAllT.slice(1), 1.0]
    const xs    = [...arcPts.map(p => p.x), ...bezPts.slice(1).map(p => p.x), IMP_X]
    const ys    = [...arcPts.map(p => p.y), ...bezPts.slice(1).map(p => p.y), IMP_Y]

    const cx = fmAnimate(satX, xs, { duration: TOTAL, times, ease: 'linear' })
    const cy = fmAnimate(satY, ys, { duration: TOTAL, times, ease: 'linear' })
    const cr = fmAnimate(satRotate,
      [0, 0, 16, 48, 48, 48],
      { duration: TOTAL, times: [0, T_ENT, T_ENT + 0.02, 7700 / 10200, T_IMP, 1.0], ease: 'linear' },
    )

    const t1 = setTimeout(() => setPhase(1), 3800)
    const t2 = setTimeout(() => setPhase(2), 5700)
    const t3 = setTimeout(() => setPhase(3), 7700)
    const t4 = setTimeout(() => { setPhase(0); setCycle(c => c + 1) }, 10200)

    return () => {
      cx.stop(); cy.stop(); cr.stop()
      ;[t1, t2, t3, t4].forEach(clearTimeout)
    }
  }, [cycle]) // eslint-disable-line react-hooks/exhaustive-deps

  const { ECX, ECY, ER, OR, ENT_X, ENT_Y, CP_X, CP_Y, IMP_X, IMP_Y } = GEO

  // 14 dots along the bezier — satellite's re-entry track
  const dots = useMemo(() => {
    const n = 14
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1), mt = 1 - t
      return {
        x: mt * mt * ENT_X + 2 * mt * t * CP_X + t * t * IMP_X,
        y: mt * mt * ENT_Y + 2 * mt * t * CP_Y + t * t * IMP_Y,
        t,
      }
    })
  }, [])

  const INK      = '#d8cfbc'
  const INK_DIM  = '#6a6055'
  const ablating    = phase >= 1
  const heavyAblate = phase >= 2

  return (
    <div style={{
      position: 'relative', background: '#0a0906',
      border: '1px solid #2a2520', borderRadius: 4,
      overflow: 'hidden', marginBottom: 4,
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 3px)',
      }} />

      <svg width="100%" viewBox="0 0 560 280" style={{ display: 'block' }}>
        <defs>
          <clipPath id="earthClipM5">
            <circle cx={ECX} cy={ECY} r={ER} />
          </clipPath>
        </defs>

        {/* Star field */}
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

        {/* Earth fill + hatch */}
        <circle cx={ECX} cy={ECY} r={ER} fill="#100e0a"/>
        {Array.from({ length: 32 }, (_, i) => (
          <line key={i}
            x1={ECX - ER + i * 28} y1={ECY - ER}
            x2={ECX - ER + i * 28 - 90} y2={ECY + ER}
            stroke={INK_DIM} strokeWidth="0.55" opacity="0.18"
            clipPath="url(#earthClipM5)"
          />
        ))}
        <circle cx={ECX} cy={ECY} r={ER} fill="none" stroke={INK} strokeWidth="1.6"/>
        <circle cx={ECX} cy={ECY} r={ER + 16}
          fill="none" stroke={INK} strokeWidth="0.5" opacity="0.20" strokeDasharray="5 9"/>
        <circle cx={ECX} cy={ECY} r={ER + 30}
          fill="none" stroke={INK} strokeWidth="0.35" opacity="0.11" strokeDasharray="3 11"/>

        {/* Orbit — same center */}
        <circle cx={ECX} cy={ECY} r={OR}
          fill="none" stroke={INK} strokeWidth="1.1" opacity="0.52"/>

        {/* Labels */}
        <text x="52" y="185" fill={INK} fontSize="14"
          fontFamily="Georgia, serif" letterSpacing="3" opacity="0.65">EARTH</text>
        <line x1="450" y1="28" x2="432" y2="14" stroke={INK} strokeWidth="0.8" opacity="0.45"/>
        <text x="378" y="12" fill={INK} fontSize="12"
          fontFamily="Georgia, serif" letterSpacing="2" opacity="0.60">ORBIT</text>

        {/* Track dots — progressive reveal per phase */}
        {dots.map((d, i) => {
          const threshold = [0, 0.42, 0.85, 1.5][phase] || 0
          const vis = phase >= 1 && d.t <= threshold
          return (
            <motion.circle key={i} cx={d.x} cy={d.y}
              r={1.3 + (1 - d.t) * 0.5} fill={INK}
              animate={{ opacity: vis ? (0.36 + d.t * 0.44) : 0 }}
              transition={{ duration: 0.4, delay: vis ? i * 0.04 : 0 }}
            />
          )
        })}

        {/* TRACK label */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <line x1="403" y1="116" x2="424" y2="103"
                stroke={INK} strokeWidth="0.7" opacity="0.4"/>
              <text x="426" y="101" fill={INK} fontSize="11"
                fontFamily="Georgia, serif" letterSpacing="2" opacity="0.50">TRACK</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Satellite — position driven by motion values along orbit arc + bezier ── */}
        <motion.g
          style={{ x: satX, y: satY, rotate: satRotate }}
          animate={{ opacity: phase >= 3 ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Dish antenna — hidden when ablating */}
          {!ablating && <>
            <line x1="0" y1="-8" x2="0" y2="-18"
              stroke={INK} strokeWidth="0.9" opacity="0.65"/>
            <path d="M -7,-18 Q 0,-25 7,-18"
              fill="none" stroke={INK} strokeWidth="0.9" opacity="0.65"/>
            <circle cx="0" cy="-18" r="1.8" fill={INK} opacity="0.70"/>
          </>}

          {/* Solar arrays — 3-panel wings, hidden when heavy ablation */}
          {!heavyAblate && <>
            <rect x="-40" y="-5" width="30" height="10"
              fill="#100e0a" stroke={INK} strokeWidth="0.9"
              opacity={ablating ? 0.45 : 0.82}/>
            <line x1="-30" y1="-5" x2="-30" y2="5" stroke={INK} strokeWidth="0.5" opacity="0.33"/>
            <line x1="-20" y1="-5" x2="-20" y2="5" stroke={INK} strokeWidth="0.5" opacity="0.33"/>
            <rect x="10" y="-5" width="30" height="10"
              fill="#100e0a" stroke={INK} strokeWidth="0.9"
              opacity={ablating ? 0.45 : 0.82}/>
            <line x1="20" y1="-5" x2="20" y2="5" stroke={INK} strokeWidth="0.5" opacity="0.33"/>
            <line x1="30" y1="-5" x2="30" y2="5" stroke={INK} strokeWidth="0.5" opacity="0.33"/>
          </>}

          {/* Main body */}
          <rect x="-10" y="-7" width="20" height="14"
            fill="#100e0a" stroke={INK}
            strokeWidth={ablating ? 0.7 : 1.5}
            opacity={heavyAblate ? 0.5 : 1}/>
          {!ablating && <>
            <line x1="-10" y1="-7" x2="10" y2="7" stroke={INK} strokeWidth="0.45" opacity="0.28"/>
            <line x1="10" y1="-7" x2="-10" y2="7" stroke={INK} strokeWidth="0.45" opacity="0.28"/>
          </>}

          {/* Thruster nozzle */}
          {!ablating && (
            <path d="M -4,7 L-5,13 L5,13 L4,7 Z"
              fill="#100e0a" stroke={INK} strokeWidth="0.7" opacity="0.55"/>
          )}

          {/* Ablation flames */}
          {ablating && (
            <motion.g
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 0.30, repeat: Infinity }}
            >
              <line x1="-4" y1="7" x2="-11" y2="28"
                stroke={INK} strokeWidth="1.1" opacity={heavyAblate ? 0.9 : 0.62}/>
              <line x1="0" y1="7" x2="0" y2="33"
                stroke={INK} strokeWidth="1.5" opacity={heavyAblate ? 1 : 0.72}/>
              <line x1="4" y1="7" x2="10" y2="27"
                stroke={INK} strokeWidth="1.1" opacity={heavyAblate ? 0.9 : 0.62}/>
              {heavyAblate && <>
                <line x1="-8" y1="9" x2="-20" y2="42"
                  stroke={INK} strokeWidth="0.75" opacity="0.42"/>
                <line x1="8" y1="9" x2="19" y2="40"
                  stroke={INK} strokeWidth="0.75" opacity="0.42"/>
              </>}
            </motion.g>
          )}
        </motion.g>

        {/* SATELLITE label */}
        <AnimatePresence>
          {phase < 2 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ delay: phase === 0 ? 1.5 : 0 }}>
              <line x1={ENT_X + 12} y1={ENT_Y - 5} x2={ENT_X + 28} y2={ENT_Y - 17}
                stroke={INK} strokeWidth="0.7" opacity="0.45"/>
              <text x={ENT_X + 30} y={ENT_Y - 13} fill={INK} fontSize="11"
                fontFamily="Georgia, serif" letterSpacing="1.5" opacity="0.62">SATELLITE</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Impact crater — inside Earth body */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <ellipse cx={IMP_X} cy={IMP_Y + 3} rx="13" ry="5.5"
                fill="none" stroke={INK} strokeWidth="0.9" opacity="0.58"/>
              <ellipse cx={IMP_X} cy={IMP_Y + 3} rx="6" ry="2.5"
                fill="none" stroke={INK} strokeWidth="0.65" opacity="0.36"/>
              {[[-16,-8],[-8,-20],[3,-15],[13,-7],[-2,-22],[7,-18]].map(([dx, dy], i) => (
                <line key={i}
                  x1={IMP_X} y1={IMP_Y + 3}
                  x2={IMP_X + dx} y2={IMP_Y + dy}
                  stroke={INK} strokeWidth="0.65" opacity="0.42"/>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* Status caption */}
        <motion.text
          key={`${phase}-${cycle}`} x="32" y="270"
          fill={INK_DIM} fontSize="10"
          fontFamily="'Space Mono', monospace" letterSpacing="1.5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        >
          {['ORBITAL APPROACH','ATMOSPHERIC ENTRY','ABLATION IN PROGRESS',
            `IMPACT  ·  SURVIVAL  ${info.rate}`][phase]}
        </motion.text>

        {/* Material note box — top-right, appears at impact */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <rect x="298" y="42" width="248" height="68" rx="1"
                fill="#100e0a" stroke={INK} strokeWidth="0.8" opacity="0.93"/>
              {[[298,42],[546,42],[298,110],[546,110]].map(([rx, ry], i) => (
                <g key={i}>
                  <line x1={rx+(i%2===0?4:-4)} y1={ry} x2={rx+(i%2===0?10:-10)} y2={ry}
                    stroke={INK} strokeWidth="0.6" opacity="0.38"/>
                  <line x1={rx} y1={ry+(i<2?4:-4)} x2={rx} y2={ry+(i<2?10:-10)}
                    stroke={INK} strokeWidth="0.6" opacity="0.38"/>
                </g>
              ))}
              <text x="314" y="63" fill={INK} fontSize="10"
                fontFamily="'Space Mono', monospace" letterSpacing="1" opacity="0.80">
                {matKey}  ·  {info.rate} SURVIVES
              </text>
              <foreignObject x="314" y="71" width="216" height="50">
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

        {/* Double border frame */}
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
        color: '#3a3a38', marginBottom: 12,
      }}>
        <div style={{ height: 1, background: '#1c1c1a', flex: 1 }} />
        <span style={{ color: '#5a5a56' }}>{openedIds.size}/{CASES.length} READ</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
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
// Equirectangular: x = lng+180 (0–360), y = 90–lat (0–180)
const _lp = cs => cs.map(([ln, la]) => `${(ln + 180).toFixed(1)},${(90 - la).toFixed(1)}`).join(' ')

// Continent polygons in [lng, lat] pairs — simplified but geographically recognisable
const LAND_SHAPES = [
  { id: 'na',   pts: [[-165,66],[-156,58],[-138,57],[-125,49],[-120,35],[-110,23],[-87,16],[-83,10],[-77,25],[-81,25],[-75,37],[-70,42],[-65,45],[-52,47],[-55,55],[-62,63],[-80,75],[-110,77],[-130,70],[-155,65]] },
  { id: 'gl',   pts: [[-46,83],[-18,78],[-18,68],[-26,65],[-44,60],[-57,65],[-57,77]] },
  { id: 'ic',   pts: [[-24,66],[-14,63],[-13,65],[-22,66]] },
  { id: 'sa',   pts: [[-80,10],[-73,11],[-61,11],[-35,-8],[-34,-3],[-43,-23],[-50,-30],[-57,-40],[-65,-55],[-68,-56],[-73,-50],[-75,-30],[-77,-5],[-80,0]] },
  { id: 'eu',   pts: [[-9,36],[2,43],[10,36],[20,36],[26,40],[32,48],[28,62],[20,72],[5,62],[-2,52],[-10,44]] },
  { id: 'bi',   pts: [[-5,50],[-3,51],[0,51],[2,52],[0,56],[-2,58],[-5,58]] },
  { id: 'af',   pts: [[-6,36],[10,37],[36,30],[42,14],[50,11],[42,0],[40,-5],[36,-20],[20,-35],[4,-5],[-5,2],[-17,14],[-13,28]] },
  { id: 'arab', pts: [[36,36],[44,28],[50,26],[58,22],[50,12],[44,10],[38,12],[36,22]] },
  { id: 'as',   pts: [[26,40],[36,36],[48,28],[60,22],[65,22],[72,8],[80,8],[80,22],[90,24],[95,20],[100,2],[108,2],[108,10],[118,20],[128,30],[132,34],[140,40],[142,48],[138,55],[110,58],[95,60],[80,75],[60,72],[40,68],[30,70],[28,62],[32,48]] },
  { id: 'jp',   pts: [[130,34],[138,36],[136,42],[130,38]] },
  { id: 'ph',   pts: [[118,18],[122,18],[122,10],[118,10]] },
  { id: 'bo',   pts: [[108,7],[118,7],[118,0],[108,0]] },
  { id: 'au',   pts: [[114,-22],[130,-12],[136,-12],[138,-18],[142,-18],[150,-24],[154,-28],[152,-35],[148,-38],[136,-35],[122,-34],[114,-34],[112,-28]] },
  { id: 'nz',   pts: [[167,-34],[172,-36],[172,-40],[168,-44],[166,-44]] },
]

function WorldMap({ selectedId, onSelect }) {
  const selected = MAP_MARKERS.find(m => m.id === selectedId)
  const INK     = '#d8cfbc'   // warm cream — matches ReentryVis
  const INK_DIM = '#8a7a60'   // muted amber
  const CFILL   = '#0e0c09'   // very dark warm-black land
  const CSTROKE = '#2e2818'   // subtle warm outline

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: '#6a6055', marginBottom: 8 }}>
        已记录的坠落地点
      </div>

      <div style={{
        position: 'relative', background: '#0a0906',
        border: '1px solid #2a2520', borderRadius: 2, overflow: 'hidden', marginBottom: 10,
      }}>
        {/* Scanlines overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
          background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 3px)',
        }} />

        <svg width="100%" viewBox="0 0 360 180" style={{ display: 'block' }}>
          {/* Ocean fill */}
          <rect x="0" y="0" width="360" height="180" fill="#0a0906" />

          {/* Lat / lng grid */}
          {[-60,-30,0,30,60].map(lat => (
            <line key={lat} x1="0" y1={90-lat} x2="360" y2={90-lat}
              stroke={lat === 0 ? '#302a1e' : '#1c1810'} strokeWidth={lat === 0 ? 0.55 : 0.28} />
          ))}
          {[-120,-60,0,60,120].map(lng => (
            <line key={lng} x1={lng+180} y1="0" x2={lng+180} y2="180"
              stroke="#1c1810" strokeWidth="0.28" />
          ))}

          {/* Continents */}
          {LAND_SHAPES.map(({ id, pts }) => (
            <polygon key={id} points={_lp(pts)} fill={CFILL} stroke={CSTROKE} strokeWidth="0.6" />
          ))}

          {/* Ocean labels */}
          <text x="48"  y="102" fill={INK_DIM} fontSize="7" fontFamily="Georgia,serif" letterSpacing="4" opacity="0.55" textAnchor="middle">PACIFIC</text>
          <text x="212" y="88"  fill={INK_DIM} fontSize="7" fontFamily="Georgia,serif" letterSpacing="4" opacity="0.55" textAnchor="middle">ATLANTIC</text>
          <text x="292" y="122" fill={INK_DIM} fontSize="6" fontFamily="Georgia,serif" letterSpacing="3" opacity="0.50" textAnchor="middle">INDIAN</text>
          <text x="322" y="76"  fill={INK_DIM} fontSize="7" fontFamily="Georgia,serif" letterSpacing="4" opacity="0.55" textAnchor="middle">PACIFIC</text>

          {/* Lat labels */}
          <text x="5" y="94"  fill={INK} fontSize="5.5" fontFamily="'Space Mono',monospace" opacity="0.45">EQ</text>
          <text x="5" y="64"  fill={INK} fontSize="5"   fontFamily="'Space Mono',monospace" opacity="0.28">30°N</text>
          <text x="5" y="124" fill={INK} fontSize="5"   fontFamily="'Space Mono',monospace" opacity="0.28">30°S</text>

          {/* Double frame — matches ReentryVis border style */}
          <rect x="0" y="0" width="360" height="180" fill="none" stroke={INK} strokeWidth="1.2" opacity="0.25"/>
          <rect x="4" y="4" width="352" height="172" fill="none" stroke={INK} strokeWidth="0.4"  opacity="0.10"/>
          {/* Corner ticks */}
          {[[0,0,6,0,0,6],[356,0,-6,0,0,6],[0,176,6,0,0,-6],[356,176,-6,0,0,-6]].map(([x,y,dx1,dy1,dx2,dy2],i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x+dx1} y2={y+dy1} stroke={INK} strokeWidth="0.7" opacity="0.35"/>
              <line x1={x} y1={y} x2={x+dx2} y2={y+dy2} stroke={INK} strokeWidth="0.7" opacity="0.35"/>
            </g>
          ))}

          {/* Markers — crosshair + pulsing ring on select */}
          {MAP_MARKERS.map(m => {
            const mx = m.lng + 180
            const my = 90 - m.lat
            const sel = selectedId === m.id
            return (
              <g key={m.id} onClick={() => onSelect(sel ? null : m.id)} style={{ cursor: 'pointer' }}>
                {sel && (
                  <motion.circle cx={mx} cy={my} r="8"
                    fill="none" stroke={m.color} strokeWidth="0.7"
                    animate={{ r: [7, 16, 7], opacity: [0.50, 0, 0.50] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                {/* Crosshair lines */}
                <line x1={mx-5} y1={my}   x2={mx-2} y2={my}   stroke={m.color} strokeWidth="0.85" opacity={sel ? 0.95 : 0.55}/>
                <line x1={mx+2} y1={my}   x2={mx+5} y2={my}   stroke={m.color} strokeWidth="0.85" opacity={sel ? 0.95 : 0.55}/>
                <line x1={mx}   y1={my-5} x2={mx}   y2={my-2} stroke={m.color} strokeWidth="0.85" opacity={sel ? 0.95 : 0.55}/>
                <line x1={mx}   y1={my+2} x2={mx}   y2={my+5} stroke={m.color} strokeWidth="0.85" opacity={sel ? 0.95 : 0.55}/>
                {/* Centre dot */}
                <circle cx={mx} cy={my} r={sel ? 2.2 : 1.6} fill={m.color} opacity={sel ? 1 : 0.75}/>
                {/* Year label when selected */}
                {sel && (
                  <text x={mx+4} y={my-3} fill={m.color} fontSize="5.5"
                    fontFamily="'Space Mono',monospace" opacity="0.90">{m.year}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 10, color: '#7a7a74' }}
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

// ─── Fade-up section wrapper ──────────────────────────────────────────────────
function FadeSection({ children, delay = 0, style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      style={style}
    >
      {children}
    </motion.div>
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenCase(id) {
    setOpenedCases(prev => new Set([...prev, id]))
  }

  const allCasesRead = openedCases.size >= CASES.length
  const resultColor = result === 'success' ? '#4a7a41' : '#c84840'

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* ── Header ── */}
        <FadeSection style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: '#5a5a56', marginBottom: 12 }}>
            MODULE 05 · REENTRY
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, color: '#f5f4f0', margin: '0 0 14px' }}>
            太空垃圾落地球
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: 0, lineHeight: 1.75, maxWidth: 760 }}>
            每一颗卫星都有生命尽头。任务结束后，它们面临两种命运：受控离轨，或等待轨道衰减。
            无论哪种，再入大气层的过程都在地球上留下了痕迹。
          </p>
        </FadeSection>

        {/* ── 01 · Re-entry animation ── */}
        <FadeSection style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 10 }}>
            01 · RE-ENTRY SIMULATION · {material}
          </div>
          <ReentryVis material={material} />
        </FadeSection>

        {/* ── 02 · Material fate table ── */}
        <FadeSection style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 14 }}>
            02 · MATERIAL FATE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {BURN_TABLE.map((row, i) => (
              <motion.div
                key={row.part}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                whileHover={{ y: -2, borderColor: row.ok === true ? '#4a7a4180' : row.ok === false ? '#c8484080' : '#c8a04080' }}
                style={{
                  background: '#0d0d0b',
                  border: '1px solid #1c1c1a',
                  borderTop: `3px solid ${row.ok === true ? '#4a7a41' : row.ok === false ? '#c84840' : '#c8a040'}`,
                  borderRadius: 3,
                  padding: '14px 16px',
                  cursor: 'default',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontFamily: SANS, fontSize: 12, color: '#c0c0b8', fontWeight: 400 }}>{row.part}</span>
                  <span style={{
                    fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                    color: row.ok === true ? '#4a7a41' : row.ok === false ? '#c84840' : '#c8a040',
                  }}>
                    {row.fate}
                  </span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: '#5a5a56', lineHeight: 1.6 }}>{row.note}</div>
              </motion.div>
            ))}
          </div>
        </FadeSection>

        {/* ── 03 · Story ending ── */}
        <FadeSection style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 14 }}>
            03 · PARALLEL TIMELINE · CHAPTER 05
          </div>
          <div style={{
            padding: '28px 32px',
            background: '#0d0d0b',
            border: '1px solid #242420',
            borderLeft: `3px solid ${resultColor}`,
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, width: 180,
              background: `linear-gradient(to left, ${resultColor}08, transparent)`,
              pointerEvents: 'none',
            }} />
            <div style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em',
              color: resultColor, marginBottom: 16, opacity: 0.8,
            }}>
              {result === 'success' ? 'MISSION SECURED' : 'MISSION LOST'}
            </div>
            {loadingEnding ? (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ fontFamily: MONO, fontSize: 11, color: '#5a5a56', letterSpacing: '0.08em' }}
              >
                GENERATING...
              </motion.div>
            ) : (
              <p style={{ fontFamily: SERIF, fontSize: 15, color: '#aeaea6', lineHeight: 2, margin: 0, fontStyle: 'italic' }}>
                {ending}
              </p>
            )}
          </div>
        </FadeSection>

        {/* ── 04 · International framework (two columns) ── */}
        <FadeSection style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            04 · INTERNATIONAL FRAMEWORK
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{
              background: '#0d0d0b', border: '1px solid #222220',
              borderRadius: 3, padding: '22px 26px',
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em',
                color: '#c8b89a', marginBottom: 10, opacity: 0.7,
              }}>
                1995 · NASA / COPUOS
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 15, color: '#f0efe8', marginBottom: 12, fontWeight: 400 }}>
                25 年离轨规定
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12, color: '#8a8a82', lineHeight: 1.8, margin: '0 0 12px' }}>
                LEO 卫星在任务结束后{' '}
                <span style={{ color: '#c8b89a' }}>25 年内</span>必须离轨。
                超过这个时限，大气阻力已无法保证可预测的再入时间和落点。
              </p>
              <p style={{ fontFamily: SANS, fontSize: 11, color: '#5a5a56', lineHeight: 1.7, margin: 0 }}>
                这只是建议，不是强制法律。统计显示目前约{' '}
                <span style={{ color: '#c8a040' }}>60% 的卫星</span>未能满足这一时限。
              </p>
            </div>
            <div style={{
              background: '#0d0d0b', border: '1px solid #222220',
              borderRadius: 3, padding: '22px 26px',
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em',
                color: '#c84840', marginBottom: 10, opacity: 0.7,
              }}>
                1967 · OUTER SPACE TREATY
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 15, color: '#f0efe8', marginBottom: 12, fontWeight: 400 }}>
                法律真空
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12, color: '#8a8a82', lineHeight: 1.8, margin: '0 0 12px' }}>
                卫星在轨期间的所有权归发射国永久持有，即使失效后也不例外。
                任何第三国或私人公司都无权在未获授权情况下移动或清除他国碎片。
              </p>
              <p style={{ fontFamily: SANS, fontSize: 11, color: '#5a5a56', lineHeight: 1.7, margin: 0 }}>
                碎片清理的核心障碍，不是技术，是国际法。
              </p>
            </div>
          </div>
        </FadeSection>

        {/* ── 05 · Incident archive ── */}
        <FadeSection style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            05 · INCIDENT ARCHIVE
          </div>
          <CaseArchive openedIds={openedCases} onOpen={handleOpenCase} />
        </FadeSection>

        {/* ── 06 · World map ── */}
        <FadeSection style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 10 }}>
            06 · REENTRY IMPACT RECORD
          </div>
          <WorldMap selectedId={selectedMapId} onSelect={setSelectedMapId} />
        </FadeSection>

        {/* ── Complete ── */}
        <div style={{ borderTop: '1px solid #1c1c1a', paddingTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              {!allCasesRead ? (
                <p style={{ fontFamily: SANS, fontSize: 12, color: '#5a5a56', margin: 0 }}>
                  还有 <span style={{ color: '#c8b89a' }}>{CASES.length - openedCases.size}</span> 个档案未读
                </p>
              ) : (
                <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#4a7a41', margin: 0 }}>
                  ✓ 全部档案已读
                </p>
              )}
            </div>
            <motion.button
              onClick={onComplete}
              whileHover={{ opacity: 0.85, y: -1 }}
              whileTap={{ scale: 0.97 }}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: '0.12em',
                color: '#0a0a0a',
                background: allCasesRead ? '#c8b89a' : '#3a3a38',
                border: 'none',
                borderRadius: 2,
                padding: '12px 40px',
                cursor: 'pointer',
                transition: 'background 0.3s',
              }}
            >
              {allCasesRead ? '前往 M6 →' : '跳过，前往 M6 →'}
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  )
}
