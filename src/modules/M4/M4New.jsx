import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { AnimatePresence, motion } from 'framer-motion'
import gsap from 'gsap'
import * as THREE from 'three'
import useAppStore from '../../store/useAppStore'
import {
  generateGameDecisionFeedback,
  generateGameReflection,
} from '../../services/ai'
import { calcInitialArmor, evaluateResult, pickEvents } from './gameData'
import ReflectionPage from './ReflectionPage'

const EARTH_GLB = '/earth%20globe%203d%20model.glb'
const SATELLITE_GLB = '/simple_satellite_low_poly_free.glb'
const EARTH_SCALE = 1
const MIN_EARTH_SCALE = 1.6
const EXPANDED_EARTH_SCALE = 3
const RECOVERY_MODEL_SCALE = 1.08
const RECOVERY_MODEL_SHIFT_X = -1.74
const RECOVERY_VIEW_OFFSET_FACTOR = 0.16
const DEFAULT_CAMERA_FOV = 44
const RECOVERY_CAMERA_START_OFFSET = new THREE.Vector3(0.7, 0.36, 2.8)
const RECOVERY_CAMERA_END_OFFSET = new THREE.Vector3(0.42, 0.2, 1.28)
const RECOVERY_CAMERA_FOCUS_BLEND = 0.52
const RECOVERY_CAMERA_DAMPING = 0.92
const RECOVERY_CAMERA_ZOOM_DAMPING = 0.82
const RECOVERY_CAMERA_START_ORBIT_RADIUS = 3.15
const RECOVERY_CAMERA_END_ORBIT_RADIUS = 2.44
const RECOVERY_CAMERA_START_FOCUS_DISTANCE = 1.26
const RECOVERY_CAMERA_END_FOCUS_DISTANCE = 0.78
const RECOVERY_MISSION_END_PHASE = Math.PI * 0.25
const RECOVERY_MISSION_END_DURATION = 3.8
const RECOVERY_MIN_FORWARD_ARC = Math.PI * 0.18
const RECOVERY_ORBIT_ROTATION = [Math.PI * 0.12, 0.18, -0.42]
const RECOVERY_ORBIT_SCALE = 2.35
const RECOVERY_SATELLITE_SCALE = 1.62
const RECOVERY_SHUTDOWN_DURATION = 2.6
const PERSONAL_ORBIT_SPEED = 0.075
const PERSONAL_SATELLITE_SIZE = 0.1
const ORBITAL_DEBRIS_BASE_COUNT = 2000
const ORBITAL_DEBRIS_MAX_COUNT = 2600
const ORBIT_VIEWBOX_SIZE = 1000
const ORBIT_CENTER_X = 500
const ORBIT_CENTER_Y = 500
const ORBIT_RADIUS_X = 205
const ORBIT_RADIUS_Y = 150
const ORBIT_LEFT_X = ORBIT_CENTER_X - ORBIT_RADIUS_X
const ORBIT_RIGHT_X = ORBIT_CENTER_X + ORBIT_RADIUS_X
const ORBIT_FRONT_PATH = `M ${ORBIT_LEFT_X} ${ORBIT_CENTER_Y} A ${ORBIT_RADIUS_X} ${ORBIT_RADIUS_Y} 0 0 0 ${ORBIT_RIGHT_X} ${ORBIT_CENTER_Y}`
const TOTAL_ROUNDS = 6
const GAME_MONTHS = [1, 3, 5, 7, 9, 12]
const GAME_PHASE = {
  EVENT: 'event',
  FEEDBACK: 'feedback',
  REFLECTION: 'reflection',
  RECOVERY: 'recovery',
}
const RECOVERY_ANIMATION_STEP = {
  MISSION_END: 'mission-end',
  SYSTEM_SHUTDOWN: 'system-shutdown',
  PASSIVATION: 'passivation',
  DEORBIT_BURN: 'deorbit-burn',
  REENTRY: 'reentry',
  BREAKUP: 'breakup',
}
const DEORBIT_TARGET_ALTITUDE_OFFSET = -0.2
const DEORBIT_RADIUS_DROP = 2
const DEORBIT_SPIRAL_DURATION = 24
const DEORBIT_SPIRAL_TURNS = 2
const DEORBIT_SPIRAL_TRACE_POINTS = 420
const DEORBIT_SATELLITE_SHRINK_FACTOR = 0.2
const DEORBIT_CAMERA_FOCUS_BLEND = 0.78
const DEORBIT_CAMERA_END_OFFSET = new THREE.Vector3(0.23, 0.12, 0.40)
const DEORBIT_CAMERA_END_ORBIT_RADIUS = 1.46
const DEORBIT_CAMERA_END_FOCUS_DISTANCE = 0.44
const REENTRY_FALL_DURATION = 12
const REENTRY_LINEAR_DROP = 0.06
const REENTRY_END_RADIUS_FACTOR = 0.18
const REENTRY_SATELLITE_SHRINK_FACTOR = 0.055
const REENTRY_FLAME_PARTICLE_COUNT = 54
const REENTRY_CAMERA_DAMPING = 4.2
const REENTRY_CAMERA_ZOOM_DAMPING = 3.8
const REENTRY_CAMERA_FOCUS_BLEND = 0.96
const REENTRY_CAMERA_END_OFFSET = new THREE.Vector3(0.08, 0.04, 0.2)
const REENTRY_CAMERA_END_ORBIT_RADIUS = 0.76
const REENTRY_CAMERA_END_FOCUS_DISTANCE = 0.18
const BREAKUP_FALL_DURATION = 14
const BREAKUP_LINEAR_DROP = 0.055
const BREAKUP_END_RADIUS_FACTOR = 0.12
const BREAKUP_PARTICLE_COUNT = 72
const BREAKUP_CORE_SHRINK_FACTOR = 0.035
const BREAKUP_CORE_CLUSTER_RADIUS_FACTOR = 0.075
const BREAKUP_CORE_MIN_SIZE_FACTOR = 0.055
const BREAKUP_CORE_MAX_DISTANCE_FACTOR = 0.13
const BREAKUP_CAMERA_END_OFFSET = new THREE.Vector3(0.03, 0.014, 0.45)
const BREAKUP_CAMERA_END_ORBIT_RADIUS = 0.29
const BREAKUP_CAMERA_END_FOCUS_DISTANCE = 0.095
const PASSIVATION_BURST_CYCLE = 2.65
const PASSIVATION_BURST_DURATION = 0.56
const PASSIVATION_EJECTION_DURATION = 0.14
const PASSIVATION_PARTICLE_COUNT = 18
const PASSIVATION_CONE_RADIUS = 0.012
const PASSIVATION_BURSTS = [
  {
    origin: [-0.044, 0.014, 0.006],
    direction: [-1, 0.2, 0.08],
    delay: 0,
    length: 0.044,
  },
  {
    origin: [-0.038, -0.018, -0.012],
    direction: [-0.98, -0.16, -0.12],
    delay: 0.34,
    length: 0.038,
  },
  {
    origin: [0.01, 0.036, 0.016],
    direction: [0.12, 0.92, 0.36],
    delay: 0.72,
    length: 0.04,
  },
  {
    origin: [0.008, -0.036, -0.012],
    direction: [0.14, -0.94, -0.28],
    delay: 1.04,
    length: 0.042,
  },
  {
    origin: [0.018, 0.004, 0.044],
    direction: [0.18, 0.1, 0.98],
    delay: 1.42,
    length: 0.036,
  },
  {
    origin: [0.018, -0.006, -0.044],
    direction: [0.12, -0.08, -0.99],
    delay: 1.76,
    length: 0.04,
  },
  {
    origin: [-0.03, 0.026, -0.018],
    direction: [-0.7, 0.58, -0.4],
    delay: 2.18,
    length: 0.032,
  },
]
const THREAT_LABELS = {
  debris_approach: 'DEBRIS APPROACH',
  solar_storm: 'SOLAR STORM',
  orbital_decay: 'ORBITAL DECAY',
  cascade_fragment: 'CASCADE FRAGMENT',
  fuel_leak: 'FUEL LEAK',
}
const RECOVERY_STEPS = [
  {
    title: '任务结束',
    label: 'MISSION END',
    body: '卫星完成工作，进入退役状态。',
    img: '/任务结束.png',
  },
  {
    title: '关闭系统',
    label: 'SYSTEM SHUTDOWN',
    body: '关闭相机、通信设备、科学载荷等主要功能。',
    img: '/关闭载荷.png',
  },
  {
    title: '钝化处理',
    label: 'PASSIVATION',
    body: '释放剩余燃料、电池能量和高压气体，避免卫星在太空中爆炸。',
    img: '/钝化处理.png',
  },
  {
    title: '降轨减速',
    label: 'DEORBIT BURN',
    body: '卫星通过发动机点火或自然阻力降低轨道，逐渐靠近地球大气层。',
    img: '/降轨减速.png',
  },
  {
    title: '再入大气层',
    label: 'ATMOSPHERIC REENTRY',
    body: '卫星高速进入大气层，受到空气阻力和高温影响。',
    img: '/再入烧蚀.png',
  },
  {
    title: '燃烧解体 / 残骸坠落',
    label: 'BREAKUP / IMPACT',
    body: '大部分结构在大气层中烧毁，少量耐高温残骸可能落入海洋或地面。',
    img: '/残骸处置.png',
  },
]
const MATERIAL_PART_META = {
  frame: {
    label: '主框架结构',
    labelEn: 'PRIMARY STRUCTURE',
    accent: '#6b7fff',
    fallback: '铝合金',
    note: '承力骨架决定大块残骸的存活概率。',
  },
  solar: {
    label: '太阳能电池板',
    labelEn: 'SOLAR ARRAY',
    accent: '#38bdf8',
    fallback: '硅基电池板',
    note: '外露面积最大，解体时会形成大量薄片碎屑。',
  },
  insulation: {
    label: '隔热 / 防护层',
    labelEn: 'THERMAL LAYER',
    accent: '#fbbf24',
    fallback: '多层铝箔隔热毯',
    note: '包覆层在冷热循环和再入烧蚀中更容易剥离。',
  },
  propulsion: {
    label: '推进贮箱',
    labelEn: 'PROPULSION TANK',
    accent: '#34d399',
    fallback: '铝合金贮箱',
    note: '厚壁贮箱是最可能保留形体的残骸之一。',
  },
}
const MATERIAL_OPTIONS = {
  frame: {
    aluminum: { label: '铝合金', summary: '低熔点，主结构大多在再入时烧蚀。', risk: 'LOW' },
    titanium: { label: '钛合金', summary: '高熔点，大块结构更可能穿过大气层。', risk: 'HIGH' },
    cfrp: { label: '碳纤维复合材料', summary: '会分解成纤维状碎片，分布范围更广。', risk: 'MED' },
  },
  solar: {
    silicon: { label: '硅基电池板', summary: '玻璃盖片碎裂成粉尘，地面存活率低。', risk: 'LOW' },
    gaas: { label: '砷化镓电池板', summary: '电池层可能形成液态滴落，部分材料残留。', risk: 'MED' },
    flexible: { label: '柔性薄膜电池板', summary: '在轨剥离更频繁，易形成微粒云。', risk: 'LOW' },
  },
  insulation: {
    mli: { label: '多层铝箔隔热毯', summary: '在轨微粒最多，再入后通常完全烧毁。', risk: 'HIGH' },
    honeycomb: { label: '铝蜂窝板', summary: '碰撞后产生规则碎片，综合风险中等。', risk: 'MED' },
    kevlar: { label: '凯夫拉防护层', summary: '耐高温，厚层残片可能继续下落。', risk: 'HIGH' },
  },
  propulsion: {
    ti_tank: { label: '钛合金球形贮箱', summary: '高密度厚壁，完整落地概率最高。', risk: 'HIGH' },
    al_tank: { label: '铝合金贮箱', summary: '壁薄，大部分会在再入时燃烧。', risk: 'LOW' },
    copv: { label: '复合缠绕贮箱', summary: '外层燃烧后，金属内衬仍可能存活。', risk: 'MED' },
  },
}
const MATERIAL_RESIDUE_CATALOG = [
  {
    key: 'frame',
    id: 'frame-selected',
    label: '结构主体',
    labelEn: 'M2 STRUCTURE',
    source: 'selected',
    note: '来自 M2 主框架选择',
  },
  {
    key: 'frame',
    id: 'frame-fasteners',
    label: '连接残件',
    labelEn: 'FASTENERS',
    material: '紧固件 / 支架',
    risk: 'MED',
    summary: ({ selectedLabel }) => `与${selectedLabel}结构一起脱落，密度小但数量多。`,
    note: '常以小块金属残片形式留存',
  },
  {
    key: 'solar',
    id: 'solar-selected',
    label: '太阳翼材料',
    labelEn: 'M2 SOLAR',
    source: 'selected',
    note: '来自 M2 太阳能电池板选择',
  },
  {
    key: 'solar',
    id: 'solar-glass',
    label: '盖片碎屑',
    labelEn: 'COVER GLASS',
    material: '玻璃盖片',
    risk: 'LOW',
    summary: '电池片外层玻璃破碎后形成细小颗粒，通常在高温中快速烧蚀。',
    note: '来自太阳翼外层覆盖材料',
  },
  {
    key: 'solar',
    id: 'solar-circuit',
    label: '电路残片',
    labelEn: 'CIRCUIT',
    material: '柔性电路 / 导线',
    risk: 'LOW',
    summary: '随太阳翼分离后卷曲燃烧，残留多为短小导线和碳化片。',
    note: '来自供电与信号连接件',
  },
  {
    key: 'insulation',
    id: 'insulation-selected',
    label: '防护层材料',
    labelEn: 'M2 THERMAL',
    source: 'selected',
    note: '来自 M2 隔热 / 防护层选择',
  },
  {
    key: 'insulation',
    id: 'insulation-foil',
    label: '薄膜碎片',
    labelEn: 'FOIL LAYERS',
    material: '铝箔 / 聚酰亚胺膜',
    risk: 'MED',
    summary: '轻薄层会先被剥离，形成短暂发光的片状碎屑云。',
    note: '来自外覆多层隔热结构',
  },
  {
    key: 'propulsion',
    id: 'propulsion-selected',
    label: '推进部件',
    labelEn: 'M2 PROPULSION',
    source: 'selected',
    note: '来自 M2 推进贮箱选择',
  },
  {
    key: 'propulsion',
    id: 'propulsion-valve',
    label: '阀体残件',
    labelEn: 'VALVES',
    material: '阀体 / 管路',
    risk: 'MED',
    summary: '小型厚壁金属件耐热性更高，可能在火焰尾迹中继续下落。',
    note: '来自推进剂管理组件',
  },
  {
    key: 'propulsion',
    id: 'propulsion-liner',
    label: '内衬残骸',
    labelEn: 'TANK LINER',
    material: '贮箱内衬',
    risk: 'HIGH',
    summary: ({ selectedLabel }) => `${selectedLabel}外层烧蚀后，内衬或焊缝区域仍可能保持形体。`,
    note: '残骸存活概率最高的一类',
  },
]
const MATERIAL_RESIDUE_GROUPS = [
  {
    id: 'structure-group',
    label: '结构残件群',
    labelEn: 'STRUCTURE CLUSTER',
    itemIds: ['frame-selected', 'frame-fasteners'],
    layout: { x: -168, y: -114, rotate: -7, detail: 'right' },
    summary: '主框架材料与连接残件会在解体瞬间同向脱落，数量多但轨迹更集中。',
    note: '承力结构 + 连接残件',
  },
  {
    id: 'solar-group',
    label: '太阳翼碎片云',
    labelEn: 'SOLAR ARRAY CLOUD',
    itemIds: ['solar-selected', 'solar-glass', 'solar-circuit'],
    layout: { x: 164, y: -100, rotate: 4, detail: 'left' },
    summary: '太阳翼外露面积最大，盖片、电路和电池层会形成薄片与微粒云。',
    note: '电池层 + 盖片 + 电路',
  },
  {
    id: 'thermal-group',
    label: '薄膜防护层',
    labelEn: 'THERMAL FILM LAYERS',
    itemIds: ['insulation-selected', 'insulation-foil'],
    layout: { x: -150, y: 94, rotate: 6, detail: 'up-right' },
    summary: '隔热与防护材料更像片状云，通常先剥离，再被高温快速烧蚀。',
    note: '防护层 + 薄膜碎片',
  },
  {
    id: 'propulsion-group',
    label: '推进高密度件',
    labelEn: 'PROPULSION DENSE PARTS',
    itemIds: ['propulsion-selected', 'propulsion-valve', 'propulsion-liner'],
    layout: { x: 158, y: 82, rotate: -6, detail: 'up-left' },
    summary: '贮箱、阀体和内衬属于高密度压力部件，是最需要关注的一组。',
    note: '贮箱 + 阀体 + 内衬',
  },
]
const MATERIAL_RISK_WEIGHT = {
  LOW: 1,
  SIM: 1,
  MED: 2,
  HIGH: 3,
}
const MotionAside = motion.aside
const MotionDiv = motion.div
const GUIDE_STYLES = `
  @keyframes m4-guide-pulse {
    0%, 100% { opacity: 0.2; transform: scale(0.92); }
    50% { opacity: 0.62; transform: scale(1.2); }
  }

  @keyframes m4-guide-arrow {
    0%, 100% { transform: translateX(-2px); }
    50% { transform: translateX(4px); }
  }

  @keyframes m4-guide-signal {
    0%, 100% { opacity: 0.32; }
    50% { opacity: 0.84; }
  }

  .m4-start-guide {
    position: absolute;
    top: 50%;
    z-index: 3;
    width: min(360px, calc(25vw - clamp(34px, 6vw, 116px) - 28px));
    color: #f4f4ff;
    pointer-events: none;
    transform: translateY(-50%);
    transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .m4-start-guide-left {
    left: clamp(24px, 4vw, 78px);
  }

  .m4-start-guide-right {
    right: clamp(34px, 6vw, 116px);
  }

  .m4-guide-eyebrow {
    margin: 0;
    color: rgba(232,232,248,0.5);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    line-height: 1.8;
  }

  .m4-guide-number {
    display: flex;
    align-items: baseline;
    gap: 14px;
    margin: 18px 0 14px;
  }

  .m4-guide-number strong {
    color: #f4f4ff;
    font-family: "Lexend", sans-serif;
    font-size: clamp(68px, 7vw, 112px);
    font-weight: 400;
    letter-spacing: -0.14em;
    line-height: 0.82;
  }

  .m4-guide-number span {
    color: rgba(232,232,248,0.72);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 14px;
    letter-spacing: 0.18em;
  }

  .m4-guide-rule {
    position: relative;
    width: 100%;
    height: 1px;
    margin: 0 0 13px;
    background: #f4f4ff;
  }

  .m4-guide-rule::after {
    position: absolute;
    top: -3px;
    right: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f4f4ff;
    content: "";
  }

  .m4-guide-kicker {
    margin: 0;
    color: rgba(232,232,248,0.62);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    line-height: 1.8;
  }

  .m4-guide-icon {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
    color: rgba(244,244,255,0.82);
  }

  .m4-guide-icon::after {
    width: 56px;
    height: 1px;
    background: #f4f4ff;
    content: "";
  }

  .m4-start-guide h2 {
    margin: 0 0 12px;
    color: #f4f4ff;
    font-family: "Noto Sans SC", sans-serif;
    font-size: clamp(20px, 2vw, 30px);
    font-weight: 400;
    letter-spacing: 0.08em;
  }

  .m4-start-guide p {
    margin: 0;
    color: rgba(232,232,248,0.68);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 13px;
    letter-spacing: 0.08em;
    line-height: 1.9;
  }

  .m4-guide-action {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
    color: rgba(139,108,248,0.88);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.18em;
  }

  .m4-guide-action::before {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #8b6cf8;
    content: "";
    animation: m4-guide-signal 1.8s ease-in-out infinite;
  }

  .m4-guide-jump-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 17px;
    padding: 9px 12px;
    border: 1px solid rgba(244,244,255,0.3);
    border-radius: 4px;
    color: rgba(244,244,255,0.9);
    background: rgba(8,8,26,0.34);
    cursor: pointer;
    pointer-events: auto;
    font-family: "Lexend", sans-serif;
    font-size: 8px;
    letter-spacing: 0.12em;
    line-height: 1;
    text-transform: uppercase;
    transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease, transform 180ms ease;
  }

  .m4-guide-jump-button:hover,
  .m4-guide-jump-button:focus-visible {
    border-color: rgba(139,108,248,0.72);
    color: #f4f4ff;
    background: rgba(139,108,248,0.16);
    outline: none;
    transform: translateY(-1px);
  }

  .m4-guide-jump-icon {
    font-size: 12px;
    line-height: 1;
  }

  .m4-orbit-handle-halo {
    position: absolute;
    inset: -12px;
    border: 1px solid rgba(139,108,248,0.72);
    border-radius: 50%;
    animation: m4-guide-pulse 1.9s ease-in-out infinite;
    pointer-events: none;
  }

  .m4-orbit-handle-arrow {
    width: 18px;
    height: 18px;
    color: #111126;
    animation: m4-guide-arrow 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
    pointer-events: none;
  }

  .m4-orbit-static-hint {
    position: absolute;
    top: 81%;
    left: 50%;
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: rgba(244,244,255,0.92);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-align: center;
    transform: translateX(-50%);
    white-space: nowrap;
    pointer-events: none;
  }

  .m4-orbit-static-hint small {
    color: rgba(232,232,248,0.5);
    font-family: "Space Mono", monospace;
    font-size: 8px;
    letter-spacing: 0.18em;
  }

  @media (max-width: 960px) {
    .m4-start-guide {
      width: min(210px, calc(25vw - clamp(24px, 5vw, 58px) - 16px));
    }

    .m4-start-guide-left {
      left: clamp(24px, 5vw, 58px);
    }

    .m4-start-guide-right {
      right: clamp(24px, 5vw, 58px);
    }

    .m4-start-guide-right p {
      display: none;
    }

    .m4-guide-action {
      margin-top: 10px;
    }

    .m4-guide-jump-button {
      margin-top: 11px;
      padding: 8px 10px;
      font-size: 7px;
    }
  }

  @media (max-width: 720px) {
    .m4-start-guide-left {
      top: 48px;
      left: 24px;
      width: 190px;
      transform: none;
    }

    .m4-guide-number {
      margin-top: 12px;
    }

    .m4-start-guide-right {
      top: auto;
      right: 24px;
      bottom: 42px;
      left: 24px;
      width: auto;
      transform: none;
    }

    .m4-guide-icon,
    .m4-start-guide-right p {
      display: none;
    }

    .m4-start-guide h2 {
      margin-bottom: 0;
      font-size: 17px;
    }

    .m4-guide-action {
      margin-top: 9px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .m4-orbit-handle-halo,
    .m4-orbit-handle-arrow,
    .m4-guide-action::before {
      animation: none;
    }
  }
`
const GAME_STYLES = `
  .m4-game-panel {
    position: absolute;
    top: 50%;
    right: 18px;
    z-index: 5;
    width: min(390px, 31vw);
    max-height: min(760px, 86vh);
    overflow: auto;
    color: #15151d;
    background: rgba(250,249,246,0.96);
    border: 1px solid rgba(255,255,255,0.72);
    box-shadow: 0 18px 60px rgba(0,0,0,0.2);
    transform: translateY(-50%);
  }

  .m4-game-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 17px 20px 14px;
    border-bottom: 1px solid rgba(21,21,29,0.12);
  }

  .m4-game-panel-header-actions {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 10px;
  }

  .m4-game-recovery-jump {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid rgba(21,21,29,0.18);
    border-radius: 4px;
    color: rgba(21,21,29,0.68);
    background: rgba(21,21,29,0.025);
    cursor: pointer;
    font-family: "Lexend", sans-serif;
    font-size: 7px;
    letter-spacing: 0.12em;
    line-height: 1;
    text-transform: uppercase;
    transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
  }

  .m4-game-recovery-jump:hover,
  .m4-game-recovery-jump:focus-visible {
    border-color: rgba(80,70,229,0.48);
    color: #5046e5;
    background: rgba(80,70,229,0.065);
    outline: none;
  }

  .m4-game-recovery-jump:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .m4-game-label {
    color: rgba(21,21,29,0.52);
    font-family: "Lexend", sans-serif;
    font-size: 8px;
    letter-spacing: 0.16em;
    line-height: 1.6;
    text-transform: uppercase;
  }

  .m4-game-panel-body {
    padding: 18px 20px 20px;
  }

  .m4-game-panel h2 {
    margin: 10px 0 10px;
    color: #15151d;
    font-family: "Noto Serif SC", serif;
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.45;
  }

  .m4-game-panel p {
    margin: 0;
    color: rgba(21,21,29,0.66);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    line-height: 1.9;
  }

  .m4-game-reference {
    margin: 14px 0 16px;
    padding: 10px 0 10px 11px;
    border-left: 1px solid rgba(21,21,29,0.3);
    color: rgba(21,21,29,0.56);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 11px;
    line-height: 1.75;
  }

  .m4-game-options {
    display: grid;
    gap: 8px;
    margin-top: 10px;
  }

  .m4-game-option {
    position: relative;
    width: 100%;
    padding: 11px 34px 11px 12px;
    border: 1px solid rgba(21,21,29,0.14);
    color: rgba(21,21,29,0.72);
    background: rgba(21,21,29,0.025);
    cursor: pointer;
    text-align: left;
    transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
  }

  .m4-game-option:hover,
  .m4-game-option:focus-visible {
    border-color: rgba(80,70,229,0.56);
    color: #15151d;
    background: rgba(80,70,229,0.065);
    outline: none;
  }

  .m4-game-option:disabled {
    cursor: wait;
    opacity: 0.46;
  }

  .m4-game-option strong {
    display: block;
    margin-bottom: 5px;
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
  }

  .m4-game-option small {
    display: block;
    color: rgba(21,21,29,0.46);
    font-family: "Lexend", "Noto Sans SC", sans-serif;
    font-size: 9px;
    letter-spacing: 0.04em;
    line-height: 1.55;
  }

  .m4-game-option-index {
    position: absolute;
    top: 11px;
    right: 12px;
    color: rgba(21,21,29,0.38);
    font-family: "Lexend", sans-serif;
    font-size: 10px;
  }

  .m4-feedback-note {
    margin: 12px 0 16px;
    padding-left: 12px;
    border-left: 2px solid var(--feedback-color);
  }

  .m4-feedback-deltas {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin: 16px 0 4px;
  }

  .m4-feedback-delta {
    padding: 3px 7px;
    border: 1px solid rgba(21,21,29,0.15);
    color: rgba(21,21,29,0.62);
    font-family: "Lexend", sans-serif;
    font-size: 9px;
    letter-spacing: 0.08em;
  }

  .m4-game-continue {
    width: 100%;
    margin-top: 17px;
    padding: 10px 12px;
    border: 1px solid rgba(21,21,29,0.82);
    color: #f8f7f4;
    background: #15151d;
    cursor: pointer;
    font-family: "Lexend", sans-serif;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transition: opacity 180ms ease;
  }

  .m4-game-continue:hover {
    opacity: 0.78;
  }

  .m4-story-panel {
    position: absolute;
    bottom: clamp(38px, 7vh, 72px);
    left: clamp(28px, 4vw, 72px);
    z-index: 4;
    width: min(470px, 42vw);
    color: #f4f4ff;
    pointer-events: none;
  }

  .m4-story-panel::before {
    display: block;
    width: 46px;
    height: 1px;
    margin-bottom: 15px;
    background: rgba(244,244,255,0.88);
    content: "";
  }

  .m4-story-panel p {
    margin: 9px 0 0;
    color: rgba(232,232,248,0.86);
    font-family: "Noto Serif SC", serif;
    font-size: 15px;
    line-height: 1.95;
  }

  .m4-recovery-panel {
    position: absolute;
    bottom: clamp(42px, 8vh, 84px);
    left: clamp(28px, 4vw, 72px);
    z-index: 4;
    width: min(620px, 50vw);
    color: #f4f4ff;
    pointer-events: none;
  }

  .m4-recovery-panel.is-intro-only {
    bottom: clamp(92px, 16vh, 154px);
  }

  .m4-recovery-panel::before {
    display: block;
    width: 44px;
    height: 1px;
    margin-bottom: 14px;
    background: rgba(244,244,255,0.9);
    content: "";
  }

  .m4-recovery-panel .m4-game-label {
    font-size: 7px;
  }

  .m4-recovery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: min(470px, 100%);
  }

  .m4-recovery-back-button {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 7px;
    padding: 7px 10px;
    border: 1px solid rgba(244,244,255,0.28);
    border-radius: 4px;
    color: rgba(244,244,255,0.84);
    background: rgba(8,8,26,0.42);
    cursor: pointer;
    pointer-events: auto;
    font-family: "Lexend", sans-serif;
    font-size: 8px;
    letter-spacing: 0.12em;
    line-height: 1;
    text-transform: uppercase;
    transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease, transform 180ms ease;
  }

  .m4-recovery-back-button:hover,
  .m4-recovery-back-button:focus-visible {
    border-color: rgba(244,244,255,0.58);
    color: #f4f4ff;
    background: rgba(107,127,255,0.16);
    outline: none;
    transform: translateX(-2px);
  }

  .m4-recovery-back-icon {
    font-size: 13px;
    line-height: 1;
  }

  .m4-recovery-panel h2 {
    margin: 14px 0 0;
    color: #f4f4ff;
    font-family: "Noto Serif SC", serif;
    font-size: clamp(30px, 3.8vw, 52px);
    font-weight: 300;
    letter-spacing: 0.04em;
    line-height: 1.16;
  }

  .m4-recovery-rule {
    width: min(470px, 100%);
    height: 1px;
    margin: 20px 0 18px;
    background: rgba(107,127,255,0.36);
  }

  .m4-recovery-panel p {
    max-width: 620px;
    margin: 0;
    color: rgba(232,232,248,0.68);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 13px;
    line-height: 1.9;
  }

  .m4-recovery-steps {
    position: absolute;
    top: 0;
    right: clamp(24px, 4vw, 58px);
    bottom: 0;
    z-index: 4;
    width: min(520px, 42vw);
    overflow-y: auto;
    padding: 0 2px 0 46px;
    scrollbar-width: none;
  }

  .m4-recovery-steps::-webkit-scrollbar {
    display: none;
  }

  .m4-recovery-step-card {
    display: grid;
    grid-template-columns: minmax(0, 1.14fr) minmax(150px, 0.86fr);
    min-height: 132px;
    margin-bottom: 18px;
    color: #15151d;
    background: rgba(250,249,246,0.98);
    border: 1px solid rgba(255,255,255,0.65);
    box-shadow: 0 14px 46px rgba(0,0,0,0.2);
    cursor: pointer;
    transform: translateX(0);
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease, border-color 220ms ease;
  }

  .m4-recovery-step-card:hover,
  .m4-recovery-step-card:focus-within,
  .m4-recovery-step-card:focus-visible,
  .m4-recovery-step-card.is-active {
    transform: translateX(-34px);
    border-color: rgba(255,255,255,0.9);
    box-shadow: 0 18px 56px rgba(0,0,0,0.28);
    outline: none;
  }

  .m4-recovery-step-card.is-active {
    border-color: rgba(107,127,255,0.58);
  }

  .m4-recovery-step-copy {
    position: relative;
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    padding: 18px 19px 18px 22px;
  }

  .m4-recovery-step-kicker {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    color: rgba(21,21,29,0.54);
    font-family: "Lexend", "Noto Sans SC", sans-serif;
    font-size: 8px;
    letter-spacing: 0.12em;
    line-height: 1.4;
    text-transform: uppercase;
  }

  .m4-recovery-step-index {
    color: rgba(80,70,229,0.8);
    font-family: "Space Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
  }

  .m4-recovery-step-copy h3 {
    margin: 0 0 9px;
    color: #15151d;
    font-family: "Noto Serif SC", serif;
    font-size: clamp(20px, 1.65vw, 28px);
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.22;
  }

  .m4-recovery-step-copy p {
    margin: 0;
    color: rgba(21,21,29,0.62);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 11px;
    line-height: 1.62;
  }

  .m4-recovery-step-media {
    min-width: 0;
    overflow: hidden;
    background: #d8dbe4;
  }

  .m4-recovery-step-media img {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 132px;
    object-fit: cover;
  }

  .m4-mission-progress {
    margin-top: 15px;
  }

  .m4-mission-progress-track {
    height: 2px;
    margin-top: 7px;
    background: rgba(232,232,248,0.15);
  }

  .m4-mission-progress-value {
    height: 100%;
    background: rgba(244,244,255,0.86);
    transition: width 500ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes m4-material-callout-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .m4-material-board {
    position: absolute;
    inset: 0;
    z-index: 6;
    color: #15151d;
    pointer-events: none;
  }

  .m4-material-board-inner {
    position: absolute;
    top: 50%;
    left: 45%;
    width: 0;
    height: 0;
    transform: translate(-50%, -50%);
  }

  .m4-material-board-header {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 8px;
    padding: 8px 11px;
    color: rgba(21,21,29,0.56);
    background: rgba(250,249,246,0.96);
    border: 1px solid rgba(255,255,255,0.72);
    font-family: "Space Mono", monospace;
    font-size: 7px;
    letter-spacing: 0.16em;
    line-height: 1;
    text-transform: uppercase;
  }

  .m4-material-board-header::before {
    flex: 1;
    height: 1px;
    background: rgba(21,21,29,0.18);
    content: "";
  }

  .m4-material-board-grid {
    position: relative;
    width: 0;
    height: 0;
  }

  .m4-material-card {
    position: absolute;
    top: 0;
    left: 0;
    width: 182px;
    min-height: 0;
    padding: 8px 10px 8px 12px;
    overflow: visible;
    color: #15151d;
    background: rgba(250,249,246,0.68);
    border: 1px solid rgba(255,255,255,0.36);
    box-shadow: 0 8px 22px rgba(0,0,0,0.08);
    pointer-events: auto;
    backdrop-filter: blur(3px);
    transform: translate(-50%, -50%) translate(var(--material-x), var(--material-y)) rotate(var(--material-rotate));
    animation: m4-material-callout-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .m4-material-card::before {
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--material-color);
    content: "";
    opacity: 0.62;
  }

  .m4-material-card.is-selected {
    background: rgba(255,255,255,0.72);
  }

  .m4-material-card h4 {
    display: grid;
    gap: 2px;
    margin: 0;
    color: #15151d;
    font-family: "Noto Sans SC", sans-serif;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .m4-material-card h4 span {
    color: rgba(21,21,29,0.46);
    font-family: "Space Mono", monospace;
    font-size: 6px;
    letter-spacing: 0.12em;
    line-height: 1;
    text-transform: uppercase;
  }

  .m4-material-card h4 strong {
    color: #15151d;
    font-family: "Noto Serif SC", serif;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.16;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .m4-material-card-detail {
    position: absolute;
    top: calc(100% + 7px);
    left: 0;
    z-index: 2;
    width: 252px;
    padding: 9px 10px 10px;
    color: #15151d;
    background: rgba(255,255,255,0.9);
    border: 1px solid rgba(21,21,29,0.12);
    box-shadow: 0 14px 34px rgba(0,0,0,0.18);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-3px);
    transition: opacity 160ms ease, transform 160ms ease, visibility 160ms ease;
  }

  .m4-material-card:hover .m4-material-card-detail,
  .m4-material-card:focus-visible .m4-material-card-detail {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .m4-material-card.is-detail-up .m4-material-card-detail {
    top: auto;
    bottom: calc(100% + 7px);
    transform: translateY(3px);
  }

  .m4-material-card.is-detail-up:hover .m4-material-card-detail,
  .m4-material-card.is-detail-up:focus-visible .m4-material-card-detail {
    transform: translateY(0);
  }

  .m4-material-card.is-detail-left .m4-material-card-detail {
    right: 0;
    left: auto;
  }

  .m4-material-card-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
    color: rgba(21,21,29,0.46);
    font-family: "Space Mono", monospace;
    font-size: 6px;
    letter-spacing: 0.1em;
    line-height: 1;
    text-transform: uppercase;
  }

  .m4-material-card-risk {
    color: #6b7fff;
  }

  .m4-material-card p {
    margin: 0;
    color: rgba(21,21,29,0.62);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 9px;
    line-height: 1.55;
  }

  .m4-material-card-items {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  }

  .m4-material-card-chip {
    max-width: 100%;
    padding: 3px 5px;
    overflow: hidden;
    color: rgba(21,21,29,0.64);
    background: color-mix(in srgb, var(--material-color) 12%, rgba(21,21,29,0.05));
    border: 1px solid color-mix(in srgb, var(--material-color) 28%, rgba(21,21,29,0.08));
    font-family: "Noto Sans SC", sans-serif;
    font-size: 8px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .m4-material-card-note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    color: rgba(21,21,29,0.42);
    font-family: "Space Mono", monospace;
    font-size: 6px;
    letter-spacing: 0.1em;
    line-height: 1.4;
    text-transform: uppercase;
  }

  .m4-material-card-note::before {
    width: 11px;
    height: 1px;
    background: color-mix(in srgb, var(--material-color) 72%, rgba(21,21,29,0.24));
    content: "";
  }

  @media (max-width: 960px) {
    .m4-game-panel {
      right: 14px;
      width: min(340px, 38vw);
    }

    .m4-story-panel {
      width: min(390px, 44vw);
    }

    .m4-recovery-panel {
      width: min(560px, calc(100vw - 56px));
    }

    .m4-recovery-steps {
      width: min(440px, 44vw);
    }

    .m4-recovery-step-card {
      grid-template-columns: minmax(0, 1fr) minmax(124px, 0.74fr);
      min-height: 122px;
    }
  }

  @media (max-width: 720px) {
    .m4-game-panel {
      top: auto;
      right: 18px;
      bottom: 18px;
      left: 18px;
      width: auto;
      max-height: 58vh;
      transform: none;
    }

    .m4-game-panel-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .m4-story-panel {
      top: 26px;
      bottom: auto;
      left: 22px;
      width: calc(100vw - 44px);
    }

    .m4-recovery-panel {
      right: 22px;
      bottom: 32px;
      left: 22px;
      width: auto;
    }

    .m4-recovery-panel.is-intro-only {
      bottom: 82px;
    }

    .m4-recovery-panel h2 {
      font-size: 30px;
    }

    .m4-recovery-header {
      width: 100%;
    }

    .m4-recovery-back-button {
      padding: 7px 9px;
      font-size: 7px;
    }

    .m4-recovery-steps {
      top: auto;
      right: 18px;
      bottom: 18px;
      left: 18px;
      width: auto;
      max-height: 46vh;
      padding: 0 0 10px;
    }

    .m4-recovery-step-card,
    .m4-recovery-step-card:hover,
    .m4-recovery-step-card:focus-within {
      transform: none;
    }

    .m4-recovery-step-copy h3 {
      font-size: 19px;
    }

    .m4-material-board {
      inset: 0;
    }

    .m4-material-board-inner {
      left: 43%;
      transform: translate(-50%, -50%) scale(0.86);
    }

    .m4-material-card {
      width: 172px;
    }

    .m4-material-card h4 strong {
      font-size: 13px;
    }

    .m4-material-card p {
      font-size: 7px;
    }
  }

  @media (max-width: 720px) {
    .m4-material-board {
      inset: 0;
    }

    .m4-material-board-inner {
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.72);
    }

    .m4-material-card {
      width: 168px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .m4-material-card {
      animation: none;
    }
  }
`

