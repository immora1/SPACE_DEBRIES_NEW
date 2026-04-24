import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const IDLE = '#242422'
const DIM  = '#181820'

// Per-part active colors（与 index.jsx 的 PART_ACCENT 保持一致）
const C = {
  frame:      { sel: '#c8b89a', emissive: '#1a1205' },
  solar:      { sel: '#4e88bf', emissive: '#05101e' },
  insulation: { sel: '#c8a040', emissive: '#1a1400' },
  propulsion: { sel: '#45b8c2', emissive: '#051a1c' },
}

// 统一哑光材质属性（无反光，无金属感）
const MATTE = { roughness: 0.92, metalness: 0 }

// ── 主框架 ────────────────────────────────────────────────────────────────────
function Frame({ active }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    ref.current.material.color.lerp(new THREE.Color(active ? C.frame.sel : IDLE), 0.08)
    ref.current.material.emissive.lerp(new THREE.Color(active ? C.frame.emissive : '#000'), 0.08)
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.88, 1.28, 0.68]} />
      <meshStandardMaterial color={IDLE} {...MATTE} />
    </mesh>
  )
}

// ── 隔热毯（半透明外壳）────────────────────────────────────────────────────────
function Insulation({ active }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    const mat = ref.current.material
    mat.color.lerp(new THREE.Color(active ? C.insulation.sel : '#1a1a18'), 0.08)
    mat.opacity += ((active ? 0.45 : 0.04) - mat.opacity) * 0.08
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.93, 1.33, 0.73]} />
      <meshStandardMaterial
        color="#1a1a18"
        transparent
        opacity={0.04}
        roughness={0.95}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── 太阳能电池板（蓝色）──────────────────────────────────────────────────────
function SolarPanels({ active }) {
  const refs = [useRef(), useRef()]
  useFrame(() => {
    refs.forEach((r) => {
      if (!r.current) return
      r.current.material.color.lerp(new THREE.Color(active ? C.solar.sel : DIM), 0.08)
      r.current.material.emissive.lerp(new THREE.Color(active ? C.solar.emissive : '#000'), 0.08)
    })
  })
  return (
    <group>
      <mesh ref={refs[0]} position={[-1.22, 0, 0]}>
        <boxGeometry args={[1.28, 0.64, 0.022]} />
        <meshStandardMaterial color={DIM} roughness={0.88} metalness={0} />
      </mesh>
      <mesh ref={refs[1]} position={[1.22, 0, 0]}>
        <boxGeometry args={[1.28, 0.64, 0.022]} />
        <meshStandardMaterial color={DIM} roughness={0.88} metalness={0} />
      </mesh>
      <mesh position={[-0.56, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.46, 6]} />
        <meshStandardMaterial color="#1e1e1c" {...MATTE} />
      </mesh>
      <mesh position={[0.56, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.46, 6]} />
        <meshStandardMaterial color="#1e1e1c" {...MATTE} />
      </mesh>
    </group>
  )
}

// ── 推进系统贮箱（青蓝色）────────────────────────────────────────────────────
function PropulsionTank({ active }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    ref.current.material.color.lerp(new THREE.Color(active ? C.propulsion.sel : IDLE), 0.08)
    ref.current.material.emissive.lerp(new THREE.Color(active ? C.propulsion.emissive : '#000'), 0.08)
  })
  return (
    <group>
      <mesh ref={ref} position={[0, -0.88, 0]}>
        <sphereGeometry args={[0.21, 20, 20]} />
        <meshStandardMaterial color={IDLE} {...MATTE} />
      </mesh>
      <mesh position={[0, -1.16, 0]}>
        <cylinderGeometry args={[0.1, 0.065, 0.15, 10]} />
        <meshStandardMaterial color="#111110" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.12, 8]} />
        <meshStandardMaterial color="#1a1a18" {...MATTE} />
      </mesh>
    </group>
  )
}

// ── 整体卫星（自转）─────────────────────────────────────────────────────────
function Satellite({ selections }) {
  const groupRef = useRef()
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.28
  })
  return (
    <group ref={groupRef}>
      <Frame          active={!!selections.frame} />
      <Insulation     active={!!selections.insulation} />
      <SolarPanels    active={!!selections.solar} />
      <PropulsionTank active={!!selections.propulsion} />
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.28, 6]} />
        <meshStandardMaterial color="#1e1e1c" {...MATTE} />
      </mesh>
    </group>
  )
}

// ── 导出 ─────────────────────────────────────────────────────────────────────
export default function SatelliteModel({ selections = {}, height = 480 }) {
  return (
    <div style={{ height, background: 'transparent' }}>
      <Canvas
        camera={{ position: [0, 0.4, 4.0], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        {/* 哑光光照：足够亮但无高光反射 */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[2, 4, 3]} intensity={0.9} color="#f0eeea" />
        <directionalLight position={[-3, 1, -2]} intensity={0.25} color="#c8d0e0" />

        <Satellite selections={selections} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          maxPolarAngle={Math.PI * 0.72}
          minPolarAngle={Math.PI * 0.28}
        />
      </Canvas>
    </div>
  )
}
