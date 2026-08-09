import assert from 'node:assert/strict'
import test from 'node:test'
import { STORY_GENERATION_METADATA } from './constants.js'
import { VALID_OUTLINE_FIXTURE } from './fixtures.js'
import { createOpenAIStoryGenerator } from './model.js'
import {
  buildStoryPrompt,
  getStorySpec,
  stableStringify,
} from './spec-assets.js'
import { buildOpeningContext } from './story-context.js'
import {
  getStorySchemaValidationMetadata,
  validateStorySchema,
} from './validators.js'

test('Opening Context 只保留 node_01 必需事实且显著小于完整 Outline', () => {
  const context = buildOpeningContext(structuredClone(VALID_OUTLINE_FIXTURE))
  const fullJson = stableStringify(VALID_OUTLINE_FIXTURE)
  const compactJson = stableStringify(context)

  assert.ok(compactJson.length < fullJson.length * 0.55)
  assert.deepEqual(Object.keys(context), [
    'event_anchor',
    'core_event',
    'user_expectation',
    'irreplaceable_part',
    'primary_anomaly',
    'current_node',
    'known_to_user',
  ])
  assert.equal(context.current_node.node_id, 'node_01')
  assert.equal('story_nodes' in context, false)
  assert.equal('reachable_endings' in context, false)
  assert.equal('initial_story_state' in context, false)
  assert.doesNotMatch(compactJson, /hidden_facts|state_rule|node_02/)
})

test('Prompt、Schema 与 AJV 校验结果在进程内复用且输入只序列化一次', () => {
  assert.strictEqual(getStorySpec('STORY_OPENING'), getStorySpec('STORY_OPENING'))

  const outline = structuredClone(VALID_OUTLINE_FIXTURE)
  const first = validateStorySchema('STORY_OUTLINE', outline)
  const second = validateStorySchema('STORY_OUTLINE', outline)
  assert.strictEqual(first, second)
  assert.strictEqual(getStorySchemaValidationMetadata(outline), first)

  const context = buildOpeningContext(outline)
  const serialized = stableStringify(context)
  const prompt = buildStoryPrompt('STORY_OPENING', context, '', serialized)
  assert.ok(prompt.includes(serialized))
  assert.equal(prompt.includes('{{opening_context}}'), false)
  assert.equal(prompt.includes('{{story_outline}}'), false)
})

test('模型封装按阶段路由配置并记录不含正文的细分耗时与用量', async () => {
  const requests = []
  const mockFetch = async (_url, init) => {
    requests.push(JSON.parse(init.body))
    return new Response(JSON.stringify({
      id: `chatcmpl_${requests.length}`,
      object: 'chat.completion',
      created: 1,
      model: requests.at(-1).model,
      choices: [{
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: '{}', refusal: null },
      }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const generate = createOpenAIStoryGenerator({
    OPENAI_API_KEY: 'test-key',
    STORY_OUTLINE_REASONING_EFFORT: 'low',
    STORY_OPENING_MODEL: 'opening-test-model',
    STORY_OPENING_REASONING_EFFORT: 'none',
    STORY_OPENING_VERBOSITY: 'low',
    STORY_OPENING_MAX_OUTPUT_TOKENS: '777',
  }, { fetch: mockFetch, maxRetries: 0 })

  await generate('STORY_OUTLINE', { important_event: { people: ['甲'], time: '', location: '', description: '事件' } })
  const openingContext = buildOpeningContext(structuredClone(VALID_OUTLINE_FIXTURE))
  const output = await generate('STORY_OPENING', openingContext)
  const metadata = output[STORY_GENERATION_METADATA]

  assert.equal(requests[0].reasoning_effort, 'low')
  assert.equal(requests[1].model, 'opening-test-model')
  assert.equal(requests[1].reasoning_effort, 'none')
  assert.equal(requests[1].verbosity, 'low')
  assert.equal(requests[1].max_completion_tokens, 777)
  assert.equal(metadata.input_tokens, 11)
  assert.equal(metadata.output_tokens, 7)
  assert.equal(metadata.timings.input_json_bytes, new TextEncoder().encode(stableStringify(openingContext)).byteLength)
  assert.ok(metadata.timings.provider_request_duration_ms >= 0)
  assert.ok(metadata.timings.total_model_duration_ms >= metadata.timings.provider_request_duration_ms)
  assert.equal(metadata.timings.prompt_load_duration_ms, 0)
  assert.equal(metadata.timings.schema_load_duration_ms, 0)
  assert.equal(metadata.timings.first_response_duration_ms, null)
  assert.equal(JSON.stringify(metadata).includes('story_text'), false)
})
