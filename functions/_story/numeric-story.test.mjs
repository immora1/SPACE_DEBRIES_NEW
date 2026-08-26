import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  CONSEQUENCE_CATALOG,
  STORY_OPTION_SETS,
  resolveOptionsForNode,
  validateNodeOptions,
} from './config/story-options.js'
import { selectEnding } from './ending-selector.js'
import {
  createFixtureStoryGenerator,
  DEFAULT_CONTINUE_OUTPUT,
  DEFAULT_KNOWLEDGE_OUTPUT,
  ENDING_PARAGRAPHS,
  VALID_OPENING_FIXTURE,
} from './fixtures.js'
import { MemoryStoryRepository } from './repository.js'
import {
  applyStateDelta,
  applyStoryOption,
} from './state-reducer.js'
import { StoryService } from './story-service.js'

function request(overrides = {}) {
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

function harness(generator = createFixtureStoryGenerator()) {
  const repository = new MemoryStoryRepository()
  const service = new StoryService({
    repository,
    generateOutput: generator,
    clock: () => 1_900_000_000_000,
  })
  return { repository, service, generator }
}

function optionRequest(story, optionId = story.current_options[0].option_id, overrides = {}) {
  return {
    session_id: overrides.session_id,
    version: story.version,
    action_type: 'STORY_OPTION_SELECT',
    node_id: story.current_node_id,
    option_id: optionId,
    client_action_id: overrides.client_action_id || randomUUID(),
  }
}

function choiceState(overrides = {}) {
  return {
    confirmed_facts: [],
    known_to_user: [],
    hidden_facts: [],
    event_integrity: 95,
    relationship_connection: 4,
    uncertainty: 98,
    current_node_id: 'node_02',
    active_consequences: [],
    key_outcomes: [],
    last_user_action: null,
    ...overrides,
  }
}

test('节点真实保留三/四选项，非法数量可诊断失败', () => {
  const three = resolveOptionsForNode({}, 'node_02')
  const four = resolveOptionsForNode({}, 'node_03')
  assert.equal(three.length, 3)
  assert.equal(four.length, 4)
  assert.equal(four[3].option_id, 'prepare_reversible_backup')
  assert.throws(
    () => validateNodeOptions('node_test', three.slice(0, 2)),
    (error) => error.code === 'OPTION_COUNT_INVALID',
  )
})

test('state delta 使用整数逐字段计算并 clamp 到 0..100', () => {
  assert.deepEqual(
    applyStateDelta(
      {
        event_integrity: 95,
        relationship_connection: 4,
        uncertainty: 98,
      },
      {
        event_integrity: 20,
        relationship_connection: -10,
        uncertainty: 8,
      },
    ),
    {
      event_integrity: 100,
      relationship_connection: 0,
      uncertainty: 100,
    },
  )
  assert.deepEqual(
    applyStateDelta(
      { event_integrity: 40, relationship_connection: 50, uncertainty: 60 },
      { event_integrity: 7, relationship_connection: -8, uncertainty: 0 },
    ),
    { event_integrity: 47, relationship_connection: 42, uncertainty: 60 },
  )
  assert.deepEqual(
    applyStateDelta(
      { event_integrity: 0, relationship_connection: 100, uncertainty: 50 },
      { event_integrity: -1, relationship_connection: 1, uncertainty: 0 },
    ),
    { event_integrity: 0, relationship_connection: 100, uncertainty: 50 },
  )
})

test('consequence 解除路径只引用此前节点可能激活的后果', () => {
  const possible = new Set()
  for (const nodeId of [
    'node_02',
    'node_03',
    'node_04',
    'node_05',
    'node_06',
    'node_07',
    'node_08',
  ]) {
    for (const option of STORY_OPTION_SETS[nodeId]) {
      for (const consequenceId of option.resolve_consequence_ids) {
        assert.equal(
          possible.has(consequenceId),
          true,
          `${nodeId}/${option.option_id} cannot resolve ${consequenceId}`,
        )
      }
    }
    for (const option of STORY_OPTION_SETS[nodeId]) {
      option.add_consequence_ids.forEach((consequenceId) => possible.add(consequenceId))
    }
  }
  assert.equal(
    Object.values(STORY_OPTION_SETS)
      .flat()
      .some((option) => option.resolve_consequence_ids.includes('visible_irreplaceable_loss')),
    false,
  )
})

test('选项的 consequence add/resolve 与 key outcome 由后端累计', () => {
  const state = choiceState({
    active_consequences: ['coordination_strain', 'unclear_signal'],
  })
  const option = resolveOptionsForNode({}, 'node_05')[1]
  const transition = applyStoryOption(state, option, {
    node_id: 'node_03',
    option_id: option.option_id,
    client_action_id: randomUUID(),
  })
  assert.deepEqual(transition.state.active_consequences, [
    'unclear_signal',
    'shared_plan',
  ])
  assert.deepEqual(transition.state.key_outcomes, [
    '人物之间重新建立了可执行的配合方式。',
  ])
})

test('Ending 规则按 priority、约束数、原顺序消解并支持 fallback', () => {
  const ending = (endingId, priority, conditions, fallback = false) => ({
    ending_id: endingId,
    outcome: endingId,
    state_rule: {
      priority,
      conditions,
      required_consequence_ids: [],
      forbidden_consequence_ids: [],
      fallback,
    },
  })
  const endings = [
    ending('first', 20, [{ metric: 'event_integrity', operator: 'gte', value: 50 }]),
    ending('more-specific', 20, [
      { metric: 'event_integrity', operator: 'gte', value: 50 },
      { metric: 'uncertainty', operator: 'lte', value: 50 },
    ]),
    ending('fallback', 0, [], true),
  ]
  const selected = selectEnding({
    reachableEndings: endings,
    storyState: {
      event_integrity: 70,
      relationship_connection: 50,
      uncertainty: 30,
    },
    activeConsequenceIds: [],
  })
  assert.equal(selected.ending.ending_id, 'more-specific')
  assert.equal(selected.trace.used_fallback, false)
  assert.equal(selected.trace.evaluated[0].condition_results[0].actual, 70)
  assert.deepEqual(selected.trace.evaluated[0].missing_required_consequence_ids, [])
  assert.deepEqual(selected.trace.evaluated[0].present_forbidden_consequence_ids, [])

  const fallback = selectEnding({
    reachableEndings: endings,
    storyState: {
      event_integrity: 10,
      relationship_connection: 50,
      uncertainty: 90,
    },
    activeConsequenceIds: [],
  })
  assert.equal(fallback.ending.ending_id, 'fallback')
  assert.equal(fallback.trace.used_fallback, true)
})

test('Ending required/forbidden consequence 规则给出可审计的不命中原因', () => {
  const result = selectEnding({
    reachableEndings: [
      {
        ending_id: 'constrained',
        outcome: '受约束结局',
        state_rule: {
          priority: 10,
          conditions: [],
          required_consequence_ids: ['shared_plan'],
          forbidden_consequence_ids: ['visible_irreplaceable_loss'],
          fallback: false,
        },
      },
      {
        ending_id: 'fallback',
        outcome: '保底结局',
        state_rule: {
          priority: 0,
          conditions: [],
          required_consequence_ids: [],
          forbidden_consequence_ids: [],
          fallback: true,
        },
      },
    ],
    storyState: {
      event_integrity: 50,
      relationship_connection: 50,
      uncertainty: 50,
    },
    activeConsequenceIds: ['visible_irreplaceable_loss'],
  })

  assert.equal(result.ending.ending_id, 'fallback')
  assert.deepEqual(
    result.trace.evaluated[0].missing_required_consequence_ids,
    ['shared_plan'],
  )
  assert.deepEqual(
    result.trace.evaluated[0].present_forbidden_consequence_ids,
    ['visible_irreplaceable_loss'],
  )
})

test('node_02 使用 Opening handoff，Continue context 不含 label 或旧等级字段', async () => {
  const { service, generator } = harness()
  const create = request()
  const story = await service.createStory(create)
  const advanced = await service.advanceStory(
    story.story_id,
    optionRequest(story, undefined, { session_id: create.session_id }),
  )
  assert.equal(advanced.current_node_id, 'node_03')
  const continueCall = generator.getCalls()[2]
  assert.equal(continueCall.taskType, 'STORY_CONTINUE')
  assert.equal(
    continueCall.input.previous_handoff.current_situation,
    VALID_OPENING_FIXTURE.continuity_handoff.current_situation,
  )
  assert.equal(Object.hasOwn(continueCall.input.selected_option_effect, 'label'), false)
  const serialized = JSON.stringify(continueCall.input)
  assert.equal(serialized.includes('interaction_result'), false)
  assert.equal(serialized.includes('POSITIVE'), false)
  assert.equal(serialized.includes('PARTIAL'), false)
  assert.equal(serialized.includes('NEGATIVE'), false)
})

test('Continue 正文过短时重试提示包含明确字符和段落目标', async () => {
  const shortOutput = structuredClone(DEFAULT_CONTINUE_OUTPUT)
  shortOutput.story_text = [
    '你护住灯片，风从天井边缘压下来。',
    '你与外婆重新分工，门外脚步逐渐靠近。',
    '你停在下一次动作前，修补边缘仍待确认。',
  ].join('\n\n')
  const generator = createFixtureStoryGenerator({
    continueOutputs: [shortOutput, DEFAULT_CONTINUE_OUTPUT],
  })
  const { service } = harness(generator)
  const create = request()
  const story = await service.createStory(create)

  const advanced = await service.advanceStory(
    story.story_id,
    optionRequest(story, undefined, { session_id: create.session_id }),
  )

  assert.equal(advanced.current_node_id, 'node_03')
  const reason = generator.getCalls()[3].context.retryReason
  assert.match(reason, /CONTINUE_STORY_TEXT_INVALID/)
  assert.match(reason, /420-500 个汉字/)
  assert.match(reason, /3-5 段/)
  assert.match(reason, /第二人称“你”/)
})

test('相同 client_action_id 幂等返回且不会重复累计状态或调用模型', async () => {
  const { service, repository, generator } = harness()
  const create = request()
  const story = await service.createStory(create)
  const action = optionRequest(story, undefined, {
    session_id: create.session_id,
    client_action_id: randomUUID(),
  })
  const first = await service.advanceStory(story.story_id, action)
  const callsAfterFirst = generator.getCallCount()
  const second = await service.advanceStory(story.story_id, action)
  assert.equal(second.version, first.version)
  assert.equal(generator.getCallCount(), callsAfterFirst)
  const interactions = await repository.getInteractions(story.story_id)
  assert.equal(interactions.length, 1)
})

test('四选项节点可真实提交第四项且按稳定 option_id 推进', async () => {
  const { service, repository } = harness()
  const create = request()
  let story = await service.createStory(create)
  story = await service.advanceStory(
    story.story_id,
    optionRequest(story, story.current_options[0].option_id, {
      session_id: create.session_id,
    }),
  )
  assert.equal(story.current_node_id, 'node_03')
  assert.equal(story.current_options.length, 4)

  const fourth = story.current_options[3]
  story = await service.advanceStory(
    story.story_id,
    optionRequest(story, fourth.option_id, {
      session_id: create.session_id,
    }),
  )
  assert.equal(fourth.option_id, 'prepare_reversible_backup')
  assert.equal(story.current_node_id, 'node_04')
  const interactions = await repository.getInteractions(story.story_id)
  assert.equal(interactions.at(-1).action_id, fourth.option_id)
  assert.deepEqual(interactions.at(-1).state_delta, {
    event_integrity: 3,
    relationship_connection: -3,
    uncertainty: -4,
  })
})

test('现有材料/任务动作继续确定性更新 game_state，不冒充故事节点', async () => {
  const { service, repository, generator } = harness()
  const create = request()
  let story = await service.createStory(create)
  const initialCalls = generator.getCallCount()
  story = await service.advanceStory(story.story_id, {
    session_id: create.session_id,
    version: story.version,
    action_type: 'MATERIALS_COMMIT',
    source_id: 'satellite_build',
    action_id: 'materials_commit',
    payload: {
      selections: {
        frame: 'aluminum',
        solar: 'silicon',
        insulation: 'kapton',
        propulsion: 'aluminum-tank',
      },
    },
  })
  assert.equal(story.current_node_id, 'node_02')
  assert.equal(story.current_checkpoint, 'mission')
  assert.equal(story.timeline.length, 1)
  assert.equal(generator.getCallCount(), initialCalls)
  assert.deepEqual(story.public_game_state.satellite_build.material_profiles, {
    frame: 'low',
    solar: 'medium',
    insulation: 'low',
    propulsion: 'low',
  })
  assert.equal(story.public_game_state.technical_metrics.fuel, 100)
  assert.equal(story.public_game_state.technical_metrics.armor, 100)

  story = await service.advanceStory(story.story_id, {
    session_id: create.session_id,
    version: story.version,
    action_type: 'MISSION_SELECT',
    source_id: 'mission',
    action_id: 'weather',
    payload: {},
  })
  assert.equal(story.current_checkpoint, 'orbital_events')
  assert.equal(story.public_game_state.mission.action_id, 'weather_monitoring')
  assert.equal(story.public_game_state.mission.mission_id, 'weather_monitoring')
  assert.equal(story.public_game_state.mission.orbit_profile.profile_id, 'sso_leo_800')
  assert.equal(story.public_game_state.mission.orbit_profile.altitude_km, 800)
  assert.equal((await repository.getInteractions(story.story_id)).length, 2)
})

test('模型失败不会更新状态、消费选项或推进节点，同一 action 可重试', async () => {
  const generator = createFixtureStoryGenerator()
  const { service, repository } = harness(generator)
  const create = request()
  const story = await service.createStory(create)
  const before = structuredClone(repository.stories.get(story.story_id))
  const action = optionRequest(story, undefined, {
    session_id: create.session_id,
    client_action_id: randomUUID(),
  })
  generator.failTask = 'STORY_CONTINUE'
  await assert.rejects(
    service.advanceStory(story.story_id, action),
    (error) => error.code === 'AI_REQUEST_FAILED',
  )
  const failed = repository.stories.get(story.story_id)
  assert.deepEqual(failed.story_state, before.story_state)
  assert.equal(failed.version, before.version)
  assert.equal((await repository.getStages(story.story_id)).length, 1)

  generator.failTask = null
  const retried = await service.advanceStory(story.story_id, action)
  assert.equal(retried.current_node_id, 'node_03')
})

test('并发提交同一 version 只有一个生成进入执行并成功推进', async () => {
  const base = createFixtureStoryGenerator()
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const generator = async (taskType, input, context) => {
    if (taskType === 'STORY_CONTINUE') await gate
    return base(taskType, input, context)
  }
  const { service } = harness(generator)
  const create = request()
  const story = await service.createStory(create)
  const firstAction = optionRequest(story, story.current_options[0].option_id, {
    session_id: create.session_id,
  })
  const secondAction = optionRequest(story, story.current_options[1].option_id, {
    session_id: create.session_id,
  })
  const first = service.advanceStory(story.story_id, firstAction)
  await new Promise((resolve) => setImmediate(resolve))
  await assert.rejects(
    service.advanceStory(story.story_id, secondAction),
    (error) => error.code === 'GENERATION_IN_PROGRESS',
  )
  release()
  const result = await first
  assert.equal(result.version, story.version + 1)
  assert.equal(result.current_node_id, 'node_03')
})

test('错误 selected_ending_id 被拒绝且 node_08 选择完全回滚', async () => {
  const wrongEnding = {
    task_type: 'STORY_ENDING',
    node_id: 'node_09',
    selected_ending_id: 'wrong-ending',
    story_text: ENDING_PARAGRAPHS,
    ending_summary: '核心事件完成，但模型故意返回错误的结局 ID。',
    next_node_context: '异常仍待解释。',
    next_node_id: 'node_10',
  }
  const generator = createFixtureStoryGenerator({ endingOutputs: [wrongEnding] })
  const { service, repository } = harness(generator)
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 6; index += 1) {
    story = await service.advanceStory(
      story.story_id,
      optionRequest(story, undefined, { session_id: create.session_id }),
    )
  }
  assert.equal(story.current_node_id, 'node_08')
  const before = structuredClone(repository.stories.get(story.story_id))
  await assert.rejects(
    service.advanceStory(
      story.story_id,
      optionRequest(story, undefined, { session_id: create.session_id }),
    ),
    (error) => error.code === 'ENDING_ID_MISMATCH',
  )
  const after = repository.stories.get(story.story_id)
  assert.equal(after.version, before.version)
  assert.deepEqual(after.story_state, before.story_state)
  assert.equal((await repository.getStages(story.story_id)).at(-1).node_id, 'node_07')
})

