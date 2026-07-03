import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const EARTH_GLB = '/earth%20globe%203d%20model.glb'

function cloneMaterial(material) {
  if (!material) return material
  const cloned = material.clone()
  cloned.depthWrite = true
  return cloned
}

export default function M4EarthModel({ radius = 1 }) {
  const { scene } = useGLTF(EARTH_GLB)

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
