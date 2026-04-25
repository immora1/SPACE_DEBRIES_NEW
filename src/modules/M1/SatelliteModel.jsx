import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const IDLE = '#242422'
const DIM  = '#181820'

const C = {
  frame:      { sel: '#c8b89a', emissive: '#1a1205' },
  solar:      { sel: '#4e88bf', emissive: '#05101e' },
  insulation: { sel: '#c8a040', emissive: '#1a1400' },
  propulsion: { sel: '#45b8c2', emissive: '#051a1c' },
}

const MATTE = { roughness: 0.92, metalness: 0 }

function Frame({ active }) {
  const ref = useRef()
  const tc  = useRef(new THREE.Color())
  const te  = useRef(new THREE.Color())
  useFrame(() => {
    if (!ref.current) return
    tc.current.set(active ? C.frame.sel : IDLE)
    te.current.set(active ? C.frame.emissive : '#000')
    ref.current.material.color.lerp(tc.current, 0.08)
    ref.current.material.emissive.lerp(te.current, 0.08)
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.88, 1.28, 0.68]} />
      <meshStandardMaterial color={IDLE} {...MATTE} />
    </mesh>
  )
}

function Insulation({ active }) {
  const ref = useRef()
  const tc  = useRef(new THREE.Color())
  useFrame(() => {
    if (!ref.current) return
    const mat = ref.current.material
    tc.current.set(active ? C.insulation.sel : '#1a1a18')
    mat.color.lerp(tc.current, 0.08)
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

function SolarPanels({ active }) {
  const refs = [useRef(), useRef()]
  const tc   = useRef(new THREE.Color())
  const te   = useRef(new THREE.Color())
  useFrame(() => {
    tc.current.set(active ? C.solar.sel : DIM)
    te.current.set(active ? C.solar.emissive : '#000')
    refs.forEach((r) => {
      if (!r.current) return
      r.current.material.color.lerp(tc.current, 0.08)
      r.current.material.emissive.lerp(te.current, 0.08)
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

function PropulsionTank({ active }) {
  const ref = useRef()
  const tc  = useRef(new THREE.Color())
  const te  = useRef(new THREE.Color())
  useFrame(() => {
    if (!ref.current) return
    tc.current.set(active ? C.propulsion.sel : IDLE)
    te.current.set(active ? C.propulsion.emissive : '#000')
    ref.current.material.color.lerp(tc.current, 0.08)
    ref.current.material.emissive.lerp(te.current, 0.08)
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

export default function SatelliteModel({ selections = {}, height = 480, fill = false }) {
  const containerStyle = fill
    ? { width: '100%', height: '100%' }
    : { height, background: 'transparent' }

  return (
    <div style={containerStyle}>
      <Canvas
        camera={fill
          ? { position: [0, 0.2, 2.6], fov: 38 }
          : { position: [0, 0.4, 4.0], fov: 34 }
        }
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
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