useGLTF.preload(EARTH_GLB)
useGLTF.preload(SATELLITE_GLB)

function StartGuide({ opacity, progress, onJumpToRecovery }) {
  const guideOpacity = opacity * Math.max(0, 1 - progress * 2.8)

  return (
    <>
      <style>{GUIDE_STYLES}</style>

      <aside
        className="m4-start-guide m4-start-guide-left"
        aria-label="任务编号"
        style={{ opacity: guideOpacity }}
      >
        <p className="m4-guide-eyebrow">ORBITAL SURVIVAL / SIMULATION 04</p>
        <div className="m4-guide-number">
          <strong>01</strong>
          <span>初始轨道</span>
        </div>
        <div className="m4-guide-rule" />
        <p className="m4-guide-kicker">LOW EARTH ORBIT · DEBRIS RESPONSE</p>
      </aside>

      <aside
        className="m4-start-guide m4-start-guide-right"
        aria-label="游戏介绍"
        style={{ opacity: guideOpacity }}
      >
        <div className="m4-guide-icon" aria-hidden="true">
          <svg width="38" height="20" viewBox="0 0 38 20" fill="none">
            <ellipse cx="19" cy="10" rx="16" ry="6.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="19" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="33" cy="7" r="1.8" fill="currentColor" />
          </svg>
        </div>
        <h2>在碎片风暴中生存</h2>
        <p>接管一颗受损卫星，在十二个月的近地轨道任务中躲避碎片。每一次判断都会消耗燃料或护甲，也会改变最终结局。</p>
        <div className="m4-guide-action">12 MONTHS · ONE SATELLITE</div>
        <button
          type="button"
          className="m4-guide-jump-button"
          onClick={onJumpToRecovery}
          aria-label="直接进入卫星回收页面"
        >
          <span className="m4-guide-jump-icon" aria-hidden="true">↘</span>
          <span>进入回收演示</span>
        </button>
      </aside>
    </>
  )
}

