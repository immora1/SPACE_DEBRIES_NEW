import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_MISSION_ID,
  MISSION_CANDIDATES,
} from '../../src/modules/M3/missionCandidates.js'
import {
  buildM2MaterialInteractions,
  buildM3MissionInteractions,
  getSiteInteractionProgress,
} from '../../src/services/storySiteInteractions.js'
import {
  MISSION_CANDIDATE_SECTION_ID,
  MISSION_STORY_BINDINGS,
  missionControlId,
} from './config/mission-story-bindings.js'
import { MISSION_OPTIONS } from './config/missions.js'
import {
  resolveNodeInteractionConfig,
  STORY_INTERACTION_MODE,
} from './config/node-interactions.js'
import { createFixtureStoryGenerator } from './fixtures.js'
import { MemoryStoryRepository } from './repository.js'
import { resolveSiteInteractionCommit } from './site-interactions.js'
import {
  buildKnowledgeContext,
} from './story-context.js'
import { StoryService } from './story-service.js'
import { validateKnowledgeReveal } from './validators.js'

const NOW = 1_900_000_000_000
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
    important_event: '外婆最后一次展示走马灯，我要写完灯诗、装回灯片并共同点灯。',
    satellite: { name: 'TEST-SAT', altitudeKm: 836 },
    game_context: { damage_level: 0, history_event_ids: [] },
    language: 'zh',
  }
}

function materialRequest(story, sessionId) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_02',
    module_id: 'M2',
    interactions: buildM2MaterialInteractions(MATERIALS),
    client_action_id: randomUUID(),
  }
}

function missionRequest(story, sessionId, taskId = 'weather', overrides = {}) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_03',
    module_id: 'M3',
    interactions: buildM3MissionInteractions(taskId),
    client_action_id: randomUUID(),
    ...overrides,
  }
}

async function harness() {
  const repository = new MemoryStoryRepository()
  const generator = createFixtureStoryGenerator()
  const service = new StoryService({
    repository,
    generateOutput: generator,
    clock: () => NOW,
  })
  const create = createRequest()
  let story = await service.createStory(create)
  story = await service.advanceStory(
    story.story_id,
    materialRequest(story, create.session_id),
  )
  return { repository, generator, service, create, story }
}

async function processAllArtifactJobs(service, story, sessionId, limit = 20) {
  let current = story
  for (let index = 0; index < limit; index += 1) {
    if (current.game_story_sync.queued_story_stages === 0) return current
    current = await service.processNextStoryJob(current.story_id, sessionId)
  }
  assert.fail(`Artifact jobs did not drain after ${limit} attempts.`)
}

test('真实任务 UI、后端任务配置与四个故事绑定按稳定 task_id 一致', () => {
  assert.equal(DEFAULT_MISSION_ID, 'weather')
  assert.deepEqual(
    MISSION_CANDIDATES.map((mission) => mission.id),
    MISSION_OPTIONS.map((mission) => mission.action_id),
  )
  assert.equal(MISSION_STORY_BINDINGS.length, 4)
  for (const [index, mission] of MISSION_OPTIONS.entries()) {
    const uiMission = MISSION_CANDIDATES[index]
    const binding = MISSION_STORY_BINDINGS[index]
    assert.equal(uiMission.label, mission.label)
    assert.equal(uiMission.desc, mission.description)
    assert.equal(uiMission.orbit, mission.orbit)
    assert.equal(uiMission.example, mission.example)
    assert.equal(binding.task_id, mission.action_id)
    assert.equal(binding.control_id, missionControlId(mission.action_id))
    assert.equal(binding.section_id, MISSION_CANDIDATE_SECTION_ID)
    assert.match(binding.effect_summary, new RegExp(mission.description.slice(0, 8)))
    assert.ok(Object.values(binding.state_delta).every(Number.isInteger))
    assert.deepEqual(binding.add_consequence_ids, [])
    assert.deepEqual(binding.resolve_consequence_ids, [])
    assert.equal(binding.task_profile.objective_summary, mission.description)
    assert.ok(binding.knowledge_profile.safe_facts.includes(mission.orbit))
  }
})

