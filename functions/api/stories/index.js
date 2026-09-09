import {
  createRequestStoryService,
  errorResponse,
  jsonResponse,
} from '../../_story/http.js'
import { createStoryStream } from '../../_story/stream-response.js'

export async function onRequestPost({ env, request }) {
  try {
    const service = createRequestStoryService(env)
    const input = await request.json()
    if (request.headers.get('accept')?.includes('application/x-ndjson')) {
      return createStoryStream(service, input)
    }
    const story = await service.createStory(input)
    return jsonResponse({ ok: true, story }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
