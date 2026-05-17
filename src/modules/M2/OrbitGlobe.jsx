import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// ── 可视半径（压缩映射，非真实比例）────────────────────────────────────────────
const VR_LEO = 1.46
const VR_MEO = 2.60
const VR_GEO = 4.00

function toVisR(altKm) {
  if (altKm < 2000)  return 1.10 + ((altKm - 200)  / 1800)  * 0.28
  if (altKm < 35786) return 1.80 + ((altKm - 2000) / 33786) * 1.00
  return VR_GEO
}

// ── 地球本体 ──────────────────────────────────────────────────────────────────
function Earth() {
  const ref = useRef()
  useFrame((_, dt) => { ref.current.rotation.y += dt * 0.025 })
  return (
    <group ref={ref}>
      {/* 主球体 */}
      <mesh>
        <sphereGeometry args={[1, 48, 30]} />
        <meshStandardMaterial color="#08101a" roughness={0.9} metalness={0.08} />
      </mesh>
      {/* 赤道线 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.002, 0.002, 2, 128]} />
        <meshBasicMaterial color="#1e2d3d" />
      </mesh>
      {/* 纬度线 */}
      {[30, -30, 60, -60].map((deg) => {
        const phi = (deg * Math.PI) / 180
        return (
          <mesh key={deg} rotation={[-Math.PI / 2, 0, 0]} position={[0, Math.sin(phi), 0]}>
            <torusGeometry args={[Math.cos(phi), 0.001, 2, 80]} />
            <meshBasicMaterial color="#0d1824" />
          </mesh>
        )
      })}
      {/* 大气光晕 */}
      <mesh>
        <sphereGeometry args={[1.08, 24, 14]} />
        <meshBasicMaterial color="#1a4080" transparent opacity={0.09} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

// ── 轨道带环 ─────────────────────────────────────────────────────────────────
// active: null=默认 | true=高亮 | false=变暗
// currentStep: 0=hover 交互 | 1=卫星高亮 | 2=任务模式
function ZoneRing({ r, baseOpacity, active, tube, hexColor, currentStep }) {
  const matRef = useRef()

  let target
  if (currentStep === 1) {
    target = active === null ? baseOpacity * 0.18 : (active ? 0.72 : 0.05)
  } else if (currentStep === 2) {
    target = active === null ? baseOpacity * 0.5  : (active ? 0.75 : 0.06)
  } else {
    // step 0：hover 时激活环全亮，其余极暗，对比清晰
    target = active === null ? baseOpacity : (active ? 1.0 : 0.06)
  }

  useFrame(() => {
    if (matRef.current) matRef.current.opacity += (target - matRef.current.opacity) * 0.1
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[r, tube, 2, 160]} />
      <meshBasicMaterial ref={matRef} color={hexColor} transparent opacity={baseOpacity} />
    </mesh>
  )
}

// ── 用户卫星轨道 + 运动点 ────────────────────────────────────────────────────
function SatOrbit({ altKm, incDeg, currentStep }) {
  const dotRef  = useRef()
  const glowRef = useRef()
  const ang     = useRef(Math.random() * Math.PI * 2)
  const r       = toVisR(altKm)
  const inc     = (incDeg * Math.PI) / 180
  const rx      = (incDeg * Math.PI) / 180 - Math.PI / 2
  const spd     = 0.38 / Math.sqrt(r)

  const highlight = currentStep === 1

  useFrame((_, dt) => {
    ang.current += dt * spd
    const x =  r * Math.cos(ang.current)
    const y =  r * Math.sin(ang.current) * Math.sin(inc)
    const z = -r * Math.sin(ang.current) * Math.cos(inc)
    if (dotRef.current)  dotRef.current.position.set(x, y, z)
    if (glowRef.current) glowRef.current.position.set(x, y, z)
  })

  return (
    <group>
      {/* 轨道环：step 1 时加粗加亮 */}
      <mesh rotation={[rx, 0, 0]}>
        <torusGeometry args={[r, highlight ? 0.013 : 0.007, 4, 128]} />
        <meshBasicMaterial color="#6b7fff" transparent opacity={highlight ? 1.0 : 0.88} />
      </mesh>
      {/* 卫星点 */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[highlight ? 0.044 : 0.022, 14, 14]} />
        <meshBasicMaterial color="#6b7fff" />
      </mesh>
      {/* 发光光晕（仅 step 1 显示） */}
      {highlight && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <meshBasicMaterial color="#6b7fff" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  )
}

// ── 导出 ─────────────────────────────────────────────────────────────────────
export default function OrbitGlobe({
  satellite,
  height = 480,
  activeOrbit = null,
  currentStep = 0,
  mission = null,
}) {
  const alt = satellite?.altitudeKm ?? 836
  const inc = satellite?.inclination ?? 98.7

  const leoActive = activeOrbit === null ? null : activeOrbit === 'leo'
  const meoActive = activeOrbit === null ? null : activeOrbit === 'meo'
  const geoActive = activeOrbit === null ? null : activeOrbit === 'geo'

  return (
    <div style={{ height, background: 'transparent', width: '100%' }}>
      <Canvas
        camera={{ position: [0, 2.8, 9.0], fov: 52 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 5, 4]} intensity={0.62} color="#d5d0cc" />
        {/* 蓝紫补光，营造深空氛围 */}
        <directionalLight position={[-3, 2, -4]} intensity={0.18} color="#4a5ad0" />

        <Earth />

        {/* 三轨道环：颜色分别为蓝、紫、青 */}
        <ZoneRing
          r={VR_LEO} baseOpacity={0.65} active={leoActive}
          tube={0.011} hexColor="#6b7fff" currentStep={currentStep}
        />
        <ZoneRing
          r={VR_MEO} baseOpacity={0.48} active={meoActive}
          tube={0.010} hexColor="#8b6cf8" currentStep={currentStep}
        />
        <ZoneRing
          r={VR_GEO} baseOpacity={0.34} active={geoActive}
          tube={0.009} hexColor="#8b6cf8" currentStep={currentStep}
        />

        <SatOrbit altKm={alt} incDeg={inc} currentStep={currentStep} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={currentStep !== 1}
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI * 0.82}
          minPolarAngle={Math.PI * 0.18}
        />
      </Canvas>
    </div>
  )
}
