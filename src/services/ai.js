import useAppStore from '../store/useAppStore'
import { createAIOutputEvent } from './aiTimeline'
import {
  buildM2MaterialInteractions,
  buildM3MissionInteractions,
  M2_MATERIAL_NODE_ID,
  M2_STORY_MODULE_ID,
  M3_MISSION_NODE_ID,
  M3_STORY_MODULE_ID,
} from './storySiteInteractions'

let aiEventSequence = 0
const STORY_SESSION_STORAGE_KEY = 'space-debris-story-session'
const storyProcessors = new Map()

export const STORY_ACTION = Object.freeze({
  STORY_OPTION_SELECT: 'STORY_OPTION_SELECT',
  SITE_INTERACTION_COMMIT: 'SITE_INTERACTION_COMMIT',
  MATERIALS_COMMIT: 'MATERIALS_COMMIT',
  ORBITAL_EVENT_RESOLVE: 'ORBITAL_EVENT_RESOLVE',
  GAME_ANSWER_CONFIRM: 'GAME_ANSWER_CONFIRM',
  CLEANUP_PAIR_SUBMIT: 'CLEANUP_PAIR_SUBMIT',
  M6_MATCH_UPDATE: 'M6_MATCH_UPDATE',
  M6_MATCH_COMPLETE: 'M6_MATCH_COMPLETE',
})

export const M6_CLEANUP_MODULE_ID = 'M6_CLEANUP_MATCHING'

export class StoryAPIError extends Error {
  constructor(code, message, status, details) {
    super(message)
    this.name = 'StoryAPIError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function getStoredStorySession() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.sessionStorage.getItem(STORY_SESSION_STORAGE_KEY))
  } catch {
    return null
  }
}

function storeStorySession(storyId, sessionId) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(
    STORY_SESSION_STORAGE_KEY,
    JSON.stringify({ storyId, sessionId }),
  )
}

export function clearStoredStorySession() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(STORY_SESSION_STORAGE_KEY)
}

async function storyFetch(path, init) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  let data
  try {
    data = await response.json()
  } catch {
    throw new StoryAPIError('INVALID_RESPONSE', '故事服务返回了无法解析的响应。', response.status)
  }
  if (!response.ok || !data.ok) {
    const error = data?.error || {}
    throw new StoryAPIError(
      error.code || 'STORY_REQUEST_FAILED',
      error.message || `故事服务请求失败（${response.status}）`,
      response.status,
      error.details,
    )
  }
  return data.story
}

function startStoryRequest() {
  useAppStore.getState().startStoryRequest()
}

function finishStoryRequest(story) {
  useAppStore.getState().setStorySnapshot(story)
  return story
}

function failStoryRequest(error) {
  useAppStore.getState().setStoryError({
    code: error.code || 'STORY_REQUEST_FAILED',
    message: error.message || '故事服务暂时不可用。',
  })
  throw error
}

export function isStorySessionUnavailableError(error) {
  return ['STORY_SESSION_MISSING', 'STORY_SESSION_EXPIRED'].includes(error?.code)
}

function normalizeStoryActionError(error) {
  if (error?.status !== 404) return error
  clearStoredStorySession()
  useAppStore.getState().clearStorySession()
  return new StoryAPIError(
    'STORY_SESSION_EXPIRED',
    '本地故事后端已重启，原故事会话无法恢复。你的页面选择仍已保留，请重新建立身份后继续。',
    409,
  )
}

export async function createStorySession({
  name,
  city,
  importantEvent,
  satellite,
  damageLevel = 0,
  historyEventIds = [],
}) {
  const sessionId = globalThis.crypto.randomUUID()
  clearStoredStorySession()
  startStoryRequest()
  try {
    const story = await storyFetch('/api/stories', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        nickname: name,
        city,
        important_event: importantEvent,
        satellite,
        game_context: {
          damage_level: damageLevel,
          history_event_ids: historyEventIds,
        },
        language: currentLanguage(),
      }),
    })
    storeStorySession(story.story_id, sessionId)
    return finishStoryRequest(story)
  } catch (error) {
    return failStoryRequest(error)
  }
}

