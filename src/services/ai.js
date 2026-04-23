// 所有 AI 调用通过后端 /api/gpt，Key 不暴露前端

async function chat(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 512) {
  const res = await fetch('/api/gpt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userPrompt, temperature, maxTokens }),
  })
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error)
  return data.content
}

// Entrance：生成开场故事
export async function generateOpeningStory({ name, city, importantEvent, satellite }) {
  const system = `你是一个克制、精准的叙事者。用第三人称描写卫星视角，语气真实不煽情，禁用"美丽""壮阔"等形容词。输出纯 JSON，格式：{"story": "..."}`
  const user = `卫星名：${satellite.name}，轨道高度：${satellite.altitudeKm}km，倾角：${satellite.inclination}°，发射年份：${satellite.launchYear}。
用户叫${name}，来自${city}，最重要的事是：${importantEvent}。
写150字开场故事：卫星刚载入，平行时空中那件事处于前夜，结尾留悬念。`
  const raw = await chat(system, user, 0.8, 400)
  // 提取 JSON，兼容模型可能返回 markdown 代码块
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 返回格式异常')
  return JSON.parse(match[0])
}
