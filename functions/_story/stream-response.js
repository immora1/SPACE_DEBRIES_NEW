import { errorResponse } from './http.js'

export function createStoryStream(service, input) {
  const encoder = new TextEncoder()
  const abort = new AbortController()
  let closed = false
  const body = new ReadableStream({
    async start(controller) {
      const send = event => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      // Keep the connection active while the private outline is generated.
      const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 10000)
      try {
        const story = await service.createStory(input, send, abort.signal)
        send({ type: 'complete', story })
      } catch (error) {
        const response = errorResponse(error)
        const payload = await response.json()
        send({ type: 'reset' })
        send({ type: 'error', error: payload.error, status: response.status })
      } finally {
        clearInterval(heartbeat)
        if (!closed) { closed = true; controller.close() }
      }
    },
    cancel() { closed = true; abort.abort() },
  })
  return new Response(body, { headers: {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    'x-content-type-options': 'nosniff',
  } })
}
