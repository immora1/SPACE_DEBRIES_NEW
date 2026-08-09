import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  CONSEQUENCE_CATALOG,
  STORY_OPTION_SETS,
  resolveOptionsForNode,
  validateNodeOptions,
} from './config/story-options.js'
import {
  ORBITAL_GAME_MODULE_ID,
  orbitalAnswerControlId,
  resolveQuestionForStoryNode,
} from './config/game-story-bindings.js'
import { ORBITAL_EVENTS } from './config/orbital-events.js'
import { selectEnding } from './ending-selector.js'
import {
  createFixtureStoryGenerator,
  DEFAULT_CONTINUE_OUTPUT,
  DEFAULT_KNOWLEDGE_OUTPUT,
  ENDING_PARAGRAPHS,
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

const MATERIAL_SELECTIONS = Object.freeze({
  frame: 'aluminum',
  solar: 'silicon',
  insulation: 'kapton',
  propulsion: 'aluminum-tank',
})

function materialSiteRequest(story, sessionId, overrides = {}) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_02',
    module_id: 'M2',
    interactions: Object.entries(MATERIAL_SELECTIONS).map(([sectionId, optionId]) => ({
      section_id: sectionId,
      control_id: `m2-material-${sectionId}-${optionId}`,
      option_id: optionId,
    })),
    client_action_id: overrides.client_action_id || randomUUID(),
  }
}

function missionSiteRequest(story, sessionId, taskId = 'weather', overrides = {}) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_03',
    module_id: 'M3',
    interactions: [{
      section_id: 'mission_candidates',
      control_id: `m3-mission-${taskId}`,
      option_id: taskId,
    }],
    client_action_id: overrides.client_action_id || randomUUID(),
  }
}

async function confirmCurrentGameAnswer(service, story, sessionId, answerIndex = 0) {
  const questionOrder = story.public_game_state.orbital_events.resolved.length + 1
  const stage = resolveQuestionForStoryNode(story.current_node_id, questionOrder)
  assert.ok(stage, `No orbital-event stage for ${story.current_node_id}`)
  const answer = ORBITAL_EVENTS[stage.question_order - 1].options[answerIndex]
  assert.ok(answer, `No answer ${answerIndex} for ${stage.question_id}`)
  return service.advanceStory(story.story_id, {
    session_id: sessionId,
    version: story.version,
    action_type: 'GAME_ANSWER_CONFIRM',
    node_id: stage.target_node_id,
    game_module_id: ORBITAL_GAME_MODULE_ID,
    question_id: stage.question_id,
    answer_id: answer.id,
    control_id: orbitalAnswerControlId(stage.question_id, answer.id),
    client_action_id: randomUUID(),
  })
}

async function advanceCurrentNode(service, story, sessionId) {
  let advanced
  if (story.current_node_id === 'node_02') {
    advanced = await service.advanceStory(
      story.story_id,
      materialSiteRequest(story, sessionId),
    )
  } else if (story.current_node_id === 'node_03') {
    advanced = await service.advanceStory(
      story.story_id,
      missionSiteRequest(story, sessionId),
    )
  } else {
    advanced = await confirmCurrentGameAnswer(service, story, sessionId)
  }
  return processAllStoryJobs(service, advanced, sessionId)
}

async function processAllStoryJobs(service, story, sessionId, limit = 20) {
  let current = story
  for (let index = 0; index < limit; index += 1) {
    if (current.game_story_sync.queued_story_stages === 0) return current
    current = await service.processNextStoryJob(current.story_id, sessionId)
  }
  assert.fail(`Story jobs did not drain after ${limit} attempts.`)
}

