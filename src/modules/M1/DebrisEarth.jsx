import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import M4EarthModel, { M4EarthLighting } from './M4EarthModel'
import useI18n from '../../i18n/useI18n'

const DEBRIS_COUNT = 2000

// Generated once so the debris field remains stable across React renders.
const DEBRIS = Array.from({ length: DEBRIS_COUNT }, () => {
  const layer = Math.random()
  let radius
  let phi

  if (layer < 0.65) {
    radius = 1.58 + Math.random() * 0.3
    phi = (Math.random() - 0.5) * Math.PI
  } else if (layer < 0.85) {
    radius = 2.55 + Math.random() * 0.65
    phi = (Math.random() - 0.5) * Math.PI
  } else {
    radius = 4.45 + Math.random() * 0.12
    phi = (Math.random() - 0.5) * 0.14
  }

  const theta = Math.random() * Math.PI * 2

  return {
    pos: [
      radius * Math.cos(theta) * Math.cos(phi),
      radius * Math.sin(phi),
      radius * Math.sin(theta) * Math.cos(phi),
    ],
    rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    scale: 0.004 + Math.random() * 0.008,
    color: layer < 0.65 ? '#c8d0f8' : layer < 0.85 ? '#8b9fff' : '#6b7fff',
  }
})

// targetPos is deliberately outside the Earth (radius 1) and inside a debris belt.
const ANNOTATIONS = [
  {
    value: '28,000 km/h',
    eyebrow: 'COLLISION VELOCITY',
    label: '平均碰撞速度',
    labelEn: 'Average collision speed',
    sub: '子弹速度的 10 倍',
    subEn: 'About 10x a bullet speed',
    color: '#cbd3ff',
    targetPos: [-1.25, 1.05, 1.05],
    labelPos: [-2.0, 1.72, 1.15],
    direction: 1,
    flowSpeed: 0.42,
  },
  {
    value: '~1.3亿',
    valueEn: '~130M',
    eyebrow: 'UNTRACKED OBJECTS',
    label: '在轨碎片总量',
    labelEn: 'Estimated orbital fragments',
    sub: '大多无法追踪',
    subEn: 'Most cannot be tracked',
    color: '#8b9fff',
    targetPos: [1.48, 0.52, 1.02],
    labelPos: [2.58, 1.02, 1.22],
    direction: 1,
    flowSpeed: 0.34,
  },
  {
    value: '36,500+',
    eyebrow: 'CATALOGUED TARGETS',
    label: '雷达可追踪目标',
    labelEn: 'Radar-trackable objects',
    sub: '编目在册',
    subEn: 'Catalogued targets',
    color: '#f87171',
    targetPos: [-0.72, -1.52, 0.92],
    labelPos: [-1.92, -2.12, 1.08],
    direction: -1,
    flowSpeed: 0.38,
  },
]

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

