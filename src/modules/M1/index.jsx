import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateMaterialFeedback } from '../../services/ai'
import SatelliteModel, { GLBSatelliteModel } from './SatelliteModel'
import DebrisEarth from './DebrisEarth'
import DebrisEarthCountries from './DebrisEarthCountries'
import { useGLTF } from '@react-three/drei'

// Preload GLB as soon as M1 is imported — ensures asset is cached before scene 5 renders
useGLTF.preload('/simple_satellite_low_poly_free.glb')

// Catch WebGL / asset errors locally so they don't unmount the entire M1
class CanvasErrorBoundary extends React.Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) return this.props.fallback ?? null
    return this.props.children
  }
}

const ZH   = "'PingFang SC', 'Microsoft YaHei', sans-serif"
const MONO = "'Space Mono', monospace"
const LEX  = "'Lexend', sans-serif"

const PART_ACCENT = {
  frame:      '#6b7fff',
  solar:      '#38bdf8',
  insulation: '#fbbf24',
  propulsion: '#34d399',
}
const RISK_COLORS = { low: '#34d399', medium: '#fbbf24', high: '#f87171' }
const RISK_LABEL  = { low: 'LOW',     medium: 'MED',     high: 'HIGH'    }

/* ── Data ── */
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

/* ── Scene variants ── */
const SCENE_VARIANTS = {
  enter: (dir) => ({ x: dir * 80, opacity: 0, filter: 'blur(6px)' }),
  show:  { x: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
  leave: (dir) => ({ x: -dir * 80, opacity: 0, filter: 'blur(6px)', transition: { duration: 0.5, ease: [0.7, 0, 0.9, 0.3] } }),
}

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

/* ── SceneNav ── */
function SceneNav({ sceneIdx, total, onNavigate }) {
  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none',
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.button key={i} onClick={() => onNavigate(i)}
          animate={{
            width: i === sceneIdx ? 28 : 6,
            background: i === sceneIdx ? '#6b7fff' : 'rgba(107,127,255,0.3)',
          }}
          transition={{ duration: 0.3 }}
          style={{ height: 2, border: 'none', cursor: 'pointer', padding: 0, pointerEvents: 'all', borderRadius: 1 }}
        />
      ))}
    </div>
  )
}