test('node_03 中央配置为 M3 SITE_GROUP_SINGLE 且不公开 legacy 选项', async () => {
  const config = resolveNodeInteractionConfig('node_03')
  assert.equal(config.interaction_mode, STORY_INTERACTION_MODE.SITE_GROUP_SINGLE)
  assert.equal(config.module_id, 'M3')
  assert.equal(config.trigger_mode, 'ON_GROUP_CONFIRM')
  assert.deepEqual(config.required_sections, ['mission_candidates'])
  assert.equal(config.legacy_option_fallback, false)
  const { story } = await harness()
  assert.equal(story.current_node_id, 'node_03')
  assert.deepEqual(story.current_options, [])
  assert.equal(story.current_interaction.interaction_mode, 'SITE_GROUP_SINGLE')
})

test('前端任务请求只含稳定 ID，确认前后进度为 0/1 与 1/1', () => {
  const interactions = buildM3MissionInteractions('imaging')
  assert.deepEqual(interactions, [{
    section_id: 'mission_candidates',
    control_id: 'm3-mission-imaging',
    option_id: 'imaging',
  }])
  assert.deepEqual(Object.keys(interactions[0]).sort(), [
    'control_id',
    'option_id',
    'section_id',
  ])
  const config = resolveNodeInteractionConfig('node_03')
  assert.deepEqual(getSiteInteractionProgress(config, { mission: null }), {
    completed: 0,
    total: 1,
  })
  assert.deepEqual(getSiteInteractionProgress(config, { mission: 'imaging' }), {
    completed: 1,
    total: 1,
  })
})

test('node_03 resolver 保存完整任务快照并分离更新 game_state 与 story_state', async () => {
  const { repository, story, create } = await harness()
  const internal = repository.stories.get(story.story_id)
  const beforeState = structuredClone(internal.story_state)
  const resolution = resolveSiteInteractionCommit(
    internal,
    missionRequest(story, create.session_id, 'science'),
    NOW,
  )
  assert.equal(resolution.snapshots.length, 1)
  const [snapshot] = resolution.snapshots
  assert.equal(snapshot.task_id, 'science')
  assert.equal(snapshot.task_name, '科学探测')
  assert.equal(snapshot.option_id, 'science')
  assert.equal(snapshot.task_profile.orbit_or_range, MISSION_OPTIONS[3].orbit)
  assert.deepEqual(resolution.transition.combined_delta, snapshot.state_delta)
  assert.deepEqual(resolution.transition.after, {
    event_integrity: beforeState.event_integrity,
    relationship_connection: beforeState.relationship_connection,
    uncertainty: beforeState.uncertainty,
  })
  assert.deepEqual(resolution.gameState.mission, {
    mission_id: 'SCIENTIFIC_EXPLORATION',
    action_id: 'science',
  })
  assert.deepEqual(internal.game_state.mission, { mission_id: null, action_id: null })
  assert.equal(resolution.nextCheckpoint, 'orbital_events')
})

test('node_03 拒绝缺选、多选、未知任务、错 control、错组和错 module', async () => {
  const { repository, story, create } = await harness()
  const internal = repository.stories.get(story.story_id)
  const valid = missionRequest(story, create.session_id)
  const cases = [
    [{ ...valid, interactions: [] }, 'TASK_SELECTION_REQUIRED'],
    [{ ...valid, interactions: [...valid.interactions, ...valid.interactions] }, 'TASK_SELECTION_REQUIRED'],
    [{ ...valid, interactions: [{ ...valid.interactions[0], option_id: 'unknown', control_id: 'm3-mission-unknown' }] }, 'TASK_NOT_FOUND'],
    [{ ...valid, interactions: [{ ...valid.interactions[0], control_id: 'm3-mission-science' }] }, 'TASK_CONTROL_MISMATCH'],
    [{ ...valid, interactions: [{ ...valid.interactions[0], section_id: 'other_group' }] }, 'TASK_NOT_IN_CANDIDATE_GROUP'],
    [{ ...valid, module_id: 'M2' }, 'INVALID_NODE_INTERACTION_MODE'],
  ]
  for (const [request, code] of cases) {
    assert.throws(
      () => resolveSiteInteractionCommit(internal, request, NOW),
      (error) => error.code === code,
    )
  }
})

