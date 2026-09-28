import assert from 'node:assert/strict'
import test from 'node:test'
import { ORBITAL_EVENTS } from '../../../functions/_story/config/orbital-events.js'
import { TOTAL_ORBITAL_EVENTS } from '../../../functions/_story/constants.js'
import { pickEvents, localizeThreatEvent, evaluateResult } from './gameData.js'

test('each game contains three ordered decisions with shared effects and translated feedback', () => {
  assert.equal(TOTAL_ORBITAL_EVENTS, 3)
  for (const count of [undefined, 3, 6]) {
    const events = pickEvents(60, ['2003 太阳风暴'], count)
    assert.deepEqual(events.map(event => event.id), ['debris_close', 'solar_flare', 'end_of_life'])
    for (const [index, event] of events.entries()) {
      assert.equal(event.options.length, 3)
      for (const [answer, option] of event.options.entries()) {
        const effect = ORBITAL_EVENTS[index].options[answer].technical_effect
        assert.deepEqual([option.armorDelta, option.fuelDelta, option.missionDelta],
          [effect.armor_delta, effect.fuel_delta, effect.mission_progress_delta])
        assert.notEqual(localizeThreatEvent(event, 'en').options[answer].techNote, option.techNote)
      }
    }
  }
})

test('all 27 answer paths finish with finite resources and preserve meaningful outcomes', () => {
  const events = pickEvents()
  const outcomes = []
  for (const first of events[0].options) for (const second of events[1].options) for (const last of events[2].options) {
    const state = { armor: 100, fuel: 100, missionProgress: 0 }
    for (const option of [first, second, last]) {
      for (const [key, delta] of [['armor', option.armorDelta], ['fuel', option.fuelDelta], ['missionProgress', option.missionDelta]]) {
        state[key] = Math.max(0, Math.min(100, state[key] + delta))
        assert.ok(Number.isFinite(state[key]))
      }
    }
    outcomes.push(evaluateResult(state))
  }
  assert.equal(outcomes.length, 27)
  assert.equal(outcomes[0], 'success')
  assert.equal(outcomes.at(-1), 'failure')
})
