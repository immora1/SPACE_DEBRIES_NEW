import OpenAI from 'openai'
import {
  STORY_GENERATION_METADATA,
  STORY_MODEL,
  STORY_REASONING_EFFORT,
  STORY_VERBOSITY,
  SUPPORTED_STORY_TASKS,
  StoryError,
  TASK_TYPE,
} from './constants.js'
import {
  buildStoryPrompt,
  getStorySpec,
  stableStringify,
} from './spec-assets.js'
import { SYSTEM_PROMPT } from './prompts/system.js'

const TASK_ENV_SUFFIX = Object.freeze({
  [TASK_TYPE.OUTLINE]: 'OUTLINE',
  [TASK_TYPE.OPENING]: 'OPENING',
  [TASK_TYPE.CONTINUE]: 'CONTINUE',
  [TASK_TYPE.BRANCH]: 'CONTINUE',
  [TASK_TYPE.ENDING]: 'ENDING',
  [TASK_TYPE.KNOWLEDGE_REVEAL]: 'KNOWLEDGE',
})

const textEncoder = new TextEncoder()
let warmRequestSeen = false

function now() {
  return globalThis.performance?.now?.() ?? Date.now()
}

function elapsed(startedAt) {
  return Math.max(0, now() - startedAt)
}

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

function stageEnv(env, taskType, key) {
  const suffix = TASK_ENV_SUFFIX[taskType]
  return suffix ? env?.[`STORY_${suffix}_${key}`] : undefined
}

function retryReasonCode(value) {
  return String(value || '').split(':', 1)[0].trim().slice(0, 80) || null
}

function attachMetadata(target, metadata) {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) return target
  Object.defineProperty(target, STORY_GENERATION_METADATA, {
    value: Object.freeze(metadata),
    enumerable: false,
    configurable: true,
  })
  return target
}

