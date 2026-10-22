import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

for (const module of ['M6', 'M8']) {
  const source = await readFile(new URL(`src/modules/${module}/index.jsx`, root), 'utf8')
  const images = [...new Set([...source.matchAll(/(?:image|img):\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))]
  test(`${module} card images exist in the deployment and have valid image signatures`, async () => {
    assert.ok(images.length > 0)
    for (const path of images) {
      const bytes = await readFile(new URL(`public${path}`, root))
      const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
      assert.ok(png || jpeg || webp, `${path} is not a supported image`)
    }
  })
  test(`${module} cleanup and observation cards stay below 300 KB per image`, async () => {
    for (const path of images.filter((path) => /^\/(cleanup|m8-game)\//.test(path))) {
      const bytes = await readFile(new URL(`public${path}`, root))
      assert.ok(bytes.length < 300_000, `${path}: ${bytes.length} bytes exceeds the card download budget`)
    }
  })
}
