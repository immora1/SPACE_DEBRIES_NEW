import { useRef, Suspense } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'

// 3D corner-tick targeting frame — 8 corners each with 3-axis ticks
function TargetBox({ size, color, opacity = 0.88 }) {
  const [w, h, d] = size
  const hw = w / 2, hh = h / 2, hd = d / 2
  const t = Math.min(hw, hh, hd) * 0.52

  // [corner x,y,z] [x-sign] [y-sign] [z-sign (inward)]
  const corners = [
    [-hw,  hh,  hd,  1, -1, -1],
    [ hw,  hh,  hd, -1, -1, -1],
    [-hw, -hh,  hd,  1,  1, -1],
    [ hw, -hh,  hd, -1,  1, -1],
    [-hw,  hh, -hd,  1, -1,  1],
    [ hw,  hh, -hd, -1, -1,  1],
    [-hw, -hh, -hd,  1,  1,  1],
    [ hw, -hh, -hd, -1,  1,  1],
  ]

  return (
    <>
      {corners.map(([cx, cy, cz, sx, sy, sz], i) => (
        <group key={i}>
          {/* X + Y tick — L-shape in XY plane */}
          <Line
            points={[
              [cx + sx * t, cy, cz],
              [cx,          cy, cz],
              [cx, cy + sy * t, cz],
            ]}
            color={color}
            lineWidth={1.6}
            transparent
            opacity={opacity}
          />
          {/* Z tick — depth axis */}
          <Line
            points={[
              [cx, cy, cz],
              [cx, cy, cz + sz * t],
            ]}
            color={color}
            lineWidth={1.6}
            transparent
            opacity={opacity * 0.7}
          />
        </group>
      ))}
    </>
  )
}

const ZH   = "'PingFang SC', 'Microsoft YaHei', sans-serif"
const MONO = "'Space Mono', monospace"
const LEX  = "'Lexend', sans-serif"

// Pre-generated at module level — stable across renders, no recomputation
const N = 2000
const DEBRIS = Array.from({ length: N }, () => {
  const layer = Math.random()
  let radius, phi

  if (layer < 0.65) {
    radius = 1.58 + Math.random() * 0.30
    phi    = (Math.random() - 0.5) * Math.PI
  } else if (layer < 0.85) {
    radius = 2.55 + Math.random() * 0.65
    phi    = (Math.random() - 0.5) * Math.PI
  } else {
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
    color: layer < 0.65 ? '#c8d0f8' : layer < 0.85 ? '#8b9fff' : '#6b7fff',
  }
})

// Annotation targets — in debrisRef local space (rotate with debris, occluded by Earth)
const ANNOTS = [
  {
    value: '28,000', unit: 'km/h',
    label: '平均碰撞速度', sub: '子弹速度的 10 倍',
    color: '#c8d0f8',
    boxPos:   [-1.0, 1.15, 0.95],  // LEO upper-left-front, r ≈ 1.74
    labelPos: [-2.0,  1.65, 0.95], // label further out
    boxSize:  [0.30, 0.20, 0.20],
  },
  {
    value: '~1.3亿', unit: '',
    label: '在轨碎片总量', sub: '大多无法追踪',
    color: '#8b9fff',
    boxPos:   [2.1, 0.25, 1.75],   // MEO right-front, r ≈ 2.83
    labelPos: [3.05, 0.45, 1.75],  // label further right
    boxSize:  [0.32, 0.22, 0.22],
  },
  {
    value: '36,500+', unit: '',
    label: '可追踪目标', sub: '雷达编目在册',
    color: '#f87171',
    boxPos:   [-0.55, -1.42, 0.92],  // LEO lower-front, r ≈ 1.77
    labelPos: [-1.3,  -2.0,  0.92],  // label lower-left
    boxSize:  [0.28, 0.20, 0.20],
  },
]

function EarthScene({ showAnnotations }) {
  const earthRef  = useRef()
  const debrisRef = useRef()
  const earthTex  = useLoader(THREE.TextureLoader, '/earth_borders.png')

  useFrame((_, delta) => {
    if (earthRef.current)  earthRef.current.rotation.y  += delta * 0.055
    if (debrisRef.current) debrisRef.current.rotation.y += delta * 0.018
  })

  return (
    <group position={[1.8, -0.1, 0]}>
      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial map={earthTex} color="#b8c4ff" />
      </mesh>

      {/* Inner atmosphere glow */}
      <mesh scale={1.055}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#3344cc" side={THREE.BackSide} transparent opacity={0.22} />
      </mesh>

      {/* Outer halo */}
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

      {/* Debris field + annotation boxes — all rotate together */}
      <group ref={debrisRef}>
        {DEBRIS.map((d, i) => (
          <mesh key={i} position={d.pos} rotation={d.rot} scale={d.scale}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={d.color} />
          </mesh>
        ))}

        {/* Annotations: rendered when scene 1 is active, occluded by Earth */}
        {showAnnotations && ANNOTS.map((a, i) => (
          <group key={`annot-${i}`}>
            {/* Corner-tick targeting frame */}
            <group position={a.boxPos}>
              <TargetBox size={a.boxSize} color={a.color} />
            </group>

            {/* Connector line: box → label */}
            <Line
              points={[a.boxPos, a.labelPos]}
              color={a.color}
              lineWidth={2.5}
              transparent
              opacity={0.55}
            />

            {/* HTML label — occlude=true raycasts against all scene meshes */}
            <Html
              position={a.labelPos}
              occlude
              distanceFactor={10}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div style={{ transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
                <div style={{
                  fontFamily: MONO, fontSize: 52, fontWeight: 700,
                  color: a.color, letterSpacing: '-0.02em', lineHeight: 1,
                  display: 'flex', alignItems: 'baseline', gap: 6,
                }}>
                  {a.value}
                  {a.unit && (
                    <span style={{ fontFamily: LEX, fontSize: 13, color: a.color, letterSpacing: '0.10em', opacity: 0.8 }}>
                      {a.unit}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: ZH, fontSize: 15, color: 'rgba(232,232,248,0.60)', marginTop: 6, lineHeight: 1.4 }}>
                  {a.label}
                </div>
                <div style={{ fontFamily: ZH, fontSize: 12, color: 'rgba(107,127,255,0.45)', marginTop: 3 }}>
                  {a.sub}
                </div>
              </div>
            </Html>
          </group>
        ))}
      </group>
    </group>
  )
}

export default function DebrisEarth({ showAnnotations = false }) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 8.5], fov: 52 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <EarthScene showAnnotations={showAnnotations} />
      </Suspense>
    </Canvas>
  )
}
