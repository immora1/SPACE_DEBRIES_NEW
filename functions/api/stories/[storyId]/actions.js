import {
  createRequestStoryService,
  errorResponse,
  jsonResponse,
} from '../../../_story/http.js'

export async function onRequestPost({ env, params, request }) {
  try {
    const service = createRequestStoryService(env)
    const story = await service.advanceStory(params.storyId, await request.json())
    return jsonResponse({ ok: true, story })
  } catch (error) {
    return errorResponse(error)
  }
}
