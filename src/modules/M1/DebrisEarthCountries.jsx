import { useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

const _COLORS = ['#f87171', '#6b7fff', '#fbbf24', '#8b9fff']
const _PCTS   = [0.3892, 0.3795, 0.1325, 0.0985]

const _BOUNDS = (() => {
  let c = 0
  return _PCTS.map(p => { const s = c * 2 * Math.PI; c += p; return [s, c * 2 * Math.PI] })
})()

const _DIVIDERS = _BOUNDS.map(([s]) => s)

const N_TOTAL = 2600

// Four-layer debris distribution — dense inner core + wide scatter + isolated stragglers
const _BY_COUNTRY = (() => {
  const groups = [[], [], [], []]
  for (let k = 0; k < N_TOTAL; k++) {
    const theta = Math.random() * Math.PI * 2
    const roll  = Math.random()
    let r, scale

    if (roll < 0.38) {
      // Dense LEO core — most of the "main ring" look
      r     = 1.32 + Math.pow(Math.random(), 0.65) * 0.80
      scale = 0.019 + Math.random() * 0.022
    } else if (roll < 0.65) {
      // Mid-band spread
      r     = 2.0 + Math.random() * 1.4
      scale = 0.014 + Math.random() * 0.018
    } else if (roll < 0.86) {
      // Wide scatter — key layer for the "floating around" feel
      r     = 3.2 + Math.random() * 2.5
      scale = 0.010 + Math.random() * 0.014
    } else {
      // Far stragglers — isolated fragments drifting beyond the main cloud
      r     = 5.5 + Math.random() * 4.0
      scale = 0.008 + Math.random() * 0.010
    }

    const ci = Math.max(0, _BOUNDS.findIndex(([s, e]) => theta >= s && theta < e))
    groups[ci].push({
      pos:   [r * Math.cos(theta), (Math.random() - 0.5) * 0.26, r * Math.sin(theta)],
      scale,
    })
  }
  return groups
})()

function makeCircle(r, res = 100) {
  return Array.from({ length: res }, (_, k) => {
    const a = (k / (res - 1)) * Math.PI * 2
    return [r * Math.cos(a), 0, r * Math.sin(a)]
  })
}

function CountryDebris({ group, color, ci, hovIdxRef }) {
  const meshRef = useRef()
  const prevHov = useRef(-99)

  useEffect(() => {
    if (!meshRef.current) return
    const dummy = new THREE.Object3D()
    group.forEach((d, i) => {
      dummy.position.set(...d.pos)
      dummy.scale.setScalar(d.scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [group])

  useFrame(() => {
    const hov = hovIdxRef.current
    if (hov === prevHov.current || !meshRef.current?.material) return
    prevHov.current = hov
    meshRef.current.material.opacity = hov < 0 ? 0.85 : ci === hov ? 1.0 : 0.07
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, group.length]}
      frustumCulled={false}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </instancedMesh>
  )
}

function Scene({ hovIdxRef }) {
  const earthRef = useRef()
  const ringRef  = useRef()
  const earthTex = useLoader(THREE.TextureLoader, '/earth_borders.png')

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.04
    if (ringRef.current)  ringRef.current.rotation.y  += delta * 0.013
  })

  return (
    <group>
      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial map={earthTex} color="#b2c4ff" />
      </mesh>
      <mesh scale={1.055}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#2233cc" side={THREE.BackSide} transparent opacity={0.22} />
      </mesh>

      {/* Faint static orbit traces */}
      <Line points={makeCircle(1.72)} color="#6b7fff" lineWidth={1} transparent opacity={0.10} />
      <Line points={makeCircle(2.87)} color="#6b7fff" lineWidth={1} transparent opacity={0.06} />
      <Line points={makeCircle(4.51)} color="#6b7fff" lineWidth={1} transparent opacity={0.04} />

      {/* Debris cloud + sector dividers — rotate together */}
      <group ref={ringRef}>
        {_DIVIDERS.map((angle, i) => (
          <Line key={i}
            points={[
              [1.22 * Math.cos(angle), 0, 1.22 * Math.sin(angle)],
              [9.50 * Math.cos(angle), 0, 9.50 * Math.sin(angle)],
            ]}
            color="#6b7fff"
            lineWidth={1}
            transparent
            opacity={0.18}
          />
        ))}

        {_BY_COUNTRY.map((group, ci) => (
          <CountryDebris
            key={ci}
            group={group}
            color={_COLORS[ci]}
            ci={ci}
            hovIdxRef={hovIdxRef}
          />
        ))}
      </group>
    </group>
  )
}

export default function DebrisEarthCountries({ hovIdxRef }) {
  return (
    <Canvas
      camera={{ position: [0, 9, 0.01], fov: 62 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Scene hovIdxRef={hovIdxRef} />
      </Suspense>
    </Canvas>
  )
}
