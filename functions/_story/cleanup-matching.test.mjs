import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  CLEANUP_MATCH_RULES,
  CLEANUP_METHODS,
  buildCleanupTargetSet,
} from './config/cleanup-pairs.js'
import {
  resolveNodeInteractionConfig,
  STORY_INTERACTION_MODE,
} from './config/node-interactions.js'
import {
  ORBITAL_GAME_MODULE_ID,
  orbitalAnswerControlId,
  resolveQuestionForStoryNode,
} from './config/game-story-bindings.js'
import { ORBITAL_EVENTS } from './config/orbital-events.js'
import {
  createFixtureStoryGenerator,
  DEFAULT_KNOWLEDGE_OUTPUT,
} from './fixtures.js'
import { MemoryStoryRepository } from './repository.js'
import { StoryService } from './story-service.js'

const MATERIALS = Object.freeze({
  frame: 'aluminum',
  solar: 'silicon',
  insulation: 'kapton',
  propulsion: 'aluminum-tank',
})

function createRequest() {
  return {
    session_id: randomUUID(),
    nickname: '南枝',
    city: '泉州',
    important_event: '外婆最后一次展示走马灯，我要在天黑前写完灯诗、装回修好的灯片，并与外婆共同点灯。',
    satellite: { name: 'TEST-SAT', altitudeKm: 836, inclination: 98 },
    game_context: { damage_level: 0, history_event_ids: [] },
    language: 'zh',
  }
}

function harness(generator = createFixtureStoryGenerator()) {
  let now = 2_000_000_000_000
  const repository = new MemoryStoryRepository()
  const service = new StoryService({ repository, generateOutput: generator, clock: () => now++ })
  return { repository, service, generator }
}

async function atNode05(service) {
  const request = createRequest()
  let story = await service.createStory(request)
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  story = await service.advanceStory(story.story_id, {
    session_id: request.session_id,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_02',
    module_id: 'M2',
    interactions: Object.entries(MATERIALS).map(([sectionId, optionId]) => ({
      section_id: sectionId,
      control_id: `m2-material-${sectionId}-${optionId}`,
      option_id: optionId,
    })),
    client_action_id: randomUUID(),
  })
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  story = await service.advanceStory(story.story_id, {
    session_id: request.session_id,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_03',
    module_id: 'M3',
    interactions: [{
      section_id: 'mission_candidates',
      control_id: 'm3-mission-weather',
      option_id: 'weather',
    }],
    client_action_id: randomUUID(),
  })
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  for (let order = 1; order <= 6; order += 1) {
    const stage = resolveQuestionForStoryNode(story.current_node_id, order)
    const answer = ORBITAL_EVENTS[order - 1].options[0]
    story = await service.advanceStory(story.story_id, {
      session_id: request.session_id,
      version: story.version,
      action_type: 'GAME_ANSWER_CONFIRM',
      node_id: stage.target_node_id,
      game_module_id: ORBITAL_GAME_MODULE_ID,
      question_id: stage.question_id,
      answer_id: answer.id,
      control_id: orbitalAnswerControlId(stage.question_id, answer.id),
      client_action_id: randomUUID(),
    })
    story = await service.processNextStoryJob(story.story_id, request.session_id)
  }
  assert.equal(story.current_node_id, 'node_05')
  assert.equal(story.game_story_sync.queued_story_stages, 0)
  return { request, story }
}

function matchRequest(story, sessionId, target, methodId = target.preferred_method_id, clientActionId = randomUUID()) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'M6_MATCH_UPDATE',
    node_id: 'node_05',
    module_id: 'M6_CLEANUP_MATCHING',
    cleanup_target_id: target.cleanup_target_id,
    cleanup_method_id: methodId,
    client_action_id: clientActionId,
  }
}

async function matchAll(service, story, sessionId) {
  for (const target of story.public_game_state.cleanup_test.target_set) {
    story = await service.advanceStory(
      story.story_id,
      matchRequest(story, sessionId, target),
    )
  }
  return story
}

function completionRequest(story, sessionId, completionId = randomUUID(), clientActionId = completionId) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'M6_MATCH_COMPLETE',
    node_id: 'node_05',
    module_id: 'M6_CLEANUP_MATCHING',
    completion_id: completionId,
    client_action_id: clientActionId,
  }
}

