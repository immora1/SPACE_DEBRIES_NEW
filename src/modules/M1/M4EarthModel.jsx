import { Component, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import useI18n from '../../i18n/useI18n'

const EARTH_GLB = '/earth-optimized.glb'

function cloneMaterial(material) {
  if (!material) return material
  const cloned = material.clone()
  cloned.depthWrite = true
  return cloned
}

function EarthStatus({ radius, status, onRetry }) {
  const { pick } = useI18n()
  const failed = status === 'failed'
  return (
    <group>
      <mesh visible={status !== 'ready'}>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshStandardMaterial color="#53658a" wireframe />
      </mesh>
      <Html center style={{ display: status === 'ready' ? 'none' : 'block' }}>
        <div style={{ color: '#fff', background: '#10182ee6', padding: '10px 16px', whiteSpace: 'nowrap', fontSize: 13 }} role="status">
          {failed ? pick('模型加载失败', 'Model failed to load') : pick('正在加载地球模型…', 'Loading Earth…')}
          {failed && <button type="button" onClick={onRetry} style={{ marginLeft: 12, pointerEvents: 'auto' }}>{pick('重试', 'Retry')}</button>}
        </div>
      </Html>
    </group>
  )
}

class EarthBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function M4EarthModel({ radius = 1 }) {
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)
  const onLoad = useCallback(() => setStatus('ready'), [])
  const onError = useCallback(() => setStatus('failed'), [])
  return (
    <>
      <EarthStatus radius={radius} status={status} onRetry={() => {
        useGLTF.clear(EARTH_GLB)
        setStatus('loading')
        setAttempt((current) => current + 1)
      }} />
      <EarthBoundary key={attempt} onError={onError}>
        <Suspense fallback={null}>
          <LoadedEarth radius={radius} onLoad={onLoad} />
        </Suspense>
      </EarthBoundary>
    </>
  )
}

function LoadedEarth({ radius, onLoad }) {
  const { scene } = useGLTF(EARTH_GLB)
  useEffect(onLoad, [onLoad])

  const normalizedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      if (!object.isMesh || !object.material) return
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
    })

    const bounds = new THREE.Box3().setFromObject(clone)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z) || 1
    const scale = (radius * 2) / maxSize

    clone.position.copy(center).multiplyScalar(-scale)
    clone.scale.setScalar(scale)
    return clone
  }, [radius, scene])

  return <primitive object={normalizedScene} />
}

export function M4EarthLighting() {
  return (
    <>
      <ambientLight intensity={2.4} />
      <directionalLight position={[4, 3, 4]} intensity={4.2} color="#c8d8f0" />
      <directionalLight position={[-3, 1, -2]} intensity={1.35} color="#8899cc" />
      <pointLight position={[0, 4, 2]} intensity={2.2} color="#ffffff" />
    </>
  )
}

useGLTF.preload(EARTH_GLB)