test('伪造任务内部字段和 node_03 legacy 选项在模型调用前被拒绝', async () => {
  const { service, story, create, generator } = await harness()
  const callsBefore = generator.getCallCount()
  const forged = missionRequest(story, create.session_id)
  forged.interactions[0].task_name = '伪造任务'
  forged.interactions[0].state_delta = {
    event_integrity: 100,
    relationship_connection: 100,
    uncertainty: -100,
  }
  await assert.rejects(
    service.advanceStory(story.story_id, forged),
    (error) => error.code === 'INVALID_INPUT',
  )
  await assert.rejects(
    service.advanceStory(story.story_id, {
      session_id: create.session_id,
      version: story.version,
      action_type: 'STORY_OPTION_SELECT',
      node_id: 'node_03',
      option_id: 'prepare_reversible_backup',
      client_action_id: randomUUID(),
    }),
    (error) => error.code === 'INVALID_NODE_INTERACTION_MODE',
  )
  assert.equal(generator.getCallCount(), callsBefore)
})

test('node_03 原子推进 node_04，幂等且模型失败不回滚网站状态', async () => {
  const { repository, service, story, create, generator } = await harness()
  const action = missionRequest(story, create.session_id, 'comms')
  generator.failTask = 'STORY_CONTINUE'
  const advanced = await service.advanceStory(story.story_id, action)
  assert.equal(advanced.current_node_id, 'node_04')
  assert.equal(advanced.current_checkpoint, 'orbital_events')
  assert.equal(advanced.public_game_state.mission.action_id, 'comms')
  const interactions = await repository.getInteractions(story.story_id)
  assert.equal(interactions.length, 2)
  assert.equal(interactions.at(-1).site_interactions[0].task_id, 'comms')
  assert.equal(interactions.at(-1).site_interactions[0].task_name, '通信中继')

  const calls = generator.getCallCount()
  const replay = await service.advanceStory(story.story_id, action)
  assert.equal(replay.version, advanced.version)
  assert.equal(generator.getCallCount(), calls)
  await assert.rejects(
    service.advanceStory(
      story.story_id,
      missionRequest(advanced, create.session_id, 'science'),
    ),
    (error) => error.code === 'NODE_CONFLICT',
  )

  await service.processNextStoryJob(story.story_id, create.session_id)
  const failed = await service.processNextStoryJob(
    story.story_id,
    create.session_id,
  )
  assert.equal(failed.current_node_id, 'node_04')
  assert.equal(failed.version, advanced.version)
  assert.equal(failed.artifact_progress.failed_artifact, 'STORY_STAGE_1')
})

test('node_03 Continue、Ending 与 Knowledge 只读取已保存的实际任务快照', async () => {
  const { repository, service, story, create, generator } = await harness()
  let advanced = await service.advanceStory(
    story.story_id,
    missionRequest(story, create.session_id, 'imaging'),
  )
  advanced = await processAllArtifactJobs(
    service,
    advanced,
    create.session_id,
  )
  const calls = generator.getCalls()
  const continueCall = [...calls].reverse().find(
    (call) => call.taskType === 'STORY_CONTINUE',
  )
  assert.equal(continueCall.input.current_node.node_id, 'node_03')
  assert.equal(continueCall.input.generation_source.interaction_node_id, 'node_03')
  assert.equal(
    continueCall.input.generation_source.interaction_snapshot.selections.length,
    1,
  )
  assert.equal(
    continueCall.input.generation_source.interaction_snapshot.selections[0].option_id,
    'imaging',
  )
  assert.ok(!JSON.stringify(continueCall.input).includes('weather'))

  const internal = repository.stories.get(story.story_id)
  const interactions = await repository.getInteractions(story.story_id)
  const stages = await repository.getStages(story.story_id)
  const context = buildKnowledgeContext({
    story: internal,
    endingOutput: {
      ending_summary: '任务在已确认的条件下结束。',
      next_node_context: '轨道异常造成了短暂的信息更新偏差。',
    },
    stages,
    interactions,
  })
  const selectedMission = context.selected_site_options.filter(
    (option) => option.section_id === 'mission_candidates',
  )
  assert.equal(selectedMission.length, 1)
  assert.equal(selectedMission[0].option_id, 'imaging')
  assert.ok(!JSON.stringify(selectedMission).includes('气象监测'))
  const knowledgeOutput = await createFixtureStoryGenerator()(
    'KNOWLEDGE_REVEAL',
    context,
  )
  const validated = validateKnowledgeReveal(knowledgeOutput, {
    selectedSiteOptions: context.selected_site_options,
  })
  assert.equal(validated.mission_insights.length, 1)
  assert.equal(validated.mission_insights[0].option_id, 'imaging')
  assert.ok(!JSON.stringify(advanced).includes('knowledge_profile'))
  assert.ok(!JSON.stringify(advanced).includes('task_profile'))
})

