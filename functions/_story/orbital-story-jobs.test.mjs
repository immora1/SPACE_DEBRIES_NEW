import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  GAME_ANSWER_STORY_BINDINGS,
  GAME_STORY_STAGE_BINDINGS,
  orbitalAnswerControlId,
  resolveGameAnswerStoryBinding,
} from './config/game-story-bindings.js'
import { ORBITAL_EVENTS } from './config/orbital-events.js'
import { STORY_JOB_LEASE_MS } from './constants.js'
import { createFixtureStoryGenerator } from './fixtures.js'
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
    satellite: { name: 'TEST-SAT', noradId: 12345, altitudeKm: 836, inclination: 98 },
    game_context: { damage_level: 0, history_event_ids: [] },
    language: 'zh',
  }
}

function harness(generator = createFixtureStoryGenerator()) {
  let now = 1_950_000_000_000
  const repository = new MemoryStoryRepository()
  const service = new StoryService({ repository, generateOutput: generator, clock: () => now++ })
  return { repository, service, generator }
}

function materialRequest(story, sessionId) {
  return {
    session_id: sessionId,
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
  }
}

function missionRequest(story, sessionId) {
  return {
    session_id: sessionId,
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
  }
}

function answerRequest(story, sessionId, order, answerIndex = 0, clientActionId = randomUUID()) {
  const stage = GAME_STORY_STAGE_BINDINGS[order - 1]
  const event = ORBITAL_EVENTS[order - 1]
  const answer = event.options[answerIndex]
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'GAME_ANSWER_CONFIRM',
    node_id: 'node_04',
    game_module_id: stage.game_module_id,
    question_id: event.id,
    answer_id: answer.id,
    control_id: orbitalAnswerControlId(event.id, answer.id),
    client_action_id: clientActionId,
  }
}

async function createAtNode04(service) {
  const request = createRequest()
  let story = await service.createStory(request)
  story = await service.advanceStory(story.story_id, materialRequest(story, request.session_id))
  story = await service.advanceStory(story.story_id, missionRequest(story, request.session_id))
  return { request, story }
}

async function answerAll(service, story, sessionId) {
  for (let order = 1; order <= 6; order += 1) {
    story = await service.advanceStory(
      story.story_id,
      answerRequest(story, sessionId, order, order % 3),
    )
  }
  return story
}

async function processAllArtifactJobs(service, story, sessionId, limit = 20) {
  let current = story
  for (let index = 0; index < limit; index += 1) {
    if (current.game_story_sync.queued_story_stages === 0) return current
    current = await service.processNextStoryJob(current.story_id, sessionId)
  }
  assert.fail(`Artifact jobs did not drain after ${limit} attempts.`)
}

async function submitM6Completion(service, story, sessionId) {
  for (const target of story.public_game_state.cleanup_test.target_set) {
    story = await service.advanceStory(story.story_id, {
      session_id: sessionId,
      version: story.version,
      action_type: 'M6_MATCH_UPDATE',
      node_id: 'node_05',
      module_id: 'M6_CLEANUP_MATCHING',
      cleanup_target_id: target.cleanup_target_id,
      cleanup_method_id: target.preferred_method_id,
      client_action_id: randomUUID(),
    })
  }
  const completionId = randomUUID()
  return service.advanceStory(story.story_id, {
    session_id: sessionId,
    version: story.version,
    action_type: 'M6_MATCH_COMPLETE',
    node_id: 'node_05',
    module_id: 'M6_CLEANUP_MATCHING',
    completion_id: completionId,
    client_action_id: completionId,
  })
}

test('六道轨道题共享 node_04，只有 Q1 触发 Continue，Q6 触发 Ending', () => {
  assert.equal(GAME_STORY_STAGE_BINDINGS.length, 6)
  assert.equal(GAME_ANSWER_STORY_BINDINGS.length, 18)
  assert.deepEqual(
    GAME_STORY_STAGE_BINDINGS.map((item) => item.target_node_id),
    Array(6).fill('node_04'),
  )
  assert.equal(GAME_STORY_STAGE_BINDINGS[0].generation_stage, 'CONTINUE')
  assert.deepEqual(
    GAME_STORY_STAGE_BINDINGS.slice(1, 5).map((item) => item.generation_stage),
    Array(4).fill('STATE_ONLY'),
  )
  assert.equal(GAME_STORY_STAGE_BINDINGS[5].generation_stage, 'ENDING')
  assert.equal(GAME_STORY_STAGE_BINDINGS[0].triggers_story_generation, true)
  assert.ok(GAME_STORY_STAGE_BINDINGS.slice(1).every((item) => !item.triggers_story_generation))
  for (const event of ORBITAL_EVENTS) {
    assert.equal(event.options.length, 3)
    for (const answer of event.options) {
      const binding = resolveGameAnswerStoryBinding(event.id, answer.id)
      assert.equal(binding.answer_name, answer.label)
      assert.ok(binding.effect_summary)
      assert.ok(Number.isInteger(binding.state_delta.event_integrity))
      assert.equal(typeof binding.key_outcome, 'string')
    }
  }
})

