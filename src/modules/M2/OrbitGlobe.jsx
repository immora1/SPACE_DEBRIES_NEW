import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// ── 视觉半径（压缩，非等比例）────────────────────────────────────────────────
const VR_LEO = 1.46
const VR_MEO = 2.60
const VR_GEO = 4.00

function toVisR(altKm) {
  if (altKm < 2000)  return 1.10 + ((altKm - 200)  / 1800)  * 0.28
  if (altKm < 35786) return 1.80 + ((altKm - 2000) / 33786) * 1.00
  return VR_GEO
}

// ── 地球 ──────────────────────────────────────────────────────────────────────
function Earth() {
  const ref = useRef()
  useFrame((_, dt) => { ref.current.rotation.y += dt * 0.03 })
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[1, 32, 20]} />
        <meshStandardMaterial color="#0c0e12" roughness={1} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.001, 0.0018, 2, 96]} />
        <meshBasicMaterial color="#1e2d3d" />
      </mesh>
      {[30, -30].map((deg) => {
        const phi = (deg * Math.PI) / 180
        return (
          <mesh key={deg} rotation={[-Math.PI / 2, 0, 0]} position={[0, Math.sin(phi), 0]}>
            <torusGeometry args={[Math.cos(phi), 0.0012, 2, 72]} />
            <meshBasicMaterial color="#111820" />
          </mesh>
        )
      })}
      <mesh>
        <sphereGeometry args={[1.055, 24, 14]} />
        <meshBasicMaterial color="#1a3560" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

// ── 轨道带环：active=null 默认亮度，true 高亮，false 变暗 ─────────────────────
function ZoneRing({ r, baseOpacity, active, tube }) {
  const matRef = useRef()
  const target = active === null ? baseOpacity : (active ? 0.92 : 0.07)

  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity += (target - matRef.current.opacity) * 0.12
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[r, tube, 2, 160]} />
      <meshBasicMaterial ref={matRef} color="#6b7fff" transparent opacity={baseOpacity} />
    </mesh>
  )
}

// ── 用户卫星轨道 + 运动点 ────────────────────────────────────────────────────
function SatOrbit({ altKm, incDeg }) {
  const dotRef = useRef()
  const ang    = useRef(Math.random() * Math.PI * 2)
  const r      = toVisR(altKm)
  const inc    = (incDeg * Math.PI) / 180
  const rx     = (incDeg * Math.PI) / 180 - Math.PI / 2
  const spd    = 0.38 / Math.sqrt(r)

  useFrame((_, dt) => {
    ang.current += dt * spd
    if (dotRef.current) {
      dotRef.current.position.set(
        r * Math.cos(ang.current),
        r * Math.sin(ang.current) * Math.sin(inc),
       -r * Math.sin(ang.current) * Math.cos(inc),
      )
    }
  })

  return (
    <group>
      <mesh rotation={[rx, 0, 0]}>
        <torusGeometry args={[r, 0.007, 4, 128]} />
        <meshBasicMaterial color="#6b7fff" transparent opacity={0.88} />
      </mesh>
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.023, 8, 8]} />
        <meshBasicMaterial color="#6b7fff" />
      </mesh>
    </group>
  )
}

// ── 导出 ─────────────────────────────────────────────────────────────────────
export default function OrbitGlobe({ satellite, height = 480, activeOrbit = null }) {
  const alt = satellite?.altitudeKm ?? 836
  const inc = satellite?.inclination ?? 98.7

  const leoActive = activeOrbit === null ? null : activeOrbit === 'leo'
  const meoActive = activeOrbit === null ? null : activeOrbit === 'meo'
  const geoActive = activeOrbit === null ? null : activeOrbit === 'geo'

  return (
    <div style={{ height, background: 'transparent' }}>
      <Canvas
        camera={{ position: [0, 3.0, 9.5], fov: 52 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 5, 4]} intensity={0.55} color="#ddd9d4" />

        <Earth />

        <ZoneRing r={VR_LEO} baseOpacity={0.62} active={leoActive} tube={0.007} />
        <ZoneRing r={VR_MEO} baseOpacity={0.40} active={meoActive} tube={0.006} />
        <ZoneRing r={VR_GEO} baseOpacity={0.24} active={geoActive} tube={0.005} />

        <SatOrbit altKm={alt} incDeg={inc} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          maxPolarAngle={Math.PI * 0.82}
          minPolarAngle={Math.PI * 0.18}
        />
      </Canvas>
    </div>
  )
}

