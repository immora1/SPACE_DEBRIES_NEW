import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MATERIAL_COMPONENTS,
  MATERIAL_OPTIONS,
  calculateMaterialBuildMetrics,
  getMaterialOption,
} from './config/materials.js'
import { resolveProductAction } from './product-actions.js'
import { applyTechnicalMetrics, createInitialGameState } from './state-reducer.js'

const BALANCED_SELECTIONS = Object.freeze({
  frame: 'aluminum',
  solar: 'silicon',
  insulation: 'kapton',
  propulsion: 'aluminum-tank',
})

const HEAVY_SELECTIONS = Object.freeze({
  frame: 'titanium',
  solar: 'silicon',
  insulation: 'ceramic',
  propulsion: 'titanium-tank',
})

function materialStory({ damageLevel = 0 } = {}) {
  return {
    current_checkpoint: 'materials',
    game_state: createInitialGameState({
      satellite: { name: 'TEST-SAT' },
      damageLevel,
    }),
  }
}

function commitMaterials(story, selections, payload = {}) {
  return resolveProductAction(story, {
    action_type: 'MATERIALS_COMMIT',
    source_id: 'satellite_build',
    action_id: 'materials_commit',
    payload: {
      ...payload,
      selections,
    },
  })
}

test('all twelve configured material option ids resolve under their component', () => {
  assert.equal(MATERIAL_COMPONENTS.length, 4)
  assert.equal(MATERIAL_OPTIONS.length, 12)

  for (const option of MATERIAL_OPTIONS) {
    assert.equal(
      getMaterialOption(option.component_id, option.option_id),
      option,
    )
  }
})

test('all material modifiers and hidden profiles match the trusted balance table', () => {
  const expected = {
    'frame/aluminum': [1, 1, 'low'],
    'frame/cfrp': [3, 0, 'medium'],
    'frame/titanium': [-2, 3, 'high'],
    'solar/silicon': [0, 1, 'medium'],
    'solar/gaas': [1, 1, 'medium'],
    'solar/flexible': [2, -1, 'low'],
    'insulation/aluminized': [1, -1, 'low'],
    'insulation/kapton': [1, 1, 'low'],
    'insulation/ceramic': [-1, 2, 'medium'],
    'propulsion/aluminum-tank': [1, 1, 'low'],
    'propulsion/composite-tank': [2, 1, 'medium'],
    'propulsion/titanium-tank': [-2, 3, 'high'],
  }

  assert.deepEqual(
    Object.fromEntries(MATERIAL_OPTIONS.map((option) => [
      `${option.component_id}/${option.option_id}`,
      [
        option.technical_effect.fuel_modifier,
        option.technical_effect.armor_modifier,
        option.technical_effect.reentry_profile,
      ],
    ])),
    expected,
  )
})

test('four material selections deterministically calculate trusted fuel and armor', () => {
  const baseMetrics = { fuel: 100, armor: 86 }
  const first = calculateMaterialBuildMetrics(HEAVY_SELECTIONS, baseMetrics)
  const second = calculateMaterialBuildMetrics(HEAVY_SELECTIONS, baseMetrics)

  assert.deepEqual(first, second)
  assert.equal(first.fuel, 95)
  assert.equal(first.armor, 95)
  assert.deepEqual(first.reentry_profiles, {
    frame: 'high',
    solar: 'medium',
    insulation: 'medium',
    propulsion: 'high',
  })
})

test('client supplied fuel armor and reentry values cannot override trusted calculation', () => {
  const resolution = commitMaterials(materialStory({ damageLevel: 20 }), BALANCED_SELECTIONS, {
    fuel: 1,
    armor: 2,
    reentryRisk: 'high',
  })

  assert.equal(resolution.gameState.technical_metrics.fuel, 100)
  assert.equal(resolution.gameState.technical_metrics.armor, 90)
  assert.equal(resolution.gameState.technical_metrics.reentry_risk, 'mixed')
  assert.deepEqual(resolution.gameState.satellite_build.material_profiles, {
    frame: 'low',
    solar: 'medium',
    insulation: 'low',
    propulsion: 'low',
  })
})

test('material armor modifiers combine with the existing M3 damage penalty', () => {
  const undamaged = commitMaterials(materialStory({ damageLevel: 0 }), HEAVY_SELECTIONS)
  const damaged = commitMaterials(materialStory({ damageLevel: 40 }), HEAVY_SELECTIONS)

  assert.equal(undamaged.gameState.technical_metrics.armor, 100)
  assert.equal(damaged.gameState.technical_metrics.armor, 81)
  assert.ok(
    damaged.gameState.technical_metrics.armor
      < undamaged.gameState.technical_metrics.armor,
  )
})

test('legacy game states without material profiles remain valid for M4 events', () => {
  const legacyState = createInitialGameState({ satellite: {}, damageLevel: 0 })
  delete legacyState.satellite_build.material_profiles

  const updated = applyTechnicalMetrics(legacyState, { fuel_delta: -3 })

  assert.deepEqual(updated.satellite_build.material_profiles, {})
  assert.equal(updated.technical_metrics.fuel, 97)
})
