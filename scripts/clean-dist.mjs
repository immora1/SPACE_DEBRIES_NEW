import { rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

if (dirname(dist) !== root || basename(dist) !== 'dist') {
  throw new Error(`Refusing to clean unexpected build directory: ${dist}`)
}

await rm(dist, {
  force: true,
  maxRetries: 3,
  recursive: true,
  retryDelay: 100,
})

console.log(`Cleaned build output: ${dist}`)