function DebrisSelectionVolume({ position, color, index }) {
  const rotation = [0.18 + index * 0.1, -0.34 + index * 0.14, 0.12 - index * 0.06]
  const cloudGeometry = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 26, 18)
    const positions = geometry.attributes.position
    const phase = index * 1.73
    const vertex = new THREE.Vector3()

    for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
      vertex.fromBufferAttribute(positions, vertexIndex)
      const normal = vertex.clone().normalize()
      const broadFold = Math.sin(normal.x * 3.4 + phase) * Math.cos(normal.y * 2.8 - phase * 0.4)
      const fineFold = Math.sin(normal.z * 5.2 - phase) * Math.sin(normal.y * 4.1 + normal.x)
      const sideBulge = Math.cos((normal.x - normal.z) * 2.6 + phase * 0.7)
      const radius = 1 + broadFold * 0.16 + fineFold * 0.075 + sideBulge * 0.055

      positions.setXYZ(
        vertexIndex,
        vertex.x * radius * (1 + normal.x * 0.08),
        vertex.y * radius,
        vertex.z * radius * (1 - normal.x * 0.04),
      )
    }

    positions.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [index])

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={cloudGeometry} scale={[0.36, 0.255, 0.235]}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.17}
          roughness={0.92}
          metalness={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function MinimalAnnotation({ annotation, index, reducedMotion, labelDivRefs, labelDotRefs }) {
  const dashRef = useRef(null)
  const { color, direction, eyebrow, flowSpeed, label, labelPos, sub, targetPos, value } = annotation
  const connectorVector = new THREE.Vector3(...labelPos).sub(new THREE.Vector3(...targetPos)).normalize()
  const connectorTarget = new THREE.Vector3(...targetPos)
    .addScaledVector(connectorVector, 0.38)
    .toArray()

  useFrame((_, delta) => {
    if (reducedMotion || !dashRef.current?.material) return
    dashRef.current.material.dashOffset -= delta * flowSpeed
  })

  return (
    <group>
      {/* A single straight connector: data label -> debris-region anchor. */}
      <Line
        points={[labelPos, connectorTarget]}
        color={color}
        lineWidth={0.65}
        transparent
        opacity={0.2}
      />
      <Line
        ref={dashRef}
        points={[labelPos, connectorTarget]}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.52}
        dashed
        dashSize={0.08}
        gapSize={0.2}
      />

      {/* A translucent cloud volume plus eight spatial corners selects a debris cluster. */}
      <DebrisSelectionVolume position={targetPos} color={color} index={index} />

      <mesh position={labelPos} ref={(element) => { labelDotRefs.current[index] = element }}>
        <circleGeometry args={[0.043, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      <Html
        position={labelPos}
        distanceFactor={10}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          ref={(element) => { labelDivRefs.current[index] = element }}
          style={{
            width: 210,
            whiteSpace: 'nowrap',
            textAlign: direction > 0 ? 'left' : 'right',
            transform: direction > 0
              ? 'translate(14px, -50%)'
              : 'translate(calc(-100% - 14px), -50%)',
          }}
        >
          <div style={{
            color,
            fontFamily: "'Space Mono', monospace",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: '0.16em',
            opacity: 0.58,
          }}>
            {eyebrow}
          </div>
          <div style={{
            color,
            fontFamily: "'Space Mono', monospace",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.08,
            marginTop: 3,
          }}>
            {value}
          </div>
          <div style={{
            width: 72,
            height: 1,
            marginTop: 6,
            marginBottom: 7,
            marginLeft: direction > 0 ? 0 : 'auto',
            background: color,
            opacity: 0.38,
          }} />
          <div style={{
            color: 'rgba(232,232,248,0.86)',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: 12,
            fontWeight: 600,
          }}>
            {label}
          </div>
          <div style={{
            color: 'rgba(143,150,189,0.72)',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: 8,
            marginTop: 3,
          }}>
            {sub}
          </div>
        </div>
      </Html>
    </group>
  )
}

function EarthScene({ showAnnotations, reducedMotion, language }) {
  const earthRef = useRef(null)
  const debrisRef = useRef(null)
  const labelDivRefs = useRef([])
  const labelDotRefs = useRef([])

  const earthCenter = useRef(new THREE.Vector3())
  const labelWorldPos = useRef(new THREE.Vector3())
  const cameraToLabel = useRef(new THREE.Vector3())
  const cameraToEarth = useRef(new THREE.Vector3())
  const closestPoint = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    if (!reducedMotion) {
      if (earthRef.current) earthRef.current.rotation.y += delta * 0.055
      if (debrisRef.current) debrisRef.current.rotation.y += delta * 0.018
    }

    if (!showAnnotations || !debrisRef.current || !earthRef.current) return

    earthRef.current.getWorldPosition(earthCenter.current)

    ANNOTATIONS.forEach((annotation, index) => {
      labelWorldPos.current.set(...annotation.labelPos).applyMatrix4(debrisRef.current.matrixWorld)
      cameraToLabel.current.copy(labelWorldPos.current).sub(state.camera.position)

      const labelDistance = cameraToLabel.current.length()
      cameraToLabel.current.normalize()

      cameraToEarth.current.copy(earthCenter.current).sub(state.camera.position)
      const earthDistanceAlongRay = cameraToEarth.current.dot(cameraToLabel.current)
      closestPoint.current
        .copy(state.camera.position)
        .addScaledVector(cameraToLabel.current, earthDistanceAlongRay)

      const distanceFromEarth = closestPoint.current.distanceTo(earthCenter.current)
      let visibility = 1

      if (earthDistanceAlongRay > 0 && earthDistanceAlongRay < labelDistance) {
        const hiddenRadius = 0.76
        const fadeRadius = 1.08
        if (distanceFromEarth <= hiddenRadius) visibility = 0
        else if (distanceFromEarth < fadeRadius) {
          visibility = (distanceFromEarth - hiddenRadius) / (fadeRadius - hiddenRadius)
        }
      }

      if (labelDivRefs.current[index]) labelDivRefs.current[index].style.opacity = visibility

      const dotMaterial = labelDotRefs.current[index]?.material
      if (dotMaterial) dotMaterial.opacity = visibility * 0.9
    })
  })

  return (
    <group position={[1.8, -0.1, 0]}>
      <group ref={earthRef}>
        <M4EarthModel radius={1} />
      </group>

      {/* A plain atmosphere shell; no glow filters or animated halo. */}
      <mesh scale={1.18}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color="#6b7fff" side={THREE.BackSide} transparent opacity={0.035} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.72, 0.002, 6, 128]} />
        <meshBasicMaterial color="#c8d0f8" transparent opacity={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2.3, 0.18, 0]}>
        <torusGeometry args={[2.87, 0.002, 6, 128]} />
        <meshBasicMaterial color="#8b9fff" transparent opacity={0.065} />
      </mesh>
      <mesh rotation={[Math.PI / 2.1, -0.08, 0]}>
        <torusGeometry args={[4.51, 0.002, 6, 128]} />
        <meshBasicMaterial color="#6b7fff" transparent opacity={0.045} />
      </mesh>

      <group ref={debrisRef}>
        {DEBRIS.map((debris, index) => (
          <mesh key={index} position={debris.pos} rotation={debris.rot} scale={debris.scale}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={debris.color} />
          </mesh>
        ))}

        {showAnnotations && ANNOTATIONS.map((annotation, index) => (
          <MinimalAnnotation
            key={annotation.eyebrow}
            annotation={language === 'en' ? {
              ...annotation,
              value: annotation.valueEn || annotation.value,
              label: annotation.labelEn || annotation.label,
              sub: annotation.subEn || annotation.sub,
            } : annotation}
            index={index}
            reducedMotion={reducedMotion}
            labelDivRefs={labelDivRefs}
            labelDotRefs={labelDotRefs}
          />
        ))}
      </group>
    </group>
  )
}

export default function DebrisEarth({ showAnnotations = false }) {
  const { language } = useI18n()
  const [inView, setInView] = useState(false)
  const wrapRef = useRef(null)
  const reducedMotion = useReducedMotionPreference()

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: '120px',
    })

    if (wrapRef.current) observer.observe(wrapRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="m1-earth-stage">
      {inView && (
        <Canvas
          frameloop="always"
          camera={{ position: [0, 0.3, 8.5], fov: 52 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          className="m1-earth-canvas"
        >
          <M4EarthLighting />
          <Suspense fallback={null}>
            <EarthScene showAnnotations={showAnnotations} reducedMotion={reducedMotion} language={language} />
          </Suspense>
        </Canvas>
      )}
    </div>
  )
}
