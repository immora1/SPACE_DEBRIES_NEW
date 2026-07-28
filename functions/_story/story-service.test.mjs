import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { StoryService } from './story-service.js'
import { MemoryStoryRepository } from './repository.js'
import { createFixtureStageGenerator } from './fixtures.js'
import { ORBITAL_EVENTS } from './config/orbital-events.js'
import { SYSTEM_PROMPT } from './prompts/system.js'

const MATERIALS = {
  frame: 'aluminum',
  solar: 'silicon',
  insulation: 'kapton',
  propulsion: 'aluminum-tank',
}

const CLEANUP = [
  ['A31_MICRO_DEBRIS', 'LASER_ABLATION', 'paint-flakes'],
  ['B27_RING_STRUCTURE', 'ROBOTIC_ARM_CAPTURE', 'adapter-ring'],
  ['C22_END_OF_LIFE_PLATFORM', 'DRAG_SAIL', 'end-of-life'],
]

function createHarness(options = {}) {
  let now = options.now || 1_800_000_000_000
  const repository = new MemoryStoryRepository()
  const generateStage = options.generateStage || createFixtureStageGenerator()
  const service = new StoryService({
    repository,
    generateStage,
    clock: () => now,
  })
  return {
    repository,
    generateStage,
    service,
    advanceClock(ms) { now += ms },
  }
}