test('Q1 只持久化一次 node_04 generation job，确认 API 不等待模型', async () => {
  const { service, repository, generator } = harness()
  const { request, story } = await createAtNode04(service)
  const callsBefore = generator.getCallCount()
  const accepted = await service.advanceStory(
    story.story_id,
    answerRequest(story, request.session_id, 1),
  )
  assert.equal(generator.getCallCount(), callsBefore)
  assert.equal(accepted.current_node_id, 'node_04')
  assert.equal(accepted.action_confirmation.queued_artifact, 'STORY_STAGE_3')
  assert.equal(accepted.public_game_state.orbital_events.resolved.length, 1)
  const jobs = await repository.getArtifactJobs(story.story_id)
  assert.deepEqual(jobs.map((job) => job.artifact_type), [
    'STORY_STAGE_1',
    'STORY_STAGE_2',
    'STORY_STAGE_3',
  ])
})

test('Q2 至 Q5 只累计状态、后果和 key outcome，不创建生成任务', async () => {
  const { service, repository, generator } = harness()
  const { request, story: atNode04 } = await createAtNode04(service)
  let story = await service.advanceStory(
    atNode04.story_id,
    answerRequest(atNode04, request.session_id, 1),
  )
  const jobCount = (await repository.getArtifactJobs(story.story_id)).length
  const calls = generator.getCallCount()
  for (let order = 2; order <= 5; order += 1) {
    story = await service.advanceStory(
      story.story_id,
      answerRequest(story, request.session_id, order),
    )
  }
  assert.equal(generator.getCallCount(), calls)
  assert.equal((await repository.getArtifactJobs(story.story_id)).length, jobCount)
  assert.equal(story.current_node_id, 'node_04')
  assert.equal(story.public_game_state.orbital_events.resolved.length, 5)
  const internal = repository.stories.get(story.story_id)
  assert.equal(internal.story_state.last_user_action.question_id, ORBITAL_EVENTS[4].id)
  assert.ok(internal.story_state.event_integrity >= 0 && internal.story_state.event_integrity <= 100)
  assert.ok(internal.story_state.relationship_connection >= 0 && internal.story_state.relationship_connection <= 100)
  assert.ok(internal.story_state.uncertainty >= 0 && internal.story_state.uncertainty <= 100)
})

test('node_04 worker 与后续答题并行，生成提交不会覆盖最新游戏状态', async () => {
  const fixture = createFixtureStoryGenerator()
  let blockStage3 = false
  let releaseGeneration
  let markStarted
  const gate = new Promise((resolve) => { releaseGeneration = resolve })
  const started = new Promise((resolve) => { markStarted = resolve })
  const generator = async (taskType, input, context) => {
    if (blockStage3 && taskType === 'STORY_CONTINUE' && input.current_node?.node_id === 'node_04') {
      blockStage3 = false
      markStarted()
      await gate
    }
    return fixture(taskType, input, context)
  }
  const { service } = harness(generator)
  const { request, story: atNode04 } = await createAtNode04(service)
  let story = await service.advanceStory(
    atNode04.story_id,
    answerRequest(atNode04, request.session_id, 1),
  )
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  blockStage3 = true
  const processing = service.processNextStoryJob(story.story_id, request.session_id)
  await started
  const afterSecondAnswer = await service.advanceStory(
    story.story_id,
    answerRequest(story, request.session_id, 2),
  )
  releaseGeneration()
  const generated = await processing
  assert.equal(generated.current_node_id, 'node_04')
  assert.equal(generated.version, afterSecondAnswer.version)
  assert.equal(generated.public_game_state.orbital_events.resolved.length, 2)
})

