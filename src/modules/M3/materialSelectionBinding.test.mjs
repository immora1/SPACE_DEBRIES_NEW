import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const labSource = readFileSync(new URL('./MaterialSelectionLab.jsx', import.meta.url), 'utf8')
const materialSource = readFileSync(new URL('./SceneMaterial.jsx', import.meta.url), 'utf8')
const m3Source = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8')
const m4Source = readFileSync(new URL('../M4/M4New.jsx', import.meta.url), 'utf8')
const m6Source = readFileSync(new URL('../M6/index.jsx', import.meta.url), 'utf8')

const selectionSource = labSource.slice(
  labSource.indexOf('activePart.options.map'),
  labSource.indexOf('</motion.fieldset>'),
)

test('selection cards show engineering tradeoffs without revealing re-entry profiles', () => {
  assert.match(selectionSource, /质量负担/)
  assert.match(selectionSource, /Mass burden/i)
  assert.match(selectionSource, /结构耐受/)
  assert.match(selectionSource, /Structural resilience/i)
  assert.doesNotMatch(selectionSource, /再入风险|RE-ENTRY RISK|reentry_profile|reentryProfile/)
})

test('material copy contains the requested component names and bilingual guidance', () => {
  for (const copy of [
    '主体结构',
    'Main Structure',
    '太阳能阵列',
    'Solar Array',
    '外部隔热层',
    'External Thermal Layer',
    '推进剂贮箱',
    'Propellant Tank',
    '质量负担',
    '结构耐受',
  ]) {
    assert.match(materialSource + labSource, new RegExp(copy, 'i'))
  }

  assert.match(labSource, /不同材料会改变卫星的重量和耐受能力/)
  assert.match(labSource, /Different materials change the satellite’s mass and structural resilience/)
})

test('analysis report reveals trusted initial metrics and qualitative component profiles', () => {
  assert.match(labSource, /初始燃料/)
  assert.match(labSource, /Initial Fuel/)
  assert.match(labSource, /初始护甲/)
  assert.match(labSource, /Initial Armor/)
  assert.match(labSource, /残片留下的可能性/)
  assert.match(labSource, /surviving fragments after atmospheric re-entry/)
  assert.match(labSource, /materialAnalysis\.fuel/)
  assert.match(labSource, /materialAnalysis\.armor/)
  assert.match(labSource, /materialAnalysis\.profiles/)
  assert.match(m3Source, /materialAnalysis=\{materialAnalysis\}/)
})

test('downstream M4 and M6 references use the current M3 material ids', () => {
  assert.doesNotMatch(m4Source, /来自 M2|M2 MATERIAL PROFILE/)
  for (const optionId of [
    'aluminized',
    'kapton',
    'ceramic',
    'aluminum-tank',
    'composite-tank',
    'titanium-tank',
  ]) {
    assert.match(m6Source, new RegExp(`['"]?${optionId.replace('-', '\\-')}['"]?\\s*:`))
  }
})
