export async function onRequestPost({ env }) {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ ok: false, error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 256,
        messages: [{ role: 'user', content: '用一句话描述太空碎片问题，语气冷静克制，不超过50字。' }],
      }),
    })
    const rawText = await res.text()
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${rawText}`)
    const data = JSON.parse(rawText)
    return Response.json({
      ok: true,
      model: data.model,
      content: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    })
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
