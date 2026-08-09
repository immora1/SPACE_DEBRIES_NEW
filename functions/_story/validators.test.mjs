import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CanonicalStoryUserInputSchema } from './schemas.js'
import {
  DEFAULT_CONTINUE_OUTPUT,
  VALID_OPENING_FIXTURE,
  VALID_OUTLINE_FIXTURE,
} from './fixtures.js'
import {
  validateStoryContinue,
  validateStoryOpening,
  validateStoryOutline,
} from './validators.js'

const packageRoot = resolve('docs/space_debris_outline_opening_v0.4')
const validationCases = JSON.parse(
  await readFile(resolve(packageRoot, 'fixtures/validation_cases.json'), 'utf8'),
)
const userInputFixture = JSON.parse(
  await readFile(resolve(packageRoot, 'fixtures/story_user_input.valid.json'), 'utf8'),
)

function clone(value) {
  return structuredClone(value)
}

function expectCode(run, code) {
  assert.throws(run, (error) => error.code === code)
}

test('全部 v0.4 fixtures 可读，合法输入、Outline 与 Opening 通过', () => {
  assert.equal(validationCases.outline_mutation_cases.length, 6)
  assert.equal(validationCases.opening_mutation_cases.length, 6)
  assert.deepEqual(CanonicalStoryUserInputSchema.parse(userInputFixture), userInputFixture)

  const outline = validateStoryOutline(clone(VALID_OUTLINE_FIXTURE))
  const opening = validateStoryOpening(
    clone(VALID_OPENING_FIXTURE),
    outline.initial_story_state,
  )
  assert.equal(outline.story_nodes.length, 5)
  assert.deepEqual(opening.additions, VALID_OPENING_FIXTURE.known_to_user_additions)
})

test('Outline 缺节点、错序、重复 ID 和错误任务类型均被精确拒绝', () => {
  const missing = clone(VALID_OUTLINE_FIXTURE)
  missing.story_nodes.pop()
  expectCode(() => validateStoryOutline(missing), 'OUTLINE_STAGE_COUNT_INVALID')

  const wrongOrder = clone(VALID_OUTLINE_FIXTURE)
  ;[wrongOrder.story_nodes[3], wrongOrder.story_nodes[4]] = [
    wrongOrder.story_nodes[4],
    wrongOrder.story_nodes[3],
  ]
  expectCode(() => validateStoryOutline(wrongOrder), 'OUTLINE_STAGE_SEQUENCE_INVALID')

  const duplicate = clone(VALID_OUTLINE_FIXTURE)
  duplicate.story_nodes[1].node_id = 'node_01'
  expectCode(() => validateStoryOutline(duplicate), 'OUTLINE_STAGE_ID_DUPLICATE')

  const wrongType = clone(VALID_OUTLINE_FIXTURE)
  wrongType.story_nodes[3].task_type = 'STORY_ENDING'
  expectCode(() => validateStoryOutline(wrongType), 'OUTLINE_STAGE_SEQUENCE_INVALID')
})

test('Outline 旧 condition、错误初态和额外字段被拒绝', () => {
  const condition = clone(VALID_OUTLINE_FIXTURE)
  condition.reachable_endings[0].condition = 'event_integrity > 80'
  expectCode(() => validateStoryOutline(condition), 'OUTLINE_ADDITIONAL_FIELD_INVALID')

  const consequences = clone(VALID_OUTLINE_FIXTURE)
  consequences.initial_story_state.active_consequences.push('自由文本后果')
  expectCode(() => validateStoryOutline(consequences), 'OUTLINE_INITIAL_STATE_INVALID')

  const wrongNode = clone(VALID_OUTLINE_FIXTURE)
  wrongNode.initial_story_state.current_node_id = 'node_02'
  expectCode(() => validateStoryOutline(wrongNode), 'OUTLINE_INITIAL_STATE_INVALID')

  const extra = clone(VALID_OUTLINE_FIXTURE)
  extra.unexpected = true
  expectCode(() => validateStoryOutline(extra), 'OUTLINE_ADDITIONAL_FIELD_INVALID')
})

test('Outline 使用结构化 ending rules 且必须恰好一个无约束 fallback', () => {
  const legacy = clone(VALID_OUTLINE_FIXTURE)
  legacy.reachable_endings[0].ending_type = 'FULLY_PRESERVED'
  expectCode(
    () => validateStoryOutline(legacy),
    'OUTLINE_ADDITIONAL_FIELD_INVALID',
  )

  const noFallback = clone(VALID_OUTLINE_FIXTURE)
  noFallback.reachable_endings.at(-1).state_rule.fallback = false
  expectCode(
    () => validateStoryOutline(noFallback),
    'OUTLINE_FALLBACK_COUNT_INVALID',
  )

  const constrainedFallback = clone(VALID_OUTLINE_FIXTURE)
  constrainedFallback.reachable_endings.at(-1).state_rule.conditions.push({
    metric: 'event_integrity',
    operator: 'gte',
    value: 0,
  })
  expectCode(
    () => validateStoryOutline(constrainedFallback),
    'OUTLINE_FALLBACK_RULE_INVALID',
  )
})

test('Outline 必填字符串、事实去空白与规范化唯一性被校验', () => {
  const blank = clone(VALID_OUTLINE_FIXTURE)
  blank.event_anchor.core_event = '   '
  expectCode(() => validateStoryOutline(blank), 'OUTLINE_EVENT_ANCHOR_INVALID')

  const duplicateFact = clone(VALID_OUTLINE_FIXTURE)
  duplicateFact.event_anchor.facts_to_preserve.push(
    `  ${duplicateFact.event_anchor.facts_to_preserve[0]}  `,
  )
  expectCode(() => validateStoryOutline(duplicateFact), 'OUTLINE_FACTS_INVALID')

  const duplicateEnding = clone(VALID_OUTLINE_FIXTURE)
  duplicateEnding.reachable_endings[1].ending_id = 'ending_01'
  expectCode(() => validateStoryOutline(duplicateEnding), 'OUTLINE_ENDING_ID_DUPLICATE')
})