export async function restoreStorySession() {
  const state = useAppStore.getState()
  const credentials = getStoredStorySession()
  if (!state.storyId) return null
  if (!credentials || credentials.storyId !== state.storyId) {
    clearStoredStorySession()
    state.clearStorySession()
    return null
  }
  startStoryRequest()
  try {
    const story = await storyFetch(
      `/api/stories/${encodeURIComponent(state.storyId)}?session_id=${encodeURIComponent(credentials.sessionId)}`,
      { method: 'GET' },
    )
    return finishStoryRequest(story)
  } catch (error) {
    if (error.status === 404) {
      clearStoredStorySession()
      state.clearStorySession()
    } else {
      state.setStoryError({ code: error.code, message: error.message })
    }
    throw error
  }
}

async function submitStoryAction(action) {
  const state = useAppStore.getState()
  const credentials = getStoredStorySession()
  if (!state.storyId || !credentials || credentials.storyId !== state.storyId) {
    throw new StoryAPIError('STORY_SESSION_MISSING', '请先在身份信息阶段建立故事。', 409)
  }
  startStoryRequest()
  try {
    const story = await storyFetch(
      `/api/stories/${encodeURIComponent(state.storyId)}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: credentials.sessionId,
          version: state.storyVersion,
          ...action,
        }),
      },
    )
    return finishStoryRequest(story)
  } catch (error) {
    return failStoryRequest(normalizeStoryActionError(error))
  }
}

export function submitCurrentStoryOption(optionId, clientActionId = globalThis.crypto.randomUUID()) {
  const state = useAppStore.getState()
  if (!state.currentStoryNode) {
    return Promise.reject(
      new StoryAPIError('STORY_NODE_MISSING', '当前没有等待处理的故事节点。', 409),
    )
  }
  return submitStoryAction({
    action_type: STORY_ACTION.STORY_OPTION_SELECT,
    node_id: state.currentStoryNode,
    option_id: optionId,
    client_action_id: clientActionId,
  })
}

export function submitSiteStoryInteraction({
  nodeId,
  moduleId,
  interactions,
  clientActionId = globalThis.crypto.randomUUID(),
}) {
  return submitStoryAction({
    action_type: STORY_ACTION.SITE_INTERACTION_COMMIT,
    node_id: nodeId,
    module_id: moduleId,
    interactions,
    client_action_id: clientActionId,
  })
}

export function submitMaterialStoryAction(
  materials,
  clientActionId = globalThis.crypto.randomUUID(),
) {
  return submitSiteStoryInteraction({
    nodeId: M2_MATERIAL_NODE_ID,
    moduleId: M2_STORY_MODULE_ID,
    interactions: buildM2MaterialInteractions(materials),
    clientActionId,
  })
}

export function submitMissionStoryAction(
  missionId,
  clientActionId = globalThis.crypto.randomUUID(),
) {
  return submitSiteStoryInteraction({
    nodeId: M3_MISSION_NODE_ID,
    moduleId: M3_STORY_MODULE_ID,
    interactions: buildM3MissionInteractions(missionId),
    clientActionId,
  })
}

function orbitalAnswerControlId(questionId, answerId) {
  return `m4-orbital:${questionId}:${answerId}`
}

export function submitOrbitalEventStoryAction(
  eventId,
  optionId,
  _questionOrder,
  clientActionId = globalThis.crypto.randomUUID(),
) {
  return submitStoryAction({
    action_type: STORY_ACTION.GAME_ANSWER_CONFIRM,
    node_id: 'node_04',
    game_module_id: 'M4_ORBITAL_EVENTS',
    question_id: eventId,
    answer_id: optionId,
    control_id: orbitalAnswerControlId(eventId, optionId),
    client_action_id: clientActionId,
  })
}

async function refreshStorySessionSilently() {
  const state = useAppStore.getState()
  const credentials = getStoredStorySession()
  if (!state.storyId || !credentials || credentials.storyId !== state.storyId) return null
  const story = await storyFetch(
    `/api/stories/${encodeURIComponent(state.storyId)}?session_id=${encodeURIComponent(credentials.sessionId)}`,
    { method: 'GET' },
  )
  useAppStore.getState().setStorySnapshot(story)
  return story
}

export function processQueuedStoryJobs({ retryJobId = null } = {}) {
  const state = useAppStore.getState()
  const credentials = getStoredStorySession()
  if (!state.storyId || !credentials || credentials.storyId !== state.storyId) {
    return Promise.resolve(null)
  }
  const existing = storyProcessors.get(state.storyId)
  if (existing && !retryJobId) return existing

  const storyId = state.storyId
  const processor = (async () => {
    let retryId = retryJobId
    try {
      for (;;) {
        const story = await storyFetch(
          `/api/stories/${encodeURIComponent(storyId)}/generations/process`,
          {
            method: 'POST',
            body: JSON.stringify({
              session_id: credentials.sessionId,
              ...(retryId ? { retry_job_id: retryId } : {}),
            }),
          },
        )
        retryId = null
        useAppStore.getState().setStorySnapshot(story)
        const sync = story.game_story_sync
        if (
          !sync
          || sync.has_failed_job
          || sync.queued_story_stages === 0
          || sync.current_generation_node
        ) break
      }
    } catch (error) {
      try {
        await refreshStorySessionSilently()
      } catch {
        useAppStore.getState().setStoryError({
          code: error.code || 'STORY_GENERATION_FAILED',
          message: error.message || '后台故事生成失败，可稍后重试。',
        })
      }
      throw error
    } finally {
      storyProcessors.delete(storyId)
    }
    return useAppStore.getState().gameStorySync
  })()
  storyProcessors.set(storyId, processor)
  return processor
}

export function submitCleanupMatchStoryAction({
  cleanupTargetId,
  cleanupMethodId,
  clientActionId = globalThis.crypto.randomUUID(),
}) {
  return submitStoryAction({
    action_type: STORY_ACTION.M6_MATCH_UPDATE,
    node_id: 'node_05',
    module_id: M6_CLEANUP_MODULE_ID,
    cleanup_target_id: cleanupTargetId,
    cleanup_method_id: cleanupMethodId,
    client_action_id: clientActionId,
  })
}

export function submitCleanupMatchingComplete(
  completionId,
  clientActionId = completionId,
) {
  return submitStoryAction({
    action_type: STORY_ACTION.M6_MATCH_COMPLETE,
    node_id: 'node_05',
    module_id: M6_CLEANUP_MODULE_ID,
    completion_id: completionId,
    client_action_id: clientActionId,
  })
}

const MATERIAL_LABELS = {
  aluminum: ['铝合金', 'aluminum alloy'],
  titanium: ['钛合金', 'titanium alloy'],
  cfrp: ['碳纤维复合材料', 'carbon-fiber composite'],
  silicon: ['硅基电池板', 'silicon solar array'],
  gaas: ['砷化镓电池板', 'GaAs solar array'],
  flexible: ['柔性薄膜电池板', 'flexible thin-film array'],
  kapton: ['聚酰亚胺薄膜', 'Kapton film'],
  ceramic: ['陶瓷隔热片', 'ceramic thermal tile'],
  aluminized: ['镀铝薄膜', 'aluminized film'],
  'aluminum-tank': ['铝合金贮箱', 'aluminum propellant tank'],
  'titanium-tank': ['钛合金贮箱', 'titanium pressure vessel'],
  'composite-tank': ['复合材料贮箱', 'composite pressure vessel'],
}

function currentLanguage() {
  return useAppStore.getState().language === 'en' ? 'en' : 'zh'
}

function copy(zh, en, language = currentLanguage()) {
  return language === 'en' ? en : zh
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
  const raw = await chat(
    `${system}\n${copy('请使用中文生成所有字段内容。只返回 JSON，不要 Markdown。', 'Write every field value in English. Return JSON only, without Markdown.')}`,
    user,
    temperature,
    maxTokens,
  )
  return parseJSON(raw, fallback)
}

function eventId(type) {
  aiEventSequence += 1
  return globalThis.crypto?.randomUUID?.()
    || `ai-${type}-${Date.now()}-${aiEventSequence}`
}

async function trackedJsonChat(meta, ...args) {
  const language = currentLanguage()
  const result = await jsonChat(...args)
  const resolvedMeta = typeof meta === 'function' ? meta(result) : meta
  const event = createAIOutputEvent(resolvedMeta, result, {
    id: eventId(resolvedMeta.type),
    language,
  })
  useAppStore.getState().appendAIOutput(event)
  return result
}

function materialChoice(materials) {
  const language = currentLanguage()
  const choices = Object.values(materials || {})
    .filter(Boolean)
    .map((value) => MATERIAL_LABELS[value]?.[language === 'en' ? 1 : 0] || value)
  return choices.length
    ? copy(`选择 ${choices.join('、')}`, `Selected ${choices.join(', ')}`, language)
    : copy('提交当前材料组合', 'Submitted the current material set', language)
}

function satText(satellite) {
  const language = currentLanguage()
  if (!satellite) return copy('未知卫星', 'Unknown satellite', language)
  return copy(
    `${satellite.name || '卫星'}，高度 ${satellite.altitudeKm || '?'} km，倾角 ${satellite.inclination || '?'}°`,
    `${satellite.name || 'Satellite'}, altitude ${satellite.altitudeKm || '?'} km, inclination ${satellite.inclination || '?'}°`,
    language,
  )
}

function userText(user) {
  const language = currentLanguage()
  if (!user) return copy('用户', 'User', language)
  return copy(
    `${user.name || '用户'}，来自 ${user.city || '未知城市'}，记忆事件：${user.importantEvent || '一件重要的事'}`,
    `${user.name || 'User'}, from ${user.city || 'an unknown city'}, memory event: ${user.importantEvent || 'an important event'}`,
    language,
  )
}

function outlineText(storyOutline) {
  if (!storyOutline) return ''
  return copy(
    `主线：${storyOutline.premise || ''}；成功结局：${storyOutline.successEnding || ''}；失败结局：${storyOutline.failureEnding || ''}`,
    `Premise: ${storyOutline.premise || ''}; success ending: ${storyOutline.successEnding || ''}; failure ending: ${storyOutline.failureEnding || ''}`,
  )
}

export async function generateStoryOutline({ name, city, importantEvent, satellite }) {
  return trackedJsonChat((result) => ({
    type: 'story-outline',
    stageId: 'm3',
    title: copy('个性化故事主线', 'Personalized story premise'),
    choice: copy(
      `${name || '用户'}提交“${importantEvent || '个人重要事件'}”，匹配 ${satellite?.name || '当前卫星'}`,
      `${name || 'The user'} submitted "${importantEvent || 'a personal event'}" and matched with ${satellite?.name || 'the current satellite'}`,
    ),
    impact: result.premise || copy('个人记忆开始与卫星命运连接。', 'A personal memory is now connected to the satellite\'s fate.'),
  }),
    '你为太空碎片互动课程生成一条简短叙事主线。字段：premise, checkpoints, successEnding, failureEnding。checkpoints 用 6 个对象：id,label,beat。',
    `学习者：${name}，城市：${city}，个人事件：${importantEvent}。卫星：${satText(satellite)}。`,
    {
      premise: copy(`${name || '学习者'}把一颗卫星的命运和自己的重要记忆连接起来。`, `${name || 'The learner'} connects an important memory to the fate of a satellite.`),
      checkpoints: ['entrance', 'm1', 'm2', 'm3', 'm4'].map((id) => ({ id, label: id.toUpperCase(), beat: copy('理解轨道碎片风险。', 'Understand orbital-debris risk.') })),
      successEnding: copy('卫星完成处置，记忆被保留下来。', 'The satellite is disposed of safely and the memory remains intact.'),
      failureEnding: copy('卫星失控，记忆出现偏移。', 'The satellite loses control and the memory shifts with it.'),
    },
    0.75,
    520,
  )
}

export async function generateOpeningStory({ name, city, importantEvent, satellite, storyOutline }) {
  return trackedJsonChat((result) => ({
    type: 'opening-story',
    stageId: 'm3',
    title: copy('故事开场生成', 'Opening story'),
    choice: copy(`${name || '用户'}确认身份信息与 ${satellite?.name || '卫星'} 的匹配`, `${name || 'The user'} confirmed the identity match with ${satellite?.name || 'the satellite'}`),
    impact: result.story || copy('个性故事正式进入卫星任务阶段。', 'The personalized story enters the satellite mission stage.'),
  }),
    '写一段 120 字以内的开场故事。字段：story。',
    `${userText({ name, city, importantEvent })}。${satText(satellite)}。${outlineText(storyOutline)}`,
    { story: copy(`${satellite?.name || '这颗卫星'}正在近地轨道运行。它的状态，将和${importantEvent || '那件重要的事'}一起被重新审视。`, `${satellite?.name || 'This satellite'} is operating in low Earth orbit. Its condition will now be reconsidered alongside ${importantEvent || 'that important event'}.`) },
    0.75,
    260,
  )
}

export async function generateMaterialFeedback({ materials, satellite, user, storyOutline }) {
  const materialText = Object.entries(materials || {}).map(([k, v]) => `${k}:${v}`).join('，')
  return trackedJsonChat((result) => ({
    type: 'material-feedback',
    stageId: 'm3',
    title: copy('卫星材料分析', 'Satellite material analysis'),
    choice: materialChoice(materials),
    impact: result.feedback || copy('材料组合改变了碰撞存活率和再入残留风险。', 'The material set changes collision survivability and re-entry residue risk.'),
  }),
    '评价卫星材料选择，120 字以内。字段：feedback。',
    `${userText(user)}。${satText(satellite)}。材料：${materialText}。${outlineText(storyOutline)}`,
    { feedback: copy('材料选择决定了抗撞击、热防护和再入残留，需要在质量、强度和善后之间取舍。', 'Material choices determine impact resistance, thermal protection, and re-entry residue, requiring tradeoffs between mass, strength, and disposal.') },
    0.65,
    220,
  )
}

export async function generateMissionStory({ mission, satellite, user, material, storyOutline }) {
  return trackedJsonChat((result) => ({
    type: 'mission-story',
    stageId: 'm3',
    title: copy('卫星任务路线', 'Satellite mission route'),
    choice: copy(`选择“${mission || '当前任务'}”`, `Selected "${mission || 'the current mission'}"`),
    impact: result.story || copy('任务类型开始约束卫星的轨道和处置余量。', 'The mission type now constrains orbit and disposal margin.'),
  }),
    '写一段任务展开故事，120 字以内。字段：story。',
    `${userText(user)}。${satText(satellite)}。任务：${mission}。主要材料：${material}。${outlineText(storyOutline)}`,
    { story: copy(`${satellite?.name || '卫星'}进入任务阶段，轨道、材料和燃料余量开始共同决定它的命运。`, `${satellite?.name || 'The satellite'} enters its mission phase, where orbit, materials, and fuel margin begin shaping its fate.`) },
    0.75,
    260,
  )
}

export async function generateEventNarrative({ event, satellite, user: _user, storyOutline }) {
  return trackedJsonChat((result) => ({
    type: 'history-event',
    stageId: 'm2',
    title: `${event?.year || copy('历史', 'History')} · ${event?.name || event?.title || copy('太空事件', 'Space event')}`,
    choice: copy(`查看“${event?.name || event?.title || '历史事件'}”`, `Viewed "${event?.nameEn || event?.name || event?.title || 'historical event'}"`),
    impact: result.narrative || copy('历史事件为当前卫星增加了一条风险参照。', 'The historical event adds a new risk reference for the current satellite.'),
  }),
    '把历史航天事件连接到当前卫星，100 字以内。字段：narrative。',
    `事件：${event?.year || ''} ${event?.name || event?.title || ''}，${event?.description || ''}。${satText(satellite)}。${outlineText(storyOutline)}`,
    { narrative: copy('历史事件说明，轨道上的每一次遗留都会改变后来任务的风险边界。', 'The event shows how every object left in orbit changes the risk boundary for later missions.') },
    0.7,
    220,
  )
}

export async function generateHistoryStory({ visitedEvents, satellite, user, damageLevel, storyOutline }) {
  const names = (visitedEvents || []).map((e) => `${e.year || ''} ${e.name || e.title || ''}`).join('；')
  return trackedJsonChat((result) => ({
    type: 'history-summary',
    stageId: 'm2',
    title: copy('历史风险总结', 'Historical risk summary'),
    choice: copy(`查看 ${visitedEvents?.length || 0} 个历史事件`, `Viewed ${visitedEvents?.length || 0} historical events`),
    impact: result.story || copy(`累计损伤风险更新为 ${damageLevel || 0}。`, `Cumulative damage risk is now ${damageLevel || 0}.`),
  }),
    '总结学习者看过的历史事件，120 字以内。字段：story。',
    `${userText(user)}。${satText(satellite)}。事件：${names}。损伤值：${damageLevel}。${outlineText(storyOutline)}`,
    { story: copy('这些历史节点把碎片问题从个案推向系统风险，也为后续决策埋下约束。', 'These historical moments turn debris from isolated incidents into a systemic risk that constrains later decisions.') },
    0.75,
    260,
  )
}

export async function generateGameDecisionFeedback({ decision, threat, outcome, satellite, user, storyOutline, decisionIndex = 0, totalDecisions = 6 }) {
  return trackedJsonChat((result) => ({
    type: 'game-decision',
    stageId: 'm4',
    title: copy(`生存决策 ${decisionIndex + 1} / ${totalDecisions}`, `Survival decision ${decisionIndex + 1} / ${totalDecisions}`),
    choice: copy(`面对“${threat}”选择“${decision}”`, `Chose "${decision}" in response to "${threat}"`),
    impact: result.storyUpdate || result.feedback || (outcome === 'correct'
      ? copy('主要风险下降，但任务资源被消耗。', 'Primary risk decreased, but mission resources were consumed.')
      : copy('风险继续累积，后续选择余量减少。', 'Risk continues to accumulate and later choices have less margin.')),
  }),
    '评价一次轨道风险决策。字段：feedback, storyUpdate。每项 80 字以内。',
    `${userText(user)}。${satText(satellite)}。第 ${decisionIndex + 1}/${totalDecisions} 轮，威胁：${threat}，决策：${decision}，结果：${outcome}。${outlineText(storyOutline)}`,
    {
      feedback: outcome === 'correct' ? copy('决策降低了主要风险，但也消耗了有限资源。', 'The decision reduced the primary risk but consumed limited resources.') : copy('决策保留了部分资源，却让风险继续累积。', 'The decision preserved some resources while allowing risk to accumulate.'),
      storyUpdate: copy(`${satellite?.name || '卫星'}的轨道状态发生变化，后续选择余量被重新计算。`, `${satellite?.name || 'The satellite'} changes orbital state and the remaining decision margin is recalculated.`),
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
    title: copy('轨道生存任务复盘', 'Orbital survival debrief'),
    choice: copy(`完成 ${decisions?.length || 0} 次决策，其中 ${correct} 次有效`, `Completed ${decisions?.length || 0} decisions, with ${correct} effective responses`),
    impact: result.storyEnding || result.satFate || copy('任务结果确定了卫星和碎片的最终走向。', 'The mission result determines the final path of the satellite and its debris.'),
  }),
    '生成任务复盘。字段：knowledgePoints(string[3]), satFate, debrisDescription, storyEnding。',
    `${userText(user)}。${satText(satellite)}。结果：${gameResult}。正确决策：${correct}/${decisions?.length || 0}。材料：${material}。${outlineText(storyOutline)}`,
    {
      knowledgePoints: currentLanguage() === 'en'
        ? ['Avoidance maneuvers consume fuel.', 'Smaller debris is harder to track.', 'End-of-life disposal capability must be reserved in advance.']
        : ['规避机动会消耗燃料。', '碎片越小越难跟踪。', '任务末期处置必须提前预留能力。'],
      satFate: gameResult === 'success' ? copy('卫星保留了处置能力。', 'The satellite retains disposal capability.') : copy('卫星失去控制，成为新的风险源。', 'The satellite loses control and becomes a new risk source.'),
      debrisDescription: copy(`${material || '卫星'}残片留在近地轨道。`, `${material || 'Satellite'} fragments remain in low Earth orbit.`),
      storyEnding: gameResult === 'success' ? copy('那件重要的事仍按原方向推进。', 'The important event continues along its original path.') : copy('那件重要的事出现了无法忽视的偏移。', 'The important event shifts in a way that can no longer be ignored.'),
    },
    0.65,
    420,
  )
}

export async function generateVideoQuestion({ satellite, user }) {
  return trackedJsonChat((result) => ({
    type: 'video-question',
    stageId: 'm7',
    title: copy('观测辨析问题', 'Observation question'),
    choice: copy('进入观测教学与辨析环节', 'Entered observation and classification training'),
    impact: result.question || copy('AI 根据当前故事背景生成新的观测问题。', 'AI generated a new observation question from the current story context.'),
  }),
    '生成一个观测辨析问题，60 字以内。字段：question。',
    `${userText(user)}。${satText(satellite)}。主题：区分再入碎片、流星和卫星过境。`,
    { question: copy('如果夜空中出现一串缓慢移动的亮点，你会先检查哪些线索来判断它是不是卫星星座？', 'If a string of slowly moving lights appears in the night sky, which clues would you check first to decide whether it is a satellite constellation?') },
    0.75,
    160,
  )
}

export async function generateAnswerExplanation({ question, answer, satellite, user }) {
  return trackedJsonChat((result) => ({
    type: 'answer-explanation',
    stageId: 'm7',
    title: copy('观测答案解析', 'Observation answer analysis'),
    choice: copy(`回答“${answer || '未填写答案'}”`, `Answered "${answer || 'no answer provided'}"`),
    impact: result.explanation || copy('用户的观测判断被纳入最终知识总结。', 'The user\'s observation judgment is included in the final knowledge summary.'),
  }),
    '解释用户答案，120 字以内。字段：explanation。',
    `${userText(user)}。${satText(satellite)}。问题：${question}。回答：${answer}。`,
    { explanation: copy('判断时要结合速度、持续时间、方向、亮度变化和是否出现碎裂轨迹，不能只看亮度。', 'Use speed, duration, direction, brightness changes, and fragmentation together; brightness alone is not enough.') },
    0.65,
    240,
  )
}