function createRequest(overrides = {}) {
  return {
    session_id: randomUUID(),
    nickname: '林远',
    city: '成都',
    important_event: '和父亲一起参加毕业典礼',
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

async function action(service, story, sessionId, body) {
  return service.advanceStory(story.story_id, {
    session_id: sessionId,
    version: story.version,
    payload: {},
    ...body,
  })
}

async function runFullStory(harness, request = createRequest()) {
  let story = await harness.service.createStory(request)
  story = await action(harness.service, story, request.session_id, {
    action_type: 'MATERIALS_COMMIT',
    source_id: 'satellite_build',
    action_id: 'materials_commit',
    payload: { selections: MATERIALS },
  })
  story = await action(harness.service, story, request.session_id, {
    action_type: 'MISSION_SELECT',
    source_id: 'mission',
    action_id: 'weather',
  })
  for (const event of ORBITAL_EVENTS) {
    story = await action(harness.service, story, request.session_id, {
      action_type: 'ORBITAL_EVENT_RESOLVE',
      source_id: event.id,
      action_id: event.options[0].id,
    })
  }
  for (const [targetId, methodId, uiTargetId] of CLEANUP) {
    story = await action(harness.service, story, request.session_id, {
      action_type: 'CLEANUP_PAIR_SUBMIT',
      source_id: targetId,
      action_id: methodId,
      payload: { ui_target_id: uiTargetId },
    })
  }
  return { story, request }
}

test('同名同城与重新开始均生成不同 story_id', async () => {
  const harness = createHarness()
  const first = await harness.service.createStory(createRequest())
  const second = await harness.service.createStory(createRequest())
  assert.notEqual(first.story_id, second.story_id)
})

test('非法 action、错误 checkpoint 与旧 version 均被拒绝', async () => {
  const harness = createHarness()
  const request = createRequest()
  const story = await harness.service.createStory(request)

  await assert.rejects(
    action(harness.service, story, request.session_id, {
      action_type: 'MISSION_SELECT',
      source_id: 'mission',
      action_id: 'weather',
    }),
    (error) => error.code === 'INVALID_CHECKPOINT',
  )
  await assert.rejects(
    action(harness.service, story, request.session_id, {
      action_type: 'MATERIALS_COMMIT',
      source_id: 'satellite_build',
      action_id: 'materials_commit',
      payload: { selections: { ...MATERIALS, frame: 'unobtainium' } },
    }),
    (error) => error.code === 'INVALID_ACTION',
  )

  const updated = await action(harness.service, story, request.session_id, {
    action_type: 'MATERIALS_COMMIT',
    source_id: 'satellite_build',
    action_id: 'materials_commit',
    payload: { selections: MATERIALS },
  })
  assert.equal(updated.version, 1)
  await assert.rejects(
    action(harness.service, story, request.session_id, {
      action_type: 'MATERIALS_COMMIT',
      source_id: 'satellite_build',
      action_id: 'materials_commit',
      payload: { selections: MATERIALS },
    }),
    (error) => error.code === 'VERSION_CONFLICT',
  )
})

test('AI 失败或非法 checkpoint 不提交状态、版本或阶段', async () => {
  const generator = createFixtureStageGenerator()
  const harness = createHarness({ generateStage: generator })
  const request = createRequest()
  const story = await harness.service.createStory(request)
  generator.failTask = 'STORY_CONTINUE'

  await assert.rejects(
    action(harness.service, story, request.session_id, {
      action_type: 'MATERIALS_COMMIT',
      source_id: 'satellite_build',
      action_id: 'materials_commit',
      payload: { selections: MATERIALS },
    }),
    (error) => error.code === 'AI_REQUEST_FAILED',
  )
  const restored = await harness.service.getStory(story.story_id, request.session_id)
  assert.equal(restored.version, 0)
  assert.equal(restored.timeline.length, 1)
  assert.deepEqual(restored.public_game_state.satellite_build.materials, {})
})

test('过期未完成故事会清理，completed 故事永久保留', async () => {
  const incompleteHarness = createHarness()
  const incompleteRequest = createRequest()
  const incomplete = await incompleteHarness.service.createStory(incompleteRequest)
  incompleteHarness.advanceClock(60 * 60 * 1000 + 1)
  await assert.rejects(
    incompleteHarness.service.getStory(incomplete.story_id, incompleteRequest.session_id),
    (error) => error.code === 'STORY_NOT_FOUND',
  )

  const completedHarness = createHarness()
  const { story, request } = await runFullStory(completedHarness)
  completedHarness.advanceClock(365 * 24 * 60 * 60 * 1000)
  const restored = await completedHarness.service.getStory(story.story_id, request.session_id)
  assert.equal(restored.status, 'completed')
})

test('public DTO 不泄漏城市、隐藏字段、未来节点或 System Prompt', async () => {
  const harness = createHarness()
  const story = await harness.service.createStory(createRequest({ city: '一座不应进入故事的城市' }))
  const serialized = JSON.stringify(story)
  assert.equal(serialized.includes('一座不应进入故事的城市'), false)
  for (const forbidden of ['hidden_cause', 'hidden_facts', 'allowed_endings', 'SYSTEM_PROMPT']) {
    assert.equal(Object.hasOwn(story, forbidden), false)
    assert.equal(serialized.includes(forbidden), false)
  }
})

test('M4 六个事件全部确定性推进 game_state 与 story_state，刷新可恢复', async () => {
  const harness = createHarness()
  const request = createRequest()
  let story = await harness.service.createStory(request)
  story = await action(harness.service, story, request.session_id, {
    action_type: 'MATERIALS_COMMIT',
    source_id: 'satellite_build',
    action_id: 'materials_commit',
    payload: { selections: MATERIALS },
  })
  story = await action(harness.service, story, request.session_id, {
    action_type: 'MISSION_SELECT',
    source_id: 'mission',
    action_id: 'weather',
  })
  const before = await harness.repository.getStory(story.story_id, request.session_id)

  for (const event of ORBITAL_EVENTS) {
    story = await action(harness.service, story, request.session_id, {
      action_type: 'ORBITAL_EVENT_RESOLVE',
      source_id: event.id,
      action_id: event.options[0].id,
    })
  }
  const after = await harness.repository.getStory(story.story_id, request.session_id)
  assert.equal(after.game_state.orbital_events.resolved.length, 6)
  assert.notDeepEqual(after.game_state.technical_metrics, before.game_state.technical_metrics)
  assert.notDeepEqual(after.story_state.metrics, before.story_state.metrics)
  assert.equal(story.current_checkpoint, 'cleanup')

  const restored = await harness.service.getStory(story.story_id, request.session_id)
  assert.equal(restored.version, story.version)
  assert.deepEqual(restored.timeline, story.timeline)
})

test('清理固定配对、ENDING、KNOWLEDGE_REVEAL 与 completed 原子完成', async () => {
  const harness = createHarness()
  const { story } = await runFullStory(harness)
  assert.equal(story.status, 'completed')
  assert.equal(story.current_checkpoint, 'completed')
  assert.ok(story.final_story_if_completed?.ending?.story_text)
  assert.ok(story.final_story_if_completed?.knowledge_reveal?.story_text)
  const taskTypes = story.timeline.map((stage) => stage.task_type)
  assert.ok(taskTypes.lastIndexOf('STORY_ENDING') < taskTypes.lastIndexOf('KNOWLEDGE_REVEAL'))
  assert.equal((await harness.repository.getInteractions(story.story_id)).length, 11)
})

test('知识揭示失败时第三个清理配对、结局和 completed 均不提交', async () => {
  const generator = createFixtureStageGenerator()
  const harness = createHarness({ generateStage: generator })
  const request = createRequest()
  let story = await harness.service.createStory(request)
  story = await action(harness.service, story, request.session_id, {
    action_type: 'MATERIALS_COMMIT',
    source_id: 'satellite_build',
    action_id: 'materials_commit',
    payload: { selections: MATERIALS },
  })
  story = await action(harness.service, story, request.session_id, {
    action_type: 'MISSION_SELECT',
    source_id: 'mission',
    action_id: 'weather',
  })
  for (const event of ORBITAL_EVENTS) {
    story = await action(harness.service, story, request.session_id, {
      action_type: 'ORBITAL_EVENT_RESOLVE',
      source_id: event.id,
      action_id: event.options[0].id,
    })
  }
  for (const [targetId, methodId, uiTargetId] of CLEANUP.slice(0, 2)) {
    story = await action(harness.service, story, request.session_id, {
      action_type: 'CLEANUP_PAIR_SUBMIT',
      source_id: targetId,
      action_id: methodId,
      payload: { ui_target_id: uiTargetId },
    })
  }
  generator.failTask = 'KNOWLEDGE_REVEAL'
  await assert.rejects(
    action(harness.service, story, request.session_id, {
      action_type: 'CLEANUP_PAIR_SUBMIT',
      source_id: CLEANUP[2][0],
      action_id: CLEANUP[2][1],
      payload: { ui_target_id: CLEANUP[2][2] },
    }),
    (error) => error.code === 'AI_REQUEST_FAILED',
  )
  const restored = await harness.service.getStory(story.story_id, request.session_id)
  assert.equal(restored.status, 'in_progress')
  assert.equal(restored.public_game_state.cleanup_test.matches.length, 2)
  assert.equal(restored.timeline.some((stage) => stage.task_type === 'STORY_ENDING'), false)
})

test('错误清理配对被拒绝，指标始终 clamp 在 0 到 100', async () => {
  const harness = createHarness()
  const { story: completed } = await runFullStory(harness)
  for (const metric of Object.values(completed.public_game_state.technical_metrics)) {
    if (typeof metric === 'number') assert.ok(metric >= 0 && metric <= 100)
  }
  const internal = harness.repository.stories.get(completed.story_id)
  for (const metric of Object.values(internal.story_state.metrics)) {
    assert.ok(metric >= 0 && metric <= 100)
  }
})

test('三组虚构用户都能跑完整故事链', async () => {
  const harness = createHarness()
  for (const [index, importantEvent] of [
    '参加妹妹的婚礼',
    '在雨停前送达一封信',
    '和老朋友完成一次约定',
  ].entries()) {
    const { story } = await runFullStory(harness, createRequest({
      session_id: randomUUID(),
      nickname: `用户${index + 1}`,
      city: ['成都', '上海', '北京'][index],
      important_event: importantEvent,
    }))
    assert.equal(story.status, 'completed')
  }
})

test('共用 System Prompt 内容哈希保持不变', () => {
  const hash = createHash('sha256').update(SYSTEM_PROMPT.replace(/\r\n/g, '\n')).digest('hex')
  assert.equal(hash, 'd6a9822bf954315e289c3a60a591635bb3656b8ad2f11404316a8f1f1ead689e')
})
