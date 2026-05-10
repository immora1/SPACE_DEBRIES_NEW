import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// Reads plain refs (updated via MotionValue.on('change')) — runs outside React render cycle
function CameraRig({ mouseX, mouseY }) {
  useFrame(({ camera }) => {
    const tx = (mouseX.current - 0.5) * 0.6
    const ty = (mouseY.current - 0.5) * -0.4
    camera.position.x += (tx - camera.position.x) * 0.04
    camera.position.y += (ty + 0.5 - camera.position.y) * 0.04
    camera.lookAt(0, 0, 0)
  })
  return null
}

const BODY  = '#12122a'
const PANEL = '#1a2845'

const C = {
  frame:      { s: '#6b7fff', e: '#0a0a30' },
  solar:      { s: '#3a78d4', e: '#040e28' },
  insulation: { s: '#c8a040', e: '#1a1200' },
  propulsion: { s: '#38bfc8', e: '#041618' },
}

// ── Main body — 8-sided flat-shaded cylinders, geometric poster look
function Body({ active }) {
  const bodyRef = useRef()
  const topRef  = useRef()
  const botRef  = useRef()
  const domeRef = useRef()
  const tc = useRef(new THREE.Color())
  const te = useRef(new THREE.Color())

  useFrame(() => {
    tc.current.set(active ? C.frame.s : BODY)
    te.current.set(active ? C.frame.e : '#000')
    ;[bodyRef, topRef, botRef, domeRef].forEach(r => {
      if (!r.current?.material) return
      r.current.material.color.lerp(tc.current, 0.07)
      r.current.material.emissive.lerp(te.current, 0.07)
    })
  })

  return (
    <group>
      <mesh ref={bodyRef}>
        <cylinderGeometry args={[0.38, 0.44, 1.15, 8]} />
        <meshStandardMaterial color={BODY} roughness={0.72} metalness={0.28} flatShading />
      </mesh>
      <mesh ref={topRef} position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.16, 0.38, 0.22, 8]} />
        <meshStandardMaterial color={BODY} roughness={0.76} metalness={0.24} flatShading />
      </mesh>
      <mesh ref={botRef} position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.28, 0.44, 0.20, 8]} />
        <meshStandardMaterial color={BODY} roughness={0.76} metalness={0.24} flatShading />
      </mesh>
      <mesh ref={domeRef} position={[0, 0.86, 0]}>
        <sphereGeometry args={[0.10, 8, 6]} />
        <meshStandardMaterial color="#07072a" roughness={0.52} metalness={0.45} flatShading />
      </mesh>
      {/* primary antenna */}
      <mesh position={[0, 1.06, 0]}>
        <cylinderGeometry args={[0.010, 0.010, 0.38, 5]} />
        <meshStandardMaterial color="#20203e" roughness={0.9} />
      </mesh>
      {/* secondary antenna */}
      <mesh position={[0.28, 0.76, 0.28]} rotation={[0.4, 0, 0.4]}>
        <cylinderGeometry args={[0.007, 0.007, 0.24, 4]} />
        <meshStandardMaterial color="#20203e" roughness={0.9} />
      </mesh>
    </group>
  )
}

// ── Insulation outer shell — glows amber when active
function Insulation({ active }) {
  const ref = useRef()
  const tc  = useRef(new THREE.Color())
  useFrame(() => {
    if (!ref.current?.material) return
    const mat = ref.current.material
    tc.current.set(C.insulation.s)
    mat.color.lerp(tc.current, 0.07)
    mat.opacity += ((active ? 0.38 : 0) - mat.opacity) * 0.07
  })
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.50, 0.52, 1.17, 8]} />
      <meshStandardMaterial
        color={C.insulation.s}
        transparent opacity={0}
        roughness={0.95} metalness={0}
        side={THREE.DoubleSide}
        flatShading
      />
    </mesh>
  )
}

