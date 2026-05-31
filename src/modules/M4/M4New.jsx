import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import gsap from 'gsap'

const EARTH_GLB = '/earth%20globe%203d%20model.glb'
const EARTH_SCALE = 1

useGLTF.preload(EARTH_GLB)

function EarthScene({ proxy }) {
  const { scene } = useGLTF(EARTH_GLB)
  const groupRef = useRef()
  const earthRef = useRef()

  useFrame((_, dt) => {
    if (!groupRef.current) return
    groupRef.current.scale.setScalar(proxy.current.scale)
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.055
  })

  return (
    <group ref={groupRef}>
      <group ref={earthRef}>
        <primitive object={scene} scale={EARTH_SCALE} />
      </group>
    </group>
  )
}

export default function M4New({ onComplete }) {
  const proxy = useRef({ scale: 1.6 })
  const started = useRef(false)

  function handleStart() {
    if (started.current) return
    started.current = true
    gsap.to(proxy.current, {
      scale: 3.2,
      duration: 1.5,
      ease: 'power3.inOut',
      onComplete() {
        if (onComplete) onComplete()
      },
    })
  }

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 1.4, 3.2], fov: 44 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={2.2} />
        <directionalLight position={[4, 3, 3]} intensity={4.0} color="#c8d8f0" />
        <directionalLight position={[-3, 1, -2]} intensity={1.2} color="#8899cc" />
        <pointLight position={[0, 4, 2]} intensity={2.5} color="#ffffff" />
        <Suspense fallback={null}>
          <EarthScene proxy={proxy} />
        </Suspense>
      </Canvas>
    </div>
  )
}
