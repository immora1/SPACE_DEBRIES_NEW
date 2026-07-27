import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { messages } from './i18n/index.js'
import { AI_STORY_STAGES } from './services/aiTimeline.js'

const srcDir = dirname(fileURLToPath(import.meta.url))
const modulesDir = join(srcDir, 'modules')

const expectedStages = [
  { id: 'm1', code: 'M1', labelKey: 'nav.m1' },
  { id: 'm2', code: 'M2', labelKey: 'nav.m2' },
  { id: 'm3', code: 'M3', labelKey: 'nav.m3' },
  { id: 'm4', code: 'M4', labelKey: 'nav.m4' },
  { id: 'm5', code: 'M5', labelKey: 'nav.m5' },
  { id: 'm6', code: 'M6', labelKey: 'nav.m6' },
  { id: 'm7', code: 'M7', labelKey: 'nav.m7' },
]

test('visible navigation uses sequential module IDs and matching labels', async () => {
  const source = await readFile(join(srcDir, 'components/StageNav.jsx'), 'utf8')
  const actualStages = Array.from(source.matchAll(
    /\{ id: '([^']+)', code: '([^']+)', labelKey: '([^']+)' \}/g,
  ), ([, id, code, labelKey]) => ({ id, code, labelKey }))

  assert.deepEqual(actualStages, expectedStages)
  assert.equal(messages['nav.m2'].zh, '历史事件')
  assert.equal(messages['nav.m3'].zh, '轨道环境')
  assert.equal(messages['nav.m5'].zh, '法律边界')
})

test('application modules follow the same sequential identity', async () => {
  const source = await readFile(join(srcDir, 'App.jsx'), 'utf8')
  const moduleIds = Array.from(source.matchAll(
    /\{ id: '([^']+)', Component: M\d/g,
  ), ([, id]) => id)

  assert.deepEqual(moduleIds, expectedStages.map((stage) => stage.id))
  assert.match(source, /import\('\.\/modules\/M5'\)/)
})

test('module folder names match the content displayed in navigation', async () => {
  const folders = (await readdir(modulesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^M[1-8]$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

  assert.deepEqual(folders, ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'])
  await access(join(modulesDir, 'M2/fall-events.json'))
  await access(join(modulesDir, 'M2/M2InteractionGuide.jsx'))
  await access(join(modulesDir, 'M3/OrbitGlobe.jsx'))
  await access(join(modulesDir, 'M5/index.jsx'))
})

test('AI story stage metadata follows the renumbered module content', () => {
  assert.deepEqual(
    Object.keys(AI_STORY_STAGES),
    ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'],
  )
  assert.equal(AI_STORY_STAGES.m2.label.zh, '历史事件回溯')
  assert.equal(AI_STORY_STAGES.m3.label.zh, '卫星身份与轨道')
  assert.equal(AI_STORY_STAGES.m5.label.zh, '法律责任边界')
})
