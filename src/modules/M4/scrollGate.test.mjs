import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
const m4 = readFileSync(new URL('./M4New.jsx', import.meta.url), 'utf8')

test('M4 boundary limits both rendered modules and navigation until completion', () => {
  assert.match(app, /completedSet.has\('m4'\) \? allModuleIds : allModuleIds.slice\(0, 4\)/)
  assert.match(app, /MODULES.filter\(\(\{ id \}\) => availableModules.includes\(id\)\)/)
  assert.match(app, /availableModules.includes\(id\)\s*\), \[availableModules\]/)
  assert.doesNotMatch(m4, /setScrollLocked/)
})

test('recovery entry cannot complete M4 or bypass unfinished decisions', () => {
  const entry = m4.slice(m4.indexOf('const handleReflectionComplete'), m4.indexOf('const handleModuleWheel'))
  assert.doesNotMatch(entry, /unlockNextStageWithoutScroll\(\)/)
  assert.match(entry, /if \(decisions.length < TOTAL_ROUNDS\)/)
  assert.match(m4, /viewedRecoverySteps.length === RECOVERY_STEPS.length\s*&& decisions.length >= TOTAL_ROUNDS/)
  assert.match(m4, /if \(!recoveryComplete \|\| completionUnlocked.current\) return/)
  assert.match(m4, /BREAKUP_FALL_DURATION \* 1000/)
  assert.match(m4, /disabled=\{!canComplete\} onClick=\{onComplete\}/)
})
