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
  assert.doesNotMatch(entry, /handleNextChapter\(\)/)
  assert.match(entry, /if \(decisions.length < TOTAL_ROUNDS\)/)
  assert.match(m4, /recoveryStepsVisible\s*&& decisions.length >= TOTAL_ROUNDS/)
})

test('recovery next chapter is available without watching all six steps and scrolls forward', () => {
  assert.doesNotMatch(m4, /viewedRecoverySteps.length === RECOVERY_STEPS.length/)
  assert.match(m4, /<button className="m4-game-continue" onClick=\{onComplete\}>\s*\{pick\('下一章', 'NEXT CHAPTER'\)\}/)
  const next = m4.slice(m4.indexOf('const handleNextChapter'), m4.indexOf('const handleReflectionComplete'))
  assert.match(next, /if \(!canContinueRecovery\) return/)
  assert.match(next, /onComplete\(\)/)
  assert.doesNotMatch(next, /autoScroll: false|viewedRecoverySteps/)
})