test('Outline 拒绝在真实选项路径下永远无法选择的非 fallback 结局', () => {
  const outline = clone(VALID_OUTLINE_FIXTURE)
  outline.reachable_endings[0].state_rule = {
    priority: 100,
    conditions: [
      { metric: 'event_integrity', operator: 'lt', value: 1 },
    ],
    required_consequence_ids: [],
    forbidden_consequence_ids: [],
    fallback: false,
  }
  expectCode(
    () => validateStoryOutline(outline),
    'OUTLINE_ENDING_UNREACHABLE',
  )
})

test('Outline hidden_facts 至少包含一条与 primary_anomaly 相关的事实', () => {
  const outline = clone(VALID_OUTLINE_FIXTURE)
  outline.initial_story_state.hidden_facts = [
    '知识揭示前不得公开异常的真实技术原因。',
  ]
  expectCode(
    () => validateStoryOutline(outline),
    'OUTLINE_HIDDEN_FACTS_INVALID',
  )
})

test('TRAVEL_INFO_DEVIATION 仅在行程核心或到场条件不可替代时通过', () => {
  const unsupported = clone(VALID_OUTLINE_FIXTURE)
  unsupported.primary_anomaly = 'TRAVEL_INFO_DEVIATION'
  expectCode(
    () => validateStoryOutline(unsupported),
    'OUTLINE_TRAVEL_ANOMALY_UNSUPPORTED',
  )

  const supported = clone(VALID_OUTLINE_FIXTURE)
  supported.primary_anomaly = 'TRAVEL_INFO_DEVIATION'
  supported.event_anchor.core_event = '南枝必须在封路前赶到老宅并送达修好的灯片。'
  supported.event_anchor.irreplaceable_part = '必须准时到场并亲手送达灯片，否则共同点灯无法完成。'
  supported.initial_story_state.hidden_facts = [
    '交通行程信息将晚于现场封路变化。',
  ]
  assert.equal(validateStoryOutline(supported), supported)
})

test('Opening 旧 state_patch、next_node_id 与其他额外字段被拒绝', () => {
  for (const field of ['state_patch', 'next_node_id', 'task_type']) {
    const opening = clone(VALID_OPENING_FIXTURE)
    opening[field] = field === 'next_node_id' ? 'node_02' : {}
    expectCode(
      () => validateStoryOpening(opening, VALID_OUTLINE_FIXTURE.initial_story_state),
      'OPENING_ADDITIONAL_FIELD_INVALID',
    )
  }
})

test('Opening threads 数量、正文长度、段落和明显选项结构被拒绝', () => {
  const noThreads = clone(VALID_OPENING_FIXTURE)
  noThreads.continuity_handoff.unresolved_threads = []
  expectCode(
    () => validateStoryOpening(noThreads, VALID_OUTLINE_FIXTURE.initial_story_state),
    'OPENING_SCHEMA_INVALID',
  )

  const tooShort = clone(VALID_OPENING_FIXTURE)
  tooShort.story_text = '你到了现场。\n\n异常刚刚出现。\n\n细节仍未解决。'
  expectCode(
    () => validateStoryOpening(tooShort, VALID_OUTLINE_FIXTURE.initial_story_state),
    'OPENING_STORY_TEXT_INVALID',
  )

  const choices = clone(VALID_OPENING_FIXTURE)
  choices.story_text += '\n\nA. 等待\nB. 离开'
  expectCode(
    () => validateStoryOpening(choices, VALID_OUTLINE_FIXTURE.initial_story_state),
    'OPENING_STORY_TEXT_INVALID',
  )
})

test('Opening additions 与初态 known_to_user 规范化去重', () => {
  const opening = clone(VALID_OPENING_FIXTURE)
  opening.known_to_user_additions.push(
    `  ${VALID_OUTLINE_FIXTURE.initial_story_state.known_to_user[0]}  `,
  )
  const result = validateStoryOpening(
    opening,
    VALID_OUTLINE_FIXTURE.initial_story_state,
  )
  assert.deepEqual(result.additions, VALID_OPENING_FIXTURE.known_to_user_additions)
})

test('Opening 不接受正文中直接泄露 hidden_facts', () => {
  const opening = clone(VALID_OPENING_FIXTURE)
  opening.story_text = opening.story_text.replace(
    '离来访者进门又还有多久',
    '天气信息更新将晚于现场天气变化，离来访者进门又还有多久',
  )
  expectCode(
    () => validateStoryOpening(opening, VALID_OUTLINE_FIXTURE.initial_story_state),
    'OPENING_HIDDEN_FACT_LEAK',
  )
})

test('Continue 禁止“不是/没有……而是……”否定对照句', () => {
  const output = clone(DEFAULT_CONTINUE_OUTPUT)
  output.story_text = output.story_text.replace(
    '你把手边最容易受影响的物件移到灯架内侧',
    '你不是把容易受影响的物件留在原处，而是把它移到灯架内侧',
  )
  expectCode(
    () => validateStoryContinue(output, {
      ...clone(VALID_OUTLINE_FIXTURE.initial_story_state),
      key_outcomes: [],
    }),
    'CONTINUE_STYLE_INVALID',
  )
})