async function submitM6Completion(service, story, sessionId) {
  let submitted = 0
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
    submitted += 1
    assert.equal(story.public_game_state.cleanup_test.matches.length, submitted)
    assert.equal(
      (await service.repository.getStory(story.story_id, sessionId)).game_state.cleanup_test.matches.length,
      submitted,
    )
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

test('node_02 使用 Opening handoff 与站内材料快照，Continue context 不含旧等级字段', async () => {
  const { service, generator } = harness()
  const create = request()
  const story = await service.createStory(create)
  const advanced = await service.advanceStory(
    story.story_id,
    materialSiteRequest(story, create.session_id),
  )
  assert.equal(advanced.current_node_id, 'node_03')
  assert.equal(generator.getCallCount(), 2)
  const generated = await processAllStoryJobs(
    service,
    advanced,
    create.session_id,
  )
  assert.equal(generated.artifact_progress.last_ready_artifact, 'STORY_STAGE_1')
  const continueCall = generator.getCalls().at(-1)
  assert.equal(continueCall.taskType, 'STORY_CONTINUE')
  assert.equal(
    continueCall.input.current_node.node_id,
    'node_02',
  )
  assert.equal(continueCall.input.generation_source.interaction_node_id, 'node_02')
  assert.equal(
    continueCall.input.generation_source.interaction_snapshot.selections.length,
    4,
  )
  assert.equal(
    Object.hasOwn(
      continueCall.input.generation_source.interaction_snapshot.selections[0],
      'knowledge_profile',
    ),
    false,
  )
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

  let advanced = await service.advanceStory(
    story.story_id,
    materialSiteRequest(story, create.session_id),
  )
  advanced = await service.processNextStoryJob(story.story_id, create.session_id)
  assert.equal(
    advanced.artifact_progress.artifacts.find(
      (artifact) => artifact.artifact_type === 'STORY_STAGE_1',
    ).generation_status,
    'QUEUED',
  )
  advanced = await service.processNextStoryJob(story.story_id, create.session_id)
  assert.equal(advanced.current_node_id, 'node_03')
  const reason = generator.getCalls()[3].context.retryReason
  assert.match(reason, /CONTINUE_STORY_TEXT_INVALID/)
  assert.match(reason, /480-520 个汉字/)
  assert.match(reason, /3-5 段/)
  assert.match(reason, /第二人称“你”/)
})

test('相同 client_action_id 幂等返回且不会重复累计状态或调用模型', async () => {
  const { service, repository, generator } = harness()
  const create = request()
  const story = await service.createStory(create)
  const action = materialSiteRequest(story, create.session_id, {
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

test('node_03 网站任务确认后，node_04 不再暴露旧故事选项', async () => {
  const { service } = harness()
  const create = request()
  let story = await service.createStory(create)
  story = await service.advanceStory(
    story.story_id,
    materialSiteRequest(story, create.session_id),
  )
  assert.equal(story.current_node_id, 'node_03')
  assert.equal(story.current_options.length, 0)
  story = await service.advanceStory(
    story.story_id,
    missionSiteRequest(story, create.session_id),
  )
  assert.equal(story.current_node_id, 'node_04')
  assert.equal(story.current_options.length, 0)
  assert.equal(story.current_interaction.interaction_mode, 'SITE_GAME_RESULT')
  assert.equal(story.current_interaction.module_id, ORBITAL_GAME_MODULE_ID)
})

test('M2 node_02 与 M3 node_03 均由网站确认推进并更新各自 game_state', async () => {
  const { service, repository, generator } = harness()
  const create = request()
  let story = await service.createStory(create)
  story = await service.advanceStory(
    story.story_id,
    materialSiteRequest(story, create.session_id),
  )
  assert.equal(story.current_node_id, 'node_03')
  assert.equal(story.current_checkpoint, 'mission')
  assert.equal(story.timeline.length, 1)
  assert.equal(generator.getCallCount(), 2)

  story = await service.advanceStory(
    story.story_id,
    missionSiteRequest(story, create.session_id),
  )
  assert.equal(story.current_checkpoint, 'orbital_events')
  assert.equal(story.current_node_id, 'node_04')
  assert.equal(story.public_game_state.mission.action_id, 'weather')
  assert.equal((await repository.getInteractions(story.story_id)).length, 2)
})

test('模型连续失败只标记 artifact，不回滚已提交的网站状态或重复消费 action', async () => {
  const generator = createFixtureStoryGenerator()
  const { service, repository } = harness(generator)
  const create = request()
  const story = await service.createStory(create)
  const before = structuredClone(repository.stories.get(story.story_id))
  const action = materialSiteRequest(story, create.session_id, {
    client_action_id: randomUUID(),
  })
  generator.failTask = 'STORY_CONTINUE'
  const committed = await service.advanceStory(story.story_id, action)
  assert.equal(committed.current_node_id, 'node_03')
  assert.equal(committed.version, before.version + 1)
  assert.deepEqual(
    committed.public_game_state.satellite_build.materials,
    MATERIAL_SELECTIONS,
  )

  await service.processNextStoryJob(story.story_id, create.session_id)
  const failed = await service.processNextStoryJob(
    story.story_id,
    create.session_id,
  )
  const stage1 = failed.artifact_progress.artifacts.find(
    (artifact) => artifact.artifact_type === 'STORY_STAGE_1',
  )
  assert.equal(stage1.generation_status, 'FAILED')
  assert.equal(failed.current_node_id, 'node_03')
  assert.equal(failed.version, committed.version)

  const idempotent = await service.advanceStory(story.story_id, action)
  assert.equal(idempotent.version, committed.version)
  assert.equal((await repository.getInteractions(story.story_id)).length, 1)
})

test('并发提交同一 interaction_version 只接受一个网站操作且不等待模型', async () => {
  const base = createFixtureStoryGenerator()
  const { service, repository, generator } = harness(base)
  const create = request()
  const story = await service.createStory(create)
  const firstAction = materialSiteRequest(story, create.session_id)
  const secondAction = materialSiteRequest(story, create.session_id)
  const settled = await Promise.allSettled([
    service.advanceStory(story.story_id, firstAction),
    service.advanceStory(story.story_id, secondAction),
  ])
  const result = settled.find((entry) => entry.status === 'fulfilled').value
  const rejected = settled.find((entry) => entry.status === 'rejected').reason
  assert.equal(rejected.code, 'STALE_STORY_VERSION')
  assert.equal(result.version, story.version + 1)
  assert.equal(result.current_node_id, 'node_03')
  assert.equal(generator.getCallCount(), 2)
  assert.equal((await repository.getInteractions(story.story_id)).length, 1)
})

test('错误 selected_ending_id 只让 Ending artifact 失败，不回滚 Q6 操作', async () => {
  const wrongEnding = {
    task_type: 'STORY_ENDING',
    node_id: 'node_05',
    selected_ending_id: 'wrong-ending',
    story_text: ENDING_PARAGRAPHS,
    ending_summary: '核心事件完成，但模型故意返回错误的结局 ID。',
    next_node_context: '异常仍待解释。',
    next_node_id: null,
  }
  const generator = createFixtureStoryGenerator({ endingOutputs: [wrongEnding] })
  const { service, repository } = harness(generator)
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 7; index += 1) {
    story = await advanceCurrentNode(service, story, create.session_id)
  }
  assert.equal(story.current_node_id, 'node_04')
  story = await confirmCurrentGameAnswer(service, story, create.session_id)
  const before = structuredClone(repository.stories.get(story.story_id))
  assert.equal(story.current_node_id, 'node_05')
  await service.processNextStoryJob(story.story_id, create.session_id)
  const failed = await service.processNextStoryJob(
    story.story_id,
    create.session_id,
  )
  const after = repository.stories.get(story.story_id)
  assert.equal(after.version, before.version)
  assert.deepEqual(after.story_state, before.story_state)
  assert.equal(after.current_node_id, 'node_05')
  assert.equal(failed.artifact_progress.failed_artifact, 'ENDING')
  assert.equal((await repository.getArtifactJobs(story.story_id)).at(-1).status, 'FAILED')
})

test('完整 node_02..05 后按 Continue→Ending→Knowledge 原子完成', async () => {
  const { service, repository, generator } = harness()
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 7; index += 1) {
    story = await advanceCurrentNode(service, story, create.session_id)
  }
  story = await confirmCurrentGameAnswer(service, story, create.session_id)
  story = await processAllStoryJobs(service, story, create.session_id)
  assert.equal(story.current_node_id, 'node_05')
  assert.equal(story.status, 'in_progress')
  assert.equal(story.game_story_sync.queued_story_stages, 0)
  story = await submitM6Completion(service, story, create.session_id)
  assert.equal(story.game_story_sync.queued_story_stages, 1)
  story = await processAllStoryJobs(service, story, create.session_id)
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

test('Knowledge 只在 Ending 校验成功后生成，并接收六题快照和相关 hidden facts', async () => {
  const repository = new MemoryStoryRepository()
  const fixture = createFixtureStoryGenerator()
  let generatedEnding = null
  let endingSeenBeforeKnowledge = false
  const generator = async (taskType, input, context) => {
    if (taskType === 'KNOWLEDGE_REVEAL') {
      endingSeenBeforeKnowledge = Boolean(generatedEnding)
    }
    const output = await fixture(taskType, input, context)
    if (taskType === 'STORY_ENDING') generatedEnding = structuredClone(output)
    return output
  }
  const service = new StoryService({
    repository,
    generateOutput: generator,
    clock: () => 1_900_000_000_000,
  })
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 7; index += 1) {
    story = await advanceCurrentNode(service, story, create.session_id)
  }
  story = await confirmCurrentGameAnswer(service, story, create.session_id)
  story = await processAllStoryJobs(service, story, create.session_id)
  story = await submitM6Completion(service, story, create.session_id)
  story = await processAllStoryJobs(service, story, create.session_id)

  assert.equal(endingSeenBeforeKnowledge, true)
  const knowledgeCall = fixture.getCalls()
    .find((call) => call.taskType === 'KNOWLEDGE_REVEAL')
  assert.deepEqual(knowledgeCall.input.hidden_facts, [
    '天气信息更新将晚于现场天气变化。',
  ])
  assert.equal(
    knowledgeCall.input.story_anomaly_effects[0],
    generatedEnding.next_node_context,
  )
  assert.equal(knowledgeCall.input.selected_game_answers.length, 6)
  assert.equal(knowledgeCall.input.cleanup_game_result.matches.length, 3)
  const completedJob = (await repository.getArtifactJobs(story.story_id)).at(-1)
  assert.equal(completedJob.status, 'READY')
})

test('Knowledge 两次业务校验失败保留已提交的 node_05 Ending', async () => {
  const invalidKnowledge = structuredClone(DEFAULT_KNOWLEDGE_OUTPUT)
  invalidKnowledge.story_connection = '天气提示出现短暂延迟。'
  invalidKnowledge.causal_chain = [
    { point_title: '轨道风险', point_text: '可能影响航天器。' },
    { point_title: '状态调整', point_text: '航天器可能调整。' },
    { point_title: '局部影响', point_text: '更新可能延迟。' },
  ]
  invalidKnowledge.material_insights = [
    {
      option_id: 'aluminum',
      option_name: '铝合金',
      insight_title: '框架材料',
      insight_text: '再入烧蚀充分。',
    },
    {
      option_id: 'silicon',
      option_name: '硅基电池板',
      insight_title: '电池板材料',
      insight_text: '成熟可靠，残留较少。',
    },
  ]
  invalidKnowledge.mission_insights = [{
    option_id: 'weather',
    option_name: '气象监测',
    insight_title: '气象任务关联',
    insight_text: '这项任务依赖持续产生并传回气象观测数据。',
  }]
  invalidKnowledge.reality_note = '影响通常短暂。'
  const generator = createFixtureStoryGenerator({
    knowledgeOutputs: [invalidKnowledge, invalidKnowledge],
  })
  const { service, repository } = harness(generator)
  const create = request()
  let story = await service.createStory(create)
  for (let index = 0; index < 7; index += 1) {
    story = await advanceCurrentNode(service, story, create.session_id)
  }
  story = await confirmCurrentGameAnswer(service, story, create.session_id)
  story = await service.processNextStoryJob(story.story_id, create.session_id)
  assert.equal(story.current_node_id, 'node_05')
  story = await submitM6Completion(service, story, create.session_id)
  const before = structuredClone(repository.stories.get(story.story_id))
  await service.processNextStoryJob(story.story_id, create.session_id)
  const failed = await service.processNextStoryJob(
    story.story_id,
    create.session_id,
  )

  const after = repository.stories.get(story.story_id)
  assert.equal(after.version, before.version)
  assert.equal(after.current_node_id, 'node_05')
  assert.deepEqual(after.story_state, before.story_state)
  assert.equal(failed.artifact_progress.failed_artifact, 'KNOWLEDGE_REVEAL')
  const failedJob = (await repository.getArtifactJobs(story.story_id)).at(-1)
  assert.equal(failedJob.status, 'FAILED')
  assert.equal(
    generator.getCalls().filter((call) => call.taskType === 'KNOWLEDGE_REVEAL').length,
    2,
  )
})
