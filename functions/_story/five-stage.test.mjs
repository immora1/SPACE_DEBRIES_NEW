import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { StoryService } from './story-service.js'
import { MemoryStoryRepository } from './repository.js'
import { createFixtureStoryGenerator, VALID_OUTLINE_FIXTURE } from './fixtures.js'
import { analyzeEndingReachability } from './ending-reachability.js'
import { validateStoryOutline } from './validators.js'
import { ORBITAL_EVENTS } from './config/orbital-events.js'
import { CLEANUP_PAIRS } from './config/cleanup-pairs.js'

test('five-stage outline endings are reachable through actual orbital answers', () => {
  assert.equal(VALID_OUTLINE_FIXTURE.story_nodes.length, 5)
  assert.deepEqual(analyzeEndingReachability(VALID_OUTLINE_FIXTURE).unreachable_non_fallback_ids, [])
  assert.doesNotThrow(() => validateStoryOutline(structuredClone(VALID_OUTLINE_FIXTURE)))
})

test('impossible endings remain rejected', () => {
  const outline = structuredClone(VALID_OUTLINE_FIXTURE)
  outline.reachable_endings[0].state_rule.required_consequence_ids = ['shared_plan']
  assert.throws(() => validateStoryOutline(outline), { code: 'OUTLINE_ENDING_UNREACHABLE' })
})

export function harness() {
  const repository = new MemoryStoryRepository()
  const generateOutput = createFixtureStoryGenerator()
  const service = new StoryService({ repository, generateOutput })
  const request = {
    session_id: randomUUID(), nickname: '南枝', city: '泉州',
    important_event: '与外婆共同完成走马灯点灯。', satellite: { name: 'TEST-SAT' },
    game_context: { damage_level: 0, history_event_ids: [] }, language: 'zh',
  }
  return { repository, generateOutput, service, request }
}

test('real product actions produce exactly five content nodes with no AI calls during orbital play', async () => {
  const { repository, generateOutput, service, request } = harness()
  request.nickname = 'PRIVATE_USER_TOKEN'
  request.city = 'PRIVATE_CITY_TOKEN'
  request.satellite.city = 'PRIVATE_MATCH_CITY'
  request.satellite.hash_seed = 'PRIVATE_HASH'
  request.satellite.match_reason = 'PRIVATE_REASON'
  let story = await service.createStory(request)
  assert.deepEqual(story.current_options, [])
  const advance = async (action_type, source_id, action_id, payload = {}) => {
    story = await service.advanceStory(story.story_id, {
      session_id: request.session_id, version: story.version, action_type, source_id, action_id, payload,
    })
  }
  await advance('MATERIALS_COMMIT', 'satellite_build', 'materials_commit', {
    selections: { frame: 'aluminum', solar: 'silicon', insulation: 'kapton', propulsion: 'aluminum-tank' },
  })
  assert.equal(story.current_stage.node_id, 'node_02')
  await advance('MISSION_SELECT', 'mission', 'weather')
  assert.equal(story.current_stage.node_id, 'node_03')
  for (const [index, event] of ORBITAL_EVENTS.entries()) {
    const callsBefore = generateOutput.getCallCount()
    await advance('ORBITAL_EVENT_RESOLVE', event.id, event.options[0].id)
    assert.equal(story.current_stage.node_id, index === 2 ? 'node_04' : 'node_03')
    assert.equal(generateOutput.getCallCount(), callsBefore + (index === 2 ? 1 : 0))
  }
  assert.deepEqual(story.timeline.map(stage => stage.node_id), ['node_01', 'node_02', 'node_03', 'node_04'])
  assert.equal(story.public_game_state.orbital_events.resolved.length, 3)
  await assert.rejects(advance('ORBITAL_EVENT_RESOLVE', 'debris_close', 'avoidance_burn'),
    { code: 'INVALID_CHECKPOINT' })
  const stored = await repository.getStory(story.story_id, request.session_id)
  assert.equal(stored.story_state.relationship_connection, 56)
  assert.equal(stored.story_state.uncertainty, 0)
  for (const pair of Object.values(CLEANUP_PAIRS)) {
    await advance('CLEANUP_PAIR_SUBMIT', pair.target_id, pair.method_id, { ui_target_id: pair.accepted_ui_ids[0] })
  }
  assert.equal(story.status, 'completed')
  assert.equal(story.timeline.length, 5)
  assert.equal(story.current_stage.task_type, 'KNOWLEDGE_REVEAL')
  assert.ok(story.final_story_if_completed.ending)
  assert.ok(story.final_story_if_completed.knowledge_reveal)
  assert.equal(generateOutput.getCalls().filter(call => call.taskType === 'STORY_CONTINUE').length, 2)
  assert.deepEqual(story.timeline.map(stage => stage.node_id), ['node_01', 'node_02', 'node_03', 'node_04', 'node_05'])
  const calls = generateOutput.getCalls()
  assert.deepEqual(calls.map(call => call.taskType), [
    'STORY_OUTLINE', 'STORY_OPENING', 'STORY_CONTINUE', 'STORY_CONTINUE', 'STORY_ENDING', 'KNOWLEDGE_REVEAL',
  ])
  assert.equal(calls[0].input.matched_satellite.name, 'TEST-SAT')
  for (const call of calls) {
    const context = JSON.stringify(call.input)
    for (const privateValue of [request.nickname, request.city, 'PRIVATE_MATCH_CITY', 'PRIVATE_HASH', 'PRIVATE_REASON']) {
      assert.equal(context.includes(privateValue), false)
    }
    if (['STORY_OPENING', 'STORY_CONTINUE', 'STORY_ENDING'].includes(call.taskType)) {
      assert.ok(call.input.satellite_anchor)
      assert.ok(call.input.causal_chain.A_satellite_event)
      assert.ok(call.input.causal_chain.C_human_effect)
      assert.equal(context.includes('B_hidden_mechanism'), false)
      assert.equal(context.includes('hidden_facts'), false)
    }
  }
  const endingContext = calls.find(call => call.taskType === 'STORY_ENDING').input
  assert.equal(endingContext.game_summary.success_count, 3)
  assert.equal(endingContext.game_summary.failure_count, 0)
  assert.equal(endingContext.game_summary.overall_result, 'success')
  assert.deepEqual(endingContext.previous_handoff, calls[3].input.previous_handoff)
  const knowledgeContext = calls.at(-1).input
  assert.ok(knowledgeContext.causal_chain.B_hidden_mechanism)
  assert.ok(knowledgeContext.next_node_context.satellite_event_A)
  const completed = await repository.getStory(story.story_id, request.session_id)
  assert.equal(completed.story_state.relationship_connection, 56)
})