test('完整 node_02..08 后按 Continue→Ending→Knowledge 原子完成', async () => {
  const { service, repository, generator } = harness()
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 7; index += 1) {
    story = await service.advanceStory(
      story.story_id,
      optionRequest(story, undefined, { session_id: create.session_id }),
    )
  }
  assert.equal(story.status, 'completed')
  assert.equal(story.current_node_id, null)
  assert.equal(story.current_options.length, 0)
  assert.ok(story.final_story_if_completed.ending)
  assert.ok(story.final_story_if_completed.knowledge_reveal)
  const calls = generator.getCalls().map((call) => call.taskType)
  assert.deepEqual(calls.slice(-3), [
    'STORY_CONTINUE',
    'STORY_ENDING',
    'KNOWLEDGE_REVEAL',
  ])
  const internal = repository.stories.get(story.story_id)
  assert.equal(internal.story_state.event_integrity <= 100, true)
  assert.equal(internal.story_state.relationship_connection >= 0, true)
  assert.equal(internal.story_state.uncertainty >= 0, true)
  assert.equal(internal.story_state.current_node_id, null)
  for (const consequenceId of internal.story_state.active_consequences) {
    assert.ok(CONSEQUENCE_CATALOG[consequenceId])
  }
})

test('Knowledge 只在 Ending 已写入私有 pending 后生成，并只接收相关 hidden facts', async () => {
  const repository = new MemoryStoryRepository()
  const fixture = createFixtureStoryGenerator()
  let persistedEndingSeen = null
  const generator = async (taskType, input, context) => {
    if (taskType === 'KNOWLEDGE_REVEAL') {
      const pending = [...repository.generations.values()]
        .find((generation) => generation.status === 'pending')
      persistedEndingSeen = structuredClone(pending?.validated_ending_output)
    }
    return fixture(taskType, input, context)
  }
  const service = new StoryService({
    repository,
    generateOutput: generator,
    clock: () => 1_900_000_000_000,
  })
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 7; index += 1) {
    story = await service.advanceStory(
      story.story_id,
      optionRequest(story, undefined, { session_id: create.session_id }),
    )
  }

  assert.equal(persistedEndingSeen?.task_type, 'STORY_ENDING')
  const knowledgeCall = fixture.getCalls()
    .find((call) => call.taskType === 'KNOWLEDGE_REVEAL')
  assert.deepEqual(knowledgeCall.input.hidden_facts, [
    '天气信息更新将晚于现场天气变化。',
  ])
  assert.equal(
    knowledgeCall.input.story_anomaly_effects[0],
    persistedEndingSeen.next_node_context,
  )
  const completedGeneration = [...repository.generations.values()].at(-1)
  assert.equal(completedGeneration.status, 'succeeded')
  assert.equal(completedGeneration.validated_ending_output, null)
})

