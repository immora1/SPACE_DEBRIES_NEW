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

test('real product actions produce exactly five story nodes then independent knowledge', async () => {
  const { repository, generateOutput, service, request } = harness()
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
    await advance('ORBITAL_EVENT_RESOLVE', event.id, event.options[0].id)
    assert.equal(story.current_stage.node_id, index === 5 ? 'node_05' : 'node_04')
  }
  assert.deepEqual(story.timeline.map(stage => stage.node_id), ['node_01', 'node_02', 'node_03', 'node_04', 'node_05'])
  const stored = await repository.getStory(story.story_id, request.session_id)
  assert.equal(stored.story_state.relationship_connection, 56)
  assert.equal(stored.story_state.uncertainty, 0)
  for (const pair of Object.values(CLEANUP_PAIRS)) {
    await advance('CLEANUP_PAIR_SUBMIT', pair.target_id, pair.method_id, { ui_target_id: pair.accepted_ui_ids[0] })
  }
  assert.equal(story.status, 'completed')
  assert.equal(story.timeline.length, 6)
  assert.equal(story.current_stage.task_type, 'KNOWLEDGE_REVEAL')
  assert.ok(story.final_story_if_completed.ending)
  assert.ok(story.final_story_if_completed.knowledge_reveal)
  assert.equal(generateOutput.getCalls().filter(call => call.taskType === 'STORY_CONTINUE').length, 3)
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