test('M6 真实清理配置使用稳定 ID、完整 profile、规则与统一 node_05 绑定', () => {
  assert.equal(Object.keys(CLEANUP_METHODS).length, 6)
  for (const method of Object.values(CLEANUP_METHODS)) {
    assert.ok(method.cleanup_method_id)
    assert.ok(method.cleanup_method_name)
    assert.ok(method.mechanism_profile.mechanism_summary)
    assert.ok(method.mechanism_profile.suitable_target_traits.length > 0)
    assert.ok(method.mechanism_profile.operational_tradeoffs.length > 0)
    assert.ok(method.mechanism_profile.safe_facts.length > 0)
  }
  const story = {
    story_id: 'stable-story',
    game_state: {
      satellite_build: { satellite: { name: 'TEST-SAT' }, materials: MATERIALS },
      technical_metrics: { armor: 90, fuel: 42 },
    },
  }
  const targets = buildCleanupTargetSet(story)
  assert.equal(targets.length, 3)
  assert.equal(new Set(targets.map((target) => target.cleanup_target_id)).size, 3)
  for (const target of targets) {
    const rule = CLEANUP_MATCH_RULES[target.cleanup_target_id]
    assert.ok(target.target_profile.safe_facts.length > 0)
    assert.ok(rule.allowed_method_ids.includes(target.preferred_method_id))
    assert.ok(rule.explanation_profile.why_suitable.length > 0)
  }
  const node = resolveNodeInteractionConfig('node_05')
  assert.equal(node.interaction_mode, STORY_INTERACTION_MODE.SITE_MATCHING_GAME)
  assert.equal(node.module_id, 'M6_CLEANUP_MATCHING')
  assert.equal(node.trigger_mode, 'ON_GAME_COMPLETE')
  assert.equal(node.legacy_option_fallback, false)
})

test('M6 单次配对由后端判定并保存替换统计，不调用模型、不改 story_state 且可幂等恢复', async () => {
  const { service, repository, generator } = harness()
  const { request, story: initial } = await atNode05(service)
  const beforeState = structuredClone(repository.stories.get(initial.story_id).story_state)
  const beforeCalls = generator.getCallCount()
  const target = initial.public_game_state.cleanup_test.target_set[0]
  const wrongMethod = Object.keys(CLEANUP_METHODS).find(
    (methodId) => methodId !== target.preferred_method_id,
  )
  const firstActionId = randomUUID()
  let story = await service.advanceStory(
    initial.story_id,
    matchRequest(initial, request.session_id, target, wrongMethod, firstActionId),
  )
  assert.equal(story.action_confirmation.cleanup_match.is_allowed_match, false)
  assert.equal(story.action_confirmation.cleanup_match.attempt_count, 1)
  assert.equal(generator.getCallCount(), beforeCalls)
  assert.deepEqual(repository.stories.get(story.story_id).story_state, beforeState)

  const replay = await service.advanceStory(
    story.story_id,
    { ...matchRequest(initial, request.session_id, target, wrongMethod, firstActionId) },
  )
  assert.equal(replay.action_confirmation.idempotent_replay, true)
  assert.equal(replay.version, story.version)

  story = await service.advanceStory(
    story.story_id,
    matchRequest(story, request.session_id, target),
  )
  const currentMatch = story.public_game_state.cleanup_test.matches[0]
  assert.equal(currentMatch.is_allowed_match, true)
  assert.equal(currentMatch.attempt_count, 2)
  assert.equal(currentMatch.changed_count, 1)
  const refreshed = await service.getStory(story.story_id, request.session_id)
  assert.deepEqual(refreshed.public_game_state.cleanup_test.matches, story.public_game_state.cleanup_test.matches)
})

test('M6 API 拒绝伪造字段、非法 ID、未完成集合，且 Ending 前不能启动', async () => {
  const { service, generator } = harness()
  const create = createRequest()
  const beforeEnding = await service.createStory(create)
  const callsBefore = generator.getCallCount()
  await assert.rejects(
    service.advanceStory(beforeEnding.story_id, {
      ...matchRequest(beforeEnding, create.session_id, {
        cleanup_target_id: 'forged',
        preferred_method_id: 'LASER_ABLATION',
      }),
    }),
    (error) => error.code === 'INVALID_NODE_INTERACTION_MODE',
  )
  assert.equal(generator.getCallCount(), callsBefore)

  const { request, story } = await atNode05(service)
  const target = story.public_game_state.cleanup_test.target_set[0]
  await assert.rejects(
    service.advanceStory(story.story_id, { ...matchRequest(story, request.session_id, target), is_correct: true }),
    (error) => error.code === 'INVALID_INPUT',
  )
  await assert.rejects(
    service.advanceStory(story.story_id, matchRequest(story, request.session_id, { ...target, cleanup_target_id: 'missing' })),
    (error) => error.code === 'CLEANUP_TARGET_NOT_FOUND',
  )
  await assert.rejects(
    service.advanceStory(story.story_id, matchRequest(story, request.session_id, target, 'missing')),
    (error) => error.code === 'CLEANUP_METHOD_NOT_FOUND',
  )
  await assert.rejects(
    service.advanceStory(story.story_id, completionRequest(story, request.session_id)),
    (error) => error.code === 'M6_MATCH_SET_INCOMPLETE',
  )
})

