import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import M4EarthModel, { M4EarthLighting } from '../M1/M4EarthModel'

// 鈹€鈹€ 鍙鍗婂緞锛堝帇缂╂槧灏勶紝闈炵湡瀹炴瘮渚嬶級鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const VR_LEO = 1.46
const VR_MEO = 2.60
const VR_GEO = 4.00

function toVisR(altKm) {
  if (altKm < 2000)  return 1.10 + ((altKm - 200)  / 1800)  * 0.28
  if (altKm < 35786) return 1.80 + ((altKm - 2000) / 33786) * 1.00
  return VR_GEO
}

// 鈹€鈹€ 鍦扮悆鏈綋 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function Earth() {
  const ref = useRef()
  useFrame((_, dt) => { ref.current.rotation.y += dt * 0.025 })
  return (
    <group ref={ref}>
      <M4EarthModel radius={1} />
    </group>
  )
}

// 鈹€鈹€ 杞ㄩ亾甯︾幆 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// active: null=榛樿 | true=楂樹寒 | false=鍙樻殫
// currentStep: 0=hover 浜や簰 | 1=鍗槦楂樹寒 | 2=浠诲姟妯″紡
function ZoneRing({ r, baseOpacity, active, tube, hexColor, currentStep }) {
  const matRef = useRef()

  let target
  if (currentStep === 1) {
    target = active === null ? baseOpacity * 0.18 : (active ? 0.72 : 0.05)
  } else if (currentStep === 2) {
    target = active === null ? baseOpacity * 0.5  : (active ? 0.75 : 0.06)
  } else {
    // step 0锛歨over 鏃舵縺娲荤幆鍏ㄤ寒锛屽叾浣欐瀬鏆楋紝瀵规瘮娓呮櫚
    target = active === null ? baseOpacity : (active ? 1.0 : 0.06)
  }

  useFrame(() => {
    if (matRef.current && Math.abs(target - matRef.current.opacity) > 0.001)
      matRef.current.opacity += (target - matRef.current.opacity) * 0.1
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[r, tube, 2, 64]} />
      <meshBasicMaterial ref={matRef} color={hexColor} transparent opacity={baseOpacity} />
    </mesh>
  )
}

// 鈹€鈹€ 鐢ㄦ埛鍗槦杞ㄩ亾 + 杩愬姩鐐?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function SatOrbit({ altKm, incDeg, currentStep }) {
  const dotRef  = useRef()
  const glowRef = useRef()
  const ang     = useRef(Math.random() * Math.PI * 2)
  const r       = toVisR(altKm)
  const inc     = (incDeg * Math.PI) / 180
  const rx      = (incDeg * Math.PI) / 180 - Math.PI / 2
  const spd     = 0.38 / Math.sqrt(r)

  const highlight = currentStep === 1

  useFrame((_, dt) => {
    ang.current += dt * spd
    const x =  r * Math.cos(ang.current)
    const y =  r * Math.sin(ang.current) * Math.sin(inc)
    const z = -r * Math.sin(ang.current) * Math.cos(inc)
    if (dotRef.current)  dotRef.current.position.set(x, y, z)
    if (glowRef.current) glowRef.current.position.set(x, y, z)
  })

  return (
    <group>
      {/* 杞ㄩ亾鐜細step 1 鏃跺姞绮楀姞浜?*/}
      <mesh rotation={[rx, 0, 0]}>
        <torusGeometry args={[r, highlight ? 0.013 : 0.007, 4, 64]} />
        <meshBasicMaterial color="#6b7fff" transparent opacity={highlight ? 1.0 : 0.88} />
      </mesh>
      {/* 鍗槦鐐?*/}
      <mesh ref={dotRef}>
        <sphereGeometry args={[highlight ? 0.044 : 0.022, 14, 14]} />
        <meshBasicMaterial color="#6b7fff" />
      </mesh>
      {/* 鍙戝厜鍏夋檿锛堜粎 step 1 鏄剧ず锛?*/}
      {highlight && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <meshBasicMaterial color="#6b7fff" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  )
}

// 鈹€鈹€ 瀵煎嚭 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export default function OrbitGlobe({
  satellite,
  height = 480,
  activeOrbit = null,
  currentStep = 0,
}) {
  const alt = satellite?.altitudeKm ?? 836
  const inc = satellite?.inclination ?? 98.7

  const leoActive = activeOrbit === null ? null : activeOrbit === 'leo'
  const meoActive = activeOrbit === null ? null : activeOrbit === 'meo'
  const geoActive = activeOrbit === null ? null : activeOrbit === 'geo'

  const [inView, setInView] = useState(false)
  const wrapRef = useRef()

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '120px' })
    if (wrapRef.current) io.observe(wrapRef.current)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrapRef} style={{ height, background: 'transparent', width: '100%' }}>
      {inView && (
        <Canvas
          frameloop="always"
          camera={{ position: [0, 2.8, 9.0], fov: 52 }}
          dpr={[1, 1]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
        <M4EarthLighting />

        <Earth />

        {/* 涓夎建閬撶幆锛氶鑹插垎鍒负钃濄€佺传銆侀潚 */}
        <ZoneRing
          r={VR_LEO} baseOpacity={0.65} active={leoActive}
          tube={0.011} hexColor="#6b7fff" currentStep={currentStep}
        />
        <ZoneRing
          r={VR_MEO} baseOpacity={0.48} active={meoActive}
          tube={0.010} hexColor="#8b6cf8" currentStep={currentStep}
        />
        <ZoneRing
          r={VR_GEO} baseOpacity={0.34} active={geoActive}
          tube={0.009} hexColor="#8b6cf8" currentStep={currentStep}
        />

        <SatOrbit altKm={alt} incDeg={inc} currentStep={currentStep} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={currentStep !== 1}
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI * 0.82}
          minPolarAngle={Math.PI * 0.18}
        />
        </Canvas>
      )}
    </div>
  )
}
