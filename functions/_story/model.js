import OpenAI from 'openai'
import {
  STORY_MODEL,
  STORY_GENERATION_METADATA,
  STORY_REASONING_EFFORT,
  STORY_VERBOSITY,
  SUPPORTED_STORY_TASKS,
  StoryError,
  TASK_TYPE,
} from './constants.js'
import { buildStoryPrompt, getStorySpec } from './spec-assets.js'
import { SYSTEM_PROMPT } from './prompts/system.js'

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function maxTokens(taskType) {
  if (taskType === TASK_TYPE.OUTLINE) return 6000
  if (taskType === TASK_TYPE.ENDING) return 3600
  if (taskType === TASK_TYPE.KNOWLEDGE_REVEAL) return 2800
  return 3200
}

function boundedChoice(value, fallback, choices) {
  return choices.includes(value) ? value : fallback
}

export function createOpenAIStoryGenerator(env, options = {}) {
  const apiKey = env?.OPENAI_API_KEY
  const model = env?.STORY_MODEL || options.model || STORY_MODEL
  const reasoningEffort = boundedChoice(
    env?.STORY_REASONING_EFFORT || options.reasoningEffort,
    STORY_REASONING_EFFORT,
    ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  )
  const verbosity = boundedChoice(
    env?.STORY_VERBOSITY || options.verbosity,
    STORY_VERBOSITY,
    ['low', 'medium', 'high'],
  )
  const timeout = boundedInteger(
    env?.OPENAI_STORY_TIMEOUT_MS || options.timeout,
    90_000,
    5_000,
    180_000,
  )
  const maxRetries = boundedInteger(
    env?.OPENAI_STORY_NETWORK_RETRIES ?? options.maxRetries,
    1,
    0,
    2,
  )

  if (!apiKey) {
    return async () => {
      throw new StoryError(
        'AI_NOT_CONFIGURED',
        'OPENAI_API_KEY is not configured for the story service.',
        503,
      )
    }
  }

  const client = new OpenAI({
    apiKey,
    fetch: options.fetch,
    maxRetries,
    timeout,
  })

  return async function generateStoryOutput(taskType, input, context = {}) {
    if (!SUPPORTED_STORY_TASKS.includes(taskType)) {
      throw new StoryError(
        'STORY_TASK_NOT_IMPLEMENTED',
        `Story task ${taskType} is not implemented by the current story specification.`,
        501,
      )
    }

    const spec = getStorySpec(taskType)
    const prompt = buildStoryPrompt(taskType, input, context.retryReason)

    let completion
    try {
      completion = await client.chat.completions.create({
        model,
        reasoning_effort: reasoningEffort,
        verbosity,
        max_completion_tokens: maxTokens(taskType),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: spec.schemaEnvelope,
        },
      })
    } catch (error) {
      throw new StoryError(
        'AI_REQUEST_FAILED',
        'The story model request failed.',
        502,
        [{
          status: Number(error?.status) || null,
          request_id: error?.request_id || null,
          provider_message: String(error?.message || 'Unknown provider error')
            .replace(/\s+/g, ' ')
            .slice(0, 500),
        }],
      )
    }

    const message = completion.choices?.[0]?.message
    if (message?.refusal) {
      throw new StoryError(
        'AI_REFUSAL',
        'The story model refused the request.',
        422,
      )
    }
    if (completion.choices?.[0]?.finish_reason === 'length') {
      throw new StoryError(
        'AI_OUTPUT_TRUNCATED',
        'The story model response was truncated.',
        502,
      )
    }
    if (typeof message?.content !== 'string' || !message.content.trim()) {
      throw new StoryError(
        'AI_EMPTY_OUTPUT',
        'The story model returned no JSON content.',
        502,
      )
    }

    try {
      const output = JSON.parse(message.content)
      Object.defineProperty(output, STORY_GENERATION_METADATA, {
        value: Object.freeze({
          request_id: completion._request_id || null,
          model: completion.model || model,
          input_tokens: completion.usage?.prompt_tokens ?? null,
          output_tokens: completion.usage?.completion_tokens ?? null,
        }),
        enumerable: false,
      })
      return output
    } catch {
      throw new StoryError(
        'AI_RESPONSE_PARSE_FAILED',
        'The story model response was not valid JSON.',
        502,
      )
    }
  }
}

// Compatibility name used by the existing HTTP bootstrap.
export const createOpenAIStageGenerator = createOpenAIStoryGenerator