function GameStatusHud({ month, fuel, armor, missionProgress }) {
  return (
    <section
      aria-label="卫星生存任务状态"
      style={{
        position: 'absolute',
        top: 'clamp(36px, 6vh, 72px)',
        left: 'clamp(28px, 4vw, 72px)',
        zIndex: 3,
        width: 'min(310px, calc(100vw - 56px))',
        padding: '4px 0 4px 18px',
        borderLeft: '1px solid rgba(232,232,248,0.42)',
        color: '#f4f4ff',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: 9,
        letterSpacing: '0.2em',
        color: 'rgba(232,232,248,0.48)',
        marginBottom: 16,
      }}>
        ORBITAL SURVIVAL · MISSION STATUS
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <strong style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 54,
          lineHeight: 0.92,
          fontWeight: 400,
          letterSpacing: '-0.1em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(month).padStart(2, '0')}
        </strong>
        <span style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: 15,
          letterSpacing: '0.12em',
          color: 'rgba(232,232,248,0.76)',
        }}>
          月
        </span>
      </div>

      <div style={{
        height: 1,
        background: 'rgba(232,232,248,0.28)',
        margin: '17px 0 14px',
      }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <StatusMetric label="燃料" english="FUEL" value={fuel} />
        <StatusMetric label="护甲" english="ARMOR" value={armor} />
      </div>

      <div className="m4-mission-progress">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'rgba(232,232,248,0.58)',
          fontFamily: 'Space Mono, monospace',
          fontSize: 8,
          letterSpacing: '0.14em',
        }}>
          <span>MISSION PROGRESS</span>
          <span>{Math.round(missionProgress)}%</span>
        </div>
        <div className="m4-mission-progress-track">
          <div
            className="m4-mission-progress-value"
            style={{ width: `${Math.max(0, Math.min(100, missionProgress))}%` }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 13,
        color: 'rgba(232,232,248,0.48)',
        fontFamily: 'Space Mono, monospace',
        fontSize: 8,
        letterSpacing: '0.14em',
      }}>
        <span>ORBITAL DEBRIS</span>
        <span>20,000+</span>
      </div>
    </section>
  )
}

function StatusMetric({ label, english, value }) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 7,
      }}>
        <span style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: 12,
          color: 'rgba(232,232,248,0.74)',
        }}>
          {label}
        </span>
        <strong style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 15,
          fontWeight: 400,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(clamped)}
          <small style={{ fontSize: 9, marginLeft: 2, color: 'rgba(232,232,248,0.58)' }}>%</small>
        </strong>
      </div>

      <div style={{ height: 2, background: 'rgba(232,232,248,0.16)' }}>
        <div style={{
          width: `${clamped}%`,
          height: '100%',
          background: 'rgba(244,244,255,0.88)',
          transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>

      <div style={{
        marginTop: 6,
        fontFamily: 'Space Mono, monospace',
        fontSize: 8,
        letterSpacing: '0.14em',
        color: 'rgba(232,232,248,0.34)',
      }}>
        {english}
      </div>
    </div>
  )
}

function StoryPanel({ month, story }) {
  return (
    <MotionAside
      key={`${month}-${story}`}
      className="m4-story-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
    >
      <div className="m4-game-label">PARALLEL TIMELINE · MONTH {String(month).padStart(2, '0')}</div>
      <p>{story}</p>
    </MotionAside>
  )
}

