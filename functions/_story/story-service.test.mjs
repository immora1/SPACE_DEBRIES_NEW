import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { StoryService } from './story-service.js'
import { MemoryStoryRepository } from './repository.js'
import {
  createFixtureStoryGenerator,
  VALID_OPENING_FIXTURE,
  VALID_OUTLINE_FIXTURE,
} from './fixtures.js'

function clone(value) {
  return structuredClone(value)
}

function createHarness(options = {}) {
  let now = options.now || 1_800_000_000_000
  const repository = new MemoryStoryRepository()
  const generateOutput = options.generateOutput || createFixtureStoryGenerator()
  const service = new StoryService({
    repository,
    generateOutput,
    clock: () => now,
  })
  return {
    repository,
    generateOutput,
    service,
    advanceClock(ms) { now += ms },
  }
}

function createRequest(overrides = {}) {
  return {
    session_id: randomUUID(),
    nickname: '南枝',
    city: '泉州',
    important_event: '外婆最后一次展示走马灯，我要在天黑前写完灯诗、装回修好的灯片，并与外婆共同点灯。',
    satellite: {
      name: 'TEST-SAT',
      noradId: 12345,
      altitudeKm: 836,
      inclination: 98,
    },
    game_context: {
      damage_level: 0,
      history_event_ids: [],
    },
    language: 'zh',
    ...overrides,
  }
}

test('创建故事按 Outline→Opening 完成，并只由后端推进到 node_02', async () => {
  const harness = createHarness()
  const request = createRequest()
  const story = await harness.service.createStory(request)

  assert.equal(story.status, 'in_progress')
  assert.equal(story.current_node_id, 'node_02')
  assert.equal(story.current_checkpoint, 'materials')
  assert.equal(story.current_options.length, 3)
  assert.equal(story.story_text, VALID_OPENING_FIXTURE.story_text)
  assert.equal(story.timeline.length, 1)
  assert.equal(story.timeline[0].node_id, 'node_01')
  assert.equal(story.timeline[0].task_type, 'STORY_OPENING')

  const internal = harness.repository.stories.get(story.story_id)
  assert.deepEqual(
    internal.story_state.known_to_user,
    [
      ...VALID_OUTLINE_FIXTURE.initial_story_state.known_to_user,
      ...VALID_OPENING_FIXTURE.known_to_user_additions,
    ],
  )
  assert.equal(internal.story_state.current_node_id, 'node_02')
})

test('runtime story_state 与不可变 outline.initial_story_state 是独立副本', async () => {
  const harness = createHarness()
  const story = await harness.service.createStory(createRequest())
  const internal = harness.repository.stories.get(story.story_id)
  const outlineBefore = clone(internal.story_outline.initial_story_state)

  internal.story_state.known_to_user.push('运行时新增事实')
  internal.story_state.event_integrity = 12

  assert.deepEqual(internal.story_outline.initial_story_state, outlineBefore)
  assert.equal(internal.story_outline.initial_story_state.event_integrity, 100)
  assert.equal(internal.story_outline.initial_story_state.known_to_user.includes('运行时新增事实'), false)
})

test('仓储后续提交不会覆盖固定 story_outline', async () => {
  const harness = createHarness()
  const request = createRequest()
  const created = await harness.service.createStory(request)
  const stored = await harness.repository.getStory(created.story_id, request.session_id)
  const originalOutline = clone(stored.story_outline)

  stored.version += 1
  stored.story_outline.primary_anomaly = 'OTHER'
  await harness.repository.commitAdvance({
    story: stored,
    expectedVersion: 1,
    interaction: {
      interaction_id: 'interaction-outline-immutability',
      story_id: created.story_id,
      module: 'TEST',
      source_id: 'test',
      action_id: 'test',
      label: 'test',
      technical_effect: null,
      narrative_effect: null,
      created_at_ms: 1,
    },
    stages: [],
  })

  const reloaded = await harness.repository.getStory(created.story_id, request.session_id)
  assert.deepEqual(reloaded.story_outline, originalOutline)
})

