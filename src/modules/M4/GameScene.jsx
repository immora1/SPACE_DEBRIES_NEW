import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// ── 太阳系比例常量（艺术压缩，保留相对真实比例）────────────────────────────────
// 地球半径 2.0，太阳半径 8.0（真实 109:1 → 游戏 4:1）
// 地日距离 100，行星轨道按真实 AU 比例缩放（地球=1AU=100）
// 外行星轨道适度压缩（Jupiter 5.2AU→300, Saturn 9.6→380, Uranus 19→440, Neptune 30→490）
const SUN_WORLD_POS = new THREE.Vector3(0, 0, -100)
const EARTH_ORBIT_R     = 100
const EARTH_ORBIT_SPEED = 0.008          // rad/s，约 13 分钟一圈
const EARTH_INITIAL_THETA = Math.PI / 2  // θ=π/2 → 初始世界坐标 [0, 0, 0]

// 行星数据
// color:    行星主体颜色（参考 NASA 真实图像风格化提取）
// atmoColor:大气/边缘发光色（BackSide 球壳，产生行星特征色大气晕）
// orbitR:   真实 AU×100，外行星适度压缩；inc: 真实轨道倾角（弧度）
// speed:    T ∝ r^1.5，angular_speed / 60，与 theta += speed*delta*60 匹配
const PLANET_DATA = [
  // Mercury：蓝灰岩质星体 + 金色反光（参考：蓝紫→金橙色谱）
  { name: 'Mercury', orbitR:  39, size: 0.40, color: '#7070a0', atmoColor: '#c89848', inc: 0.1222, speed: 0.000540,  phase: 0.5  },
  // Venus：浓郁琥珀金（参考：全金橙暖调）
  { name: 'Venus',   orbitR:  72, size: 0.78, color: '#c07010', atmoColor: '#f0c030', inc: 0.0593, speed: 0.000218,  phase: 2.1  },
  // Mars：深铁锈红（参考：深棕红→橙赭色谱）
  { name: 'Mars',    orbitR: 152, size: 0.48, color: '#881808', atmoColor: '#e04010', inc: 0.0323, speed: 0.0000712, phase: 1.0  },
  // Jupiter：暖棕多带（参考：橄榄绿→橙→淡粉色谱）
  { name: 'Jupiter', orbitR: 300, size: 2.50, color: '#a87848', atmoColor: '#d4aa78', inc: 0.0228, speed: 0.0000257, phase: 4.5, saturnRings: false },
  // Saturn：近黑橄榄体 + 金色环（参考：极深暗色→金橄榄色谱）
  { name: 'Saturn',  orbitR: 380, size: 2.20, color: '#2e2818', atmoColor: '#b09030', inc: 0.0436, speed: 0.0000180, phase: 2.8, saturnRings: true  },
  // Uranus：鲜艳青绿（参考：vivid cyan-mint 均匀色谱）
  { name: 'Uranus',  orbitR: 440, size: 1.50, color: '#08bab0', atmoColor: '#60e8e0', inc: 0.0135, speed: 0.0000145, phase: 5.0  },
  // Neptune：深钴蓝（参考：深海军蓝→中钴蓝色谱）
  { name: 'Neptune', orbitR: 490, size: 1.48, color: '#0818a8', atmoColor: '#2858e8', inc: 0.0309, speed: 0.0000123, phase: 0.2  },
]

// ── 地球 ──────────────────────────────────────────────────────────────────────
function Earth() {
  const meshRef = useRef()
  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.05
  })
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial
        color="#1a3550"
        roughness={0.75}
        metalness={0.2}
        emissive="#0a1a28"
        emissiveIntensity={0.4}
      />
    </mesh>
  )
}

// ── 大气层 ────────────────────────────────────────────────────────────────────
function Atmosphere() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[2.05, 64, 64]} />
        <meshBasicMaterial color="#7ac8f0" transparent opacity={0.55} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.15, 48, 48]} />
        <meshBasicMaterial color="#3a90d0" transparent opacity={0.22} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.35, 32, 32]} />
        <meshBasicMaterial color="#1a5080" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
    </>
  )
}

