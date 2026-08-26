import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./M4New.jsx', import.meta.url), 'utf8')
const recoveryStepsSource = source.slice(
  source.indexOf('const RECOVERY_STEPS = ['),
  source.indexOf('const MATERIAL_PART_META'),
)
const normalizedSource = source.replaceAll("\\'", "'")

test('M4 recovery intro and six steps use the current bilingual end-of-life copy', () => {
  for (const text of [
    '卫星退役流程',
    'Satellite End-of-Life Process',
    '下面以常见的无人卫星为例，了解一颗卫星完成任务后的退役过程。卫星会依次停止任务运行、关闭主要设备、处理内部残余能量，并逐步离开原来的工作轨道。轨道高度持续降低后，卫星最终进入地球大气层，大部分结构会在这一过程中解体和烧蚀，少数部件仍可能继续坠向地球。',
    'The following sequence shows a typical end-of-life process for an uncrewed satellite. After completing its mission, the satellite stops normal operations, shuts down major mission equipment, removes or secures stored energy, and gradually leaves its operational orbit. As its altitude decreases, it eventually enters Earth\'s atmosphere, where most of its structure breaks apart and ablates, although some components may survive and continue toward the surface.',
  ]) {
    assert.match(normalizedSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const text of [
    '任务完成',
    '任务结束',
    '系统关闭',
    '关闭主要设备',
    '钝化',
    '钝化处理',
    '离轨',
    '降低轨道',
    '大气层进入',
    '进入大气层',
    '烧蚀结果',
    '残片存留',
    'MISSION COMPLETE',
    'Mission Complete',
    'SYSTEM SHUTDOWN',
    'Shut Down Major Equipment',
    'PASSIVATION',
    'Passivation',
    'ORBIT LOWERING',
    'Lower the Orbit',
    'ATMOSPHERIC ENTRY',
    'Enter the Atmosphere',
    'REENTRY OUTCOME',
    'Surviving Fragments',
  ]) {
    assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(source, /highlight:\s*'钝化处理可以降低退役卫星发生爆炸或解体、继续产生新碎片的可能。'/)
  assert.match(source, /highlightEn:\s*'Passivation reduces the chance that a retired satellite will later explode or break apart and create new debris\.'/)
  assert.match(source, /highlight:\s*'进入大气层并不能保证所有卫星部件都会完全烧毁。'/)
  assert.match(source, /highlightEn:\s*'Atmospheric entry does not guarantee that every satellite component will burn up completely\.'/)
  assert.match(source, /m4-recovery-step-highlight/)
  assert.match(source, /font-weight:\s*650/)
  assert.match(source, /aria-label=\{pick\('卫星退役流程', 'Satellite End-of-Life Process'\)\}/)
  assert.doesNotMatch(source, /aria-label=\{pick\('太空卫星回收', 'Satellite recovery'\)\}/)
})

test('M4 recovery keeps six ordered cards and existing step interaction hooks', () => {
  assert.equal((source.match(/const RECOVERY_STEPS = \[/g) || []).length, 1)
  assert.equal((recoveryStepsSource.match(/img:/g) || []).length, 6)
  assert.match(source, /RECOVERY_STEPS\.map\(\(step, index\) =>/)
  assert.match(source, /pick\(step\.label, step\.labelEn\)/)
  assert.match(source, /handleStepSelect/)
  assert.match(source, /onActiveStepChange\(index\)/)
  assert.match(source, /RECOVERY_ANIMATION_STEP\.PASSIVATION/)
  assert.match(source, /RECOVERY_ANIMATION_STEP\.BREAKUP/)
})

test('M4 recovery no longer uses the superseded step wording', () => {
  for (const oldText of [
    "title: '关闭载荷'",
    "title: '降轨减速'",
    "title: '再入烧蚀'",
    "title: '残骸处置'",
    "titleEn: 'Payload shutdown'",
    "titleEn: 'Deorbit burn'",
    "titleEn: 'Atmospheric re-entry'",
    "titleEn: 'Breakup and impact'",
  ]) {
    assert.doesNotMatch(recoveryStepsSource, new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
