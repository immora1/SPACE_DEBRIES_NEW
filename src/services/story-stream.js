export async function readStoryStream(response, onEvent = () => {}) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let story = null
  try {
    const consume = line => {
      if (!line.trim()) return
      const event = JSON.parse(line)
      if (event.type === 'error') {
        const error = new Error(event.error?.message || '故事生成失败，请重试。')
        Object.assign(error, { code: event.error?.code, status: event.status })
        throw error
      }
      if (event.type === 'complete') story = event.story
      else onEvent(event)
    }
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let boundary
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        consume(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 1)
      }
      if (done) break
    }
    consume(buffer)
    if (!story) throw new Error('故事连接中断，请重新生成。')
    return story
  } catch (error) {
    onEvent({ type: 'reset' })
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
}
