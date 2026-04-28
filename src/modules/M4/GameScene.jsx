import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// 地球
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

// 大气层：三层叠加，产生清晰的边缘光晕
// - 内层（贴地）：亮蓝白，不透明度高，勾勒地球轮廓
// - 中层：蓝色扩散光
// - 外层：极淡的远晕
function Atmosphere() {
  return (
    <>
      {/* 内层：紧贴地球表面，亮蓝白色，勾勒轮廓 */}
      <mesh>
        <sphereGeometry args={[2.05, 64, 64]} />
        <meshBasicMaterial color="#7ac8f0" transparent opacity={0.55} side={THREE.BackSide} />
      </mesh>
      {/* 中层：蓝色扩散晕 */}
      <mesh>
        <sphereGeometry args={[2.15, 48, 48]} />
        <meshBasicMaterial color="#3a90d0" transparent opacity={0.22} side={THREE.BackSide} />
      </mesh>
      {/* 外层：极淡远晕 */}
      <mesh>
        <sphereGeometry args={[2.35, 32, 32]} />
        <meshBasicMaterial color="#1a5080" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
    </>
  )
}

// 轨道环：用 TubeGeometry 渲染有实体宽度的轨道圈（lineBasicMaterial 线宽 WebGL 固定为 1px）
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

// 与 SPACE GAME debris.js 相同的"原子模型"方案：
// 40条轨道环，每条环的粒子均匀分布在 theta 0~2π，形成清晰可见的轨道圈。
// 90% 原子模型环 + 10% 散落背景，复现真实碎片云外观。
const OUR_SCALE = 2.0 / 6371  // 场景地球半径 / 真实地球半径km
const OUR_R = 2.0              // 场景地球半径

function buildDebrisData(totalCount) {
  const result = []
  const NUM_RINGS = 40
  const PER_RING  = Math.floor(totalCount * 0.9 / NUM_RINGS)

  // 生成40条随机轨道环（不同高度、倾角、升交点赤经）
  const rings = Array.from({ length: NUM_RINGS }, () => ({
    alt:    500 + Math.pow(Math.random(), 2) * 14000, // 500~14500km，低轨为主
    inc:    Math.random() * Math.PI,
    raan:   Math.random() * Math.PI * 2,
    spread: 50 + Math.random() * 200,                 // 高度扩散 50~250km
  }))

  // 原子模型：每条环均匀排布粒子
  rings.forEach((ring) => {
    for (let k = 0; k < PER_RING; k++) {
      let theta = (k / PER_RING) * Math.PI * 2
      theta += (Math.random() - 0.5) * 0.08            // 轻微抖动防止完美圆
      const alt    = ring.alt + (Math.random() - 0.5) * ring.spread
      const radius = (6371 + alt) * OUR_SCALE
      result.push({
        radius, theta, raan: ring.raan, inc: ring.inc,
        speed: 0.005 * Math.sqrt(OUR_R / radius) * (Math.random() > 0.5 ? 1 : -1),
      })
    }
  })

  // 散落背景（10%）：完全随机分布
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
      // Keplerian 轨道位置计算（与 SPACE GAME debris.js 相同公式）
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

// 用户卫星（CubeSat 结构，配色适配当前网站）
function Satellite({ orbitRadius = 3.2, inclination = 0.5, phase = 0 }) {
  const groupRef = useRef()
  const wrapperRef = useRef()
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
    <group ref={wrapperRef}>
      <group ref={groupRef}>
        {/* 卫星主体 */}
        <mesh>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#3a3a38" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* 太阳能板 左 */}
        <mesh position={[-0.32, 0, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.015]} />
          <meshStandardMaterial color="#3d5a7a" emissive="#3d5a7a" emissiveIntensity={0.6} />
        </mesh>
        {/* 太阳能板 右 */}
        <mesh position={[0.32, 0, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.015]} />
          <meshStandardMaterial color="#3d5a7a" emissive="#3d5a7a" emissiveIntensity={0.6} />
        </mesh>
        {/* 天线 */}
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
          <meshBasicMaterial color="#c8b89a" />
        </mesh>
        {/* 卫星高亮点 */}
        <pointLight color="#c8b89a" intensity={0.4} distance={1.5} />
      </group>
    </group>
  )
}

