async function chat(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 360) {
  const res = await fetch('/api/gpt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userPrompt, temperature, maxTokens }),
  })
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'AI request failed')
  return data.content || ''
}

function parseJSON(raw, fallback) {
  const text = String(raw || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return fallback
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return fallback
  }
}

async function jsonChat(system, user, fallback, temperature = 0.7, maxTokens = 360) {
  const raw = await chat(`${system}\n只返回 JSON，不要 Markdown。`, user, temperature, maxTokens)
  return parseJSON(raw, fallback)
}

function satText(satellite) {
  if (!satellite) return '未知卫星'
  return `${satellite.name || '卫星'}，高度 ${satellite.altitudeKm || '?'} km，倾角 ${satellite.inclination || '?'}°`
}

function userText(user) {
  if (!user) return '用户'
  return `${user.name || '用户'}，来自 ${user.city || '未知城市'}，记忆事件：${user.importantEvent || '一件重要的事'}`
}

function outlineText(storyOutline) {
  if (!storyOutline) return ''
  return `主线：${storyOutline.premise || ''}；成功结局：${storyOutline.successEnding || ''}；失败结局：${storyOutline.failureEnding || ''}`
}

export async function generateStoryOutline({ name, city, importantEvent, satellite }) {
  return jsonChat(
    '你为太空碎片互动课程生成一条简短叙事主线。字段：premise, checkpoints, successEnding, failureEnding。checkpoints 用 6 个对象：id,label,beat。',
    `学习者：${name}，城市：${city}，个人事件：${importantEvent}。卫星：${satText(satellite)}。`,
    {
      premise: `${name || '学习者'}把一颗卫星的命运和自己的重要记忆连接起来。`,
      checkpoints: ['entrance', 'm1', 'm2', 'm3', 'm4'].map((id) => ({ id, label: id.toUpperCase(), beat: '理解轨道碎片风险。' })),
      successEnding: '卫星完成处置，记忆被保留下来。',
      failureEnding: '卫星失控，记忆出现偏移。',
    },
    0.75,
    520,
  )
}

export async function generateOpeningStory({ name, city, importantEvent, satellite, storyOutline }) {
  return jsonChat(
    '写一段 120 字以内的开场故事。字段：story。',
    `${userText({ name, city, importantEvent })}。${satText(satellite)}。${outlineText(storyOutline)}`,
    { story: `${satellite?.name || '这颗卫星'}正在近地轨道运行。它的状态，将和${importantEvent || '那件重要的事'}一起被重新审视。` },
    0.75,
    260,
  )
}

export async function generateMaterialFeedback({ materials, satellite, user, storyOutline }) {
  const materialText = Object.entries(materials || {}).map(([k, v]) => `${k}:${v}`).join('，')
  return jsonChat(
    '评价卫星材料选择，120 字以内。字段：feedback。',
    `${userText(user)}。${satText(satellite)}。材料：${materialText}。${outlineText(storyOutline)}`,
    { feedback: '材料选择决定了抗撞击、热防护和再入残留，需要在质量、强度和善后之间取舍。' },
    0.65,
    220,
  )
}

export async function generateMissionStory({ mission, satellite, user, material, storyOutline }) {
  return jsonChat(
    '写一段任务展开故事，120 字以内。字段：story。',
    `${userText(user)}。${satText(satellite)}。任务：${mission}。主要材料：${material}。${outlineText(storyOutline)}`,
    { story: `${satellite?.name || '卫星'}进入任务阶段，轨道、材料和燃料余量开始共同决定它的命运。` },
    0.75,
    260,
  )
}

export async function generateEventNarrative({ event, satellite, user: _user, storyOutline }) {
  return jsonChat(
    '把历史航天事件连接到当前卫星，100 字以内。字段：narrative。',
    `事件：${event?.year || ''} ${event?.name || event?.title || ''}，${event?.description || ''}。${satText(satellite)}。${outlineText(storyOutline)}`,
    { narrative: '历史事件说明，轨道上的每一次遗留都会改变后来任务的风险边界。' },
    0.7,
    220,
  )
}

export async function generateHistoryStory({ visitedEvents, satellite, user, damageLevel, storyOutline }) {
  const names = (visitedEvents || []).map((e) => `${e.year || ''} ${e.name || e.title || ''}`).join('；')
  return jsonChat(
    '总结学习者看过的历史事件，120 字以内。字段：story。',
    `${userText(user)}。${satText(satellite)}。事件：${names}。损伤值：${damageLevel}。${outlineText(storyOutline)}`,
    { story: '这些历史节点把碎片问题从个案推向系统风险，也为后续决策埋下约束。' },
    0.75,
    260,
  )
}

export async function generateGameDecisionFeedback({ decision, threat, outcome, satellite, user, storyOutline, decisionIndex = 0, totalDecisions = 6 }) {
  return jsonChat(
    '评价一次轨道风险决策。字段：feedback, storyUpdate。每项 80 字以内。',
    `${userText(user)}。${satText(satellite)}。第 ${decisionIndex + 1}/${totalDecisions} 轮，威胁：${threat}，决策：${decision}，结果：${outcome}。${outlineText(storyOutline)}`,
    {
      feedback: outcome === 'correct' ? '决策降低了主要风险，但也消耗了有限资源。' : '决策保留了部分资源，却让风险继续累积。',
      storyUpdate: `${satellite?.name || '卫星'}的轨道状态发生变化，后续选择余量被重新计算。`,
    },
    0.65,
    260,
  )
}

export async function generateGameReflection({ gameResult, decisions, satellite, user, material, storyOutline }) {
  const correct = (decisions || []).filter((d) => d.outcome === 'correct').length
  return jsonChat(
    '生成任务复盘。字段：knowledgePoints(string[3]), satFate, debrisDescription, storyEnding。',
    `${userText(user)}。${satText(satellite)}。结果：${gameResult}。正确决策：${correct}/${decisions?.length || 0}。材料：${material}。${outlineText(storyOutline)}`,
    {
      knowledgePoints: ['规避机动会消耗燃料。', '碎片越小越难跟踪。', '任务末期处置必须提前预留能力。'],
      satFate: gameResult === 'success' ? '卫星保留了处置能力。' : '卫星失去控制，成为新的风险源。',
      debrisDescription: `${material || '卫星'}残片留在近地轨道。`,
      storyEnding: gameResult === 'success' ? '那件重要的事仍按原方向推进。' : '那件重要的事出现了无法忽视的偏移。',
    },
    0.65,
    420,
  )
}

export async function generateVideoQuestion({ satellite, user }) {
  return jsonChat(
    '生成一个观测辨析问题，60 字以内。字段：question。',
    `${userText(user)}。${satText(satellite)}。主题：区分再入碎片、流星和卫星过境。`,
    { question: '如果夜空中出现一串缓慢移动的亮点，你会先检查哪些线索来判断它是不是卫星星座？' },
    0.75,
    160,
  )
}

export async function generateAnswerExplanation({ question, answer, satellite, user }) {
  return jsonChat(
    '解释用户答案，120 字以内。字段：explanation。',
    `${userText(user)}。${satText(satellite)}。问题：${question}。回答：${answer}。`,
    { explanation: '判断时要结合速度、持续时间、方向、亮度变化和是否出现碎裂轨迹，不能只看亮度。' },
    0.65,
    240,
  )
}