function RecoveryIntroPanel({ expanded, onBackToResult }) {
  return (
    <MotionAside
      className={`m4-recovery-panel${expanded ? '' : ' is-intro-only'}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      aria-label="太空卫星回收"
    >
      <style>{GAME_STYLES}</style>
      <div className="m4-recovery-header">
        <div className="m4-game-label">MODULE 05 · REENTRY</div>
        <button
          type="button"
          className="m4-recovery-back-button"
          onClick={onBackToResult}
          title="返回游戏结束板块"
          aria-label="返回游戏结束板块"
        >
          <span className="m4-recovery-back-icon" aria-hidden="true">←</span>
          <span>返回结算</span>
        </button>
      </div>
      <h2>太空卫星回收</h2>
      {expanded && (
        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="m4-recovery-rule" />
          <p>
            每一颗卫星都有生命尽头。任务结束后，它们面临两种命运：受控离轨，或等待轨道衰减。
            无论哪种，再入大气层的过程都在地球上留下了痕迹。
          </p>
        </MotionDiv>
      )}
    </MotionAside>
  )
}

function RecoveryStepsPanel({ activeStepIndex, onActiveStepChange }) {
  const stepsRef = useRef()

  const updateActiveStep = useCallback(() => {
    const stepsEl = stepsRef.current
    if (!stepsEl) return

    const cards = Array.from(stepsEl.querySelectorAll('.m4-recovery-step-card'))
    if (cards.length === 0) return

    const firstCardTop = cards[0].offsetTop
    const topMarker = stepsEl.scrollTop + 42
    let nextIndex = 0

    cards.forEach((card, index) => {
      const cardTop = card.offsetTop - firstCardTop
      if (cardTop <= topMarker) nextIndex = index
    })

    onActiveStepChange(nextIndex)
  }, [onActiveStepChange])

  const handleWheel = useCallback((event) => {
    event.stopPropagation()
  }, [])

  const handleStepSelect = useCallback((index) => {
    const stepsEl = stepsRef.current
    const card = stepsEl?.querySelectorAll('.m4-recovery-step-card')?.[index]

    onActiveStepChange(index)
    if (stepsEl && card) {
      const firstCardTop = stepsEl.querySelector('.m4-recovery-step-card')?.offsetTop || 0
      stepsEl.scrollTo({
        top: Math.max(0, card.offsetTop - firstCardTop),
        behavior: 'smooth',
      })
    }
  }, [onActiveStepChange])

  const handleStepKeyDown = useCallback((event, index) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleStepSelect(index)
  }, [handleStepSelect])

  useEffect(() => {
    updateActiveStep()
  }, [updateActiveStep])

  return (
    <MotionAside
      ref={stepsRef}
      className="m4-recovery-steps"
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
      aria-label="卫星回收步骤展示"
      onScroll={updateActiveStep}
      onWheel={handleWheel}
    >
      <style>{GAME_STYLES}</style>
      {RECOVERY_STEPS.map((step, index) => (
        <article
          className={`m4-recovery-step-card${index === activeStepIndex ? ' is-active' : ''}`}
          key={step.title}
          onClick={() => handleStepSelect(index)}
          onKeyDown={(event) => handleStepKeyDown(event, index)}
          role="button"
          tabIndex={0}
          aria-current={index === activeStepIndex ? 'step' : undefined}
        >
          <div className="m4-recovery-step-copy">
            <div className="m4-recovery-step-kicker">
              <span>{step.label}</span>
              <span className="m4-recovery-step-index">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
          <div className="m4-recovery-step-media" aria-hidden="true">
            <img src={step.img} alt="" />
          </div>
        </article>
      ))}
    </MotionAside>
  )
}

function GamePanel({
  phase,
  event,
  round,
  loading,
  feedback,
  onChoose,
  onContinue,
  onJumpToRecovery,
}) {
  return (
    <aside className="m4-game-panel" aria-live="polite">
      <style>{GAME_STYLES}</style>
      <div className="m4-game-panel-header">
        <span className="m4-game-label">ORBITAL EVENT / {String(round + 1).padStart(2, '0')}</span>
        <div className="m4-game-panel-header-actions">
          <span className="m4-game-label">{round + 1} / {TOTAL_ROUNDS}</span>
          <button
            type="button"
            className="m4-game-recovery-jump"
            onClick={onJumpToRecovery}
            disabled={loading}
            aria-label="直接进入卫星回收页面"
          >
            <span aria-hidden="true">↘</span>
            <span>回收</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <MotionDiv
            key="loading"
            className="m4-game-panel-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="m4-game-label">GROUND CONTROL · ANALYZING</div>
            <h2>正在回传任务日志</h2>
            <p>地面站正在比对轨道参数与历史案例。</p>
          </MotionDiv>
        )}

        {!loading && phase === GAME_PHASE.EVENT && event && (
          <MotionDiv
            key={`event-${event.id}`}
            className="m4-game-panel-body"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="m4-game-label">{THREAT_LABELS[event.type] || 'ORBITAL THREAT'} · THREAT DETECTED</div>
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            <div className="m4-game-reference">{event.realRef}</div>
            <div className="m4-game-label">SELECT RESPONSE</div>
            <div className="m4-game-options">
              {event.options.map((option, index) => (
                <button
                  className="m4-game-option"
                  disabled={loading}
                  key={option.id}
                  onClick={() => onChoose(option)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.subtext}</small>
                  <span className="m4-game-option-index">{String.fromCharCode(65 + index)}</span>
                </button>
              ))}
            </div>
          </MotionDiv>
        )}

        {!loading && phase === GAME_PHASE.FEEDBACK && feedback && (
          <MotionDiv
            key={`feedback-${round}`}
            className="m4-game-panel-body"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="m4-game-label">MISSION LOG · RESPONSE RECORDED</div>
            <h2>{feedback.title}</h2>
            <div className="m4-feedback-note" style={{ '--feedback-color': feedback.color }}>
              <p>{feedback.aiLog || feedback.techNote}</p>
            </div>
            <div className="m4-game-reference">{feedback.techNote}</div>
            <div className="m4-feedback-deltas">
              <DeltaTag label="ARMOR" value={feedback.armorDelta} />
              <DeltaTag label="FUEL" value={feedback.fuelDelta} />
              <DeltaTag label="MISSION" value={feedback.missionDelta} />
            </div>
            <button className="m4-game-continue" onClick={onContinue}>
              {round + 1 >= TOTAL_ROUNDS ? 'VIEW MISSION RESULT' : 'CONTINUE TO NEXT MONTH'}
            </button>
          </MotionDiv>
        )}
      </AnimatePresence>
    </aside>
  )
}

function DeltaTag({ label, value }) {
  if (!value) return null

  return (
    <span className="m4-feedback-delta">
      {label} {value > 0 ? '+' : ''}{value}%
    </span>
  )
}

function OrbitBackdrop({ opacity }) {
  return (
    <svg
      viewBox={`0 0 ${ORBIT_VIEWBOX_SIZE} ${ORBIT_VIEWBOX_SIZE}`}
      preserveAspectRatio="none"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    >
      <ellipse
        cx={ORBIT_CENTER_X}
        cy={ORBIT_CENTER_Y}
        rx={ORBIT_RADIUS_X}
        ry={ORBIT_RADIUS_Y}
        fill="none"
        stroke={`rgba(255,255,255,${opacity})`}
        strokeWidth="2"
        strokeDasharray="3 16"
        strokeLinecap="round"
      />
    </svg>
  )
}

function OrbitControl({ progress, disabled, onProgressChange, onDragEnd }) {
  const controlRef = useRef()
  const activePointerRef = useRef(null)
  const angle = Math.PI - progress * Math.PI
  const knobX = ORBIT_CENTER_X + Math.cos(angle) * ORBIT_RADIUS_X
  const knobY = ORBIT_CENTER_Y + Math.sin(angle) * ORBIT_RADIUS_Y
  const showHint = progress < 0.08 && !disabled

  const updateProgress = useCallback((clientX) => {
    const rect = controlRef.current?.getBoundingClientRect()
    if (!rect) return

    const viewBoxX = ((clientX - rect.left) / rect.width) * ORBIT_VIEWBOX_SIZE
    const nextProgress = (viewBoxX - ORBIT_LEFT_X) / (ORBIT_RIGHT_X - ORBIT_LEFT_X)
    onProgressChange(Math.max(0, Math.min(1, nextProgress)))
  }, [onProgressChange])

  const handlePointerDown = useCallback((event) => {
    if (disabled || activePointerRef.current !== null) return
    activePointerRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    updateProgress(event.clientX)
  }, [disabled, updateProgress])

  const handlePointerMove = useCallback((event) => {
    if (
      activePointerRef.current === event.pointerId
      && event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      updateProgress(event.clientX)
    }
  }, [updateProgress])

  const handlePointerUp = useCallback((event) => {
    if (activePointerRef.current !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activePointerRef.current = null
    onDragEnd()
  }, [onDragEnd])

  const handleKeyDown = useCallback((event) => {
    if (disabled) return

    let nextProgress = progress
    if (event.key === 'ArrowRight') nextProgress = Math.min(1, progress + 0.05)
    if (event.key === 'ArrowLeft') nextProgress = Math.max(0, progress - 0.05)
    if (event.key === 'Home') nextProgress = 0
    if (event.key === 'End') nextProgress = 1
    if (nextProgress === progress) return

    event.preventDefault()
    onProgressChange(nextProgress)
    if (nextProgress >= 0.98) onDragEnd()
  }, [disabled, onDragEnd, onProgressChange, progress])

  return (
    <div
      ref={controlRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox={`0 0 ${ORBIT_VIEWBOX_SIZE} ${ORBIT_VIEWBOX_SIZE}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%' }}
      >
        <path
          d={ORBIT_FRONT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.96)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="向右拖动轨道节点开始任务"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        style={{
          position: 'absolute',
          left: `${knobX / ORBIT_VIEWBOX_SIZE * 100}%`,
          top: `${knobY / ORBIT_VIEWBOX_SIZE * 100}%`,
          display: 'grid',
          width: 54,
          height: 54,
          boxSizing: 'border-box',
          placeItems: 'center',
          borderRadius: '50%',
          background: '#ffffff',
          border: '4px solid rgba(222,228,255,0.96)',
          transform: 'translate(-50%, -50%)',
          cursor: 'grab',
          pointerEvents: disabled ? 'none' : 'auto',
          touchAction: 'none',
        }}
      >
        {showHint && <div className="m4-orbit-handle-halo" />}
        <svg className="m4-orbit-handle-arrow" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M3 9H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 5L14 9L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {!disabled && (
        <div className="m4-orbit-static-hint">
          <span>按住节点向右拖动</span>
          <small>DRAG TO START</small>
        </div>
      )}
    </div>
  )
}

function toPersonalOrbitRadius(altitudeKm, earthRadius) {
  const parsedAltitude = Number(altitudeKm)
  const altitude = Number.isFinite(parsedAltitude) ? parsedAltitude : 836
  const clampedAltitude = Math.max(200, Math.min(35786, altitude))
  const normalizedAltitude = Math.log1p(clampedAltitude - 160) / Math.log1p(35786 - 160)
  return earthRadius + 0.032 + normalizedAltitude * 0.006
}

function isRecoveryFocusedStep(recoveryStep) {
  return recoveryStep === RECOVERY_ANIMATION_STEP.MISSION_END
    || recoveryStep === RECOVERY_ANIMATION_STEP.SYSTEM_SHUTDOWN
    || recoveryStep === RECOVERY_ANIMATION_STEP.PASSIVATION
    || recoveryStep === RECOVERY_ANIMATION_STEP.DEORBIT_BURN
    || recoveryStep === RECOVERY_ANIMATION_STEP.REENTRY
    || recoveryStep === RECOVERY_ANIMATION_STEP.BREAKUP
}

function isRecoveryPoweredDownStep(recoveryStep) {
  return recoveryStep === RECOVERY_ANIMATION_STEP.SYSTEM_SHUTDOWN
    || recoveryStep === RECOVERY_ANIMATION_STEP.PASSIVATION
    || recoveryStep === RECOVERY_ANIMATION_STEP.DEORBIT_BURN
    || recoveryStep === RECOVERY_ANIMATION_STEP.REENTRY
    || recoveryStep === RECOVERY_ANIMATION_STEP.BREAKUP
}

function OrbitSatelliteModel({ spinRef, recoveryStep }) {
  const { scene } = useGLTF(SATELLITE_GLB)
  const { normalizedScene, materialRecords, meshRecords, modelMaxSize } = useMemo(() => {
    const clone = scene.clone(true)
    const records = []
    const meshRecords = []

    clone.traverse((object) => {
      if (!object.isMesh || !object.material) return

      const meshRecord = {
        object,
        originPosition: object.position.clone(),
        originRotation: object.rotation.clone(),
        originScale: object.scale.clone(),
        center: new THREE.Vector3(),
        centerDistance: 0,
        direction: new THREE.Vector3(),
        longestSide: 0,
        shortestSide: 0,
        size: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        delay: 0,
        isCore: false,
        isPanelLike: false,
      }
      meshRecords.push(meshRecord)

      const sourceMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      const clonedMaterials = sourceMaterials.map((material) => {
        const clonedMaterial = material.clone()
        const sourceOpacity = typeof clonedMaterial.opacity === 'number' ? clonedMaterial.opacity : 1
        const sourceTransparent = clonedMaterial.transparent

        records.push({
          material: clonedMaterial,
          color: clonedMaterial.color?.clone() || null,
          emissive: clonedMaterial.emissive?.clone() || null,
          emissiveIntensity: clonedMaterial.emissiveIntensity || 0,
          metalness: clonedMaterial.metalness,
          opacity: sourceOpacity,
          roughness: clonedMaterial.roughness,
          transparent: sourceTransparent,
          meshRecord,
        })
        clonedMaterial.transparent = sourceTransparent || sourceOpacity < 1
        return clonedMaterial
      })

      object.material = Array.isArray(object.material)
        ? clonedMaterials
        : clonedMaterials[0]
    })

    const bounds = new THREE.Box3().setFromObject(clone)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z) || 1
    const modelScale = PERSONAL_SATELLITE_SIZE / maxSize
    let coreDistance = Infinity
    let coreIndex = -1
    let fallbackCoreDistance = Infinity
    let fallbackCoreIndex = 0

    meshRecords.forEach((record, index) => {
      const meshBounds = new THREE.Box3().setFromObject(record.object)
      const meshCenter = meshBounds.getCenter(record.center)
      const meshSize = meshBounds.getSize(record.size)
      const longestSide = Math.max(meshSize.x, meshSize.y, meshSize.z)
      const shortestSide = Math.max(0.0001, Math.min(meshSize.x, meshSize.y, meshSize.z))
      const distance = meshCenter.distanceTo(center)

      record.centerDistance = distance
      record.longestSide = longestSide
      record.shortestSide = shortestSide
      record.isPanelLike = longestSide > maxSize * 0.2 && longestSide / shortestSide > 5.2

      if (distance < fallbackCoreDistance) {
        fallbackCoreDistance = distance
        fallbackCoreIndex = index
      }

      if (!record.isPanelLike && distance < coreDistance) {
        coreDistance = distance
        coreIndex = index
      }
    })
    if (coreIndex < 0) coreIndex = fallbackCoreIndex

    const coreRecord = meshRecords[coreIndex]
    const coreClusterRadius = maxSize * BREAKUP_CORE_CLUSTER_RADIUS_FACTOR
    meshRecords.forEach((record, index) => {
      const fallbackAngle = index * 2.399963
      const direction = record.center.clone().sub(center)
      const distanceToCore = coreRecord
        ? record.center.distanceTo(coreRecord.center)
        : record.centerDistance
      const isMainCabinCore = !record.isPanelLike && (
        index === coreIndex
        || (
          record.longestSide >= maxSize * BREAKUP_CORE_MIN_SIZE_FACTOR
          && record.centerDistance <= maxSize * BREAKUP_CORE_MAX_DISTANCE_FACTOR
          && distanceToCore <= coreClusterRadius
        )
      )

      if (direction.lengthSq() < 0.0001) {
        direction.set(Math.cos(fallbackAngle), Math.sin(fallbackAngle) * 0.32, Math.sin(fallbackAngle))
      }

      record.direction.copy(direction.normalize())
      record.direction.x += Math.cos(fallbackAngle) * 0.28
      record.direction.y += Math.sin(fallbackAngle * 0.7) * 0.2
      record.direction.z += Math.sin(fallbackAngle) * 0.28
      record.direction.normalize()
      record.spin.set(
        (Math.sin(index * 1.17) * 0.9 + 0.35) * (index % 2 === 0 ? 1 : -1),
        Math.cos(index * 0.91) * 0.82,
        Math.sin(index * 0.63) * 0.76,
      )
      record.delay = record.isPanelLike
        ? Math.min(0.22, index * 0.028)
        : Math.min(0.68, index * 0.06)
      record.isCore = isMainCabinCore || (index === coreIndex && !record.isPanelLike)
    })

    clone.position.copy(center).multiplyScalar(-modelScale)
    clone.scale.setScalar(modelScale)
    return {
      normalizedScene: clone,
      materialRecords: records,
      meshRecords,
      modelMaxSize: maxSize,
    }
  }, [scene])
  const shutdownProgressRef = useRef(0)
  const breakupProgressRef = useRef(0)
  const shutdownColor = useMemo(() => new THREE.Color('#202432'), [])
  const isSystemShutdown = isRecoveryPoweredDownStep(recoveryStep)
  const isBreakup = recoveryStep === RECOVERY_ANIMATION_STEP.BREAKUP

  useFrame((_, delta) => {
    breakupProgressRef.current = THREE.MathUtils.damp(
      breakupProgressRef.current,
      isBreakup ? 1 : 0,
      0.48,
      delta,
    )
    const breakupProgress = THREE.MathUtils.smoothstep(breakupProgressRef.current, 0, 1)

    meshRecords.forEach((record) => {
      const partProgress = record.isCore
        ? 0
        : THREE.MathUtils.smoothstep(
          THREE.MathUtils.clamp(
            (breakupProgress - record.delay) / Math.max(0.001, 1 - record.delay),
            0,
            1,
          ),
          0,
          1,
        )
      const separation = modelMaxSize * (record.isPanelLike ? 0.95 : 0.68) * partProgress

      record.object.position
        .copy(record.originPosition)
        .addScaledVector(record.direction, separation)
      record.object.rotation.set(
        record.originRotation.x + record.spin.x * partProgress,
        record.originRotation.y + record.spin.y * partProgress,
        record.originRotation.z + record.spin.z * partProgress,
      )
      record.object.scale.copy(record.originScale).multiplyScalar(
        record.isCore
          ? 1
          : THREE.MathUtils.lerp(1, record.isPanelLike ? 0.025 : 0.06, partProgress),
      )
    })

    shutdownProgressRef.current = THREE.MathUtils.damp(
      shutdownProgressRef.current,
      isSystemShutdown ? 1 : 0,
      3.6 / RECOVERY_SHUTDOWN_DURATION,
      delta,
    )
    const progress = THREE.MathUtils.smoothstep(shutdownProgressRef.current, 0, 1)

    materialRecords.forEach((record) => {
      const partProgress = record.meshRecord?.isCore
        ? 0
        : THREE.MathUtils.smoothstep(
          THREE.MathUtils.clamp(
            (breakupProgress - (record.meshRecord?.delay || 0))
              / Math.max(0.001, 1 - (record.meshRecord?.delay || 0)),
            0,
            1,
          ),
          0,
          1,
        )

      if (record.color && record.material.color) {
        record.material.color.copy(record.color).lerp(shutdownColor, progress * 0.94)
      }
      if (record.emissive && record.material.emissive) {
        record.material.emissive.copy(record.emissive).lerp(shutdownColor, progress)
      }
      if (typeof record.material.opacity === 'number') {
        record.material.opacity = record.opacity * Math.pow(1 - partProgress, 1.7)
        record.material.transparent = record.transparent || record.opacity < 1 || partProgress > 0.01
      }
      if (typeof record.material.emissiveIntensity === 'number') {
        record.material.emissiveIntensity = THREE.MathUtils.lerp(
          record.emissiveIntensity,
          partProgress > 0 ? 0.42 : 0,
          Math.max(progress, partProgress),
        )
      }
      if (typeof record.material.roughness === 'number' && typeof record.roughness === 'number') {
        record.material.roughness = THREE.MathUtils.lerp(record.roughness, 0.96, progress)
      }
      if (typeof record.material.metalness === 'number' && typeof record.metalness === 'number') {
        record.material.metalness = THREE.MathUtils.lerp(record.metalness, 0.18, progress)
      }
    })
  })

  return (
    <group ref={spinRef} rotation={[0.2, 0.45, -0.16]}>
      <primitive object={normalizedScene} />
    </group>
  )
}