// 事件警报光效（威胁触发时）
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

// 星场：大星 + 小星两层，有大小变化
function StarField() {
  // 小星（密集背景）
  const smallPos = useMemo(() => {
    const pos = new Float32Array(4000 * 3)
    for (let i = 0; i < 4000; i++) {
      const r = 55 + Math.random() * 45
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  // 大星（稀疏亮点）
  const bigPos = useMemo(() => {
    const pos = new Float32Array(300 * 3)
    for (let i = 0; i < 300; i++) {
      const r = 60 + Math.random() * 35
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
        <pointsMaterial color="#d8d4cc" size={0.06} sizeAttenuation transparent opacity={0.75} />
      </points>
      <points geometry={bigGeo}>
        <pointsMaterial color="#f5f0e8" size={0.18} sizeAttenuation transparent opacity={0.9} />
      </points>
    </>
  )
}

// 深空背景雾（让远处有轻微蓝紫色调，不再纯黑）
function SpaceFog() {
  return (
    <mesh>
      <sphereGeometry args={[90, 16, 16]} />
      <meshBasicMaterial color="#0d0f18" side={THREE.BackSide} />
    </mesh>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 太阳系（背景装饰）
// 太阳位于场景深处，8 颗行星各有轨道环，缓慢公转
// ─────────────────────────────────────────────────────────────────────────────

// 注意：没有 Earth —— 主场景的地球就是太阳系里的地球，不重复放小蓝点
const PLANET_DATA = [
  { name: 'Mercury', orbitR: 5,   size: 0.14, color: '#b0a898', inc: 0.12, speed: 0.0055, phase: 0.5,  saturnRings: false },
  { name: 'Venus',   orbitR: 8,   size: 0.22, color: '#e8c850', inc: 0.05, speed: 0.0042, phase: 2.1,  saturnRings: false },
  { name: 'Mars',    orbitR: 15,  size: 0.16, color: '#c85030', inc: 0.09, speed: 0.0028, phase: 1.0,  saturnRings: false },
  { name: 'Jupiter', orbitR: 22,  size: 0.55, color: '#c89060', inc: 0.05, speed: 0.0018, phase: 4.5,  saturnRings: false },
  { name: 'Saturn',  orbitR: 30,  size: 0.46, color: '#d8b858', inc: 0.20, speed: 0.0013, phase: 2.8,  saturnRings: true  },
  { name: 'Uranus',  orbitR: 37,  size: 0.34, color: '#60c8c0', inc: 0.15, speed: 0.0009, phase: 5.0,  saturnRings: false },
  { name: 'Neptune', orbitR: 43,  size: 0.32, color: '#3060c0', inc: 0.07, speed: 0.0007, phase: 0.2,  saturnRings: false },
]

// 太阳
function Sun() {
  const glowRef = useRef()
  useFrame((state) => {
    if (glowRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04
      glowRef.current.scale.setScalar(pulse)
    }
  })
  return (
    <>
      {/* 核心 */}
      <mesh>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color="#fff8d0" />
      </mesh>
      {/* 内晕 */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[3.2, 24, 24]} />
        <meshBasicMaterial color="#ffcc40" transparent opacity={0.18} />
      </mesh>
      {/* 外晕 */}
      <mesh>
        <sphereGeometry args={[5.0, 16, 16]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.06} />
      </mesh>
      {/* 太阳光源，照亮整个背景 */}
      <pointLight color="#fff8e0" intensity={4.0} distance={300} />
    </>
  )
}

// 行星轨道环（围绕太阳，细管）
function PlanetOrbit({ radius, inclination }) {
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0)
    const pts   = curve.getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y))
    const path  = new THREE.CatmullRomCurve3(pts, true)
    return new THREE.TubeGeometry(path, 160, 0.10, 4, true)
  }, [radius])

  return (
    <group rotation={[inclination, 0, 0]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#c8b89a" transparent opacity={0.28} />
      </mesh>
    </group>
  )
}

// 单颗行星（公转动画 + 可选土星环）
function Planet({ orbitR, size, color, inc, speed, phase, saturnRings }) {
  const ref   = useRef()
  const theta = useRef(phase)

  useFrame((_, delta) => {
    theta.current += speed * delta * 60
    const x = orbitR * Math.cos(theta.current)
    const z = orbitR * Math.sin(theta.current) * Math.cos(inc)
    const y = orbitR * Math.sin(theta.current) * Math.sin(inc)
    if (ref.current) ref.current.position.set(x, y, z)
  })

  return (
    <>
      <PlanetOrbit radius={orbitR} inclination={inc * 0.4} />
      <group ref={ref}>
        {/* 行星球体 */}
        <mesh>
          <sphereGeometry args={[size, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {/* 大气/光晕 */}
        <mesh>
          <sphereGeometry args={[size * 1.25, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.12} />
        </mesh>
        {/* 土星环 */}
        {saturnRings && (
          <>
            <mesh rotation={[Math.PI * 0.38, 0.1, 0]}>
              <torusGeometry args={[size * 1.9, size * 0.22, 2, 80]} />
              <meshBasicMaterial color="#d4b858" transparent opacity={0.55} />
            </mesh>
            <mesh rotation={[Math.PI * 0.38, 0.1, 0]}>
              <torusGeometry args={[size * 2.35, size * 0.10, 2, 80]} />
              <meshBasicMaterial color="#c8a840" transparent opacity={0.30} />
            </mesh>
          </>
        )}
      </group>
    </>
  )
}

// 地球轨道环：从太阳延伸出来，半径 = 太阳到主场景地球的距离
// 让主场景的大地球视觉上就在这条轨道上
function EarthOrbitRing() {
  // 太阳系 group 内坐标：地球轨道半径 ≈ 11（与太阳系其他行星比例一致）
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 11, 11, 0, 2 * Math.PI, false, 0)
    const pts   = curve.getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y))
    const path  = new THREE.CatmullRomCurve3(pts, true)
    return new THREE.TubeGeometry(path, 160, 0.10, 4, true)
  }, [])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#4a88c8" transparent opacity={0.35} />
    </mesh>
  )
}