// ── 卫星轨道环 ─────────────────────────────────────────────────────────────────
function OrbitRing({ radius, inclination = 0, color = '#c8b89a', opacity = 0.75, tubeRadius = 0.012 }) {
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0)
    const points = curve.getPoints(180).map((p) => new THREE.Vector3(p.x, 0, p.y))
    const path = new THREE.CatmullRomCurve3(points, true)
    return new THREE.TubeGeometry(path, 180, tubeRadius, 6, true)
  }, [radius, tubeRadius])

  return (
    <group rotation={[inclination, 0, 0]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  )
}

// ── 碎片云 ─────────────────────────────────────────────────────────────────────
const OUR_SCALE = 2.0 / 6371
const OUR_R = 2.0

function buildDebrisData(totalCount) {
  const result = []
  const NUM_RINGS = 40
  const PER_RING  = Math.floor(totalCount * 0.9 / NUM_RINGS)

  const rings = Array.from({ length: NUM_RINGS }, () => ({
    alt:    500 + Math.pow(Math.random(), 2) * 14000,
    inc:    Math.random() * Math.PI,
    raan:   Math.random() * Math.PI * 2,
    spread: 50 + Math.random() * 200,
  }))

  rings.forEach((ring) => {
    for (let k = 0; k < PER_RING; k++) {
      let theta = (k / PER_RING) * Math.PI * 2
      theta += (Math.random() - 0.5) * 0.08
      const alt    = ring.alt + (Math.random() - 0.5) * ring.spread
      const radius = (6371 + alt) * OUR_SCALE
      result.push({
        radius, theta, raan: ring.raan, inc: ring.inc,
        speed: 0.005 * Math.sqrt(OUR_R / radius) * (Math.random() > 0.5 ? 1 : -1),
      })
    }
  })

  const scatterCount = totalCount - result.length
  for (let i = 0; i < scatterCount; i++) {
    const alt    = 400 + Math.random() * 20000
    const radius = (6371 + alt) * OUR_SCALE
    result.push({
      radius,
      theta: Math.random() * Math.PI * 2,
      raan:  Math.random() * Math.PI * 2,
      inc:   Math.acos(2 * Math.random() - 1),
      speed: 0.01 * Math.sqrt(OUR_R / radius) * (Math.random() > 0.5 ? 1 : -1),
    })
  }
  return result
}

function DebrisCloud({ count = 3000, damageLevel = 0 }) {
  const meshRef = useRef()
  const actualCount = Math.min(count + damageLevel * 100, 5000)
  const debrisData = useMemo(() => buildDebrisData(actualCount), [actualCount])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    if (!meshRef.current) return
    debrisData.forEach((d, i) => {
      d.theta += d.speed
      const x = d.radius * (Math.cos(d.raan) * Math.cos(d.theta) - Math.sin(d.raan) * Math.sin(d.theta) * Math.cos(d.inc))
      const z = d.radius * (Math.sin(d.raan) * Math.cos(d.theta) + Math.cos(d.raan) * Math.sin(d.theta) * Math.cos(d.inc))
      const y = d.radius * Math.sin(d.theta) * Math.sin(d.inc)
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, actualCount]}>
      <boxGeometry args={[0.04, 0.04, 0.04]} />
      <meshBasicMaterial color="#ffffff" />
    </instancedMesh>
  )
}

// ── 用户卫星（CubeSat，坐标相对地球中心）─────────────────────────────────────────
function Satellite({ orbitRadius = 3.2, inclination = 0.5, phase = 0 }) {
  const groupRef = useRef()
  const theta = useRef(phase)

  useFrame((_, delta) => {
    theta.current += delta * 0.25
    const x = orbitRadius * (Math.cos(0) * Math.cos(theta.current) - Math.sin(0) * Math.sin(theta.current) * Math.cos(inclination))
    const z = orbitRadius * (Math.sin(0) * Math.cos(theta.current) + Math.cos(0) * Math.sin(theta.current) * Math.cos(inclination))
    const y = orbitRadius * Math.sin(theta.current) * Math.sin(inclination)
    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      groupRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#3a3a38" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.32, 0, 0]}>
        <boxGeometry args={[0.28, 0.12, 0.015]} />
        <meshStandardMaterial color="#3d5a7a" emissive="#3d5a7a" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.32, 0, 0]}>
        <boxGeometry args={[0.28, 0.12, 0.015]} />
        <meshStandardMaterial color="#3d5a7a" emissive="#3d5a7a" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
        <meshBasicMaterial color="#c8b89a" />
      </mesh>
      <pointLight color="#c8b89a" intensity={0.4} distance={1.5} />
    </group>
  )
}