test('Knowledge 两次业务校验失败会清空 pending Ending 并回滚 node_08 选择', async () => {
  const invalidKnowledge = structuredClone(DEFAULT_KNOWLEDGE_OUTPUT)
  invalidKnowledge.story_connection = '天气提示出现短暂延迟。'
  invalidKnowledge.causal_chain = [
    { point_title: '轨道风险', point_text: '可能影响航天器。' },
    { point_title: '状态调整', point_text: '航天器可能调整。' },
    { point_title: '局部影响', point_text: '更新可能延迟。' },
  ]
  invalidKnowledge.reality_note = '影响通常短暂。'
  const generator = createFixtureStoryGenerator({
    knowledgeOutputs: [invalidKnowledge, invalidKnowledge],
  })
  const { service, repository } = harness(generator)
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 6; index += 1) {
    story = await service.advanceStory(
      story.story_id,
      optionRequest(story, undefined, { session_id: create.session_id }),
    )
  }
  const before = structuredClone(repository.stories.get(story.story_id))
  await assert.rejects(
    service.advanceStory(
      story.story_id,
      optionRequest(story, undefined, { session_id: create.session_id }),
    ),
    (error) => error.code === 'KNOWLEDGE_TEXT_INVALID',
  )

  const after = repository.stories.get(story.story_id)
  assert.equal(after.version, before.version)
  assert.equal(after.current_node_id, 'node_08')
  assert.deepEqual(after.story_state, before.story_state)
  const failedGeneration = [...repository.generations.values()].at(-1)
  assert.equal(failedGeneration.status, 'failed')
  assert.equal(failedGeneration.validated_ending_output, null)
  assert.equal(
    generator.getCalls().filter((call) => call.taskType === 'KNOWLEDGE_REVEAL').length,
    2,
  )
})