export function createOpenAIStoryGenerator(env, options = {}) {
  const apiKey = env?.OPENAI_API_KEY
  const defaultModel = env?.STORY_MODEL || options.model || STORY_MODEL
  const defaultReasoningEffort = boundedChoice(
    env?.STORY_REASONING_EFFORT || options.reasoningEffort,
    STORY_REASONING_EFFORT,
    ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  )
  const defaultVerbosity = boundedChoice(
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
    const totalStartedAt = now()
    if (!SUPPORTED_STORY_TASKS.includes(taskType)) {
      throw new StoryError(
        'STORY_TASK_NOT_IMPLEMENTED',
        `Story task ${taskType} is not implemented by the current story specification.`,
        501,
      )
    }

    const coldRequest = !warmRequestSeen
    warmRequestSeen = true
    const model = stageEnv(env, taskType, 'MODEL') || defaultModel
    const stageDefaultReasoningEffort = taskType === TASK_TYPE.OUTLINE
      ? (context.retryReason ? 'medium' : 'low')
      : defaultReasoningEffort
    const reasoningEffort = boundedChoice(
      stageEnv(env, taskType, 'REASONING_EFFORT'),
      stageDefaultReasoningEffort,
      ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    )
    const verbosity = boundedChoice(
      stageEnv(env, taskType, 'VERBOSITY'),
      defaultVerbosity,
      ['low', 'medium', 'high'],
    )
    const completionTokenLimit = boundedInteger(
      stageEnv(env, taskType, 'MAX_OUTPUT_TOKENS'),
      maxTokens(taskType),
      256,
      16_000,
    )

    const serializeStartedAt = now()
    const inputJson = stableStringify(input)
    const contextSerializeDurationMs = elapsed(serializeStartedAt)
    const promptStartedAt = now()
    const spec = getStorySpec(taskType)
    const prompt = buildStoryPrompt(
      taskType,
      input,
      context.retryReason,
      inputJson,
    )
    const promptRenderDurationMs = elapsed(promptStartedAt)
    const requestPrepareDurationMs = Math.max(
      0,
      elapsed(totalStartedAt) - contextSerializeDurationMs - promptRenderDurationMs,
    )
    const baseTimings = {
      request_prepare_duration_ms: requestPrepareDurationMs,
      prompt_load_duration_ms: 0,
      schema_load_duration_ms: 0,
      prompt_render_duration_ms: promptRenderDurationMs,
      context_serialize_duration_ms: contextSerializeDurationMs,
      provider_request_duration_ms: 0,
      first_response_duration_ms: null,
      response_parse_duration_ms: 0,
      total_model_duration_ms: 0,
      input_json_bytes: textEncoder.encode(inputJson).byteLength,
      input_character_count: inputJson.length,
      output_character_count: null,
      cold_request: coldRequest,
      retry_reason_code: retryReasonCode(context.retryReason),
    }
    const modelConfig = {
      model,
      reasoning_effort: reasoningEffort,
      verbosity,
      max_completion_tokens: completionTokenLimit,
      timeout_ms: timeout,
      network_retries: maxRetries,
    }

    let completion
    const providerStartedAt = now()
    try {
      completion = await client.chat.completions.create({
        model,
        reasoning_effort: reasoningEffort,
        verbosity,
        max_completion_tokens: completionTokenLimit,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: spec.schemaEnvelope,
        },
      })
      baseTimings.provider_request_duration_ms = elapsed(providerStartedAt)
    } catch (error) {
      baseTimings.provider_request_duration_ms = elapsed(providerStartedAt)
      baseTimings.total_model_duration_ms = elapsed(totalStartedAt)
      const storyError = new StoryError(
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
      attachMetadata(storyError, {
        request_id: error?.request_id || null,
        ...modelConfig,
        input_tokens: null,
        output_tokens: null,
        timings: Object.freeze({ ...baseTimings }),
      })
      throw storyError
    }

    const message = completion.choices?.[0]?.message
    const providerMetadata = {
      request_id: completion._request_id || null,
      ...modelConfig,
      input_tokens: completion.usage?.prompt_tokens ?? null,
      output_tokens: completion.usage?.completion_tokens ?? null,
    }
    if (message?.refusal) {
      const error = new StoryError('AI_REFUSAL', 'The story model refused the request.', 422)
      baseTimings.total_model_duration_ms = elapsed(totalStartedAt)
      attachMetadata(error, { ...providerMetadata, timings: Object.freeze({ ...baseTimings }) })
      throw error
    }
    if (completion.choices?.[0]?.finish_reason === 'length') {
      const error = new StoryError('AI_OUTPUT_TRUNCATED', 'The story model response was truncated.', 502)
      baseTimings.total_model_duration_ms = elapsed(totalStartedAt)
      attachMetadata(error, { ...providerMetadata, timings: Object.freeze({ ...baseTimings }) })
      throw error
    }
    if (typeof message?.content !== 'string' || !message.content.trim()) {
      const error = new StoryError('AI_EMPTY_OUTPUT', 'The story model returned no JSON content.', 502)
      baseTimings.total_model_duration_ms = elapsed(totalStartedAt)
      attachMetadata(error, { ...providerMetadata, timings: Object.freeze({ ...baseTimings }) })
      throw error
    }

    baseTimings.output_character_count = message.content.length
    const parseStartedAt = now()
    try {
      const output = JSON.parse(message.content)
      baseTimings.response_parse_duration_ms = elapsed(parseStartedAt)
      baseTimings.total_model_duration_ms = elapsed(totalStartedAt)
      attachMetadata(output, {
        ...providerMetadata,
        timings: Object.freeze({ ...baseTimings }),
      })
      return output
    } catch {
      baseTimings.response_parse_duration_ms = elapsed(parseStartedAt)
      baseTimings.total_model_duration_ms = elapsed(totalStartedAt)
      const error = new StoryError(
        'AI_RESPONSE_PARSE_FAILED',
        'The story model response was not valid JSON.',
        502,
      )
      attachMetadata(error, {
        ...providerMetadata,
        timings: Object.freeze({ ...baseTimings }),
      })
      throw error
    }
  }
}

// Compatibility name used by the existing HTTP bootstrap.
export const createOpenAIStageGenerator = createOpenAIStoryGenerator