// ── 事件警报光效 ────────────────────────────────────────────────────────────────
function AlertPulse({ active }) {
  const meshRef = useRef()
  const scale = useRef(1)
  const growing = useRef(true)

  useFrame((_, delta) => {
    if (!active || !meshRef.current) return
    if (growing.current) {
      scale.current += delta * 0.8
      if (scale.current > 2.5) growing.current = false
    } else {
      scale.current -= delta * 0.8
      if (scale.current < 1) growing.current = true
    }
    meshRef.current.scale.setScalar(scale.current)
    meshRef.current.material.opacity = (2.5 - scale.current) / 1.5 * 0.15
  })

  if (!active) return null
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.2, 32, 32]} />
      <meshBasicMaterial color="#c8503a" transparent opacity={0.1} side={THREE.BackSide} />
    </mesh>
  )
}

// ── 星场（位于 EarthSystem 内，随地球移动，半径 650-720 始终在所有行星之外）──────
// 星点以地球为中心分布，确保行星（最远距地球 ~590）永远在星场之内（无遮挡）
function StarField() {
  const smallPos = useMemo(() => {
    const pos = new Float32Array(4000 * 3)
    for (let i = 0; i < 4000; i++) {
      const r = 650 + Math.random() * 70
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  const bigPos = useMemo(() => {
    const pos = new Float32Array(300 * 3)
    for (let i = 0; i < 300; i++) {
      const r = 655 + Math.random() * 65
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  const smallGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(smallPos, 3))
    return g
  }, [smallPos])

  const bigGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(bigPos, 3))
    return g
  }, [bigPos])

  return (
    <>
      <points geometry={smallGeo}>
        <pointsMaterial color="#d8d4cc" size={0.50} sizeAttenuation transparent opacity={0.75} />
      </points>
      <points geometry={bigGeo}>
        <pointsMaterial color="#f5f0e8" size={1.50} sizeAttenuation transparent opacity={0.9} />
      </points>
    </>
  )
}

// ── 深空背景球（位于 EarthSystem 内，半径 750 > 最远行星距地 590，提供纯黑底色）──
function SpaceFog() {
  return (
    <mesh>
      <sphereGeometry args={[750, 16, 16]} />
      <meshBasicMaterial color="#0d0f18" side={THREE.BackSide} />
    </mesh>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 太阳系（黄道面 = XZ 平面，group 无旋转；各行星用真实轨道倾角）
// ─────────────────────────────────────────────────────────────────────────────

// 太阳（参考"The Sun #10"色谱：黄白核→深橙色球→深红日冕，radius 8.0，比例 4:1）
function Sun() {
  const chromoRef = useRef()
  const coronaRef = useRef()
  const outerRef  = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // 色球层脉动（快，模拟太阳活动）
    if (chromoRef.current) chromoRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.03)
    // 内日冕缓慢扩张
    if (coronaRef.current) coronaRef.current.scale.setScalar(1 + Math.sin(t * 0.7) * 0.04)
    // 外日冕极慢呼吸
    if (outerRef.current)  outerRef.current.scale.setScalar(1 + Math.sin(t * 0.25) * 0.025)
  })
  return (
    <>
      {/* 光球核心：明亮黄白（最热区域） */}
      <mesh>
        <sphereGeometry args={[8.0, 32, 32]} />
        <meshBasicMaterial color="#ffee88" />
      </mesh>
      {/* 色球层：深橙，紧贴表面 BackSide 产生边缘燃烧感 */}
      <mesh ref={chromoRef}>
        <sphereGeometry args={[9.2, 28, 28]} />
        <meshBasicMaterial color="#ff6010" transparent opacity={0.55} side={THREE.BackSide} />
      </mesh>
      {/* 内日冕：深红橙，脉动 */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[13.0, 22, 22]} />
        <meshBasicMaterial color="#cc2800" transparent opacity={0.22} />
      </mesh>
      {/* 外日冕：深暗红晕，极淡 */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[20.0, 14, 14]} />
        <meshBasicMaterial color="#780800" transparent opacity={0.07} />
      </mesh>
      {/* 太阳点光源，照亮整个太阳系 */}
      <pointLight color="#fff8d8" intensity={5.0} distance={800} decay={2} />
    </>
  )
}