test('Q6 使用六题最终状态选结局，Ending 等待 node_04 handoff', async () => {
  const { service, repository, generator } = harness()
  const { request, story: atNode04 } = await createAtNode04(service)
  const callsBefore = generator.getCallCount()
  const story = await answerAll(service, atNode04, request.session_id)
  assert.equal(generator.getCallCount(), callsBefore)
  assert.equal(story.current_node_id, 'node_05')
  assert.equal(story.public_game_state.orbital_events.resolved.length, 6)
  const jobs = await repository.getArtifactJobs(story.story_id)
  assert.deepEqual(jobs.map((job) => job.artifact_type), [
    'STORY_STAGE_1',
    'STORY_STAGE_2',
    'STORY_STAGE_3',
    'ENDING',
  ])
  assert.equal(jobs.at(-1).status, 'WAITING_PREREQUISITE')
  const internal = repository.stories.get(story.story_id)
  assert.ok(internal.final_story.selected_ending_id)
  assert.equal(internal.story_state.last_user_action.question_id, ORBITAL_EVENTS[5].id)
})

test('PROCESSING worker 租约过期后可恢复', async () => {
  const { service, repository } = harness()
  const { request, story: atNode04 } = await createAtNode04(service)
  let story = await service.advanceStory(
    atNode04.story_id,
    answerRequest(atNode04, request.session_id, 1),
  )
  const first = await repository.claimNextArtifactJob(story.story_id, 2_000_000_000_000)
  assert.equal(first.state, 'claimed')
  const recovered = await repository.claimNextArtifactJob(
    story.story_id,
    2_000_000_000_000 + STORY_JOB_LEASE_MS + 1,
  )
  assert.equal(recovered.state, 'claimed')
  assert.equal(recovered.job.job_id, first.job.job_id)
  assert.equal(recovered.job.attempt_count, 2)
})

test('node_04 两次生成失败不回滚 Q1，Q2 仍可继续', async () => {
  const generator = createFixtureStoryGenerator()
  const { service, repository } = harness(generator)
  const { request, story: atNode04 } = await createAtNode04(service)
  let story = await service.advanceStory(
    atNode04.story_id,
    answerRequest(atNode04, request.session_id, 1),
  )
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  generator.failTask = 'STORY_CONTINUE'
  const stateBeforeFailure = structuredClone(repository.stories.get(story.story_id).story_state)
  await service.processNextStoryJob(story.story_id, request.session_id)
  story = await service.processNextStoryJob(story.story_id, request.session_id)
  assert.deepEqual(repository.stories.get(story.story_id).story_state, stateBeforeFailure)
  assert.equal(story.artifact_progress.failed_artifact, 'STORY_STAGE_3')
  const afterQ2 = await service.advanceStory(
    story.story_id,
    answerRequest(story, request.session_id, 2),
  )
  assert.equal(afterQ2.public_game_state.orbital_events.resolved.length, 2)
})

test('完整五节点故事只生成 3 次 Continue，M6 完成后只生成一次 Knowledge', async () => {
  const { service, repository, generator } = harness()
  const { request, story: atNode04 } = await createAtNode04(service)
  let story = await answerAll(service, atNode04, request.session_id)
  story = await processAllArtifactJobs(service, story, request.session_id)
  assert.equal(story.current_node_id, 'node_05')
  assert.deepEqual(
    story.timeline.map((stage) => stage.artifact_type),
    ['OPENING', 'STORY_STAGE_1', 'STORY_STAGE_2', 'STORY_STAGE_3', 'ENDING'],
  )
  story = await submitM6Completion(service, story, request.session_id)
  assert.equal(story.game_story_sync.queued_story_stages, 1)
  story = await processAllArtifactJobs(service, story, request.session_id)
  assert.equal(story.status, 'completed', JSON.stringify(story.artifact_progress))
  assert.deepEqual(
    story.timeline.map((stage) => stage.artifact_type),
    ['OPENING', 'STORY_STAGE_1', 'STORY_STAGE_2', 'STORY_STAGE_3', 'ENDING', 'KNOWLEDGE_REVEAL'],
  )
  assert.equal(
    generator.getCalls().filter((call) => call.taskType === 'STORY_CONTINUE').length,
    3,
  )
  assert.equal(
    generator.getCalls().filter((call) => call.taskType === 'KNOWLEDGE_REVEAL').length,
    1,
  )
  assert.equal(story.artifact_progress.metrics.model_calls_per_story, 7)
  assert.equal(story.artifact_progress.metrics.continue_calls_per_story, 3)
  assert.equal((await repository.getArtifactJobs(story.story_id)).length, 5)
})
