import {
  createRequestStoryService,
  errorResponse,
  jsonResponse,
} from '../../_story/http.js'

export async function onRequestPost({ env, request }) {
  try {
    const service = createRequestStoryService(env)
    const story = await service.createStory(await request.json())
    return jsonResponse({ ok: true, story }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