// 完整太阳系组
// position: 太阳放在左后下方，rotation 让黄道面微微朝向观察者
// 主场景地球在世界原点 [0,0,0]，视觉上就是太阳系里的地球
function SolarSystem() {
  return (
    <group position={[-18, -10, -38]} rotation={[0.32, 0.18, 0]}>
      <Sun />
      <EarthOrbitRing />
      {PLANET_DATA.map((p) => (
        <Planet key={p.name} {...p} />
      ))}
    </group>
  )
}

// 主场景组件（导出）
export default function GameScene({ damageLevel = 0, alertActive = false, satelliteInclination = 0.5 }) {
  return (
    <Canvas
      camera={{ position: [0, 4, 10], fov: 45 }}
      style={{ background: '#0d0f18' }}
      gl={{ antialias: true }}
    >
      {/* 太阳光（主光源，暖白，从右上方） */}
      <directionalLight position={[12, 6, 4]} intensity={1.4} color="#fff8f0" />
      {/* 环境散射（模拟宇宙背景辐射，轻微蓝紫） */}
      <ambientLight intensity={0.25} color="#3a4060" />
      {/* 地球背面填充光（深蓝，防止全黑） */}
      <pointLight position={[-8, -4, -6]} intensity={0.5} color="#1a3a6a" />
      {/* 金色点光（模拟轨道环反光） */}
      <pointLight position={[0, 6, 0]} intensity={0.2} color="#c8b89a" />

      <SpaceFog />
      <StarField />
      <SolarSystem />
      <Earth />
      <Atmosphere />

      {/* 三层轨道环（LEO / MEO / GEO），全部用网站金色，粗细递减 */}
      <OrbitRing radius={2.55} inclination={0.45} color="#c8b89a" opacity={0.85} tubeRadius={0.014} />
      <OrbitRing radius={3.60} inclination={0.25} color="#c8b89a" opacity={0.55} tubeRadius={0.010} />
      <OrbitRing radius={5.20} inclination={0.08} color="#c8b89a" opacity={0.35} tubeRadius={0.007} />

      <DebrisCloud count={3000} damageLevel={damageLevel} />

      <Satellite orbitRadius={3.2} inclination={satelliteInclination} phase={0} />

      <AlertPulse active={alertActive} />

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={20}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </Canvas>
  )
}