// ── Solar wings — two panels per side (poster-art style, bold blue)
function SolarPanels({ active }) {
  const r0 = useRef(), r1 = useRef(), r2 = useRef(), r3 = useRef()
  const tc = useRef(new THREE.Color())
  const te = useRef(new THREE.Color())

  useFrame(() => {
    tc.current.set(active ? C.solar.s : PANEL)
    te.current.set(active ? C.solar.e : '#000')
    ;[r0, r1, r2, r3].forEach(r => {
      if (!r.current?.material) return
      r.current.material.color.lerp(tc.current, 0.07)
      r.current.material.emissive.lerp(te.current, 0.07)
    })
  })

  return (
    <group>
      {/* left boom */}
      <mesh position={[-0.66, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.60, 5]} />
        <meshStandardMaterial color="#0e0e26" roughness={0.9} />
      </mesh>
      <mesh ref={r0} position={[-1.18, 0, 0]}>
        <boxGeometry args={[0.72, 0.55, 0.016]} />
        <meshStandardMaterial color={PANEL} roughness={0.70} metalness={0.08} flatShading />
      </mesh>
      <mesh ref={r1} position={[-1.97, 0, 0]}>
        <boxGeometry args={[0.72, 0.55, 0.016]} />
        <meshStandardMaterial color={PANEL} roughness={0.70} metalness={0.08} flatShading />
      </mesh>
      {/* right boom */}
      <mesh position={[0.66, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.60, 5]} />
        <meshStandardMaterial color="#0e0e26" roughness={0.9} />
      </mesh>
      <mesh ref={r2} position={[1.18, 0, 0]}>
        <boxGeometry args={[0.72, 0.55, 0.016]} />
        <meshStandardMaterial color={PANEL} roughness={0.70} metalness={0.08} flatShading />
      </mesh>
      <mesh ref={r3} position={[1.97, 0, 0]}>
        <boxGeometry args={[0.72, 0.55, 0.016]} />
        <meshStandardMaterial color={PANEL} roughness={0.70} metalness={0.08} flatShading />
      </mesh>
    </group>
  )
}

// ── Propulsion tank — faceted sphere + nozzle
function PropulsionTank({ active }) {
  const tankRef   = useRef()
  const nozzleRef = useRef()
  const tc = useRef(new THREE.Color())
  const te = useRef(new THREE.Color())

  useFrame(() => {
    tc.current.set(active ? C.propulsion.s : BODY)
    te.current.set(active ? C.propulsion.e : '#000')
    ;[tankRef, nozzleRef].forEach(r => {
      if (!r.current?.material) return
      r.current.material.color.lerp(tc.current, 0.07)
      r.current.material.emissive.lerp(te.current, 0.07)
    })
  })

  return (
    <group>
      <mesh ref={tankRef} position={[0, -0.96, 0]}>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshStandardMaterial color={BODY} roughness={0.60} metalness={0.32} flatShading />
      </mesh>
      <mesh ref={nozzleRef} position={[0, -1.27, 0]}>
        <cylinderGeometry args={[0.08, 0.14, 0.20, 8]} />
        <meshStandardMaterial color="#06061a" roughness={0.88} metalness={0.14} flatShading />
      </mesh>
    </group>
  )
}

// ── Orbital ring (decorative — references the lunar program poster aesthetic)
function OrbitalRing() {
  return (
    <mesh rotation={[Math.PI / 2.2, 0, 0.5]}>
      <torusGeometry args={[2.55, 0.006, 4, 110]} />
      <meshBasicMaterial color="#6b7fff" transparent opacity={0.20} />
    </mesh>
  )
}

// ── Second ring at a different angle
function OrbitalRing2() {
  return (
    <mesh rotation={[Math.PI / 1.6, 0.8, 0]}>
      <torusGeometry args={[2.8, 0.004, 4, 110]} />
      <meshBasicMaterial color="#8b6cf8" transparent opacity={0.10} />
    </mesh>
  )
}

// ── Background planet — geometric dark sphere in bottom-right
function BackgroundPlanet() {
  return (
    <mesh position={[4.5, -3.5, -11]}>
      <sphereGeometry args={[5.5, 6, 5]} />
      <meshBasicMaterial color="#0f0530" transparent opacity={0.55} flatShading />
    </mesh>
  )
}

// ── Full assembly
function Satellite({ selections }) {
  const groupRef = useRef()
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.20
  })
  return (
    <group ref={groupRef} rotation={[0.14, 0.3, 0]}>
      <Body           active={!!selections.frame} />
      <Insulation     active={!!selections.insulation} />
      <SolarPanels    active={!!selections.solar} />
      <PropulsionTank active={!!selections.propulsion} />
    </group>
  )
}

export default function SatelliteModel({ selections = {}, height = 480, fill = false, mouseXRef, mouseYRef }) {
  const containerStyle = fill
    ? { width: '100%', height: '100%' }
    : { height, background: 'transparent' }

  return (
    <div style={containerStyle}>
      <Canvas
        camera={fill
          ? { position: [0, 0.5, 4.0], fov: 40 }
          : { position: [0, 0.4, 5.0], fov: 34 }
        }
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.16} />
        <directionalLight position={[4, 6, 3]}  intensity={1.5} color="#c0d0ff" />
        <directionalLight position={[-3, -2, -5]} intensity={0.22} color="#1a1060" />
        <pointLight position={[-4, 3, 2]} intensity={1.0} color="#6b7fff" distance={14} />

        <BackgroundPlanet />
        <OrbitalRing />
        <OrbitalRing2 />
        <Satellite selections={selections} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI * 0.72}
          minPolarAngle={Math.PI * 0.28}
        />
        {mouseXRef && mouseYRef && <CameraRig mouseX={mouseXRef} mouseY={mouseYRef} />}
      </Canvas>
    </div>
  )
}