function SatelliteShutdownEffects({ recoveryStep }) {
  const ringOneRef = useRef()
  const ringTwoRef = useRef()
  const ringOneMaterialRef = useRef()
  const ringTwoMaterialRef = useRef()
  const indicatorMaterialRef = useRef()
  const payloadMaterialRef = useRef()
  const statusLightRef = useRef()
  const visibleProgressRef = useRef(0)
  const shutdownProgressRef = useRef(0)
  const colors = useMemo(() => ({
    active: new THREE.Color('#9be7ff'),
    warning: new THREE.Color('#ffd36a'),
    off: new THREE.Color('#11131c'),
  }), [])

  useFrame((state, delta) => {
    const isRecoveryFocusStep = isRecoveryFocusedStep(recoveryStep)
    const isSystemShutdown = isRecoveryPoweredDownStep(recoveryStep)

    visibleProgressRef.current = THREE.MathUtils.damp(
      visibleProgressRef.current,
      isRecoveryFocusStep ? 1 : 0,
      1.8,
      delta,
    )
    shutdownProgressRef.current = THREE.MathUtils.damp(
      shutdownProgressRef.current,
      isSystemShutdown ? 1 : 0,
      3.25 / RECOVERY_SHUTDOWN_DURATION,
      delta,
    )

    const visibleProgress = THREE.MathUtils.smoothstep(visibleProgressRef.current, 0, 1)
    const shutdownProgress = THREE.MathUtils.smoothstep(shutdownProgressRef.current, 0, 1)
    const flicker = isSystemShutdown
      ? THREE.MathUtils.lerp(
        0.42 + Math.abs(Math.sin(state.clock.elapsedTime * 24)) * 0.58,
        1,
        shutdownProgress,
      )
      : 1
    const signalOpacity = visibleProgress * Math.max(0, 1 - shutdownProgress) * flicker
    const signalScale = THREE.MathUtils.lerp(1, 0.34, shutdownProgress)

    if (ringOneRef.current) ringOneRef.current.scale.setScalar(signalScale)
    if (ringTwoRef.current) ringTwoRef.current.scale.setScalar(signalScale * 1.16)

    if (ringOneMaterialRef.current) ringOneMaterialRef.current.opacity = signalOpacity * 0.54
    if (ringTwoMaterialRef.current) ringTwoMaterialRef.current.opacity = signalOpacity * 0.32

    if (indicatorMaterialRef.current) {
      indicatorMaterialRef.current.color
        .copy(colors.active)
        .lerp(colors.warning, Math.min(shutdownProgress * 1.8, 1))
        .lerp(colors.off, Math.max(0, shutdownProgress - 0.55) / 0.45)
      indicatorMaterialRef.current.opacity = visibleProgress
        * Math.max(0, 1 - shutdownProgress * 0.92)
        * flicker
    }

    if (payloadMaterialRef.current) {
      payloadMaterialRef.current.opacity = visibleProgress
        * Math.max(0, 1 - shutdownProgress)
        * 0.62
        * flicker
    }

    if (statusLightRef.current) {
      statusLightRef.current.intensity = signalOpacity * 0.86
    }
  })

  return (
    <group>
      <pointLight ref={statusLightRef} color="#9be7ff" intensity={0} distance={0.45} />
      <mesh position={[0, 0.026, 0.025]}>
        <sphereGeometry args={[0.007, 12, 12]} />
        <meshBasicMaterial ref={indicatorMaterialRef} color="#9be7ff" transparent opacity={0} />
      </mesh>
      <mesh position={[0.032, -0.014, 0.004]}>
        <boxGeometry args={[0.03, 0.006, 0.006]} />
        <meshBasicMaterial ref={payloadMaterialRef} color="#9be7ff" transparent opacity={0} />
      </mesh>
      <mesh ref={ringOneRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.118, 0.0016, 8, 96]} />
        <meshBasicMaterial
          ref={ringOneMaterialRef}
          color="#9be7ff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringTwoRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.172, 0.0011, 8, 96]} />
        <meshBasicMaterial
          ref={ringTwoMaterialRef}
          color="#9be7ff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function SatellitePassivationEffects({ recoveryStep }) {
  const particleRefs = useRef([])
  const particleMaterialRefs = useRef([])
  const lightRef = useRef()
  const visibilityRef = useRef(0)
  const burstSpecs = useMemo(() => {
    const sourceAxis = new THREE.Vector3(0, 1, 0)

    return PASSIVATION_BURSTS.map((burst, index) => {
      const direction = new THREE.Vector3(...burst.direction).normalize()
      const quaternion = new THREE.Quaternion().setFromUnitVectors(sourceAxis, direction)
      const side = index % 2 === 0 ? 1 : -1

      return {
        ...burst,
        origin: new THREE.Vector3(...burst.origin),
        quaternion,
        particles: Array.from({ length: PASSIVATION_PARTICLE_COUNT }, (_, particleIndex) => {
          const radialProgress = Math.sqrt((particleIndex + 0.5) / PASSIVATION_PARTICLE_COUNT)
          const angle = index * 0.73 + particleIndex * 2.399963
          const radius = PASSIVATION_CONE_RADIUS * radialProgress
          const size = THREE.MathUtils.lerp(0.0028, 0.00145, radialProgress)

          return {
            delay: (particleIndex % 9) * 0.055,
            x: Math.cos(angle) * radius * side,
            z: Math.sin(angle) * radius,
            size,
          }
        }),
      }
    })
  }, [])
  const isPassivation = recoveryStep === RECOVERY_ANIMATION_STEP.PASSIVATION

  useFrame((state, delta) => {
    visibilityRef.current = THREE.MathUtils.damp(
      visibilityRef.current,
      isPassivation ? 1 : 0,
      8.5,
      delta,
    )
    const visibleProgress = THREE.MathUtils.smoothstep(visibilityRef.current, 0, 1)
    let lightIntensity = 0

    burstSpecs.forEach((burst, index) => {
      const localTime = THREE.MathUtils.euclideanModulo(
        state.clock.elapsedTime - burst.delay,
        PASSIVATION_BURST_CYCLE,
      )
      const active = isPassivation && localTime < PASSIVATION_BURST_DURATION
      const lifeProgress = active
        ? THREE.MathUtils.clamp(localTime / PASSIVATION_BURST_DURATION, 0, 1)
        : 1
      const burstStrength = active ? Math.pow(1 - lifeProgress, 0.48) : 0

      lightIntensity += visibleProgress * burstStrength * 0.16

      const burstParticles = particleRefs.current[index] || []
      const burstParticleMaterials = particleMaterialRefs.current[index] || []

      burst.particles.forEach((particle, particleIndex) => {
        const particleMesh = burstParticles[particleIndex]
        const particleMaterial = burstParticleMaterials[particleIndex]
        const particleStartTime = particle.delay * PASSIVATION_EJECTION_DURATION
        const particleMotionRaw = active
          ? THREE.MathUtils.clamp(
            (localTime - particleStartTime)
              / Math.max(0.001, PASSIVATION_BURST_DURATION - particleStartTime),
            0,
            1,
          )
          : 1
        const particleLifeProgress = active
          ? THREE.MathUtils.clamp(
            (localTime - particleStartTime)
              / Math.max(0.001, PASSIVATION_BURST_DURATION - particleStartTime),
            0,
            1,
          )
          : 1
        const particleStarted = active && localTime >= particleStartTime
        const particleMotionProgress = 1 - Math.pow(1 - particleMotionRaw, 4.6)
        const coneSpread = 0.12 + particleMotionProgress * 1.32
        const particleFade = particleStarted
          ? Math.pow(1 - particleLifeProgress, 0.48)
          : 0

        if (particleMesh) {
          particleMesh.position.set(
            particle.x * coneSpread,
            burst.length * (0.1 + particleMotionProgress * 0.88),
            particle.z * coneSpread,
          )
          particleMesh.scale.setScalar(
            visibleProgress * particleFade * (0.72 + particleMotionProgress * 0.24),
          )
        }

        if (particleMaterial) {
          particleMaterial.opacity = visibleProgress * particleFade * 0.86
        }
      })
    })

    if (lightRef.current) {
      lightRef.current.intensity = Math.min(0.22, lightIntensity)
    }
  })

  return (
    <group>
      <pointLight ref={lightRef} color="#ffffff" intensity={0} distance={0.24} />
      {burstSpecs.map((burst, index) => (
        <group key={`${burst.delay}-${burst.length}`} position={burst.origin} quaternion={burst.quaternion}>
          {burst.particles.map((particle, particleIndex) => (
            <mesh
              key={particleIndex}
              ref={(node) => {
                if (!particleRefs.current[index]) particleRefs.current[index] = []
                particleRefs.current[index][particleIndex] = node
              }}
            >
              <sphereGeometry args={[particle.size, 12, 12]} />
              <meshBasicMaterial
                ref={(node) => {
                  if (!particleMaterialRefs.current[index]) particleMaterialRefs.current[index] = []
                  particleMaterialRefs.current[index][particleIndex] = node
                }}
                color="#ffffff"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function SatelliteReentryEffects({ recoveryStep }) {
  const particleRefs = useRef([])
  const particleMaterialRefs = useRef([])
  const lightRef = useRef()
  const visibilityRef = useRef(0)
  const particles = useMemo(() => {
    const colors = ['#ff2d12', '#ff5a16', '#ff8d24', '#ffd26a']

    return Array.from({ length: REENTRY_FLAME_PARTICLE_COUNT }, (_, index) => {
      const progress = index / Math.max(1, REENTRY_FLAME_PARTICLE_COUNT - 1)
      const angle = index * 2.399963
      const radial = Math.sqrt((index + 0.5) / REENTRY_FLAME_PARTICLE_COUNT)
      const colorIndex = index % colors.length

      return {
        angle,
        color: colors[colorIndex],
        delay: (index * 0.073) % 1,
        drift: 0.004 + radial * 0.024,
        opacity: THREE.MathUtils.lerp(0.68, 0.28, progress),
        size: THREE.MathUtils.lerp(0.0072, 0.0028, progress),
        speed: THREE.MathUtils.lerp(0.74, 1.16, 1 - progress),
      }
    })
  }, [])
  const isReentry = recoveryStep === RECOVERY_ANIMATION_STEP.REENTRY

  useFrame((state, delta) => {
    visibilityRef.current = THREE.MathUtils.damp(
      visibilityRef.current,
      isReentry ? 1 : 0,
      1.7,
      delta,
    )
    const visibleProgress = THREE.MathUtils.smoothstep(visibilityRef.current, 0, 1)
    const time = state.clock.elapsedTime

    particles.forEach((particle, index) => {
      const particleMesh = particleRefs.current[index]
      const particleMaterial = particleMaterialRefs.current[index]
      const localProgress = (time * particle.speed + particle.delay) % 1
      const fade = Math.sin(localProgress * Math.PI)
      const spread = particle.drift * (0.25 + localProgress * 1.45)
      const flicker = 0.76 + Math.sin(time * 19 + index * 0.71) * 0.18
        + Math.sin(time * 37 + index) * 0.06
      const intensity = visibleProgress * fade * THREE.MathUtils.clamp(flicker, 0.42, 1)

      if (particleMesh) {
        particleMesh.position.set(
          Math.cos(particle.angle + time * 0.38) * spread,
          0.028 + localProgress * 0.18,
          Math.sin(particle.angle - time * 0.25) * spread * 0.78,
        )
        particleMesh.scale.setScalar(
          particle.size * (0.52 + localProgress * 0.84) * Math.max(0.001, visibleProgress),
        )
      }

      if (particleMaterial) {
        particleMaterial.opacity = intensity * particle.opacity
      }
    })

    if (lightRef.current) {
      lightRef.current.intensity = visibleProgress * (0.34 + Math.abs(Math.sin(time * 16)) * 0.26)
    }
  })

  return (
    <group>
      <pointLight ref={lightRef} color="#ff3a16" intensity={0} distance={0.42} />
      {particles.map((particle, index) => (
        <mesh
          key={`${particle.color}-${index}`}
          ref={(node) => {
            particleRefs.current[index] = node
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial
            ref={(node) => {
              particleMaterialRefs.current[index] = node
            }}
            color={particle.color}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

function SatelliteBreakupEffects({ recoveryStep }) {
  const particleRefs = useRef([])
  const particleMaterialRefs = useRef([])
  const lightRef = useRef()
  const visibilityRef = useRef(0)
  const particles = useMemo(() => {
    const colors = ['#ff2a12', '#ff6318', '#ffa126', '#ffe06d']

    return Array.from({ length: BREAKUP_PARTICLE_COUNT }, (_, index) => {
      const isCoreFlame = index >= Math.floor(BREAKUP_PARTICLE_COUNT * 0.68)
      const angle = index * 2.399963
      const radial = Math.sqrt((index + 0.5) / BREAKUP_PARTICLE_COUNT)
      const direction = new THREE.Vector3(
        Math.cos(angle) * (0.62 + radial * 0.74),
        Math.sin(angle * 0.7) * 0.48,
        Math.sin(angle) * (0.62 + radial * 0.6),
      ).normalize()

      return {
        angle,
        color: colors[index % colors.length],
        delay: (index * 0.061) % 1,
        direction,
        drift: THREE.MathUtils.lerp(0.018, 0.11, radial),
        isCoreFlame,
        opacity: isCoreFlame ? 0.58 : THREE.MathUtils.lerp(0.7, 0.24, radial),
        size: isCoreFlame
          ? THREE.MathUtils.lerp(0.0035, 0.0074, radial)
          : THREE.MathUtils.lerp(0.0065, 0.0026, radial),
        speed: isCoreFlame ? 0.78 + radial * 0.24 : 0.46 + radial * 0.62,
      }
    })
  }, [])
  const isBreakup = recoveryStep === RECOVERY_ANIMATION_STEP.BREAKUP

  useFrame((state, delta) => {
    visibilityRef.current = THREE.MathUtils.damp(
      visibilityRef.current,
      isBreakup ? 1 : 0,
      1.35,
      delta,
    )
    const visibleProgress = THREE.MathUtils.smoothstep(visibilityRef.current, 0, 1)
    const time = state.clock.elapsedTime

    particles.forEach((particle, index) => {
      const particleMesh = particleRefs.current[index]
      const particleMaterial = particleMaterialRefs.current[index]
      const localProgress = (time * particle.speed + particle.delay) % 1
      const fade = Math.sin(localProgress * Math.PI)
      const lateCoreStrength = particle.isCoreFlame
        ? THREE.MathUtils.smoothstep(visibleProgress, 0.28, 1)
        : 1 - THREE.MathUtils.smoothstep(visibleProgress, 0.46, 1)
      const flicker = 0.72 + Math.sin(time * 20 + index * 0.83) * 0.18
        + Math.sin(time * 43 + index * 0.29) * 0.08
      const intensity = visibleProgress * lateCoreStrength * fade
        * THREE.MathUtils.clamp(flicker, 0.36, 1)

      if (particleMesh) {
        if (particle.isCoreFlame) {
          const radius = particle.drift * (0.14 + localProgress * 0.52)
          particleMesh.position.set(
            Math.cos(particle.angle + time * 0.32) * radius,
            0.02 + localProgress * 0.08,
            Math.sin(particle.angle - time * 0.26) * radius * 0.72,
          )
        } else {
          particleMesh.position
            .copy(particle.direction)
            .multiplyScalar(particle.drift * (0.24 + localProgress * 1.35))
          particleMesh.position.y += 0.018 + localProgress * 0.12
        }

        particleMesh.scale.setScalar(
          particle.size * (0.48 + localProgress * 0.92) * Math.max(0.001, visibleProgress),
        )
      }

      if (particleMaterial) {
        particleMaterial.opacity = intensity * particle.opacity
      }
    })

    if (lightRef.current) {
      lightRef.current.intensity = visibleProgress * (0.36 + Math.abs(Math.sin(time * 18)) * 0.28)
    }
  })

  return (
    <group>
      <pointLight ref={lightRef} color="#ff4118" intensity={0} distance={0.46} />
      {particles.map((particle, index) => (
        <mesh
          key={`${particle.color}-${index}`}
          ref={(node) => {
            particleRefs.current[index] = node
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial
            ref={(node) => {
              particleMaterialRefs.current[index] = node
            }}
            color={particle.color}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

function resolveMaterialResidueItem(item, materials) {
  const part = MATERIAL_PART_META[item.key]
  const selected = materials?.[item.key]
  const option = MATERIAL_OPTIONS[item.key]?.[selected]
  const selectedLabel = option?.label || part.fallback
  const summarySource = item.source === 'selected'
    ? option?.summary || '未在材料板块中选择时，使用默认卫星材料进行演示。'
    : item.summary

  return {
    ...item,
    accent: part.accent,
    label: item.source === 'selected' ? part.label : item.label,
    material: item.source === 'selected' ? selectedLabel : item.material,
    risk: item.risk || option?.risk || 'SIM',
    summary: typeof summarySource === 'function'
      ? summarySource({ selectedLabel, option, part })
      : summarySource,
  }
}

function getHighestMaterialRisk(items) {
  return items.reduce((highest, item) => (
    (MATERIAL_RISK_WEIGHT[item.risk] || 0) > (MATERIAL_RISK_WEIGHT[highest] || 0)
      ? item.risk
      : highest
  ), 'LOW')
}

function getMaterialResidueCards(materials) {
  const resolvedItems = MATERIAL_RESIDUE_CATALOG.map((item) => resolveMaterialResidueItem(item, materials))
  const itemMap = new Map(resolvedItems.map((item) => [item.id, item]))

  return MATERIAL_RESIDUE_GROUPS.map((group, index) => {
    const items = group.itemIds.map((id) => itemMap.get(id)).filter(Boolean)
    const primaryItem = items.find((item) => item.source === 'selected') || items[0]

    return {
      ...group,
      accent: primaryItem?.accent || '#6b7fff',
      hasSelected: items.some((item) => item.source === 'selected'),
      itemCount: items.length,
      items,
      material: `${items.length}类 · ${primaryItem?.material || '残余材料'}`,
      number: String(index + 1).padStart(2, '0'),
      risk: getHighestMaterialRisk(items),
    }
  })
}

function BreakupMaterialBoard({ recoveryStep, materials }) {
  const cards = useMemo(() => getMaterialResidueCards(materials), [materials])
  const isBreakup = recoveryStep === RECOVERY_ANIMATION_STEP.BREAKUP

  if (!isBreakup) return null

  return (
    <aside
      className="m4-material-board"
      aria-label="再入后遗留材料"
    >
      <style>{GAME_STYLES}</style>
      <div className="m4-material-board-inner">
        <div className="m4-material-board-header">
          <span>REMAINING MATERIALS</span>
          <span>{cards.length} GROUPS</span>
        </div>
        <div className="m4-material-board-grid">
          {cards.map((card, index) => (
            <article
              key={card.id}
              className={[
                'm4-material-card',
                card.hasSelected ? 'is-selected' : '',
                card.layout.detail.includes('up') ? 'is-detail-up' : '',
                card.layout.detail.includes('left') ? 'is-detail-left' : '',
              ].filter(Boolean).join(' ')}
              tabIndex={0}
              style={{
                '--material-color': card.accent,
                '--material-x': `${card.layout.x}px`,
                '--material-y': `${card.layout.y}px`,
                '--material-rotate': `${card.layout.rotate}deg`,
                animationDelay: `${index * 70}ms`,
              }}
            >
              <h4>
                <span>{card.label}</span>
                <strong>{card.material}</strong>
              </h4>
              <div className="m4-material-card-detail">
                <div className="m4-material-card-detail-header">
                  <span>{card.labelEn}</span>
                  <span className="m4-material-card-risk">{card.number} / {card.risk}</span>
                </div>
                <p>{card.summary}</p>
                <div className="m4-material-card-items">
                  {card.items.map((item) => (
                    <span key={item.id} className="m4-material-card-chip">
                      {item.material}
                    </span>
                  ))}
                </div>
                <div className="m4-material-card-note">{card.note}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </aside>
  )
}

function DeorbitSpiralTrajectory({
  radius,
  targetRadius,
  travelRef,
  visibilityRef,
}) {
  const materialRef = useRef()
  const geometry = useMemo(() => {
    const positions = new Float32Array(DEORBIT_SPIRAL_TRACE_POINTS * 3)
    const startPhase = RECOVERY_MISSION_END_PHASE
    const totalPhase = Math.PI * 2 * DEORBIT_SPIRAL_TURNS

    for (let index = 0; index < DEORBIT_SPIRAL_TRACE_POINTS; index += 1) {
      const progress = index / (DEORBIT_SPIRAL_TRACE_POINTS - 1)
      const phase = startPhase + progress * totalPhase
      const spiralRadius = THREE.MathUtils.lerp(radius, targetRadius, progress)
      const offset = index * 3

      positions[offset] = Math.cos(phase) * spiralRadius
      positions[offset + 1] = Math.sin(phase) * spiralRadius
      positions[offset + 2] = 0
    }

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    nextGeometry.setDrawRange(0, 2)
    return nextGeometry
  }, [radius, targetRadius])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const visibleProgress = THREE.MathUtils.smoothstep(visibilityRef.current, 0, 1)
    const travelProgress = THREE.MathUtils.clamp(travelRef.current, 0, 1)
    const visiblePoints = Math.max(
      2,
      Math.ceil(2 + travelProgress * (DEORBIT_SPIRAL_TRACE_POINTS - 2)),
    )

    geometry.setDrawRange(0, visiblePoints)
    if (materialRef.current) {
      materialRef.current.opacity = visibleProgress * 0.92
    }
  })

  return (
    <line geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        ref={materialRef}
        color="#8ff3ff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  )
}

function getForwardPhaseTarget(currentPhase, targetPhase) {
  const fullTurn = Math.PI * 2
  let target = targetPhase + Math.max(0, Math.ceil((currentPhase - targetPhase) / fullTurn)) * fullTurn

  if (target - currentPhase < RECOVERY_MIN_FORWARD_ARC) target += fullTurn
  return target
}

function dampAngle(current, target, damping, delta) {
  const fullTurn = Math.PI * 2
  const angleDelta = THREE.MathUtils.euclideanModulo(
    target - current + Math.PI,
    fullTurn,
  ) - Math.PI

  return current + angleDelta * (1 - Math.exp(-damping * delta))
}

function PersonalSatelliteOrbit({
  altitudeKm,
  inclinationDeg,
  earthRadius,
  recoveryStep,
  focusRef,
}) {
  const orbitRef = useRef()
  const orbitMaterialRef = useRef()
  const satelliteRef = useRef()
  const spinRef = useRef()
  const markerMaterialRef = useRef()
  const markerLightRef = useRef()
  const phaseTweenRef = useRef(null)
  const phaseRef = useRef(Math.PI * 0.04)
  const spinSpeedRef = useRef(0.18)
  const shutdownProgressRef = useRef(0)
  const deorbitProgressRef = useRef(0)
  const deorbitTravelRef = useRef(0)
  const reentryVisibilityRef = useRef(0)
  const reentryTravelRef = useRef(0)
  const breakupVisibilityRef = useRef(0)
  const breakupTravelRef = useRef(0)
  const reduceMotionRef = useRef(false)
  const isRecoveryFocusStep = isRecoveryFocusedStep(recoveryStep)
  const isSystemShutdown = isRecoveryPoweredDownStep(recoveryStep)
  const isDeorbitBurn = recoveryStep === RECOVERY_ANIMATION_STEP.DEORBIT_BURN
  const isReentry = recoveryStep === RECOVERY_ANIMATION_STEP.REENTRY
  const isBreakup = recoveryStep === RECOVERY_ANIMATION_STEP.BREAKUP
  const radius = toPersonalOrbitRadius(altitudeKm, earthRadius)
  const deorbitTargetRadius = Math.max(
    earthRadius + DEORBIT_TARGET_ALTITUDE_OFFSET,
    radius - DEORBIT_RADIUS_DROP,
  )
  const reentryTargetRadius = Math.max(
    earthRadius * REENTRY_END_RADIUS_FACTOR,
    deorbitTargetRadius - REENTRY_LINEAR_DROP,
  )
  const breakupTargetRadius = Math.max(
    earthRadius * BREAKUP_END_RADIUS_FACTOR,
    reentryTargetRadius - BREAKUP_LINEAR_DROP,
  )
  const parsedInclination = Number(inclinationDeg)
  const inclination = THREE.MathUtils.degToRad(
    Number.isFinite(parsedInclination) ? parsedInclination : 98.7,
  )
  const defaultOrbitRotation = useMemo(() => [
    inclination - Math.PI / 2,
    0.38,
    -0.14,
  ], [inclination])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      reduceMotionRef.current = media.matches
    }

    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    phaseTweenRef.current?.kill()

    if (!isRecoveryFocusStep) {
      spinSpeedRef.current = 0.18
      return undefined
    }

    if (reduceMotionRef.current) {
      phaseRef.current = RECOVERY_MISSION_END_PHASE
      spinSpeedRef.current = 0
      return undefined
    }

    const tweenState = {
      phase: phaseRef.current,
      spinSpeed: spinSpeedRef.current,
    }
    const targetPhase = getForwardPhaseTarget(
      phaseRef.current,
      RECOVERY_MISSION_END_PHASE,
    )

    phaseTweenRef.current = gsap.to(tweenState, {
      phase: targetPhase,
      spinSpeed: 0,
      duration: RECOVERY_MISSION_END_DURATION,
      ease: 'power3.out',
      onUpdate() {
        phaseRef.current = tweenState.phase
        spinSpeedRef.current = tweenState.spinSpeed
      },
      onComplete() {
        phaseRef.current = RECOVERY_MISSION_END_PHASE
        spinSpeedRef.current = 0
      },
    })

    return () => phaseTweenRef.current?.kill()
  }, [isRecoveryFocusStep])

  useEffect(() => {
    if (!isDeorbitBurn) return

    deorbitTravelRef.current = 0
    phaseRef.current = RECOVERY_MISSION_END_PHASE
  }, [isDeorbitBurn])

  useEffect(() => {
    if (!isReentry) return

    deorbitTravelRef.current = 1
    reentryTravelRef.current = 0
    phaseRef.current = RECOVERY_MISSION_END_PHASE + Math.PI * 2 * DEORBIT_SPIRAL_TURNS
  }, [isReentry])

  useEffect(() => {
    if (!isBreakup) return

    deorbitTravelRef.current = 1
    reentryTravelRef.current = 1
    breakupTravelRef.current = 0
    phaseRef.current = RECOVERY_MISSION_END_PHASE + Math.PI * 2 * DEORBIT_SPIRAL_TURNS
  }, [isBreakup])

  useFrame((_, delta) => {
    const canAnimate = !reduceMotionRef.current
      && (typeof document === 'undefined' || document.visibilityState === 'visible')
    deorbitProgressRef.current = THREE.MathUtils.damp(
      deorbitProgressRef.current,
      isDeorbitBurn ? 1 : 0,
      1.55,
      delta,
    )
    const deorbitVisibility = THREE.MathUtils.smoothstep(deorbitProgressRef.current, 0, 1)
    reentryVisibilityRef.current = THREE.MathUtils.damp(
      reentryVisibilityRef.current,
      isReentry ? 1 : 0,
      2.2,
      delta,
    )
    const reentryVisibility = THREE.MathUtils.smoothstep(reentryVisibilityRef.current, 0, 1)
    breakupVisibilityRef.current = THREE.MathUtils.damp(
      breakupVisibilityRef.current,
      isBreakup ? 1 : 0,
      1.45,
      delta,
    )
    const breakupVisibility = THREE.MathUtils.smoothstep(breakupVisibilityRef.current, 0, 1)
    const targetOrbitRotation = isRecoveryFocusStep
      ? RECOVERY_ORBIT_ROTATION
      : defaultOrbitRotation
    const targetOrbitScale = isRecoveryFocusStep ? RECOVERY_ORBIT_SCALE : 1

    if (orbitRef.current) {
      orbitRef.current.rotation.x = dampAngle(
        orbitRef.current.rotation.x,
        targetOrbitRotation[0],
        1.15,
        delta,
      )
      orbitRef.current.rotation.y = dampAngle(
        orbitRef.current.rotation.y,
        targetOrbitRotation[1],
        1.15,
        delta,
      )
      orbitRef.current.rotation.z = dampAngle(
        orbitRef.current.rotation.z,
        targetOrbitRotation[2],
        1.15,
        delta,
      )
      const nextOrbitScale = THREE.MathUtils.damp(
        orbitRef.current.scale.x,
        targetOrbitScale,
        0.82,
        delta,
      )
      orbitRef.current.scale.setScalar(nextOrbitScale)
    }

    if (canAnimate && !isRecoveryFocusStep) {
      phaseRef.current = (phaseRef.current + delta * PERSONAL_ORBIT_SPEED) % (Math.PI * 2)
    }

    if (isDeorbitBurn) {
      if (canAnimate) {
        deorbitTravelRef.current = Math.min(
          1,
          deorbitTravelRef.current + delta / DEORBIT_SPIRAL_DURATION,
        )
      } else {
        deorbitTravelRef.current = 1
      }

      phaseRef.current = RECOVERY_MISSION_END_PHASE
        + deorbitTravelRef.current * Math.PI * 2 * DEORBIT_SPIRAL_TURNS
    }

    if (isReentry) {
      if (canAnimate) {
        reentryTravelRef.current = Math.min(
          1,
          reentryTravelRef.current + delta / REENTRY_FALL_DURATION,
        )
      } else {
        reentryTravelRef.current = 1
      }

      deorbitTravelRef.current = 1
      phaseRef.current = RECOVERY_MISSION_END_PHASE + Math.PI * 2 * DEORBIT_SPIRAL_TURNS
    }

    if (isBreakup) {
      if (canAnimate) {
        breakupTravelRef.current = Math.min(
          1,
          breakupTravelRef.current + delta / BREAKUP_FALL_DURATION,
        )
      } else {
        breakupTravelRef.current = 1
      }

      deorbitTravelRef.current = 1
      reentryTravelRef.current = 1
      phaseRef.current = RECOVERY_MISSION_END_PHASE + Math.PI * 2 * DEORBIT_SPIRAL_TURNS
    }

    if (isRecoveryFocusStep && !canAnimate) {
      phaseRef.current = isReentry || isBreakup
        ? RECOVERY_MISSION_END_PHASE + Math.PI * 2 * DEORBIT_SPIRAL_TURNS
        : RECOVERY_MISSION_END_PHASE
      spinSpeedRef.current = 0
    }

    if (canAnimate && spinRef.current) {
      spinRef.current.rotation.y += delta * spinSpeedRef.current
    }

    shutdownProgressRef.current = THREE.MathUtils.damp(
      shutdownProgressRef.current,
      isSystemShutdown ? 1 : 0,
      3.6 / RECOVERY_SHUTDOWN_DURATION,
      delta,
    )
    const shutdownProgress = THREE.MathUtils.smoothstep(shutdownProgressRef.current, 0, 1)

    if (markerLightRef.current) {
      markerLightRef.current.intensity = THREE.MathUtils.lerp(0.36, 0.02, shutdownProgress)
    }

    if (markerMaterialRef.current) {
      markerMaterialRef.current.opacity = THREE.MathUtils.lerp(1, 0.16, shutdownProgress)
      markerMaterialRef.current.color.setRGB(
        THREE.MathUtils.lerp(1, 0.08, shutdownProgress),
        THREE.MathUtils.lerp(1, 0.09, shutdownProgress),
        THREE.MathUtils.lerp(1, 0.13, shutdownProgress),
      )
    }

    if (orbitMaterialRef.current) {
      orbitMaterialRef.current.opacity = THREE.MathUtils.lerp(0.96, 0.22, deorbitVisibility)
        * (1 - reentryVisibility)
        * (1 - breakupVisibility)
    }

    if (!satelliteRef.current) return
    const spiralTravel = isReentry || isBreakup ? 1 : deorbitTravelRef.current * deorbitVisibility
    const reentryTravel = isBreakup
      ? 1
      : isReentry
      ? THREE.MathUtils.smoothstep(reentryTravelRef.current, 0, 1)
      : 0
    const breakupTravel = isBreakup
      ? THREE.MathUtils.smoothstep(breakupTravelRef.current, 0, 1)
      : 0
    const spiralOrbitRadius = THREE.MathUtils.lerp(
      radius,
      deorbitTargetRadius,
      spiralTravel,
    )
    const reentryOrbitRadius = THREE.MathUtils.lerp(
      spiralOrbitRadius,
      reentryTargetRadius,
      reentryTravel,
    )
    const currentOrbitRadius = THREE.MathUtils.lerp(
      reentryOrbitRadius,
      breakupTargetRadius,
      breakupTravel,
    )
    satelliteRef.current.position.set(
      Math.cos(phaseRef.current) * currentOrbitRadius,
      Math.sin(phaseRef.current) * currentOrbitRadius,
      0,
    )
    const deorbitShrinkProgress = isDeorbitBurn || isReentry
      ? THREE.MathUtils.smoothstep(spiralTravel, 0, 1)
      : 0
    const deorbitScaleFactor = THREE.MathUtils.lerp(
      1,
      DEORBIT_SATELLITE_SHRINK_FACTOR,
      deorbitShrinkProgress,
    )
    const reentryScaleFactor = isReentry
      ? THREE.MathUtils.lerp(
        deorbitScaleFactor,
        REENTRY_SATELLITE_SHRINK_FACTOR,
        reentryTravel,
      )
      : isBreakup
        ? THREE.MathUtils.lerp(
          REENTRY_SATELLITE_SHRINK_FACTOR,
          BREAKUP_CORE_SHRINK_FACTOR,
          breakupTravel,
        )
      : deorbitScaleFactor
    const targetSatelliteScale = isRecoveryFocusStep
      ? RECOVERY_SATELLITE_SCALE * reentryScaleFactor
      : 1
    const nextScale = THREE.MathUtils.damp(
      satelliteRef.current.scale.x,
      targetSatelliteScale,
      1.4,
      delta,
    )
    satelliteRef.current.scale.setScalar(nextScale)
    if (focusRef?.current) {
      satelliteRef.current.getWorldPosition(focusRef.current)
      focusRef.current.deorbitProgress = isDeorbitBurn ? spiralTravel : isReentry || isBreakup ? 1 : 0
      focusRef.current.reentryProgress = isReentry ? reentryTravel : isBreakup ? 1 : 0
      focusRef.current.breakupProgress = isBreakup ? breakupTravel : 0
    }
  })

  return (
    <group ref={orbitRef} rotation={defaultOrbitRotation}>
      <mesh>
        <torusGeometry args={[radius, 0.0016, 5, 240]} />
        <meshBasicMaterial
          ref={orbitMaterialRef}
          color="#ffffff"
          transparent
          opacity={0.96}
          depthWrite={false}
        />
      </mesh>
      <DeorbitSpiralTrajectory
        radius={radius}
        targetRadius={deorbitTargetRadius}
        travelRef={deorbitTravelRef}
        visibilityRef={deorbitProgressRef}
      />

      <group ref={satelliteRef}>
        <mesh>
          <sphereGeometry args={[0.008, 12, 12]} />
          <meshBasicMaterial ref={markerMaterialRef} color="#ffffff" transparent opacity={1} />
        </mesh>
        <pointLight ref={markerLightRef} color="#ffffff" intensity={0.36} distance={0.7} />
        <OrbitSatelliteModel spinRef={spinRef} recoveryStep={recoveryStep} />
        <SatelliteShutdownEffects recoveryStep={recoveryStep} />
        <SatellitePassivationEffects recoveryStep={recoveryStep} />
        <SatelliteReentryEffects recoveryStep={recoveryStep} />
        <SatelliteBreakupEffects recoveryStep={recoveryStep} />
      </group>
    </group>
  )
}

function createSeededRandom(seed) {
  let value = seed >>> 0

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function buildOrbitalDebrisData(count, earthRadius) {
  const random = createSeededRandom(0x51a7e)

  return Array.from({ length: count }, () => {
    const innerBand = random() < 0.78
    const altitude = innerBand
      ? 0.035 + random() * 0.085
      : 0.12 + random() * 0.13
    const length = 0.0024 + random() * 0.0056
    const thickness = 0.0012 + random() * 0.002

    return {
      radius: earthRadius + altitude,
      theta: random() * Math.PI * 2,
      inclination: 0.16 + random() * Math.PI * 0.78,
      ascendingNode: random() * Math.PI * 2,
      speed: (0.016 + random() * 0.032) * (random() > 0.14 ? 1 : -1),
      scale: [length, thickness, thickness * (0.7 + random() * 0.9)],
      rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
      spin: [(random() - 0.5) * 0.18, (random() - 0.5) * 0.18, (random() - 0.5) * 0.18],
      offset: new THREE.Vector3(),
    }
  })
}

function OrbitalDebrisCloud({ earthRadius, damageLevel }) {
  const meshRef = useRef()
  const reduceMotionRef = useRef(false)
  const pointerActiveRef = useRef(false)
  const pointerNdcRef = useRef(new THREE.Vector2(2, 2))
  const { gl } = useThree()
  const parsedDamageLevel = Number(damageLevel)
  const actualCount = Math.min(
    ORBITAL_DEBRIS_BASE_COUNT + (
      Number.isFinite(parsedDamageLevel) ? Math.max(0, Math.round(parsedDamageLevel * 80)) : 0
    ),
    ORBITAL_DEBRIS_MAX_COUNT,
  )
  const debrisData = useMemo(
    () => buildOrbitalDebrisData(actualCount, earthRadius),
    [actualCount, earthRadius],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const vectors = useMemo(() => ({
    basePosition: new THREE.Vector3(),
    projectedPosition: new THREE.Vector3(),
    cameraRight: new THREE.Vector3(),
    cameraUp: new THREE.Vector3(),
    localDirection: new THREE.Vector3(),
    targetOffset: new THREE.Vector3(),
    inverseWorldMatrix: new THREE.Matrix4(),
  }), [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      reduceMotionRef.current = media.matches
    }

    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    meshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      pointerNdcRef.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      pointerActiveRef.current = true
    }
    const handlePointerLeave = () => {
      pointerActiveRef.current = false
    }

    canvas.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [gl])

  useFrame((state, delta) => {
    if (!meshRef.current) return

    const canAnimate = !reduceMotionRef.current
      && (typeof document === 'undefined' || document.visibilityState === 'visible')
    const canInteract = canAnimate && pointerActiveRef.current
    const influenceRadius = 0.5

    vectors.inverseWorldMatrix.copy(meshRef.current.matrixWorld).invert()
    vectors.cameraRight
      .setFromMatrixColumn(state.camera.matrixWorld, 0)
      .transformDirection(vectors.inverseWorldMatrix)
    vectors.cameraUp
      .setFromMatrixColumn(state.camera.matrixWorld, 1)
      .transformDirection(vectors.inverseWorldMatrix)

    debrisData.forEach((debris, index) => {
      if (canAnimate) {
        debris.theta = (debris.theta + delta * debris.speed) % (Math.PI * 2)
        debris.rotation[0] += delta * debris.spin[0]
        debris.rotation[1] += delta * debris.spin[1]
        debris.rotation[2] += delta * debris.spin[2]
      }

      const cosTheta = Math.cos(debris.theta)
      const sinTheta = Math.sin(debris.theta)
      const cosNode = Math.cos(debris.ascendingNode)
      const sinNode = Math.sin(debris.ascendingNode)
      const cosInclination = Math.cos(debris.inclination)
      const sinInclination = Math.sin(debris.inclination)

      vectors.basePosition.set(
        debris.radius * (cosNode * cosTheta - sinNode * sinTheta * cosInclination),
        debris.radius * sinTheta * sinInclination,
        debris.radius * (sinNode * cosTheta + cosNode * sinTheta * cosInclination),
      )

      vectors.targetOffset.set(0, 0, 0)
      if (canInteract) {
        vectors.projectedPosition
          .copy(vectors.basePosition)
          .applyMatrix4(meshRef.current.matrixWorld)
          .project(state.camera)

        const dx = vectors.projectedPosition.x - pointerNdcRef.current.x
        const dy = vectors.projectedPosition.y - pointerNdcRef.current.y
        const distance = Math.hypot(dx, dy)

        if (
          vectors.projectedPosition.z >= -1
          && vectors.projectedPosition.z <= 1
          && distance < influenceRadius
        ) {
          const normalizedDistance = Math.max(distance, 0.0001)
          const strength = Math.pow(1 - distance / influenceRadius, 2.4) * 0.038

          vectors.localDirection
            .copy(vectors.cameraRight)
            .multiplyScalar(dx / normalizedDistance)
            .addScaledVector(vectors.cameraUp, dy / normalizedDistance)
            .normalize()
          vectors.targetOffset.copy(vectors.localDirection).multiplyScalar(strength)
        }
      }

      const responseSpeed = vectors.targetOffset.lengthSq() > 0 ? 5.5 : 2.4
      debris.offset.lerp(vectors.targetOffset, 1 - Math.exp(-delta * responseSpeed))
      dummy.position.copy(vectors.basePosition).add(debris.offset)
      dummy.rotation.set(...debris.rotation)
      dummy.scale.set(...debris.scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, actualCount]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#e7e5ee" transparent opacity={0.72} depthWrite={false} />
    </instancedMesh>
  )
}

function EarthScene({
  proxy,
  satellite,
  damageLevel,
  showPersonalOrbit,
  recoveryStep,
  satelliteFocusRef,
}) {
  const { scene } = useGLTF(EARTH_GLB)
  const groupRef = useRef()
  const earthRef = useRef()
  const earthMetrics = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(scene)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())

    return {
      centerOffset: center.multiplyScalar(-EARTH_SCALE),
      radius: Math.max(size.x, size.y, size.z) * EARTH_SCALE * 0.5,
    }
  }, [scene])

  useFrame((_, dt) => {
    if (!groupRef.current) return
    groupRef.current.scale.setScalar(proxy.current.scale)
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.055
  })

  return (
    <group ref={groupRef}>
      <group ref={earthRef}>
        <primitive
          object={scene}
          position={earthMetrics.centerOffset}
          scale={EARTH_SCALE}
        />
      </group>
      {showPersonalOrbit && (
        <PersonalSatelliteOrbit
          altitudeKm={satellite?.altitudeKm}
          inclinationDeg={satellite?.inclination}
          earthRadius={earthMetrics.radius}
          recoveryStep={recoveryStep}
          focusRef={satelliteFocusRef}
        />
      )}
      {showPersonalOrbit && (
        <OrbitalDebrisCloud
          earthRadius={earthMetrics.radius}
          damageLevel={damageLevel}
        />
      )}
    </group>
  )
}

function EarthOrbitControls({ proxy, recoveryStep, satelliteFocusRef }) {
  const controlsRef = useRef()
  const lastViewOffsetRef = useRef(null)
  const zoomProgressRef = useRef(0)
  const reentryZoomProgressRef = useRef(0)
  const breakupZoomProgressRef = useRef(0)
  const { camera, size } = useThree()
  const cameraVectors = useMemo(() => ({
    fallbackFocus: new THREE.Vector3(0.84, 0.84, 0),
    focus: new THREE.Vector3(),
    target: new THREE.Vector3(),
    zoomOffset: new THREE.Vector3(),
    desiredPosition: new THREE.Vector3(),
    currentSpherical: new THREE.Spherical(),
    desiredSpherical: new THREE.Spherical(),
    nextPosition: new THREE.Vector3(),
    clearanceDirection: new THREE.Vector3(),
  }), [])
  const recoveryActive = isRecoveryFocusedStep(recoveryStep)
  const isDeorbitBurn = recoveryStep === RECOVERY_ANIMATION_STEP.DEORBIT_BURN
  const isReentry = recoveryStep === RECOVERY_ANIMATION_STEP.REENTRY
  const isBreakup = recoveryStep === RECOVERY_ANIMATION_STEP.BREAKUP

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    const viewOffsetX = Math.max(0, -proxy.current.x) * size.width * RECOVERY_VIEW_OFFSET_FACTOR
    const nextViewOffset = viewOffsetX < 0.5 ? 0 : viewOffsetX

    if (Math.abs((lastViewOffsetRef.current ?? -1) - nextViewOffset) > 0.5) {
      if (nextViewOffset === 0) {
        camera.clearViewOffset()
      } else {
        camera.setViewOffset(size.width, size.height, nextViewOffset, 0, size.width, size.height)
      }
      camera.updateProjectionMatrix()
      lastViewOffsetRef.current = nextViewOffset
    }

    if (recoveryActive) {
      const focusSource = satelliteFocusRef?.current
      const hasSatelliteFocus = focusSource && focusSource.lengthSq() > 0.0001
      const rawDeorbitFocusProgress = isReentry || isBreakup
        ? 1
        : isDeorbitBurn
          && hasSatelliteFocus
          && Number.isFinite(focusSource.deorbitProgress)
          ? THREE.MathUtils.clamp(focusSource.deorbitProgress, 0, 1)
          : 0
      const deorbitFocusProgress = THREE.MathUtils.smoothstep(rawDeorbitFocusProgress, 0, 1)
      reentryZoomProgressRef.current = THREE.MathUtils.damp(
        reentryZoomProgressRef.current,
        isReentry || isBreakup ? 1 : 0,
        REENTRY_CAMERA_ZOOM_DAMPING,
        delta,
      )
      const reentryCameraProgress = THREE.MathUtils.smoothstep(
        reentryZoomProgressRef.current,
        0,
        1,
      )
      breakupZoomProgressRef.current = THREE.MathUtils.damp(
        breakupZoomProgressRef.current,
        isBreakup ? 1 : 0,
        REENTRY_CAMERA_ZOOM_DAMPING,
        delta,
      )
      const breakupCameraProgress = THREE.MathUtils.smoothstep(
        breakupZoomProgressRef.current,
        0,
        1,
      )
      const cameraDamping = isReentry || isBreakup ? REENTRY_CAMERA_DAMPING : RECOVERY_CAMERA_DAMPING
      const damping = 1 - Math.exp(-delta * cameraDamping)
      zoomProgressRef.current = THREE.MathUtils.damp(
        zoomProgressRef.current,
        1,
        RECOVERY_CAMERA_ZOOM_DAMPING,
        delta,
      )
      const zoomEase = THREE.MathUtils.smoothstep(zoomProgressRef.current, 0, 1)
      const baseMinOrbitRadius = THREE.MathUtils.lerp(
        RECOVERY_CAMERA_START_ORBIT_RADIUS,
        RECOVERY_CAMERA_END_ORBIT_RADIUS,
        zoomEase,
      )
      const deorbitMinOrbitRadius = THREE.MathUtils.lerp(
        baseMinOrbitRadius,
        DEORBIT_CAMERA_END_ORBIT_RADIUS,
        deorbitFocusProgress,
      )
      const reentryMinOrbitRadius = THREE.MathUtils.lerp(
        deorbitMinOrbitRadius,
        REENTRY_CAMERA_END_ORBIT_RADIUS,
        reentryCameraProgress,
      )
      const minOrbitRadius = THREE.MathUtils.lerp(
        reentryMinOrbitRadius,
        BREAKUP_CAMERA_END_ORBIT_RADIUS,
        breakupCameraProgress,
      )
      const baseMinFocusDistance = THREE.MathUtils.lerp(
        RECOVERY_CAMERA_START_FOCUS_DISTANCE,
        RECOVERY_CAMERA_END_FOCUS_DISTANCE,
        zoomEase,
      )
      const deorbitMinFocusDistance = THREE.MathUtils.lerp(
        baseMinFocusDistance,
        DEORBIT_CAMERA_END_FOCUS_DISTANCE,
        deorbitFocusProgress,
      )
      const reentryMinFocusDistance = THREE.MathUtils.lerp(
        deorbitMinFocusDistance,
        REENTRY_CAMERA_END_FOCUS_DISTANCE,
        reentryCameraProgress,
      )
      const minFocusDistance = THREE.MathUtils.lerp(
        reentryMinFocusDistance,
        BREAKUP_CAMERA_END_FOCUS_DISTANCE,
        breakupCameraProgress,
      )
      const deorbitFocusBlend = THREE.MathUtils.lerp(
        RECOVERY_CAMERA_FOCUS_BLEND,
        DEORBIT_CAMERA_FOCUS_BLEND,
        deorbitFocusProgress,
      )
      const focusBlend = THREE.MathUtils.lerp(
        deorbitFocusBlend,
        REENTRY_CAMERA_FOCUS_BLEND,
        reentryCameraProgress,
      )

      cameraVectors.focus.copy(hasSatelliteFocus ? focusSource : cameraVectors.fallbackFocus)
      cameraVectors.target
        .copy(cameraVectors.focus)
        .multiplyScalar(focusBlend)
      cameraVectors.zoomOffset
        .copy(RECOVERY_CAMERA_START_OFFSET)
        .lerp(RECOVERY_CAMERA_END_OFFSET, zoomEase)
        .lerp(DEORBIT_CAMERA_END_OFFSET, deorbitFocusProgress)
        .lerp(REENTRY_CAMERA_END_OFFSET, reentryCameraProgress)
        .lerp(BREAKUP_CAMERA_END_OFFSET, breakupCameraProgress)
      cameraVectors.desiredPosition
        .copy(cameraVectors.target)
        .add(cameraVectors.zoomOffset)
      cameraVectors.currentSpherical.setFromVector3(camera.position)
      cameraVectors.desiredSpherical.setFromVector3(cameraVectors.desiredPosition)

      controls.enabled = false
      controls.target.lerp(cameraVectors.target, damping)
      cameraVectors.nextPosition.setFromSphericalCoords(
        Math.max(
          minOrbitRadius,
          THREE.MathUtils.damp(
            cameraVectors.currentSpherical.radius,
            Math.max(cameraVectors.desiredSpherical.radius, minOrbitRadius),
            cameraDamping,
            delta,
          ),
        ),
        THREE.MathUtils.clamp(
          THREE.MathUtils.damp(
            cameraVectors.currentSpherical.phi,
            cameraVectors.desiredSpherical.phi,
            cameraDamping,
            delta,
          ),
          0.16,
          Math.PI - 0.16,
        ),
        dampAngle(
          cameraVectors.currentSpherical.theta,
          cameraVectors.desiredSpherical.theta,
          cameraDamping,
          delta,
        ),
      )

      if (
        cameraVectors.nextPosition.distanceTo(cameraVectors.focus)
        < minFocusDistance
      ) {
        cameraVectors.clearanceDirection
          .copy(cameraVectors.nextPosition)
          .sub(cameraVectors.focus)
        if (cameraVectors.clearanceDirection.lengthSq() < 0.0001) {
          cameraVectors.clearanceDirection.set(0, 0, 1)
        }
        cameraVectors.nextPosition
          .copy(cameraVectors.focus)
          .addScaledVector(
            cameraVectors.clearanceDirection.normalize(),
            minFocusDistance,
          )
      }

      camera.position.copy(cameraVectors.nextPosition)
      camera.lookAt(controls.target)
      return
    }

    zoomProgressRef.current = 0
    reentryZoomProgressRef.current = 0
    breakupZoomProgressRef.current = 0
    controls.enabled = true
    controls.target.set(0, 0, 0)
    controls.update()
  })

  useEffect(() => () => {
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }, [camera])

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      enableZoom={false}
      enableRotate={!recoveryActive}
      rotateSpeed={0.45}
      minPolarAngle={Math.PI * 0.22}
      maxPolarAngle={Math.PI * 0.78}
    />
  )
}

export default function M4New({ onComplete = () => {} }) {
  const {
    satellite,
    user,
    materials,
    damageLevel,
    clickedHistoryEvents,
    storyOutline,
    storyChapters,
    setGameResult,
    setDebrisGenerated,
    setScrollLocked,
    setStoryChapter,
  } = useAppStore()
  const proxy = useRef({ scale: MIN_EARTH_SCALE, orbitOpacity: 1, x: 0 })
  const satelliteFocusRef = useRef(new THREE.Vector3())
  const started = useRef(false)
  const completionUnlocked = useRef(false)
  const progressRef = useRef(0)
  const [events] = useState(() => pickEvents(damageLevel, clickedHistoryEvents || [], TOTAL_ROUNDS))
  const [gameStatus, setGameStatus] = useState(() => ({
    fuel: 100,
    armor: calcInitialArmor(damageLevel),
    missionProgress: 0,
  }))
  const [orbitProgress, setOrbitProgress] = useState(0)
  const [orbitOpacity, setOrbitOpacity] = useState(1)
  const [orbitLocked, setOrbitLocked] = useState(false)
  const [orbitVisible, setOrbitVisible] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [phase, setPhase] = useState(GAME_PHASE.EVENT)
  const [round, setRound] = useState(0)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [reflection, setReflection] = useState(null)
  const [localResult, setLocalResult] = useState(null)
  const [recoveryStepsVisible, setRecoveryStepsVisible] = useState(false)
  const [activeRecoveryStepIndex, setActiveRecoveryStepIndex] = useState(0)
  const initialStory = storyChapters?.m3
    || storyChapters?.opening
    || `${satellite?.name || '卫星'}进入近地轨道。监测系统开始记录每一次微小偏移。`
  const [storyThread, setStoryThread] = useState([initialStory])
  const currentEvent = events[round] || null
  const currentMonth = GAME_MONTHS[round] || GAME_MONTHS[GAME_MONTHS.length - 1]
  const latestStory = storyThread[storyThread.length - 1]
  const recoveryStep = phase === GAME_PHASE.RECOVERY && recoveryStepsVisible
    ? activeRecoveryStepIndex === 0
      ? RECOVERY_ANIMATION_STEP.MISSION_END
      : activeRecoveryStepIndex === 1
        ? RECOVERY_ANIMATION_STEP.SYSTEM_SHUTDOWN
        : activeRecoveryStepIndex === 2
          ? RECOVERY_ANIMATION_STEP.PASSIVATION
          : activeRecoveryStepIndex === 3
            ? RECOVERY_ANIMATION_STEP.DEORBIT_BURN
            : activeRecoveryStepIndex === 4
              ? RECOVERY_ANIMATION_STEP.REENTRY
              : activeRecoveryStepIndex === 5
                ? RECOVERY_ANIMATION_STEP.BREAKUP
                : RECOVERY_ANIMATION_STEP.SYSTEM_SHUTDOWN
    : null

  useEffect(() => {
    if (!gameStarted) {
      setScrollLocked(false)
      return
    }

    setScrollLocked(true)
    return () => setScrollLocked(false)
  }, [gameStarted, phase, setScrollLocked])

  useEffect(() => {
    if (!gameStarted) return

    gsap.to(proxy.current, {
      scale: phase === GAME_PHASE.RECOVERY && recoveryStepsVisible
        ? RECOVERY_MODEL_SCALE
        : EXPANDED_EARTH_SCALE,
      x: phase === GAME_PHASE.RECOVERY && recoveryStepsVisible
        ? RECOVERY_MODEL_SHIFT_X
        : 0,
      duration: 0.72,
      ease: 'power3.out',
    })
  }, [gameStarted, phase, recoveryStepsVisible])

  const handleGameEnd = useCallback(async (allDecisions, finalStatus, finalStories) => {
    const result = evaluateResult({
      armor: finalStatus.armor,
      fuel: finalStatus.fuel,
      missionProgress: finalStatus.missionProgress,
      totalRounds: TOTAL_ROUNDS,
    })
    const isSuccess = result === 'success'
    const material = materials?.frame || '铝合金'
    const finalStory = finalStories[finalStories.length - 1]

    setLoading(true)
    let generatedReflection
    try {
      generatedReflection = await generateGameReflection({
        gameResult: isSuccess ? 'success' : 'failure',
        decisions: allDecisions,
        satellite: satellite || { name: 'UNKNOWN' },
        user: user || { name: '用户', importantEvent: '某件重要的事' },
        material,
        storyOutline,
      })
    } catch {
      generatedReflection = {
        knowledgePoints: [
          '每一次轨道规避都会消耗有限燃料。',
          '小尺寸碎片仍可能造成不可逆损伤。',
          '失控卫星会继续增加近地轨道风险。',
        ],
        satFate: isSuccess
          ? '卫星完成任务并保留了离轨能力。'
          : '卫星失去控制，成为新的轨道碎片来源。',
        debrisDescription: `${material}碎片，来源于受损卫星，残留于近地轨道。`,
      }
    }

    const normalizedReflection = {
      ...generatedReflection,
      storyEnding: generatedReflection.storyEnding
        || finalStory
        || (isSuccess ? '那件重要的事仍按原来的方向推进。' : '那件重要的事出现了无法忽略的偏移。'),
    }

    setGameResult({
      result,
      finalArmor: finalStatus.armor,
      finalFuel: finalStatus.fuel,
      finalMission: finalStatus.missionProgress,
      decisionCount: allDecisions.length,
    })
    setDebrisGenerated([normalizedReflection.debrisDescription])
    setStoryChapter('m4', normalizedReflection.storyEnding)
    setLocalResult(result)
    setReflection(normalizedReflection)
    setLoading(false)
    setPhase(GAME_PHASE.REFLECTION)
  }, [
    materials,
    satellite,
    setDebrisGenerated,
    setGameResult,
    setStoryChapter,
    storyOutline,
    user,
  ])

  const handleChoose = useCallback(async (option) => {
    if (!currentEvent || loading) return

    const nextStatus = {
      armor: Math.max(0, Math.min(100, gameStatus.armor + (option.armorDelta || 0))),
      fuel: Math.max(0, Math.min(100, gameStatus.fuel + (option.fuelDelta || 0))),
      missionProgress: Math.max(0, Math.min(100, gameStatus.missionProgress + (option.missionDelta || 0))),
    }
    const decision = {
      round,
      eventId: currentEvent.id,
      eventTitle: currentEvent.title,
      optionId: option.id,
      optionLabel: option.label,
      outcome: option.outcome,
      armorDelta: option.armorDelta,
      fuelDelta: option.fuelDelta,
      missionDelta: option.missionDelta,
    }

    setLoading(true)
    let aiResult
    try {
      aiResult = await generateGameDecisionFeedback({
        decision: option.label,
        threat: currentEvent.title,
        outcome: option.outcome,
        satellite: satellite || { name: 'UNKNOWN' },
        user: user || { name: '用户', importantEvent: '某件重要的事' },
        storyOutline,
        decisionIndex: round,
        totalDecisions: TOTAL_ROUNDS,
      })
    } catch {
      aiResult = {
        feedback: option.techNote,
        storyUpdate: option.outcome === 'correct'
          ? `${satellite?.name || '卫星'}完成机动，轨道数据重新稳定。平行时空中的关键节点暂时没有偏离。`
          : `${satellite?.name || '卫星'}的遥测信号出现新的波动。平行时空中的一个细节随之改变。`,
      }
    }

    const nextStories = aiResult.storyUpdate
      ? [...storyThread, aiResult.storyUpdate]
      : storyThread
    const nextDecisions = [...decisions, decision]
    const feedbackColor = option.outcome === 'correct'
      ? '#16835d'
      : option.outcome === 'partial'
        ? '#b66b16'
        : '#b13b32'

    setGameStatus(nextStatus)
    setDecisions(nextDecisions)
    setStoryThread(nextStories)
    setFeedback({
      ...option,
      title: option.outcome === 'correct'
        ? '机动执行完成'
        : option.outcome === 'partial'
          ? '风险仍未完全解除'
          : '轨道状态继续恶化',
      aiLog: aiResult.feedback || option.techNote,
      color: feedbackColor,
      nextDecisions,
      nextStories,
      nextStatus,
    })
    setLoading(false)
    setPhase(GAME_PHASE.FEEDBACK)
  }, [
    currentEvent,
    decisions,
    gameStatus,
    loading,
    round,
    satellite,
    storyOutline,
    storyThread,
    user,
  ])

  const handleContinue = useCallback(async () => {
    if (!feedback) return

    const isFinished = round + 1 >= TOTAL_ROUNDS
      || feedback.nextStatus.armor <= 0
      || feedback.nextStatus.fuel <= 0

    if (isFinished) {
      await handleGameEnd(feedback.nextDecisions, feedback.nextStatus, feedback.nextStories)
      return
    }

    setRound((value) => value + 1)
    setFeedback(null)
    setPhase(GAME_PHASE.EVENT)
  }, [feedback, handleGameEnd, round])

  const unlockNextStageWithoutScroll = useCallback(() => {
    if (completionUnlocked.current) return
    completionUnlocked.current = true
    onComplete({ autoScroll: false })
  }, [onComplete])

  const handleReflectionComplete = useCallback(() => {
    setRecoveryStepsVisible(false)
    setActiveRecoveryStepIndex(0)
    setPhase(GAME_PHASE.RECOVERY)
    unlockNextStageWithoutScroll()
  }, [unlockNextStageWithoutScroll])

  const handleRecoveryBackToResult = useCallback(() => {
    setRecoveryStepsVisible(false)
    setActiveRecoveryStepIndex(0)
    setPhase(GAME_PHASE.REFLECTION)
  }, [])

  const handleJumpToRecovery = useCallback(() => {
    const material = materials?.frame || '卫星结构材料'

    if (!reflection) {
      setLocalResult('success')
      setReflection({
        knowledgePoints: [
          '退役卫星通常需要经过关机、钝化、降轨、再入和残骸处置等阶段。',
          '钝化会释放剩余燃料、电池能量和高压气体，降低在轨爆炸风险。',
          '再入过程中大部分结构会烧蚀解体，少量耐高温残骸可能继续下落。',
        ],
        satFate: '演示模式已跳过十二个月任务，直接进入退役卫星回收流程。',
        storyEnding: `${satellite?.name || '卫星'}结束任务演示，地面站切换到回收与再入处置视角。`,
        debrisDescription: `${material}残骸演示样本，用于展示再入烧蚀后的碎片命运。`,
      })
    }

    started.current = true
    progressRef.current = 1
    proxy.current.orbitOpacity = 0
    gsap.killTweensOf(proxy.current)
    setOrbitProgress(1)
    setOrbitOpacity(0)
    setOrbitLocked(true)
    setOrbitVisible(false)
    setGameStarted(true)
    setLoading(false)
    setFeedback(null)
    setActiveRecoveryStepIndex(0)
    setRecoveryStepsVisible(true)
    setPhase(GAME_PHASE.RECOVERY)
    unlockNextStageWithoutScroll()
  }, [
    materials?.frame,
    reflection,
    satellite?.name,
    unlockNextStageWithoutScroll,
  ])

  const handleModuleWheel = useCallback((event) => {
    if (phase !== GAME_PHASE.RECOVERY) return
    if (recoveryStepsVisible) return
    event.preventDefault()
    if (event.deltaY > 0) {
      setActiveRecoveryStepIndex(0)
      setRecoveryStepsVisible(true)
    }
  }, [phase, recoveryStepsVisible])

  const handleProgressChange = useCallback((progress) => {
    progressRef.current = progress
    setOrbitProgress(progress)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (progressRef.current < 0.98 || started.current) return
    started.current = true
    setOrbitLocked(true)
    handleProgressChange(1)
    gsap.to(proxy.current, {
      scale: EXPANDED_EARTH_SCALE,
      x: 0,
      orbitOpacity: 0,
      duration: 1.1,
      ease: 'power3.inOut',
      onUpdate() {
        setOrbitOpacity(proxy.current.orbitOpacity)
      },
      onComplete() {
        setOrbitVisible(false)
        setGameStarted(true)
      },
    })
  }, [handleProgressChange])

  return (
    <div
      onWheel={handleModuleWheel}
      style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}
    >
      {orbitVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <OrbitBackdrop opacity={orbitOpacity * 0.9} />
        </div>
      )}

      <Canvas
        camera={{ position: [0, 1.4, 3.2], fov: DEFAULT_CAMERA_FOV }}
        style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={2.2} />
        <directionalLight position={[4, 3, 3]} intensity={4.0} color="#c8d8f0" />
        <directionalLight position={[-3, 1, -2]} intensity={1.2} color="#8899cc" />
        <pointLight position={[0, 4, 2]} intensity={2.5} color="#ffffff" />
        <Suspense fallback={null}>
          <EarthScene
            proxy={proxy}
            satellite={satellite}
            damageLevel={damageLevel}
            showPersonalOrbit={gameStarted}
            recoveryStep={recoveryStep}
            satelliteFocusRef={satelliteFocusRef}
          />
        </Suspense>
        <EarthOrbitControls
          proxy={proxy}
          recoveryStep={recoveryStep}
          satelliteFocusRef={satelliteFocusRef}
        />
      </Canvas>

      <BreakupMaterialBoard recoveryStep={recoveryStep} materials={materials} />

      {orbitVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, opacity: orbitOpacity }}>
          <OrbitControl
            progress={orbitProgress}
            disabled={orbitLocked}
            onProgressChange={handleProgressChange}
            onDragEnd={handleDragEnd}
          />
        </div>
      )}

      {orbitVisible && (
        <StartGuide
          opacity={orbitOpacity}
          progress={orbitProgress}
          onJumpToRecovery={handleJumpToRecovery}
        />
      )}

      {gameStarted && (
        <>
          {(phase === GAME_PHASE.EVENT || phase === GAME_PHASE.FEEDBACK) && (
            <GameStatusHud
              month={currentMonth}
              fuel={gameStatus.fuel}
              armor={gameStatus.armor}
              missionProgress={gameStatus.missionProgress}
            />
          )}
          {(phase === GAME_PHASE.EVENT || phase === GAME_PHASE.FEEDBACK) && (
            <>
              <StoryPanel month={currentMonth} story={latestStory} />
              <GamePanel
                phase={phase}
                event={currentEvent}
                round={round}
                loading={loading}
                feedback={feedback}
                onChoose={handleChoose}
                onContinue={handleContinue}
                onJumpToRecovery={handleJumpToRecovery}
              />
            </>
          )}
          {phase === GAME_PHASE.RECOVERY && (
            <>
              <RecoveryIntroPanel
                expanded={recoveryStepsVisible}
                onBackToResult={handleRecoveryBackToResult}
              />
              {recoveryStepsVisible && (
                <RecoveryStepsPanel
                  activeStepIndex={activeRecoveryStepIndex}
                  onActiveStepChange={setActiveRecoveryStepIndex}
                />
              )}
            </>
          )}
          {phase === GAME_PHASE.REFLECTION && (
            <ReflectionPage
              reflection={reflection}
              gameResult={localResult}
              missionStats={gameStatus}
              onComplete={handleReflectionComplete}
            />
          )}
        </>
      )}
    </div>
  )
}
