import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  MATERIAL_STORY_BINDINGS,
  materialControlId,
} from './config/material-story-bindings.js'
import {
  resolveNodeInteractionConfig,
  STORY_INTERACTION_MODE,
} from './config/node-interactions.js'
import { MATERIAL_OPTIONS } from './config/materials.js'
import {
  createFixtureStoryGenerator,
  DEFAULT_KNOWLEDGE_OUTPUT,
} from './fixtures.js'
import { MemoryStoryRepository } from './repository.js'
import {
  aggregateSiteConsequences,
  resolveSiteInteractionCommit,
} from './site-interactions.js'
import { StoryService } from './story-service.js'
import { applySiteInteraction } from './state-reducer.js'
import { validateKnowledgeReveal } from './validators.js'
import {
  buildM2MaterialInteractions,
  M2_MATERIAL_SECTIONS,
} from '../../src/services/storySiteInteractions.js'

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

function siteRequest(story, sessionId, overrides = {}) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_02',
    module_id: 'M2',
    interactions: buildM2MaterialInteractions(MATERIALS),
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
  const story = await service.createStory(create)
  return { repository, generator, service, create, story }
}

test('M2 后端绑定与真实页面 4×3 控件 ID 完全一致', () => {
  assert.equal(MATERIAL_STORY_BINDINGS.length, 12)
  assert.deepEqual(M2_MATERIAL_SECTIONS, [
    'frame',
    'solar',
    'insulation',
    'propulsion',
  ])
  for (const sectionId of M2_MATERIAL_SECTIONS) {
    const materials = MATERIAL_OPTIONS.filter(
      (material) => material.component_id === sectionId,
    )
    const bindings = MATERIAL_STORY_BINDINGS.filter(
      (binding) => binding.section_id === sectionId,
    )
    assert.equal(materials.length, 3)
    assert.equal(bindings.length, 3)
    assert.deepEqual(
      bindings.map((binding) => binding.control_id),
      materials.map((material) => materialControlId(sectionId, material.option_id)),
    )
  }
})

test('node_02 与 node_03 使用网站交互，node_04 接受六道 M4 题目，node_05 接受 M6', () => {
  const node02 = resolveNodeInteractionConfig('node_02')
  assert.equal(node02.interaction_mode, STORY_INTERACTION_MODE.SITE_COMPOSITE)
  assert.equal(node02.module_id, 'M2')
  assert.equal(node02.legacy_option_fallback, false)
  assert.deepEqual(node02.required_sections, M2_MATERIAL_SECTIONS)
  const node03 = resolveNodeInteractionConfig('node_03')
  assert.equal(node03.interaction_mode, STORY_INTERACTION_MODE.SITE_GROUP_SINGLE)
  assert.equal(node03.module_id, 'M3')
  assert.equal(node03.legacy_option_fallback, false)
  assert.deepEqual(node03.required_sections, ['mission_candidates'])
  const node04 = resolveNodeInteractionConfig('node_04')
  assert.equal(node04.interaction_mode, STORY_INTERACTION_MODE.SITE_GAME_RESULT)
  assert.equal(node04.module_id, 'M4_ORBITAL_EVENTS')
  assert.equal(node04.legacy_option_fallback, false)
  const node05 = resolveNodeInteractionConfig('node_05')
  assert.equal(node05.interaction_mode, STORY_INTERACTION_MODE.SITE_MATCHING_GAME)
  assert.equal(node05.module_id, 'M6_CLEANUP_MATCHING')
  for (const nodeId of ['node_06', 'node_07', 'node_08', 'node_09', 'node_10']) {
    assert.equal(resolveNodeInteractionConfig(nodeId), null)
  }
})

