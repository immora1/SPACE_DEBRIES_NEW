import assert from 'node:assert/strict'
import test from 'node:test'
import { createOpenAIStoryGenerator } from './model.js'

test('GPT-5.6 Luna story request uses medium reasoning and JSON Schema output', async () => {
  let requestBody
  const mockFetch = async (_url, init) => {
    requestBody = JSON.parse(init.body)
    return new Response(JSON.stringify({
      id: 'chatcmpl_test',
      object: 'chat.completion',
      created: 1,
      model: 'gpt-5.6-luna',
      choices: [{
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: '{}',
          refusal: null,
        },
      }],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const generate = createOpenAIStoryGenerator(
    { OPENAI_API_KEY: 'test-key' },
    { fetch: mockFetch, maxRetries: 0 },
  )

  await generate('STORY_OUTLINE', {
    important_event: {
      people: ['测试者'],
      time: '',
      location: '',
      description: '一次重要经历',
    },
  })

  assert.equal(requestBody.model, 'gpt-5.6-luna')
  assert.equal(requestBody.reasoning_effort, 'medium')
  assert.equal(requestBody.verbosity, 'medium')
  assert.equal(requestBody.max_completion_tokens, 6000)
  assert.equal(requestBody.max_tokens, undefined)
  assert.equal(requestBody.temperature, undefined)
  assert.equal(requestBody.messages.length, 2)
  assert.equal(requestBody.messages[0].role, 'system')
  assert.match(requestBody.messages[0].content, /太空垃圾个性化互动叙事引擎/)
  assert.equal(requestBody.messages[1].role, 'user')
  assert.equal(requestBody.response_format.type, 'json_schema')
  assert.equal(requestBody.response_format.json_schema.name, 'story_outline')
})
