import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createTranslator,
  localize,
  normalizeLanguage,
} from './index.js'

test('normalizes unsupported languages to Chinese', () => {
  assert.equal(normalizeLanguage('en'), 'en')
  assert.equal(normalizeLanguage('zh'), 'zh')
  assert.equal(normalizeLanguage('fr'), 'zh')
})

test('localize falls back to the available language', () => {
  assert.equal(localize('en', '轨道环境', 'Orbital Environment'), 'Orbital Environment')
  assert.equal(localize('en', '轨道环境', ''), '轨道环境')
  assert.equal(localize('zh', '', 'Orbital Environment'), 'Orbital Environment')
})

test('translator interpolates variables and falls back to Chinese messages', () => {
  const messages = {
    greeting: { zh: '你好，{name}', en: 'Hello, {name}' },
    chineseOnly: { zh: '继续任务' },
  }
  const english = createTranslator('en', messages)

  assert.equal(english('greeting', { name: 'Ari' }), 'Hello, Ari')
  assert.equal(english('chineseOnly'), '继续任务')
  assert.equal(english('missing.key'), 'missing.key')
})
