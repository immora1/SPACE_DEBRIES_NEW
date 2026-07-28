import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { AI_OUTPUT_SCHEMA_BY_TASK } from './schemas.js'
import { STORY_MODEL, StoryError } from './constants.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import { buildStagePrompt } from './prompts/index.js'

function schemaName(taskType) {
  return `space_debris_${taskType.toLowerCase()}`
}

function bindSchemaToContract(taskType, baseSchema, stageContract) {
  if (taskType === 'STORY_OUTLINE') return baseSchema
  return baseSchema.extend({
    checkpoint: z.literal(stageContract.next_checkpoint),
  })
}

export function createOpenAIStageGenerator(env, options = {}) {
  const apiKey = env?.OPENAI_API_KEY
  const model = env?.STORY_MODEL || options.model || STORY_MODEL

  return async function generateStage(taskType, stageContract) {
    if (!apiKey) {
      throw new StoryError(
        'AI_NOT_CONFIGURED',
        'OPENAI_API_KEY is not configured for the story service.',
        503,
      )
    }

    const baseSchema = AI_OUTPUT_SCHEMA_BY_TASK[taskType]
    if (!baseSchema) throw new StoryError('UNKNOWN_TASK_TYPE', `Unsupported task type: ${taskType}`, 500)
    const schema = bindSchemaToContract(taskType, baseSchema, stageContract)

    try {
      const client = new OpenAI({
        apiKey,
        fetch: options.fetch,
      })
      const completion = await client.chat.completions.parse({
        model,
        temperature: taskType === 'STORY_OUTLINE' ? 0.55 : 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildStagePrompt(taskType, stageContract) },
        ],
        response_format: zodResponseFormat(schema, schemaName(taskType)),
      })
      const message = completion.choices?.[0]?.message
      if (message?.refusal) {
        throw new StoryError('AI_REFUSAL', message.refusal, 422)
      }
      const validated = schema.safeParse(message?.parsed)
      if (!validated.success) {
        throw new StoryError(
          'AI_INVALID_OUTPUT',
          'The model response did not match the stage schema.',
          502,
          validated.error.issues,
        )
      }
      return validated.data
    } catch (error) {
      if (error instanceof StoryError) throw error
      throw new StoryError(
        'AI_REQUEST_FAILED',
        error?.message || 'The story model request failed.',
        502,
      )
    }
  }
}
