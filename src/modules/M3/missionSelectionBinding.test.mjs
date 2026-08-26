import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { MISSION_OPTIONS } from '../../../functions/_story/config/missions.js'

const deckSource = await readFile(new URL('./MissionSelectionDeck.jsx', import.meta.url), 'utf8')

test('mission copy is bilingual and every card exposes the same required fields', () => {
  for (const mission of MISSION_OPTIONS) {
    for (const field of [
      'label',
      'label_en',
      'objective',
      'objective_en',
      'operation',
      'operation_en',
      'examples',
      'examples_en',
      'mission_effect',
      'mission_effect_en',
    ]) {
      assert.equal(typeof mission[field], 'string', `${mission.mission_id}.${field}`)
      assert.ok(mission[field].trim().length > 0, `${mission.mission_id}.${field}`)
    }
  }
})

test('mission selection heading removes internal product wording', () => {
  assert.match(deckSource, /04 · 任务选择/)
  assert.match(deckSource, /04 · MISSION SELECTION/)
  assert.match(deckSource, /每颗卫星都有自己的任务，而任务决定它需要去哪里、如何运行。/)
  assert.match(deckSource, /Every satellite is built for a specific purpose/)
  assert.doesNotMatch(deckSource, /M4 游戏/)
  assert.doesNotMatch(deckSource, /second consequential choice/i)
  assert.doesNotMatch(deckSource, /第二个有后果的选择/)
})

test('mission card renders objective operation orbit altitude examples and effect', () => {
  for (const token of [
    'mission.objective',
    'mission.operation',
    'mission.orbit_profile',
    'mission.examples',
    'mission.mission_effect',
  ]) {
    assert.match(deckSource, new RegExp(token.replaceAll('.', '\\.')))
  }
})

