import { useRef, Suspense } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Text, Html, Line, Billboard } from '@react-three/drei'
import * as THREE from 'three'

const MONO_FONT = '/fonts/SpaceMono-Bold.woff2'
const CJK_FONT  = '/fonts/NotoSansSC-subset.woff2'

// 3D corner-tick targeting frame — 8 corners each with 3-axis ticks
function TargetBox({ size, color, opacity = 0.88 }) {
  const [w, h, d] = size
  const hw = w / 2, hh = h / 2, hd = d / 2
  const t = Math.min(hw, hh, hd) * 0.52

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

// Pre-generated at module level — stable across renders
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

const ANNOTS = [
  {
    value: '28,000', unit: ' km/h', valueFont: MONO_FONT,
    label: '平均碰撞速度', sub: '子弹速度的 10 倍',
    color: '#c8d0f8',
    boxPos:   [-1.0,  1.15,  0.95],
    labelPos: [-2.0,  1.65,  0.95],
    boxSize:  [0.30,  0.20,  0.20],
    dir: -1,   // shoulder extends in -x direction, text anchors right
  },
  {
    value: '~1.3亿', unit: '', valueFont: CJK_FONT,
    label: '在轨碎片总量', sub: '大多无法追踪',
    color: '#8b9fff',
    boxPos:   [ 2.1,  0.25,  1.75],
    labelPos: [ 3.05, 0.45,  1.75],
    boxSize:  [0.32,  0.22,  0.22],
    dir: 1,    // shoulder extends in +x direction, text anchors left
  },
  {
    value: '36,500+', unit: '', valueFont: MONO_FONT,
    label: '可追踪目标', sub: '雷达编目在册',
    color: '#f87171',
    boxPos:   [-0.55, -1.42,  0.92],
    labelPos: [-1.3,  -2.0,   0.92],
    boxSize:  [0.28,  0.20,  0.20],
    dir: -1,   // shoulder extends in -x direction, text anchors right
  },
]


function EarthScene({ showAnnotations }) {
  const earthRef    = useRef()
  const debrisRef   = useRef()
  const earthTex    = useLoader(THREE.TextureLoader, '/earth_borders.png')

  // Refs for 3D Text meshes (value) — fillOpacity set directly, no re-render
  const valueRefs   = useRef([null, null, null])
  // Refs for HTML label divs — style.opacity set directly
  const labelDivRefs = useRef([null, null, null])

  // Reusable vectors — avoid GC per frame
  const _ec = useRef(new THREE.Vector3())
  const _lp = useRef(new THREE.Vector3())
  const _tl = useRef(new THREE.Vector3())
  const _te = useRef(new THREE.Vector3())
  const _cp = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    if (earthRef.current)  earthRef.current.rotation.y  += delta * 0.055
    if (debrisRef.current) debrisRef.current.rotation.y += delta * 0.018

    if (!showAnnotations || !debrisRef.current || !earthRef.current) return
    earthRef.current.getWorldPosition(_ec.current)
    const R     = 1.0
    const camera = state.camera

    ANNOTS.forEach((a, i) => {
      _lp.current.set(...a.labelPos).applyMatrix4(debrisRef.current.matrixWorld)
      _tl.current.copy(_lp.current).sub(camera.position)
      const distToLabel = _tl.current.length()
      _tl.current.normalize()

      _te.current.copy(_ec.current).sub(camera.position)
      const tEarth = _te.current.dot(_tl.current)
      _cp.current.copy(camera.position).addScaledVector(_tl.current, tEarth)
      const perpDist = _cp.current.distanceTo(_ec.current)

      let occ = 1
      if (tEarth > 0 && tEarth < distToLabel) {
        const inner = R * 0.76
        const outer = R * 1.06
        if (perpDist <= inner)      occ = 0
        else if (perpDist < outer)  occ = (perpDist - inner) / (outer - inner)
      }

      // 3D Text — direct property mutation, no React re-render
      if (valueRefs.current[i]) valueRefs.current[i].fillOpacity = occ

      // HTML labels — direct DOM mutation
      if (labelDivRefs.current[i]) labelDivRefs.current[i].style.opacity = occ
    })
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

      {/* Debris + annotations — all rotate together */}
      <group ref={debrisRef}>
        {DEBRIS.map((d, i) => (
          <mesh key={i} position={d.pos} rotation={d.rot} scale={d.scale}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={d.color} />
          </mesh>
        ))}

        {showAnnotations && ANNOTS.map((a, i) => (
          <group key={`annot-${i}`}>
            {/* 3D corner-tick targeting frame */}
            <group position={a.boxPos}>
              <TargetBox size={a.boxSize} color={a.color} />
            </group>

            {/* Connector line: debris region → terminus dot */}
            <Line
              points={[a.boxPos, a.labelPos]}
              color={a.color}
              lineWidth={1.6}
              transparent
              opacity={0.42}
            />

            {/* Terminus dot — visible anchor where line ends and number begins */}
            <mesh position={a.labelPos}>
              <sphereGeometry args={[0.038, 8, 8]} />
              <meshBasicMaterial color={a.color} transparent opacity={0.88} />
            </mesh>

            {/* Value — Billboard at labelPos, vertically centered on terminus dot */}
            <Billboard position={a.labelPos}>
              <Text
                ref={el => { valueRefs.current[i] = el }}
                anchorX={a.dir > 0 ? 'left' : 'right'}
                anchorY="middle"
                fontSize={0.44}
                color={a.color}
                outlineWidth="3.5%"
                outlineColor={a.color}
                fillOpacity={1}
              >
                {a.value}{a.unit}
              </Text>
            </Billboard>

            {/* Label + sub — Html at SAME XZ as labelPos so it tracks with the number */}
            <Html
              position={[a.labelPos[0], a.labelPos[1] - 0.38, a.labelPos[2]]}
              distanceFactor={10}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                ref={el => { labelDivRefs.current[i] = el }}
                style={{
                  whiteSpace: 'nowrap', transition: 'opacity 0.1s linear',
                  textAlign: a.dir > 0 ? 'left' : 'right',
                }}
              >
                <div style={{
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  fontSize: 15, fontWeight: 500,
                  color: 'rgba(232,232,248,0.85)',
                  textShadow: '0 1px 8px rgba(4,4,15,0.95)',
                  lineHeight: 1.4,
                }}>
                  {a.label}
                </div>
                <div style={{
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  fontSize: 12,
                  color: 'rgba(180,190,255,0.68)',
                  textShadow: '0 1px 6px rgba(4,4,15,0.95)',
                  marginTop: 3,
                }}>
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
