import {
  createRequestStoryService,
  errorResponse,
  jsonResponse,
} from '../../../../_story/http.js'

export async function onRequestPost({ env, params, request }) {
  try {
    const body = await request.json()
    const service = createRequestStoryService(env)
    const story = await service.processNextStoryJob(
      params.storyId,
      body.session_id,
      body.retry_job_id || null,
    )
    return jsonResponse({ ok: true, story })
  } catch (error) {
    return errorResponse(error)
  }
}