// 行星轨道环（无自身旋转；由外层 Planet group 统一倾斜，确保环与星体共面）
function PlanetOrbit({ radius }) {
  const tubeR = 0.12 + radius * 0.0006
  const geometry = useMemo(() => {
    const pts = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0)
      .getPoints(240)
      .map((p) => new THREE.Vector3(p.x, 0, p.y))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, tubeR, 4, true)
  }, [radius, tubeR])

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#c8b89a" transparent opacity={0.22} />
    </mesh>
  )
}

// 单颗行星（公转 + 大气晕 + 可选土星环）
// 关键：轨道环与行星球体都在同一个 <group rotation={[inc,0,0]}> 内，
// 组内 XZ 平面即行星轨道平面，位置只需 y=0，彻底消除环/星不共面问题。
function Planet({ orbitR, size, color, atmoColor, inc, speed, phase, saturnRings }) {
  const bodyRef = useRef()
  const theta   = useRef(phase)

  useFrame((_, delta) => {
    theta.current += speed * delta * 60
    // 在倾斜 group 的局部空间内，轨道是平坦 XZ 圆（y 始终为 0）
    if (bodyRef.current) {
      bodyRef.current.position.set(
        orbitR * Math.cos(theta.current),
        0,
        orbitR * Math.sin(theta.current),
      )
    }
  })

  return (
    // 整个轨道系统（环 + 星体）整体倾斜 inc 弧度，环和星体永远共面
    <group rotation={[inc, 0, 0]}>
      <PlanetOrbit radius={orbitR} />
      <group ref={bodyRef}>
        {/* 行星主体 */}
        <mesh>
          <sphereGeometry args={[size, 20, 20]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {/* 大气层内晕：BackSide 产生边缘特征色（各行星独有色调） */}
        <mesh>
          <sphereGeometry args={[size * 1.18, 16, 16]} />
          <meshBasicMaterial color={atmoColor} transparent opacity={0.38} side={THREE.BackSide} />
        </mesh>
        {/* 大气层外散射：正面薄雾 */}
        <mesh>
          <sphereGeometry args={[size * 1.40, 12, 12]} />
          <meshBasicMaterial color={atmoColor} transparent opacity={0.07} />
        </mesh>
        {/* 土星环（深暗金色，匹配 Saturn 极深暗体+金色亮环风格） */}
        {saturnRings && (
          <>
            <mesh rotation={[Math.PI * 0.38, 0.1, 0]}>
              <torusGeometry args={[size * 1.9, size * 0.22, 2, 80]} />
              <meshBasicMaterial color="#c8a428" transparent opacity={0.60} />
            </mesh>
            <mesh rotation={[Math.PI * 0.38, 0.1, 0]}>
              <torusGeometry args={[size * 2.40, size * 0.12, 2, 80]} />
              <meshBasicMaterial color="#a08020" transparent opacity={0.35} />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}

// 太阳系组（group 无旋转 → 黄道面即 XZ 平面，与地球公转轨道共面）
function SolarSystem() {
  return (
    <group position={[SUN_WORLD_POS.x, SUN_WORLD_POS.y, SUN_WORLD_POS.z]}>
      <Sun />
      {PLANET_DATA.map((p) => (
        <Planet key={p.name} {...p} />
      ))}
    </group>
  )
}

// 地球公转轨道参考线（XZ 平面，圆心=太阳，半径=EARTH_ORBIT_R）
function EarthOrbitPath() {
  const geometry = useMemo(() => {
    const pts = new THREE.EllipseCurve(0, 0, EARTH_ORBIT_R, EARTH_ORBIT_R, 0, 2 * Math.PI, false, 0)
      .getPoints(360)
      .map((p) => new THREE.Vector3(p.x, 0, p.y))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 360, 0.25, 4, true)
  }, [])
  return (
    <group position={[SUN_WORLD_POS.x, SUN_WORLD_POS.y, SUN_WORLD_POS.z]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#4a88c8" transparent opacity={0.18} />
      </mesh>
    </group>
  )
}

// ── 地球系统（地球 + 所有近地对象 + 星场 + 背景球，整组绕太阳公转）─────────────
// earthPosRef 每帧写入地球世界坐标，供 CameraFollower 读取
function EarthSystem({ earthPosRef, damageLevel, alertActive, satelliteInclination }) {
  const groupRef = useRef()
  const theta = useRef(EARTH_INITIAL_THETA)

  useFrame((_, delta) => {
    theta.current += delta * EARTH_ORBIT_SPEED
    const x = SUN_WORLD_POS.x + EARTH_ORBIT_R * Math.cos(theta.current)
    const z = SUN_WORLD_POS.z + EARTH_ORBIT_R * Math.sin(theta.current)
    const y = SUN_WORLD_POS.y  // 黄道面 y=0
    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      earthPosRef.current.set(x, y, z)
    }
  }, -2)  // 优先级 -2：最先运行，确保 CameraFollower 能读到当帧最新位置

  return (
    <group ref={groupRef}>
      {/* 星场和背景球跟随地球，确保始终在所有行星（最远 ~590）之外 */}
      <SpaceFog />
      <StarField />

      <Earth />
      <Atmosphere />

      {/* 三层卫星轨道环（LEO / MEO / GEO） */}
      <OrbitRing radius={2.55} inclination={0.45} color="#c8b89a" opacity={0.85} tubeRadius={0.014} />
      <OrbitRing radius={3.60} inclination={0.25} color="#c8b89a" opacity={0.55} tubeRadius={0.010} />
      <OrbitRing radius={5.20} inclination={0.08} color="#c8b89a" opacity={0.35} tubeRadius={0.007} />

      <DebrisCloud count={3000} damageLevel={damageLevel} />
      <Satellite orbitRadius={3.2} inclination={satelliteInclination} phase={0} />
      <AlertPulse active={alertActive} />
    </group>
  )
}

// ── 相机跟随地球：将 OrbitControls target 锁定到地球世界坐标 ─────────────────────
function CameraFollower({ earthPosRef, controlsRef }) {
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.target.copy(earthPosRef.current)
    }
  }, -1)  // 优先级 -1：在 EarthSystem(-2) 后、OrbitControls(0) 前执行
  return null
}