test('通用 Continue Context 对单任务保持 combined_delta 等于 task_delta', async () => {
  const { repository, service, story, create, generator } = await harness()
  const internal = repository.stories.get(story.story_id)
  const resolution = resolveSiteInteractionCommit(
    internal,
    missionRequest(story, create.session_id, 'weather'),
    NOW,
  )
  let advanced = await service.advanceStory(
    story.story_id,
    missionRequest(story, create.session_id, 'weather'),
  )
  advanced = await processAllArtifactJobs(service, advanced, create.session_id)
  assert.equal(advanced.artifact_progress.last_ready_artifact, 'STORY_STAGE_2')
  const context = generator.getCalls().at(-1).input
  assert.deepEqual(
    context.state_transition.delta,
    resolution.snapshots[0].state_delta,
  )
  assert.equal('item_deltas' in context.state_transition, false)
  assert.equal(
    context.generation_source.interaction_snapshot.selections[0].section_id,
    'mission_candidates',
  )
  assert.equal(context.generation_source.interaction_node_id, 'node_03')
})

test('node_03 rejects stale and legacy mission requests before generation', async () => {
  const { service, story, create, generator } = await harness()
  const callsBefore = generator.getCallCount()

  await assert.rejects(
    service.advanceStory(
      story.story_id,
      missionRequest(story, create.session_id, 'weather', {
        version: story.version - 1,
      }),
    ),
    (error) => error.code === 'STALE_STORY_VERSION',
  )
  await assert.rejects(
    service.advanceStory(story.story_id, {
      session_id: create.session_id,
      version: story.version,
      action_type: 'MISSION_SELECT',
      source_id: 'mission',
      action_id: 'weather',
      payload: {},
    }),
    (error) => error.code === 'INVALID_NODE_INTERACTION_MODE',
  )

  assert.equal(generator.getCallCount(), callsBefore)
})

test('node_03 concurrent commits accept one canonical interaction without waiting for generation', async () => {
  const repository = new MemoryStoryRepository()
  const fixtureGenerator = createFixtureStoryGenerator()
  const generator = fixtureGenerator
  const service = new StoryService({
    repository,
    generateOutput: generator,
    clock: () => NOW,
  })
  const create = createRequest()
  let story = await service.createStory(create)
  story = await service.advanceStory(
    story.story_id,
    materialRequest(story, create.session_id),
  )
  const firstAction = missionRequest(story, create.session_id, 'weather')
  const firstAdvance = await service.advanceStory(story.story_id, firstAction)
  await assert.rejects(
    service.advanceStory(
      story.story_id,
      missionRequest(story, create.session_id, 'science'),
    ),
    (error) => error.code === 'STALE_STORY_VERSION',
  )
  assert.equal(firstAdvance.current_node_id, 'node_04')
  assert.equal(firstAdvance.public_game_state.mission.action_id, 'weather')
  assert.equal((await repository.getInteractions(story.story_id)).length, 2)
})