test('Opening 不修改指标、持续后果、隐藏事实或 last_user_action', async () => {
  const harness = createHarness()
  const story = await harness.service.createStory(createRequest())
  const internal = harness.repository.stories.get(story.story_id)
  const initial = internal.story_outline.initial_story_state
  const runtime = internal.story_state

  for (const field of [
    'confirmed_facts',
    'hidden_facts',
    'event_integrity',
    'relationship_connection',
    'uncertainty',
    'active_consequences',
    'last_user_action',
  ]) {
    assert.deepEqual(runtime[field], initial[field])
  }
})

test('Outline 业务校验失败会携带原因重试一次', async () => {
  const invalidOutline = clone(VALID_OUTLINE_FIXTURE)
  ;[invalidOutline.story_nodes[3], invalidOutline.story_nodes[4]] = [
    invalidOutline.story_nodes[4],
    invalidOutline.story_nodes[3],
  ]
  const generator = createFixtureStoryGenerator({
    outlineOutputs: [invalidOutline, VALID_OUTLINE_FIXTURE],
  })
  const harness = createHarness({ generateOutput: generator })

  await harness.service.createStory(createRequest())
  assert.equal(generator.getCallCount(), 3)
  const calls = generator.getCalls()
  assert.equal(calls[1].taskType, 'STORY_OUTLINE')
  assert.match(calls[1].context.retryReason, /OUTLINE_NODE_SEQUENCE_INVALID/)
})

test('Outline 不可达结局重试反馈包含 ending ID 与真实数值范围', async () => {
  const unreachable = clone(VALID_OUTLINE_FIXTURE)
  unreachable.reachable_endings[0].state_rule = {
    priority: 100,
    conditions: [
      { metric: 'event_integrity', operator: 'lt', value: 1 },
    ],
    required_consequence_ids: [],
    forbidden_consequence_ids: [],
    fallback: false,
  }
  const generator = createFixtureStoryGenerator({
    outlineOutputs: [unreachable, VALID_OUTLINE_FIXTURE],
  })
  const harness = createHarness({ generateOutput: generator })

  await harness.service.createStory(createRequest())
  const reason = generator.getCalls()[1].context.retryReason
  assert.match(reason, /OUTLINE_ENDING_UNREACHABLE/)
  assert.match(reason, /ending_01/)
  assert.match(reason, /event_integrity 72-100/)
  assert.match(reason, /更高 priority 规则完全遮蔽/)
})

test('Opening 结构校验失败会重试，最终只保存一个 node_01 stage', async () => {
  const invalidOpening = {
    ...clone(VALID_OPENING_FIXTURE),
    next_node_id: 'node_02',
  }
  const generator = createFixtureStoryGenerator({
    openingOutputs: [invalidOpening, VALID_OPENING_FIXTURE],
  })
  const harness = createHarness({ generateOutput: generator })
  const story = await harness.service.createStory(createRequest())

  assert.equal(generator.getCallCount(), 3)
  assert.equal((await harness.repository.getStages(story.story_id)).length, 1)
  assert.match(generator.getCalls()[2].context.retryReason, /OPENING_ADDITIONAL_FIELD_INVALID/)
})

test('Opening 正文长度失败时重试原因包含可执行的字符和段落目标', async () => {
  const invalidOpening = clone(VALID_OPENING_FIXTURE)
  invalidOpening.story_text = `${'你在现场等待，异常仍未解决。'.repeat(7)}

${'你重新检查约定，重要物件仍在手边。'.repeat(7)}

${'你听见远处传来声音，细节依旧悬而未决。'.repeat(7)}`
  const generator = createFixtureStoryGenerator({
    openingOutputs: [invalidOpening, VALID_OPENING_FIXTURE],
  })
  const harness = createHarness({ generateOutput: generator })

  await harness.service.createStory(createRequest())

  const reason = generator.getCalls()[2].context.retryReason
  assert.match(reason, /OPENING_STORY_TEXT_INVALID/)
  assert.match(reason, /420-500 个汉字/)
  assert.match(reason, /不计标点、数字和空格/)
  assert.match(reason, /3-5 段/)
  assert.match(reason, /第二人称“你”/)
})

