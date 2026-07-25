import useAppStore from '../store/useAppStore'
import { createAIOutputEvent } from './aiTimeline'

let aiEventSequence = 0

const MATERIAL_LABELS = {
  aluminum: '铝合金',
  titanium: '钛合金',
  cfrp: '碳纤维复合材料',
  silicon: '硅基电池板',
  gaas: '砷化镓电池板',
  flexible: '柔性薄膜电池板',
  kapton: '聚酰亚胺薄膜',
  ceramic: '陶瓷隔热片',
  aluminized: '镀铝薄膜',
  'aluminum-tank': '铝合金贮箱',
  'titanium-tank': '钛合金贮箱',
  'composite-tank': '复合材料贮箱',
}

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

function eventId(type) {
  aiEventSequence += 1
  return globalThis.crypto?.randomUUID?.()
    || `ai-${type}-${Date.now()}-${aiEventSequence}`
}

async function trackedJsonChat(meta, ...args) {
  const result = await jsonChat(...args)
  const resolvedMeta = typeof meta === 'function' ? meta(result) : meta
  const event = createAIOutputEvent(resolvedMeta, result, {
    id: eventId(resolvedMeta.type),
  })
  useAppStore.getState().appendAIOutput(event)
  return result
}

function materialChoice(materials) {
  const choices = Object.values(materials || {})
    .filter(Boolean)
    .map((value) => MATERIAL_LABELS[value] || value)
  return choices.length ? `选择 ${choices.join('、')}` : '提交当前材料组合'
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
  return trackedJsonChat((result) => ({
    type: 'story-outline',
    stageId: 'm2',
    title: '个性化故事主线',
    choice: `${name || '用户'}提交“${importantEvent || '个人重要事件'}”，匹配 ${satellite?.name || '当前卫星'}`,
    impact: result.premise || '个人记忆开始与卫星命运连接。',
  }),
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
  return trackedJsonChat((result) => ({
    type: 'opening-story',
    stageId: 'm2',
    title: '故事开场生成',
    choice: `${name || '用户'}确认身份信息与 ${satellite?.name || '卫星'} 的匹配`,
    impact: result.story || '个性故事正式进入卫星任务阶段。',
  }),
    '写一段 120 字以内的开场故事。字段：story。',
    `${userText({ name, city, importantEvent })}。${satText(satellite)}。${outlineText(storyOutline)}`,
    { story: `${satellite?.name || '这颗卫星'}正在近地轨道运行。它的状态，将和${importantEvent || '那件重要的事'}一起被重新审视。` },
    0.75,
    260,
  )
}

export async function generateMaterialFeedback({ materials, satellite, user, storyOutline }) {
  const materialText = Object.entries(materials || {}).map(([k, v]) => `${k}:${v}`).join('，')
  return trackedJsonChat((result) => ({
    type: 'material-feedback',
    stageId: 'm2',
    title: '卫星材料分析',
    choice: materialChoice(materials),
    impact: result.feedback || '材料组合改变了碰撞存活率和再入残留风险。',
  }),
    '评价卫星材料选择，120 字以内。字段：feedback。',
    `${userText(user)}。${satText(satellite)}。材料：${materialText}。${outlineText(storyOutline)}`,
    { feedback: '材料选择决定了抗撞击、热防护和再入残留，需要在质量、强度和善后之间取舍。' },
    0.65,
    220,
  )
}

export async function generateMissionStory({ mission, satellite, user, material, storyOutline }) {
  return trackedJsonChat((result) => ({
    type: 'mission-story',
    stageId: 'm2',
    title: '卫星任务路线',
    choice: `选择“${mission || '当前任务'}”`,
    impact: result.story || '任务类型开始约束卫星的轨道和处置余量。',
  }),
    '写一段任务展开故事，120 字以内。字段：story。',
    `${userText(user)}。${satText(satellite)}。任务：${mission}。主要材料：${material}。${outlineText(storyOutline)}`,
    { story: `${satellite?.name || '卫星'}进入任务阶段，轨道、材料和燃料余量开始共同决定它的命运。` },
    0.75,
    260,
  )
}

export async function generateEventNarrative({ event, satellite, user: _user, storyOutline }) {
  return trackedJsonChat((result) => ({
    type: 'history-event',
    stageId: 'm3',
    title: `${event?.year || '历史'} · ${event?.name || event?.title || '太空事件'}`,
    choice: `查看“${event?.name || event?.title || '历史事件'}”`,
    impact: result.narrative || '历史事件为当前卫星增加了一条风险参照。',
  }),
    '把历史航天事件连接到当前卫星，100 字以内。字段：narrative。',
    `事件：${event?.year || ''} ${event?.name || event?.title || ''}，${event?.description || ''}。${satText(satellite)}。${outlineText(storyOutline)}`,
    { narrative: '历史事件说明，轨道上的每一次遗留都会改变后来任务的风险边界。' },
    0.7,
    220,
  )
}

export async function generateHistoryStory({ visitedEvents, satellite, user, damageLevel, storyOutline }) {
  const names = (visitedEvents || []).map((e) => `${e.year || ''} ${e.name || e.title || ''}`).join('；')
  return trackedJsonChat((result) => ({
    type: 'history-summary',
    stageId: 'm3',
    title: '历史风险总结',
    choice: `查看 ${visitedEvents?.length || 0} 个历史事件`,
    impact: result.story || `累计损伤风险更新为 ${damageLevel || 0}。`,
  }),
    '总结学习者看过的历史事件，120 字以内。字段：story。',
    `${userText(user)}。${satText(satellite)}。事件：${names}。损伤值：${damageLevel}。${outlineText(storyOutline)}`,
    { story: '这些历史节点把碎片问题从个案推向系统风险，也为后续决策埋下约束。' },
    0.75,
    260,
  )
}

export async function generateGameDecisionFeedback({ decision, threat, outcome, satellite, user, storyOutline, decisionIndex = 0, totalDecisions = 6 }) {
  return trackedJsonChat((result) => ({
    type: 'game-decision',
    stageId: 'm4',
    title: `生存决策 ${decisionIndex + 1} / ${totalDecisions}`,
    choice: `面对“${threat}”选择“${decision}”`,
    impact: result.storyUpdate || result.feedback || (outcome === 'correct' ? '主要风险下降，但任务资源被消耗。' : '风险继续累积，后续选择余量减少。'),
  }),
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
  return trackedJsonChat((result) => ({
    type: 'game-reflection',
    stageId: 'm4',
    title: '轨道生存任务复盘',
    choice: `完成 ${decisions?.length || 0} 次决策，其中 ${correct} 次有效`,
    impact: result.storyEnding || result.satFate || '任务结果确定了卫星和碎片的最终走向。',
  }),
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
  return trackedJsonChat((result) => ({
    type: 'video-question',
    stageId: 'm7',
    title: '观测辨析问题',
    choice: '进入观测教学与辨析环节',
    impact: result.question || 'AI 根据当前故事背景生成新的观测问题。',
  }),
    '生成一个观测辨析问题，60 字以内。字段：question。',
    `${userText(user)}。${satText(satellite)}。主题：区分再入碎片、流星和卫星过境。`,
    { question: '如果夜空中出现一串缓慢移动的亮点，你会先检查哪些线索来判断它是不是卫星星座？' },
    0.75,
    160,
  )
}

export async function generateAnswerExplanation({ question, answer, satellite, user }) {
  return trackedJsonChat((result) => ({
    type: 'answer-explanation',
    stageId: 'm7',
    title: '观测答案解析',
    choice: `回答“${answer || '未填写答案'}”`,
    impact: result.explanation || '用户的观测判断被纳入最终知识总结。',
  }),
    '解释用户答案，120 字以内。字段：explanation。',
    `${userText(user)}。${satText(satellite)}。问题：${question}。回答：${answer}。`,
    { explanation: '判断时要结合速度、持续时间、方向、亮度变化和是否出现碎裂轨迹，不能只看亮度。' },
    0.65,
    240,
  )
}
