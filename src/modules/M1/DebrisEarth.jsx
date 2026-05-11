import { useRef, Suspense } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

// Pre-generated at module level — stable across renders, no recomputation
const N = 2000
const DEBRIS = Array.from({ length: N }, () => {
  const layer = Math.random()
  let radius, phi

  if (layer < 0.65) {
    // LEO — dense, tight to Earth
    radius = 1.58 + Math.random() * 0.30
    phi    = (Math.random() - 0.5) * Math.PI
  } else if (layer < 0.85) {
    // MEO
    radius = 2.55 + Math.random() * 0.65
    phi    = (Math.random() - 0.5) * Math.PI
  } else {
    // GEO — equatorial belt
    radius = 4.45 + Math.random() * 0.12
    phi    = (Math.random() - 0.5) * 0.14
  }

  const theta = Math.random() * Math.PI * 2
  return {
    pos: [
      radius * Math.cos(theta) * Math.cos(phi),
      radius * Math.sin(phi),
      radius * Math.sin(theta) * Math.cos(phi),
    ],
    rot:   [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    scale: 0.004 + Math.random() * 0.008,
    // Color gradient: LEO=near-white, MEO=accent-blue, GEO=pure accent
    color: layer < 0.65 ? '#c8d0f8' : layer < 0.85 ? '#8b9fff' : '#6b7fff',
  }
})

function EarthScene() {
  const earthRef  = useRef()
  const debrisRef = useRef()
  const earthTex  = useLoader(THREE.TextureLoader, '/earth_borders.png')

  useFrame((_, delta) => {
    if (earthRef.current)  earthRef.current.rotation.y  += delta * 0.055
    if (debrisRef.current) debrisRef.current.rotation.y += delta * 0.018
  })

  return (
    // Offset Earth right-of-center so debris extends into left viewport
    <group position={[1.8, -0.1, 0]}>
      {/* Earth — tinted blue-lavender to match design palette */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial map={earthTex} color="#b8c4ff" />
      </mesh>

      {/* Inner atmosphere glow */}
      <mesh scale={1.055}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#3344cc" side={THREE.BackSide} transparent opacity={0.22} />
      </mesh>

      {/* Outer halo — very subtle */}
      <mesh scale={1.22}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color="#6b7fff" side={THREE.BackSide} transparent opacity={0.06} />
      </mesh>

      {/* Orbital rings — LEO / MEO / GEO */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.72, 0.003, 8, 128]} />
        <meshBasicMaterial color="#c8d0f8" transparent opacity={0.14} />
      </mesh>
      <mesh rotation={[Math.PI / 2.3, 0.18, 0]}>
        <torusGeometry args={[2.87, 0.003, 8, 128]} />
        <meshBasicMaterial color="#8b9fff" transparent opacity={0.09} />
      </mesh>
      <mesh rotation={[Math.PI / 2.1, -0.08, 0]}>
        <torusGeometry args={[4.51, 0.003, 8, 128]} />
        <meshBasicMaterial color="#6b7fff" transparent opacity={0.07} />
      </mesh>

      {/* Debris field */}
      <group ref={debrisRef}>
        {DEBRIS.map((d, i) => (
          <mesh key={i} position={d.pos} rotation={d.rot} scale={d.scale}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={d.color} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function DebrisEarth() {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 8.5], fov: 52 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <EarthScene />
      </Suspense>
    </Canvas>
  )
}