/* ── Scene 0: HERO ── */
function SceneHero({ normX, normY }) {
  const ghostX = useTransform(normX, [-1, 1], ['-50px', '50px'])
  const ghostY = useTransform(normY, [-1, 1], ['-28px', '28px'])
  const E = { duration: 0.65, ease: [0.16, 1, 0.3, 1] }


  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      {/* ── Ghost parallax — behind Earth, very subtle ── */}
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
          28,000
        </motion.div>
      </div>

      {/* ── Module tag — top center ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...E, delay: 0.05 }}
        style={{
          position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
          fontFamily: LEX, fontSize: 8, fontWeight: 700, color: '#484878',
          letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
        M1 · 太空垃圾是什么
      </motion.div>

      {/* ── Left column — all text ── */}
      <div style={{
        position: 'absolute', left: '6%', top: '13%', width: '44%',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* H1 */}
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ ...E, delay: 0.12 }}
          style={{
            fontFamily: ZH, fontSize: 'clamp(50px,7.2vw,78px)', fontWeight: 700,
            color: '#ffffff', lineHeight: 1.08, marginBottom: 2,
          }}>
          太空垃圾
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ ...E, delay: 0.20 }}
          style={{
            fontFamily: ZH, fontSize: 'clamp(50px,7.2vw,78px)', fontWeight: 700,
            color: '#ffffff', lineHeight: 1.08, marginBottom: 26,
          }}>
          不是比喻，
        </motion.div>

        {/* Hairline divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }}
          transition={{ ...E, delay: 0.28 }}
          style={{
            height: 1, background: 'linear-gradient(to right, rgba(107,127,255,0.45), transparent)',
            transformOrigin: 'left', marginBottom: 22,
          }}
        />

        {/* H2 */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...E, delay: 0.35 }}
          style={{
            fontFamily: ZH, fontSize: 18, fontWeight: 700,
            color: '#ffffff', lineHeight: 1.6, marginBottom: 12,
          }}>
          是真实存在的物理威胁。
        </motion.div>

        {/* Body */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...E, delay: 0.43 }}
          style={{
            fontFamily: ZH, fontSize: 13,
            color: 'rgba(232,232,248,0.48)', lineHeight: 1.9, marginBottom: 36,
          }}>
          自 1957 年第一颗卫星升空，人类已在轨道上累积了数以亿计的碎片。
          它们以超音速运行，无法回收，无法清除，且持续增加。
        </motion.div>

      </div>

      {/* ── Scattered decorations — right zone ── */}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...E, delay: 0.58 }}
        style={{
          position: 'absolute', top: '7%', right: '5%',
          fontFamily: MONO, fontSize: 8, color: '#2a2a4a', letterSpacing: '0.12em',
        }}>
        SINCE 1957
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...E, delay: 0.64 }}
        style={{
          position: 'absolute', top: '28%', right: '3%',
          fontFamily: MONO, fontSize: 8, color: 'rgba(107,127,255,0.18)', letterSpacing: '0.06em',
        }}>
        ~1.3亿 FRAGMENTS
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...E, delay: 0.70 }}
        style={{
          position: 'absolute', bottom: '28%', right: '5%',
          fontFamily: MONO, fontSize: 8, color: 'rgba(232,232,248,0.10)', letterSpacing: '0.08em',
        }}>
        LEO · MEO · GEO
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...E, delay: 0.76 }}
        style={{
          position: 'absolute', bottom: '14%', right: '8%',
          fontFamily: MONO, fontSize: 8, color: 'rgba(107,127,255,0.14)', letterSpacing: '0.06em',
        }}>
        KESSLER SYNDROME
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...E, delay: 0.82 }}
        style={{
          position: 'absolute', bottom: '5%', right: '4%',
          fontFamily: LEX, fontSize: 8, color: '#2a2a4a', letterSpacing: '0.10em',
        }}>
        — →
      </motion.div>
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

    const draw = () => {
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
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>

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
          02 · ORIGIN / 来源
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


function SceneCountries() {
  const hovIdxRef  = useRef(-1)
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
          03 · CONTRIBUTORS / 各国贡献
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 'clamp(22px,2.4vw,34px)', fontWeight: 700,
          color: '#e8e8f8', lineHeight: 1.22, marginBottom: 8, pointerEvents: 'none',
        }}>
          三国贡献了全球 96% 的碎片。
        </div>
        <div style={{
          fontFamily: ZH, fontSize: 13, color: '#484878',
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

      {/* 3D Earth — right panel */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: '68%', height: '100%' }}>
        <DebrisEarthCountries hovIdxRef={hovIdxRef} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none', zIndex: 10,
        }}>
          <div ref={cNameRef} style={{
            fontFamily: LEX, fontSize: 8, fontWeight: 700,
            color: 'rgba(107,127,255,0.55)', letterSpacing: '0.16em',
            textTransform: 'uppercase', marginBottom: 6,
          }}>TOTAL TRACKED</div>
          <div ref={cCountRef} style={{
            fontFamily: MONO, fontSize: 26, fontWeight: 700,
            color: '#e8e8f8', letterSpacing: '-0.03em',
          }}>{TOTAL_DEBRIS.toLocaleString()}</div>
          <div ref={cPctRef} style={{
            fontFamily: LEX, fontSize: 7.5,
            color: 'rgba(107,127,255,0.38)', letterSpacing: '0.1em',
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
  const canvasRef     = useRef()
  const sceneRef      = useRef()
  const yearRef       = useRef(1960)
  const isUserScrub   = useRef(false)
  const lastStateUpd  = useRef(0)
  const driftRef      = useRef(0)
  const satellitesRef = useRef([])
  const spawnAccumRef = useRef(0)
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

    let rafId, lastFrameTime = performance.now()
    const draw = (now = performance.now()) => {
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
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
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

/* ── Survival probability by risk level (re-entry ground reach) ── */
const SURVIVE_PCT = { high: 85, medium: 44, low: 11 }

/* ── Atmospheric gradient backgrounds per option ── */
const OPT_GRADIENT = {
  frame:      [
    'radial-gradient(ellipse at 25% 60%, #0d2035 0%, #040c18 75%)',   // aluminum — cold blue
    'radial-gradient(ellipse at 75% 40%, #120828 0%, #060313 75%)',   // titanium — deep purple
    'radial-gradient(ellipse at 50% 75%, #081510 0%, #040d08 75%)',   // cfrp — dark teal
  ],
  solar:      [
    'radial-gradient(ellipse at 40% 30%, #081e30 0%, #040c18 75%)',   // silicon — space blue
    'radial-gradient(ellipse at 60% 70%, #1c0c04 0%, #0d0602 75%)',   // gaas — ember
    'radial-gradient(ellipse at 35% 55%, #041818 0%, #020c0c 75%)',   // flexible — deep teal
  ],
  insulation: [
    'radial-gradient(ellipse at 50% 25%, #101820 0%, #060c14 75%)',   // mli — blue-gray
    'radial-gradient(ellipse at 65% 65%, #151208 0%, #0a0a05 75%)',   // honeycomb — warm
    'radial-gradient(ellipse at 30% 50%, #1a1406 0%, #0c0a03 75%)',   // kevlar — amber
  ],
  propulsion: [
    'radial-gradient(ellipse at 50% 40%, #220808 0%, #100404 75%)',   // ti_tank — danger red
    'radial-gradient(ellipse at 45% 60%, #060c18 0%, #030810 75%)',   // al_tank — safe blue
    'radial-gradient(ellipse at 55% 40%, #1c0e04 0%, #0d0802 75%)',   // copv — amber
  ],
}

/* ── Satellite schematic — always-accurate 2-D diagram showing the active part ── */
function PartSchematic({ activePart }) {
  const accent = PART_ACCENT[activePart] ?? '#6b7fff'
  const dim    = 'rgba(107,127,255,0.18)'
  const dimFill = 'rgba(107,127,255,0.03)'

  const c  = (part) => activePart === part ? accent         : dim
  const f  = (part) => activePart === part ? accent + '1a'  : dimFill
  const sw = (part) => activePart === part ? 1.5            : 0.7

  return (
    <div style={{ pointerEvents: 'none' }}>
      <svg viewBox="0 0 118 64" width={118} height={64} style={{ overflow: 'visible' }}>
        {/* ── Left solar panel ── */}
        <rect x="1" y="20" width="24" height="20" rx="2"
          fill={f('solar')} stroke={c('solar')} strokeWidth={sw('solar')} />
        {/* inner cell lines */}
        {[6,11,16,21].map(x => (
          <line key={x} x1={x} y1="20" x2={x} y2="40"
            stroke={c('solar')} strokeWidth={0.4} opacity={activePart==='solar'?0.6:0.2}/>
        ))}
        {/* left boom */}
        <line x1="25" y1="30" x2="33" y2="30"
          stroke={c('solar')} strokeWidth={sw('solar')} />

        {/* ── Insulation (outer shell) ── */}
        <rect x="33" y="14" width="52" height="32" rx="6"
          fill={f('insulation')} stroke={c('insulation')} strokeWidth={sw('insulation')} />

        {/* ── Frame / body (inner) ── */}
        <rect x="37" y="18" width="44" height="24" rx="4"
          fill={f('frame')} stroke={c('frame')} strokeWidth={sw('frame')} />
        {/* panel lines on body */}
        {[46,55,64,73].map(x => (
          <line key={x} x1={x} y1="18" x2={x} y2="42"
            stroke={c('frame')} strokeWidth={0.4} opacity={activePart==='frame'?0.5:0.15}/>
        ))}

        {/* ── Propulsion nozzle ── */}
        <line x1="59" y1="46" x2="59" y2="51"
          stroke={c('propulsion')} strokeWidth={sw('propulsion')} />
        <polygon points="59,51 51,62 67,62"
          fill={f('propulsion')} stroke={c('propulsion')} strokeWidth={sw('propulsion')} />

        {/* ── Right boom ── */}
        <line x1="85" y1="30" x2="93" y2="30"
          stroke={c('solar')} strokeWidth={sw('solar')} />
        {/* ── Right solar panel ── */}
        <rect x="93" y="20" width="24" height="20" rx="2"
          fill={f('solar')} stroke={c('solar')} strokeWidth={sw('solar')} />
        {[99,104,109,114].map(x => (
          <line key={x} x1={x} y1="20" x2={x} y2="40"
            stroke={c('solar')} strokeWidth={0.4} opacity={activePart==='solar'?0.6:0.2}/>
        ))}

        {/* ── Active part glow pulse ── */}
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

      {/* part label */}
      <div style={{
        marginTop: 5,
        fontFamily: "'Space Mono', monospace",
        fontSize: 7, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: accent, textAlign: 'center',
      }}>
        {PARTS.find(p => p.id === activePart)?.labelEn ?? ''}
      </div>
    </div>
  )
}

/* ── Scene 5: MATERIAL SELECTION ── */
function SceneMaterial({ satellite, user, storyOutline, materials, setMaterialPart, onComplete, mouseXRef, mouseYRef }) {
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
    <div style={{ position: 'absolute', inset: 0, background: '#02030e', display: 'flex' }}>

      {/* ── LEFT: 3D GLB model (45% width) ── */}
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

        {/* Part info overlay at bottom-left of model */}
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

        {/* Part progress dots - bottom center of model panel */}
        <div style={{
          position: 'absolute', bottom: 22, left: 0, right: 0,
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

        {/* ── Satellite schematic overlay (top-right of model panel) ── */}
        <motion.div
          key={activePart.id}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: 'absolute', top: 18, right: 18, zIndex: 10,
            pointerEvents: 'none',
            padding: '10px 12px',
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

      {/* ── RIGHT: column — accordion on top, CTA button below ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {/* Accordion area */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>

        {/* Top label */}
        <div style={{
          position: 'absolute', top: 18, left: 18, right: 18, zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(107,127,255,0.22)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            SELECT MATERIAL
          </span>
          <span style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(107,127,255,0.22)', letterSpacing: '0.12em' }}>
            {selectedCount} / 4 CONFIGURED
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
              {/* Background gradient */}
              <motion.div
                animate={{ scale: isActive ? 1.05 : 1 }}
                transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: 'absolute', inset: 0, background: gradients[i] ?? '#04040f' }}
              />

              {/* Dark vignette overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(2,3,14,0.97) 0%, rgba(2,3,14,0.40) 55%, rgba(2,3,14,0.12) 100%)',
              }} />

              {/* Selected top glow */}
              {isSel && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(to bottom, ${accent}1a 0%, transparent 45%)`,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Top-left label */}
              <div style={{
                position: 'absolute', top: 46, left: 16,
                fontFamily: MONO, fontSize: 7.5, fontWeight: 700,
                color: isActive ? accent : 'rgba(107,127,255,0.25)',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                transition: 'color 0.4s',
              }}>
                {String(i + 1).padStart(2, '0')} · {opt.en.split(' ')[0]}
              </div>

              {/* Top-right risk */}
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

              {/* Ghost number */}
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

              {/* Center content (on hover) */}
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

              {/* Bottom: EN code + material name */}
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

              {/* Selected bottom bar */}
              {isSel && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
                }} />
              )}
            </motion.div>
          )
        })}

        </div>{/* end accordion */}

        {/* ── CTA button — sits in flow below accordion, no overlap ever ── */}
        <AnimatePresence>
          {allDone && aiState === 'idle' && (
            <motion.div
              key="gen-cta"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 64 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onClick={handleGenerateFeedback}
              whileHover={{ background: 'rgba(107,127,255,0.18)' }}
              style={{
                flexShrink: 0, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
                borderTop: '1px solid rgba(107,127,255,0.28)',
                background: 'rgba(107,127,255,0.10)',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontFamily: MONO, fontSize: 12, fontWeight: 700,
                color: '#c8ccff', letterSpacing: '0.22em', textTransform: 'uppercase',
              }}>
                GENERATE ANALYSIS
              </span>
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ fontFamily: MONO, fontSize: 18, color: '#6b7fff', lineHeight: 1 }}
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
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6b7fff', animation: 'blink 1.2s ease infinite', boxShadow: '0 0 10px #6b7fff' }} />
                <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(107,127,255,0.55)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
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
                <p style={{ fontFamily: ZH, fontSize: 12, color: 'rgba(232,232,248,0.68)', lineHeight: 2.0, margin: '0 0 24px', borderLeft: '2px solid rgba(107,127,255,0.2)', paddingLeft: 14 }}>
                  {aiState === 'done' ? feedback : '材料分析服务暂时不可用，材料组合已记录。'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                    onClick={onComplete}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(107,127,255,0.14)'; e.currentTarget.style.borderColor='rgba(107,127,255,0.7)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(107,127,255,0.06)'; e.currentTarget.style.borderColor='rgba(107,127,255,0.40)' }}
                    style={{
                      fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                      padding: '10px 22px', cursor: 'pointer',
                      border: '1px solid rgba(107,127,255,0.40)', color: '#6b7fff',
                      background: 'rgba(107,127,255,0.06)', transition: 'background 0.2s, border-color 0.2s',
                    }}
                  >
                    NEXT CHAPTER →
                  </motion.div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

/* ── Main M1 ── */
export default function M1({ onComplete }) {
  const satellite        = useAppStore(s => s.satellite)
  const user             = useAppStore(s => s.user)
  const storyOutline     = useAppStore(s => s.storyOutline)
  const materials        = useAppStore(s => s.materials)
  const setMaterialPart  = useAppStore(s => s.setMaterialPart)
  const completedModules = useAppStore(s => s.completedModules)

  const [released,  setReleased]  = useState(false)
  const [isInView,  setIsInView]  = useState(false)
  const [sceneIdx,  setSceneIdx]  = useState(0)
  const [direction, setDirection] = useState(1)
  const containerRef = useRef()
  const TOTAL = 6

  // Refs for wheel handler (avoids stale closures in window-level listener)
  const isInViewRef    = useRef(false)
  const sceneIdxRef    = useRef(0)
  const releasedRef    = useRef(false)
  const m1CompletedRef = useRef(completedModules.includes('m1'))

  useEffect(() => { sceneIdxRef.current = sceneIdx }, [sceneIdx])
  useEffect(() => { releasedRef.current = released  }, [released])
  useEffect(() => { m1CompletedRef.current = completedModules.includes('m1') }, [completedModules])


  /* Mouse tracking */
  const rawX    = useMotionValue(0)
  const rawY    = useMotionValue(0)
  const smoothX = useSpring(rawX, { stiffness: 80, damping: 22 })
  const smoothY = useSpring(rawY, { stiffness: 80, damping: 22 })
  const normX   = useTransform(rawX, [0, typeof window !== 'undefined' ? window.innerWidth  : 1], [-1, 1])
  const normY   = useTransform(rawY, [0, typeof window !== 'undefined' ? window.innerHeight : 1], [-1, 1])

  /* R3F bridge */
  const mouseXRef = useRef(0.5)
  const mouseYRef = useRef(0.5)
  useEffect(() => {
    const ux = rawX.on('change', v => { mouseXRef.current = v / window.innerWidth })
    const uy = rawY.on('change', v => { mouseYRef.current = v / window.innerHeight })
    return () => { ux(); uy() }
  }, [])

  useEffect(() => {
    const h = e => { rawX.set(e.clientX); rawY.set(e.clientY) }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [])

  /* Navigation */
  const goTo = useCallback((idx) => {
    const next = Math.max(0, Math.min(TOTAL - 1, idx))
    setDirection(next > sceneIdxRef.current ? 1 : -1)
    setSceneIdx(next)
  }, [])

  /* 滚动锁定 + Scene 导航
     双重防御：
     1. wheel 事件内"提前"检测（M1 将要进入视口就锁，不等进入后再锁）
     2. scroll 事件兜底（极速滑过时由 scroll 事件补救并 snap 回来）
     无论 M1 是否已完成，每次进入 M1 区域都会重新锁定，必须横向滚动到头才能继续。
     从上方进入（向下滚）→ 从 Scene 0 开始，向右滚到 Scene 5 才能继续到 M2。
     从下方进入（向上滚）→ 从 Scene 5 开始，向左滚到 Scene 0 才能继续到 Entrance。 */
  useEffect(() => {
    const lastWheel = { t: 0 }
    let locked    = false
    let unlocking = false  // 解锁动画期间防止 scroll 兜底再次锁定
    let animating = false  // snap 动画进行期间
    let animRafId = null
    let prevScrollY = window.scrollY

    // ease-in-out 曲线：慢→快→慢
    const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

    // 用 ease 曲线平滑滚动到 targetY，完成后调用 onDone
    const smoothTo = (targetY, onDone) => {
      const startY = window.scrollY
      const dist   = targetY - startY
      if (Math.abs(dist) < 3) { animating = false; onDone(); return }
      const t0  = performance.now()
      const dur = 620  // ms，可调
      const tick = (now) => {
        const p = Math.min((now - t0) / dur, 1)
        window.scrollTo(0, startY + dist * ease(p))
        if (p < 1) {
          animRafId = requestAnimationFrame(tick)
        } else {
          window.scrollTo(0, targetY)
          animating = false
          animRafId = null
          onDone()
        }
      }
      animRafId = requestAnimationFrame(tick)
    }

    const getAbsTop = () => {
      const el = containerRef.current
      if (!el) return 0
      return Math.round(el.getBoundingClientRect().top + window.scrollY)
    }

    // dir: 'down' = 从上方进入（从 Scene 0 开始），'up' = 从下方进入（从末尾开始）
    const lockToM1 = (dir = 'down') => {
      if (locked || unlocking || animating) return
      locked = true
      isInViewRef.current = true
      setIsInView(true)
      const startScene = dir === 'up' ? TOTAL - 1 : 0
      sceneIdxRef.current = startScene
      setSceneIdx(startScene)
      setDirection(dir === 'up' ? -1 : 1)
      const targetY = getAbsTop()
      if (Math.abs(window.scrollY - targetY) < 3) {
        // 已在位置，直接锁定
        document.body.style.overflow = 'hidden'
      } else {
        // 用 ease 曲线平滑滚动到 M1，动画结束后再锁定滚动
        animating = true
        smoothTo(targetY, () => { document.body.style.overflow = 'hidden' })
      }
    }

    const unlockFromM1 = (toY) => {
      if (animRafId) { cancelAnimationFrame(animRafId); animRafId = null; animating = false }
      locked    = false
      unlocking = true
      isInViewRef.current = false
      setIsInView(false)
      // overflow: hidden 状态下 window.scrollTo 无法移动页面，必须先解除再启动动画
      // animating=true 会让 onWheel 的 e.preventDefault() 阻断用户触发，unlocking=true 阻断 onScroll 重锁
      document.body.style.overflow = ''
      animating = true
      smoothTo(Math.max(0, toY), () => {
        setTimeout(() => { unlocking = false }, 300)
      })
    }

    // scroll 兜底：极速滑动导致 wheel 漏网时，scroll 事件仍能 snap 回 M1
    const onScroll = () => {
      if (locked || unlocking) return
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const currentScrollY = window.scrollY
      const scrollDir = currentScrollY >= prevScrollY ? 'down' : 'up'
      prevScrollY = currentScrollY
      // M1 在视口内（底部 > 0 确保 M1 仍有像素在屏幕上，防止在 M2 时误触发）
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        lockToM1(scrollDir)
      }
    }

    const onWheel = e => {
      const el = containerRef.current
      if (!el) return

      // snap 动画进行中：阻断原生滚动，等动画完成
      if (animating) { e.preventDefault(); return }

      if (!locked) {
        const rect  = el.getBoundingClientRect()
        const absDx = Math.abs(e.deltaX), absDy = Math.abs(e.deltaY)
        const delta  = absDx > absDy ? e.deltaX : e.deltaY
        const absDelta = Math.max(absDx, absDy)

        // 提前锁定：向下滚且本次 delta 可能让 M1 进入视口（从上方接近）
        const approaching          = delta > 0 && rect.top > 0 && rect.top < window.innerHeight + absDelta + 200
        // 提前锁定：向上滚且 M1 底部即将进入视口（从下方接近，即从 M2 返回）
        const approachingFromBelow = delta < 0 && rect.top < 0 && rect.bottom > -absDelta - 200
        // 正常锁定：M1 已在视口内
        const inView               = rect.top < window.innerHeight && rect.bottom > 0

        if (approaching || approachingFromBelow || inView) {
          e.preventDefault()
          lockToM1(delta > 0 ? 'down' : 'up')
        }
        return
      }

      // 已锁定：阻断原生滚动
      e.preventDefault()

      const si    = sceneIdxRef.current
      const rel   = releasedRef.current
      const absDx = Math.abs(e.deltaX), absDy = Math.abs(e.deltaY)
      const delta  = absDx > absDy ? e.deltaX : e.deltaY

      // Scene 5 右侧可滚动面板：允许其自身滚动
      if (si === 5 && e.target.closest('[data-scroll-zone]')) return

      // 向左滚动且在第一个 Scene → 解锁回到 Entrance
      if (delta < 0 && si === 0) {
        unlockFromM1(getAbsTop() - window.innerHeight)
        return
      }

      // 向右滚动且在最后一个 Scene，且材料已选完或 M1 已完成 → 解锁进入 M2
      if (delta > 0 && (rel || m1CompletedRef.current) && si === TOTAL - 1) {
        const elTop = getAbsTop()
        unlockFromM1(elTop + (containerRef.current?.offsetHeight ?? window.innerHeight))
        return
      }

      // 节流 Scene 切换
      const now = Date.now()
      if (now - lastWheel.t < 900) return
      lastWheel.t = now

      if (delta > 0) {
        setDirection(1);  setSceneIdx(prev => Math.min(TOTAL - 1, prev + 1))
      } else {
        setDirection(-1); setSceneIdx(prev => Math.max(0, prev - 1))
      }
    }

    const onKey = e => {
      if (!isInViewRef.current) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setDirection(1);  setSceneIdx(prev => Math.min(TOTAL - 1, prev + 1))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setDirection(-1); setSceneIdx(prev => Math.max(0, prev - 1))
      }
    }

    window.addEventListener('scroll',  onScroll, { passive: true })
    window.addEventListener('wheel',   onWheel,  { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      if (animRafId) cancelAnimationFrame(animRafId)
      window.removeEventListener('scroll',  onScroll)
      window.removeEventListener('wheel',   onWheel)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  function handleComplete() {
    setReleased(true)
    onComplete()
  }

  const renderScene = () => {
    switch (sceneIdx) {
      case 0: return <SceneHero normX={normX} normY={normY} />
      case 1: return <SceneScale />
      case 2: return <SceneSources />
      case 3: return <SceneCountries />
      case 4: return <SceneTrend />
      case 5: return (
        <SceneMaterial
          satellite={satellite} user={user} storyOutline={storyOutline}
          materials={materials} setMaterialPart={setMaterialPart}
          onComplete={handleComplete}
          mouseXRef={mouseXRef} mouseYRef={mouseYRef}
        />
      )
      default: return null
    }
  }

  return (
    <div ref={containerRef} style={{
      height: '100vh', position: 'relative',
      overflow: 'hidden', cursor: 'none', background: '#04040f',
    }}>

      {/* Persistent Earth backdrop — unmount when not visible to free the WebGL context */}
      <AnimatePresence>
        {sceneIdx <= 1 && (
          <motion.div
            key="earth-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
          >
            <DebrisEarth showAnnotations={sceneIdx === 1} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={sceneIdx}
          custom={direction}
          variants={SCENE_VARIANTS}
          initial="enter"
          animate="show"
          exit="leave"
          style={{ position: 'absolute', inset: 0, zIndex: 3 }}
        >
          {renderScene()}
        </motion.div>
      </AnimatePresence>

      <CustomCursor mouseX={rawX} mouseY={rawY} smoothX={smoothX} smoothY={smoothY} />
      <SceneNav sceneIdx={sceneIdx} total={TOTAL} onNavigate={goTo} />
    </div>
  )
}