test('前端只构造稳定 ID，后端解析中性逐项 delta 并在汇总后统一计算状态', async () => {
  const { repository, story, create } = await harness()
  const internal = repository.stories.get(story.story_id)
  internal.story_state.event_integrity = 99
  internal.story_state.relationship_connection = 50
  internal.story_state.uncertainty = 1
  const request = siteRequest(story, create.session_id)
  assert.deepEqual(Object.keys(request.interactions[0]).sort(), [
    'control_id',
    'option_id',
    'section_id',
  ])

  const resolved = resolveSiteInteractionCommit(internal, request, NOW)
  assert.equal(resolved.snapshots.length, 4)
  assert.equal(resolved.transition.item_deltas.length, 4)
  assert.deepEqual(resolved.transition.combined_delta, {
    event_integrity: 0,
    relationship_connection: 0,
    uncertainty: 0,
  })
  assert.deepEqual(resolved.transition.after, {
    event_integrity: 99,
    relationship_connection: 50,
    uncertainty: 1,
  })
  assert.deepEqual(resolved.gameState.satellite_build.materials, MATERIALS)
  assert.equal(resolved.gameState.technical_metrics.reentry_risk, 'low')

  const syntheticSnapshots = structuredClone(resolved.snapshots)
  syntheticSnapshots[0].state_delta = {
    event_integrity: 20,
    relationship_connection: -60,
    uncertainty: 8,
  }
  const clamped = applySiteInteraction({
    runtimeState: internal.story_state,
    snapshots: syntheticSnapshots,
    combinedDelta: syntheticSnapshots.reduce((total, snapshot) => ({
      event_integrity: total.event_integrity + snapshot.state_delta.event_integrity,
      relationship_connection:
        total.relationship_connection + snapshot.state_delta.relationship_connection,
      uncertainty: total.uncertainty + snapshot.state_delta.uncertainty,
    }), { event_integrity: 0, relationship_connection: 0, uncertainty: 0 }),
    addConsequenceIds: [],
    resolveConsequenceIds: [],
    outcomes: resolved.outcomes,
    action: {
      node_id: 'node_02',
      module_id: 'M2',
      interaction_mode: 'SITE_COMPOSITE',
      client_action_id: randomUUID(),
    },
  })
  assert.deepEqual(clamped.after, {
    event_integrity: 100,
    relationship_connection: 0,
    uncertainty: 9,
  })
})

test('复合提交拒绝缺项、重复 section、跨 section option 与伪造 control', async () => {
  const { repository, story, create } = await harness()
  const internal = repository.stories.get(story.story_id)
  const valid = siteRequest(story, create.session_id)

  assert.throws(
    () => resolveSiteInteractionCommit(internal, {
      ...valid,
      interactions: valid.interactions.slice(0, 3),
    }, NOW),
    (error) => error.code === 'SITE_SECTION_MISSING',
  )
  assert.throws(
    () => resolveSiteInteractionCommit(internal, {
      ...valid,
      interactions: [valid.interactions[0], valid.interactions[0], ...valid.interactions.slice(2)],
    }, NOW),
    (error) => error.code === 'SITE_SECTION_DUPLICATED',
  )
  assert.throws(
    () => resolveSiteInteractionCommit(internal, {
      ...valid,
      interactions: valid.interactions.map((item) => (
        item.section_id === 'solar' ? { ...item, option_id: 'aluminum' } : item
      )),
    }, NOW),
    (error) => error.code === 'SITE_OPTION_NOT_IN_SECTION',
  )
  assert.throws(
    () => resolveSiteInteractionCommit(internal, {
      ...valid,
      interactions: valid.interactions.map((item) => (
        item.section_id === 'frame' ? { ...item, control_id: 'forged-control' } : item
      )),
    }, NOW),
    (error) => error.code === 'SITE_CONTROL_NOT_FOUND',
  )
})

test('同一 consequence 的 add/resolve 配置冲突会在运行前失败', () => {
  assert.throws(
    () => aggregateSiteConsequences([
      { add_consequence_ids: ['shared_plan'], resolve_consequence_ids: [] },
      { add_consequence_ids: [], resolve_consequence_ids: ['shared_plan'] },
    ]),
    (error) => error.code === 'SITE_INTERACTION_CONFIG_CONFLICT',
  )
})

test('请求 Schema 拒绝前端伪造 delta、后果和叙事结果', async () => {
  const { service, story, create, generator } = await harness()
  const callsBefore = generator.getCallCount()
  const forged = siteRequest(story, create.session_id)
  forged.interactions[0] = {
    ...forged.interactions[0],
    state_delta: { event_integrity: 100, relationship_connection: 100, uncertainty: -100 },
    add_consequence_ids: ['shared_plan'],
    key_outcome: '伪造结果',
  }
  await assert.rejects(
    service.advanceStory(story.story_id, forged),
    (error) => error.code === 'INVALID_INPUT',
  )
  assert.equal(generator.getCallCount(), callsBefore)
})