test('Opening 连续两次失败不会保存 Outline、stage 或推进后的 session', async () => {
  const invalidOpening = {
    ...clone(VALID_OPENING_FIXTURE),
    state_patch: {},
  }
  const generator = createFixtureStoryGenerator({
    openingOutputs: [invalidOpening, invalidOpening],
  })
  const harness = createHarness({ generateOutput: generator })

  await assert.rejects(
    harness.service.createStory(createRequest()),
    (error) => error.code === 'OPENING_ADDITIONAL_FIELD_INVALID',
  )
  assert.equal(harness.repository.stories.size, 0)
  assert.equal(harness.repository.stages.size, 0)
  assert.equal(generator.getCallCount(), 3)
})

test('模型请求失败时不写入任何部分数据', async () => {
  const generator = createFixtureStoryGenerator({ failTask: 'STORY_OPENING' })
  const harness = createHarness({ generateOutput: generator })

  await assert.rejects(
    harness.service.createStory(createRequest()),
    (error) => error.code === 'AI_REQUEST_FAILED',
  )
  assert.equal(harness.repository.stories.size, 0)
  assert.equal(harness.repository.stages.size, 0)
})

test('相同 session_id 幂等返回同一故事且不重复调用模型或创建 stage', async () => {
  const generator = createFixtureStoryGenerator()
  const harness = createHarness({ generateOutput: generator })
  const request = createRequest()

  const first = await harness.service.createStory(request)
  const second = await harness.service.createStory(clone(request))

  assert.equal(second.story_id, first.story_id)
  assert.equal(generator.getCallCount(), 2)
  assert.equal((await harness.repository.getStages(first.story_id)).length, 1)
})

test('同一 session_id 携带不同输入会返回幂等冲突', async () => {
  const harness = createHarness()
  const request = createRequest()
  await harness.service.createStory(request)

  await assert.rejects(
    harness.service.createStory({
      ...clone(request),
      important_event: '另一件完全不同的重要事件',
    }),
    (error) => error.code === 'IDEMPOTENCY_KEY_REUSED' && error.status === 409,
  )
})

test('known facts 规范化去重，阶段仍保存原始 additions', async () => {
  const opening = clone(VALID_OPENING_FIXTURE)
  opening.known_to_user_additions.push(
    `  ${VALID_OUTLINE_FIXTURE.initial_story_state.known_to_user[0]}  `,
  )
  const harness = createHarness({
    generateOutput: createFixtureStoryGenerator({ openingOutputs: [opening] }),
  })
  const story = await harness.service.createStory(createRequest())
  const internal = harness.repository.stories.get(story.story_id)
  const stages = await harness.repository.getStages(story.story_id)

  assert.equal(stages[0].known_to_user_additions.length, 3)
  assert.equal(internal.story_state.known_to_user.length, 5)
})

test('公开响应不包含 hidden_facts、完整 outline 或 continuity_handoff', async () => {
  const harness = createHarness()
  const request = createRequest()
  const story = await harness.service.createStory(request)
  const restored = await harness.service.getStory(story.story_id, request.session_id)
  const serialized = JSON.stringify(restored)

  for (const forbidden of [
    'hidden_facts',
    'story_outline',
    'initial_story_state',
    'continuity_handoff',
    'prompt_metadata',
    'state_before',
    'state_after',
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }
  for (const hiddenFact of VALID_OUTLINE_FIXTURE.initial_story_state.hidden_facts) {
    assert.equal(serialized.includes(hiddenFact), false)
  }
})

test('非法 action 请求会在模型调用前拒绝且不改变状态', async () => {
  const harness = createHarness()
  const request = createRequest()
  const story = await harness.service.createStory(request)

  await assert.rejects(
    harness.service.advanceStory(story.story_id, {}),
    (error) => error.code === 'INVALID_INPUT' && error.status === 400,
  )
  const restored = await harness.service.getStory(story.story_id, request.session_id)
  assert.equal(restored.current_node_id, 'node_02')
  assert.equal(restored.timeline.length, 1)
})

test('过期故事仍按现有仓库策略清理', async () => {
  const harness = createHarness()
  const request = createRequest()
  const story = await harness.service.createStory(request)
  harness.advanceClock(60 * 60 * 1000 + 1)

  await assert.rejects(
    harness.service.getStory(story.story_id, request.session_id),
    (error) => error.code === 'STORY_NOT_FOUND',
  )
})