// ── 场景内容（Canvas 子组件，持有跨组件 refs）──────────────────────────────────
function SceneContent({ damageLevel, alertActive, satelliteInclination }) {
  const earthPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const controlsRef = useRef()

  return (
    <>
      {/* 主光源（暖白，从右上方照亮地球正面） */}
      <directionalLight position={[12, 8, 6]} intensity={1.2} color="#fff8f0" />
      {/* 环境散射（轻微蓝紫，模拟宇宙背景） */}
      <ambientLight intensity={0.20} color="#3a4060" />
      {/* 地球背面填充光 */}
      <pointLight position={[-8, -4, -6]} intensity={0.4} color="#1a3a6a" />

      <SolarSystem />
      <EarthOrbitPath />

      <EarthSystem
        earthPosRef={earthPosRef}
        damageLevel={damageLevel}
        alertActive={alertActive}
        satelliteInclination={satelliteInclination}
      />

      <CameraFollower earthPosRef={earthPosRef} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={3}
        maxDistance={500}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  )
}

// ── 主场景组件（导出）─────────────────────────────────────────────────────────
export default function GameScene({ damageLevel = 0, alertActive = false, satelliteInclination = 0.5 }) {
  return (
    <Canvas
      camera={{ position: [0, 4, 10], fov: 45 }}
      style={{ background: '#0d0f18' }}
      gl={{ antialias: true }}
    >
      <SceneContent
        damageLevel={damageLevel}
        alertActive={alertActive}
        satelliteInclination={satelliteInclination}
      />
    </Canvas>
  )
}
