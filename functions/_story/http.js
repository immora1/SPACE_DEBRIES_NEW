import { StoryError } from './constants.js'
import { createStoryRepository } from './repository.js'
import { createOpenAIStageGenerator } from './model.js'
import { StoryService } from './story-service.js'

export function createRequestStoryService(env) {
  return new StoryService({
    repository: createStoryRepository(env),
    generateStage: createOpenAIStageGenerator(env),
  })
}

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

export function errorResponse(error) {
  if (error instanceof StoryError) {
    return jsonResponse({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }, error.status)
  }
  return jsonResponse({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected story service error.',
    },
  }, 500)
}
