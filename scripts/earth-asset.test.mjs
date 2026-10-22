import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function readGlb(name) {
  const bytes = readFileSync(new URL(`../public/${name}`, import.meta.url))
  assert.equal(bytes.readUInt32LE(0), 0x46546c67)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  const jsonLength = bytes.readUInt32LE(12)
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  const binary = bytes.subarray(28 + jsonLength)
  const viewBytes = (view) => binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)
  return { bytes, document, binary, viewBytes }
}

test('optimized Earth preserves geometry, materials and scene while reducing download size', () => {
  const original = readGlb('earth globe 3d model.glb')
  const optimized = readGlb('earth-optimized.glb')
  assert(optimized.bytes.length < original.bytes.length * 0.3)
  for (const key of ['accessors', 'meshes', 'materials', 'nodes', 'scenes', 'textures', 'samplers']) {
    assert.deepEqual(optimized.document[key], original.document[key], key)
  }
  const imageViews = new Set(original.document.images.map((image) => image.bufferView))
  original.document.bufferViews.forEach((view, index) => {
    const packedView = optimized.document.bufferViews[index]
    assert.equal(packedView.byteOffset % 4, 0)
    assert(packedView.byteOffset + packedView.byteLength <= optimized.binary.length)
    if (!imageViews.has(index)) {
      assert.deepEqual(optimized.viewBytes(packedView), original.viewBytes(view), `geometry buffer ${index}`)
    }
  })
})