test('成功提交原子保存快照与汇总；同一 client_action_id 幂等且 stale version 被拒绝', async () => {
  const { repository, service, story, create, generator } = await harness()
  const action = siteRequest(story, create.session_id)
  const advanced = await service.advanceStory(story.story_id, action)
  assert.equal(advanced.current_node_id, 'node_03')
  assert.equal(advanced.current_checkpoint, 'mission')
  const interactions = await repository.getInteractions(story.story_id)
  assert.equal(interactions.length, 1)
  assert.equal(interactions[0].site_interactions.length, 4)
  assert.equal(interactions[0].item_deltas.length, 4)
  assert.deepEqual(interactions[0].combined_delta, {
    event_integrity: 0,
    relationship_connection: 0,
    uncertainty: 0,
  })
  assert.equal(interactions[0].site_outcomes.length, 4)
  const calls = generator.getCallCount()
  const replay = await service.advanceStory(story.story_id, action)
  assert.equal(replay.version, advanced.version)
  assert.equal(generator.getCallCount(), calls)

  await assert.rejects(
    service.advanceStory(story.story_id, siteRequest(story, create.session_id)),
    (error) => error.code === 'STALE_STORY_VERSION',
  )
  await assert.rejects(
    service.advanceStory(
      story.story_id,
      siteRequest(advanced, create.session_id),
    ),
    (error) => error.code === 'NODE_CONFLICT',
  )
})

test('node_02 禁止 legacy option，模型失败不回滚已提交的材料快照或状态', async () => {
  const { repository, service, story, create, generator } = await harness()
  await assert.rejects(
    service.advanceStory(story.story_id, {
      session_id: create.session_id,
      version: story.version,
      action_type: 'STORY_OPTION_SELECT',
      node_id: 'node_02',
      option_id: 'protect_irreplaceable_part',
      client_action_id: randomUUID(),
    }),
    (error) => error.code === 'INVALID_NODE_INTERACTION_MODE',
  )

  generator.failTask = 'STORY_CONTINUE'
  const committed = await service.advanceStory(
    story.story_id,
    siteRequest(story, create.session_id),
  )
  assert.equal(committed.current_node_id, 'node_03')
  await service.processNextStoryJob(story.story_id, create.session_id)
  const failed = await service.processNextStoryJob(
    story.story_id,
    create.session_id,
  )
  const after = repository.stories.get(story.story_id)
  assert.equal(after.current_node_id, 'node_03')
  assert.equal(after.version, committed.version)
  assert.deepEqual(
    after.game_state.satellite_build.materials,
    MATERIALS,
  )
  assert.equal((await repository.getInteractions(story.story_id)).length, 1)
  assert.equal((await repository.getStages(story.story_id)).length, 1)
  assert.equal(failed.artifact_progress.failed_artifact, 'STORY_STAGE_1')
})

test('Knowledge 旧故事保持空 insights，新故事只能引用真实材料 ID 与名称', async () => {
  assert.equal(
    validateKnowledgeReveal(structuredClone(DEFAULT_KNOWLEDGE_OUTPUT))
      .material_insights.length,
    0,
  )

  const selectedSiteOptions = MATERIAL_STORY_BINDINGS.slice(0, 2).map((binding) => ({
    module_id: binding.module_id,
    section_id: binding.section_id,
    section_name: binding.display_snapshot.section_name,
    option_id: binding.option_id,
    option_name: binding.display_snapshot.option_name,
    knowledge_profile: structuredClone(binding.knowledge_profile),
  }))
  const generator = createFixtureStoryGenerator()
  const output = await generator('KNOWLEDGE_REVEAL', {
    selected_site_options: selectedSiteOptions,
  })
  const validated = validateKnowledgeReveal(output, { selectedSiteOptions })
  assert.equal(validated.material_insights.length, 2)
  assert.deepEqual(
    validated.material_insights.map((insight) => insight.option_id),
    selectedSiteOptions.map((option) => option.option_id),
  )

  const forged = structuredClone(output)
  forged.material_insights[0].option_id = 'not-selected'
  assert.throws(
    () => validateKnowledgeReveal(forged, { selectedSiteOptions }),
    (error) => error.code === 'KNOWLEDGE_MATERIAL_INSIGHTS_INVALID',
  )
})

test('旧版进行中故事只能读取，不能再写入产品或叙事操作', async () => {
  const { repository, service, story, create } = await harness()
  repository.stories.get(story.story_id).prompt_metadata.spec_version = '2.0-numeric-state'
  await assert.rejects(
    service.advanceStory(story.story_id, {
      session_id: create.session_id,
      version: story.version,
      action_type: 'MISSION_SELECT',
      source_id: 'mission',
      action_id: 'weather',
      payload: {},
    }),
    (error) => error.code === 'STORY_VERSION_NOT_CONTINUABLE',
  )
  await assert.rejects(
    service.processNextStoryJob(story.story_id, create.session_id),
    (error) => error.code === 'STORY_VERSION_NOT_CONTINUABLE',
  )
  assert.equal((await repository.getInteractions(story.story_id)).length, 0)
})