test('failed generation rolls back the product action and permits retry', async () => {
  const { repository, generateOutput, service, request } = harness()
  const story = await service.createStory(request)
  const action = { session_id: request.session_id, version: story.version,
    action_type: 'MATERIALS_COMMIT', source_id: 'satellite_build', action_id: 'materials_commit',
    payload: { selections: { frame: 'aluminum', solar: 'silicon', insulation: 'kapton', propulsion: 'aluminum-tank' } } }
  const before = await repository.getStory(story.story_id, request.session_id)
  generateOutput.failTask = 'STORY_CONTINUE'
  await assert.rejects(service.advanceStory(story.story_id, action), { code: 'AI_REQUEST_FAILED' })
  assert.deepEqual(await repository.getStory(story.story_id, request.session_id), before)
  assert.equal((await repository.getStages(story.story_id)).length, 1)
  generateOutput.failTask = null
  const next = await service.advanceStory(story.story_id, action)
  assert.equal(next.current_node_id, 'node_03')
  await assert.rejects(service.advanceStory(story.story_id, action), { code: 'VERSION_CONFLICT' })
})

test('legacy story choices cannot bypass five-stage product checkpoints', async () => {
  const { service, request } = harness()
  const story = await service.createStory(request)
  await assert.rejects(service.advanceStory(story.story_id, {
    session_id: request.session_id, version: story.version, action_type: 'STORY_OPTION_SELECT',
    node_id: 'node_02', option_id: 'protect_irreplaceable_part', client_action_id: randomUUID(),
  }), { code: 'INVALID_ACTION_TYPE' })
})

test('failed orbital play reaches Ending with different aggregate results and preserves retry state', async () => {
  const { repository, generateOutput, service, request } = harness()
  let story = await service.createStory(request)
  const advance = async (action_type, source_id, action_id, payload = {}) => {
    story = await service.advanceStory(story.story_id, {
      session_id: request.session_id, version: story.version, action_type, source_id, action_id, payload,
    })
  }
  await advance('MATERIALS_COMMIT', 'satellite_build', 'materials_commit', {
    selections: { frame: 'aluminum', solar: 'silicon', insulation: 'kapton', propulsion: 'aluminum-tank' },
  })
  await advance('MISSION_SELECT', 'mission', 'weather')
  for (const event of ORBITAL_EVENTS.slice(0, -1)) {
    await advance('ORBITAL_EVENT_RESOLVE', event.id, event.options.find(option => option.outcome === 'wrong').id)
  }
  const last = ORBITAL_EVENTS.at(-1)
  const before = await repository.getStory(story.story_id, request.session_id)
  generateOutput.failTask = 'STORY_ENDING'
  await assert.rejects(advance('ORBITAL_EVENT_RESOLVE', last.id, last.options.find(option => option.outcome === 'wrong').id),
    { code: 'AI_REQUEST_FAILED' })
  assert.deepEqual(await repository.getStory(story.story_id, request.session_id), before)
  generateOutput.failTask = null
  await advance('ORBITAL_EVENT_RESOLVE', last.id, last.options.find(option => option.outcome === 'wrong').id)
  const summary = generateOutput.getCalls().at(-1).input.game_summary
  assert.equal(summary.overall_result, 'failure')
  assert.equal(summary.failure_count, 3)
  assert.equal(summary.final_story_metrics.event_integrity, 76)
  assert.equal(story.current_stage.node_id, 'node_04')
  assert.equal(story.current_stage.display_content.selected_ending_id, 'ending_03')
})
