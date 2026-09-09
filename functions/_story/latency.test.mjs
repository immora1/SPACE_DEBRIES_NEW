import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpenAIStoryGenerator } from './model.js'
import { partialOpeningText } from './opening-stream.js'
import { outlineModelSchema, restoreOutlineRules } from './outline-generation.js'
import { VALID_OUTLINE_FIXTURE, VALID_OPENING_FIXTURE, createFixtureStoryGenerator } from './fixtures.js'
import { StoryService } from './story-service.js'
import { MemoryStoryRepository } from './repository.js'
import { validateStoryOutline } from './validators.js'
import { createStoryStream } from './stream-response.js'
import { readStoryStream } from '../../src/services/story-stream.js'
import { StoryError } from './constants.js'

test('partial opening extracts only first top-level story_text and handles every escape boundary', () => {
  const text = '你看见“灯”\n外婆说："回来\\看看"。😀'
  const json = JSON.stringify({ story_text: text, hidden_facts: ['NEVER PREVIEW'] })
  for (let i = 0; i <= json.length; i++) {
    const preview = partialOpeningText(json.slice(0, i))
    assert.ok(text.startsWith(preview))
    assert.ok(!preview.includes('NEVER'))
  }
  assert.equal(partialOpeningText(json), text)
  assert.equal(partialOpeningText('{"other":"story_text","story_text":"秘密"}'), '')
  assert.equal(partialOpeningText('{"story_text":"你\\u597'), '你')
  assert.equal(partialOpeningText('{"story_text":"你\\u597d'), '你好')
})

test('compact model outline restores trusted rules before full validation', () => {
  const compact = structuredClone(VALID_OUTLINE_FIXTURE)
  compact.reachable_endings.forEach(ending => delete ending.state_rule)
  compact.story_nodes.forEach(node => { delete node.node_id; delete node.task_type })
  for (const key of ['event_integrity', 'relationship_connection', 'uncertainty', 'current_node_id', 'active_consequences', 'last_user_action']) delete compact.initial_story_state[key]
  assert.equal(outlineModelSchema.schema.properties.reachable_endings.items.properties.state_rule, undefined)
  assert.doesNotThrow(() => validateStoryOutline(restoreOutlineRules(compact)))
  assert.deepEqual(restoreOutlineRules(compact), VALID_OUTLINE_FIXTURE)
})

test('opening uses low reasoning and emits text before stream completion', async () => {
  let body
  let finish
  const gate = new Promise(resolve => { finish = resolve })
  let previewSeen
  const seen = new Promise(resolve => { previewSeen = resolve })
  const encoder = new TextEncoder()
  const json = JSON.stringify(VALID_OPENING_FIXTURE)
  const part = json.indexOf('。') + 1
  const frame = content => encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`)
  const mockFetch = async (_url, init) => {
    body = JSON.parse(init.body)
    return new Response(new ReadableStream({ async start(controller) {
      controller.enqueue(frame(json.slice(0, part)))
      await gate
      controller.enqueue(frame(json.slice(part)))
      controller.enqueue(encoder.encode('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'))
      controller.close()
    } }), { headers: { 'content-type': 'text/event-stream' } })
  }
  const generate = createOpenAIStoryGenerator({ OPENAI_API_KEY: 'test' }, { fetch: mockFetch })
  const pending = generate('STORY_OPENING', {}, { onPreview: previewSeen })
  try {
    const preview = await Promise.race([seen, new Promise((_, reject) => setTimeout(() => reject(new Error('No preview before completion')), 1000))])
    assert.ok(VALID_OPENING_FIXTURE.story_text.startsWith(preview))
    assert.equal(body.reasoning_effort, 'low')
    assert.equal(body.stream, true)
  } finally { finish() }
  assert.deepEqual(await pending, VALID_OPENING_FIXTURE)
})

test('opening retry resets preview and timings include generation and persistence', async () => {
  const fixture = createFixtureStoryGenerator({ openingOutputs: [{ ...VALID_OPENING_FIXTURE, story_text: '你' }, VALID_OPENING_FIXTURE] })
  const events = []
  const repository = new MemoryStoryRepository()
  const service = new StoryService({ repository, generateOutput: async (...args) => {
    if (args[0] === 'STORY_OPENING') args[2].onPreview?.('你')
    return fixture(...args)
  } })
  const result = await service.createStory({ session_id: crypto.randomUUID(), nickname: '测试', city: '泉州', important_event: '与外婆一起点亮走马灯。', satellite: {}, game_context: { damage_level: 0, history_event_ids: [] }, language: 'zh' }, event => events.push(event))
  assert.equal(events.filter(e => e.type === 'reset').length, 2)
  assert.ok(events.some(e => e.type === 'preview'))
  assert.ok(result.generation_timings.outline_ms >= 0)
  assert.ok(result.generation_timings.opening_ms >= 0)
  assert.ok(result.generation_timings.persist_ms >= 0)
  assert.equal(result.generation_timings.opening_attempts, 2)
})

test('client receives previews but only returns a committed result', async () => {
  const events = []
  const response = createStoryStream({ async createStory(_input, emit) {
    emit({ type: 'preview', text: '你看见了灯。' })
    return { story_id: 'saved', timeline: [] }
  } }, {})
  const result = await readStoryStream(response, event => events.push(event))
  assert.equal(result.story_id, 'saved')
  assert.equal(events[0].text, '你看见了灯。')
})

test('generation failure clears preview and never publishes completion', async () => {
  const events = []
  const response = createStoryStream({ async createStory(_input, emit) {
    emit({ type: 'preview', text: '暂时预览' })
    throw new StoryError('OPENING_STORY_TEXT_INVALID', '请重试。', 502)
  } }, {})
  await assert.rejects(readStoryStream(response, event => events.push(event)), { code: 'OPENING_STORY_TEXT_INVALID' })
  assert.equal(events.at(-1).type, 'reset')
  assert.equal(events.some(event => event.type === 'complete'), false)
})

test('client decodes split UTF-8 frames and rejects truncated connections', async () => {
  const bytes = new TextEncoder().encode('{"type":"preview","text":"你看见了灯"}\n')
  const events = []
  const response = new Response(new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
    controller.close()
  } }))
  await assert.rejects(readStoryStream(response, event => events.push(event)), /连接中断/)
  assert.equal(events[0].text, '你看见了灯')
  assert.equal(events.at(-1).type, 'reset')
})

test('canceling response aborts generation work', async () => {
  let signal
  const response = createStoryStream({ async createStory(_input, _emit, abortSignal) {
    signal = abortSignal
    await new Promise(resolve => abortSignal.addEventListener('abort', resolve, { once: true }))
    abortSignal.throwIfAborted()
  } }, {})
  await response.body.cancel()
  assert.equal(signal.aborted, true)
})
