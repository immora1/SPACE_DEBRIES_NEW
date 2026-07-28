import {
  createRequestStoryService,
  errorResponse,
  jsonResponse,
} from '../../_story/http.js'

export async function onRequestGet({ env, params, request }) {
  try {
    const sessionId = new URL(request.url).searchParams.get('session_id')
    const service = createRequestStoryService(env)
    const story = await service.getStory(params.storyId, sessionId)
    return jsonResponse({ ok: true, story })
  } catch (error) {
    return errorResponse(error)
  }
}
