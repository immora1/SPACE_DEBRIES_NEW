import { useCallback, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import gsap from 'gsap'

const EARTH_GLB = '/earth%20globe%203d%20model.glb'
const EARTH_SCALE = 1
const MIN_EARTH_SCALE = 1.6
const EXPANDED_EARTH_SCALE = 3
const ORBIT_VIEWBOX_SIZE = 1000
const ORBIT_CENTER_X = 500
const ORBIT_CENTER_Y = 560
const ORBIT_RADIUS_X = 250
const ORBIT_RADIUS_Y = 185
const ORBIT_LEFT_X = ORBIT_CENTER_X - ORBIT_RADIUS_X
const ORBIT_RIGHT_X = ORBIT_CENTER_X + ORBIT_RADIUS_X
const ORBIT_FRONT_PATH = `M ${ORBIT_LEFT_X} ${ORBIT_CENTER_Y} A ${ORBIT_RADIUS_X} ${ORBIT_RADIUS_Y} 0 0 0 ${ORBIT_RIGHT_X} ${ORBIT_CENTER_Y}`

useGLTF.preload(EARTH_GLB)

function OrbitBackdrop({ opacity }) {
  return (
    <svg
      viewBox={`0 0 ${ORBIT_VIEWBOX_SIZE} ${ORBIT_VIEWBOX_SIZE}`}
      preserveAspectRatio="none"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    >
      <ellipse
        cx={ORBIT_CENTER_X}
        cy={ORBIT_CENTER_Y}
        rx={ORBIT_RADIUS_X}
        ry={ORBIT_RADIUS_Y}
        fill="none"
        stroke={`rgba(255,255,255,${opacity})`}
        strokeWidth="3"
        strokeDasharray="3 16"
        strokeLinecap="round"
      />
    </svg>
  )
}

function OrbitControl({ progress, disabled, onProgressChange, onDragEnd }) {
  const controlRef = useRef()
  const angle = Math.PI - progress * Math.PI
  const knobX = ORBIT_CENTER_X + Math.cos(angle) * ORBIT_RADIUS_X
  const knobY = ORBIT_CENTER_Y + Math.sin(angle) * ORBIT_RADIUS_Y

  const updateProgress = useCallback((clientX) => {
    const rect = controlRef.current?.getBoundingClientRect()
    if (!rect) return

    const viewBoxX = ((clientX - rect.left) / rect.width) * ORBIT_VIEWBOX_SIZE
    const nextProgress = (viewBoxX - ORBIT_LEFT_X) / (ORBIT_RIGHT_X - ORBIT_LEFT_X)
    onProgressChange(Math.max(0, Math.min(1, nextProgress)))
  }, [onProgressChange])

  const handlePointerDown = useCallback((event) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    updateProgress(event.clientX)
  }, [disabled, updateProgress])

  const handlePointerMove = useCallback((event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updateProgress(event.clientX)
    }
  }, [updateProgress])

  const handlePointerUp = useCallback((event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onDragEnd()
  }, [onDragEnd])

  return (
    <div
      ref={controlRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox={`0 0 ${ORBIT_VIEWBOX_SIZE} ${ORBIT_VIEWBOX_SIZE}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%' }}
      >
        <path
          d={ORBIT_FRONT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.96)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'absolute',
          left: `${knobX / ORBIT_VIEWBOX_SIZE * 100}%`,
          top: `${knobY / ORBIT_VIEWBOX_SIZE * 100}%`,
          width: 36,
          height: 36,
          boxSizing: 'border-box',
          borderRadius: '50%',
          background: '#ffffff',
          border: '4px solid rgba(222,228,255,0.96)',
          transform: 'translate(-50%, -50%)',
          cursor: 'grab',
          pointerEvents: disabled ? 'none' : 'auto',
          touchAction: 'none',
        }}
      />
    </div>
  )
}

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

export default function M4New() {
  const proxy = useRef({ scale: MIN_EARTH_SCALE, orbitOpacity: 1 })
  const started = useRef(false)
  const progressRef = useRef(0)
  const [orbitProgress, setOrbitProgress] = useState(0)
  const [orbitOpacity, setOrbitOpacity] = useState(1)
  const [orbitLocked, setOrbitLocked] = useState(false)
  const [orbitVisible, setOrbitVisible] = useState(true)

  const handleProgressChange = useCallback((progress) => {
    progressRef.current = progress
    setOrbitProgress(progress)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (progressRef.current < 0.98 || started.current) return
    started.current = true
    setOrbitLocked(true)
    handleProgressChange(1)
    gsap.to(proxy.current, {
      scale: EXPANDED_EARTH_SCALE,
      orbitOpacity: 0,
      duration: 1.1,
      ease: 'power3.inOut',
      onUpdate() {
        setOrbitOpacity(proxy.current.orbitOpacity)
      },
      onComplete() {
        setOrbitVisible(false)
      },
    })
  }, [handleProgressChange])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {orbitVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <OrbitBackdrop opacity={orbitOpacity * 0.9} />
        </div>
      )}

      <Canvas
        camera={{ position: [0, 1.4, 3.2], fov: 44 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}
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

      {orbitVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, opacity: orbitOpacity }}>
          <OrbitControl
            progress={orbitProgress}
            disabled={orbitLocked}
            onProgressChange={handleProgressChange}
            onDragEnd={handleDragEnd}
          />
        </div>
      )}
    </div>
  )
}