test('M6 完成原子冻结三条快照并只创建一个 Knowledge job，Ending 与数值不变', async () => {
  const { service, repository, generator } = harness()
  const { request, story: atEnding } = await atNode05(service)
  const endingId = repository.stories.get(atEnding.story_id).final_story.selected_ending_id
  const beforeState = structuredClone(repository.stories.get(atEnding.story_id).story_state)
  const beforeCalls = generator.getCallCount()
  let story = await matchAll(service, atEnding, request.session_id)
  assert.equal(generator.getCallCount(), beforeCalls)
  const completionId = randomUUID()
  const completion = completionRequest(story, request.session_id, completionId)
  story = await service.advanceStory(story.story_id, completion)
  assert.equal(story.action_confirmation.snapshot_count, 3)
  assert.equal(story.game_story_sync.queued_story_stages, 1)
  assert.equal(story.status, 'in_progress')
  assert.equal(story.current_node_id, 'node_05')
  assert.equal(generator.getCallCount(), beforeCalls)
  assert.deepEqual(repository.stories.get(story.story_id).story_state, beforeState)
  assert.equal(repository.stories.get(story.story_id).final_story.selected_ending_id, endingId)
  const snapshots = await repository.getCleanupSnapshots(story.story_id)
  assert.equal(snapshots.length, 3)
  assert.ok(snapshots.every((snapshot) => (
    snapshot.target_profile.safe_facts.length
    && snapshot.mechanism_profile.safe_facts.length
    && snapshot.explanation_profile.why_suitable.length
  )))
  const queuedKnowledgeJob = (await repository.getArtifactJobs(story.story_id)).at(-1)
  assert.equal(queuedKnowledgeJob.status, 'QUEUED')
  assert.ok(Number.isInteger(story.action_confirmation.interaction_ack_ms))
  const replay = await service.advanceStory(story.story_id, completion)
  assert.equal(replay.action_confirmation.idempotent_replay, true)
  assert.equal((await repository.getArtifactJobs(story.story_id)).length, 5)
  assert.equal((await repository.getCleanupSnapshots(story.story_id)).length, 3)
})

test('Knowledge Context 只含最终三组配对，输出只引用真实 ID 并在成功后完成故事', async () => {
  const { service, repository, generator } = harness()
  const { request, story: atEnding } = await atNode05(service)
  let story = await matchAll(service, atEnding, request.session_id)
  story = await service.advanceStory(story.story_id, completionRequest(story, request.session_id))
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  const knowledgeCall = generator.getCalls().findLast(
    (call) => call.taskType === 'KNOWLEDGE_REVEAL',
  )
  assert.equal(knowledgeCall.input.cleanup_game_result.matches.length, 3)
  assert.equal(Object.hasOwn(knowledgeCall.input.cleanup_game_result, 'all_methods'), false)
  assert.equal(Object.hasOwn(knowledgeCall.input.cleanup_game_result, 'rules'), false)
  assert.equal(story.status, 'completed')
  assert.equal(story.current_checkpoint, 'completed')
  const reveal = story.final_story_if_completed.knowledge_reveal
  assert.ok(reveal.cleanup_insights.length >= 1)
  const actualPairs = new Set(knowledgeCall.input.cleanup_game_result.matches.map(
    (match) => `${match.cleanup_target_id}:${match.cleanup_method_id}`,
  ))
  assert.ok(reveal.cleanup_insights.every((insight) => (
    actualPairs.has(`${insight.cleanup_target_id}:${insight.cleanup_method_id}`)
  )))
  const completedKnowledgeJob = (await repository.getArtifactJobs(story.story_id)).at(-1)
  assert.equal(completedKnowledgeJob.status, 'READY')
  assert.ok(completedKnowledgeJob.metrics.context_build_ms >= 0)
  assert.ok(completedKnowledgeJob.metrics.artifact_total_generation_ms >= 0)
})

test('Knowledge 第一次失败自动定向重试，第二次失败保留快照和已提交 M6 状态', async () => {
  const fixture = createFixtureStoryGenerator()
  let invalidAttemptsRemaining = 2
  const generator = async (taskType, input, context) => {
    if (taskType === 'KNOWLEDGE_REVEAL' && invalidAttemptsRemaining > 0) {
      invalidAttemptsRemaining -= 1
      const invalid = await fixture(taskType, input, context)
      invalid.cleanup_insights = []
      return invalid
    }
    return fixture(taskType, input, context)
  }
  const { service, repository } = harness(generator)
  const { request, story: atEnding } = await atNode05(service)
  let story = await matchAll(service, atEnding, request.session_id)
  story = await service.advanceStory(story.story_id, completionRequest(story, request.session_id))
  const stateBefore = structuredClone(repository.stories.get(story.story_id).story_state)
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  let jobs = await repository.getArtifactJobs(story.story_id)
  assert.equal(jobs.at(-1).status, 'QUEUED')
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  jobs = await repository.getArtifactJobs(story.story_id)
  const failed = jobs.at(-1)
  assert.equal(failed.status, 'FAILED')
  assert.equal(failed.attempt_count, 2)
  assert.equal((await repository.getCleanupSnapshots(story.story_id)).length, 3)
  assert.deepEqual(repository.stories.get(story.story_id).story_state, stateBefore)
  assert.equal(story.status, 'in_progress')
  assert.equal(story.current_node_id, 'node_05')
  assert.equal((await repository.getCleanupSnapshots(story.story_id)).length, 3)
})
