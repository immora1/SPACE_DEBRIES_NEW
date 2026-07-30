const FIELD_LABELS = {
  premise: { zh: '故事主线', en: 'Premise' },
  checkpoints: { zh: '发展节点', en: 'Checkpoints' },
  successEnding: { zh: '成功走向', en: 'Success path' },
  failureEnding: { zh: '风险走向', en: 'Risk path' },
  story: { zh: '故事内容', en: 'Story' },
  feedback: { zh: 'AI 分析', en: 'AI analysis' },
  narrative: { zh: '事件叙事', en: 'Event narrative' },
  storyUpdate: { zh: '故事变化', en: 'Story update' },
  knowledgePoints: { zh: '知识要点', en: 'Knowledge points' },
  satFate: { zh: '卫星结局', en: 'Satellite fate' },
  debrisDescription: { zh: '碎片结果', en: 'Debris outcome' },
  storyEnding: { zh: '故事结局', en: 'Story ending' },
  question: { zh: '生成问题', en: 'Question' },
  explanation: { zh: 'AI 解释', en: 'AI explanation' },
}

export const AI_STORY_STAGES = {
  m1: { code: 'M1', label: { zh: '太空垃圾认知', en: 'Space debris awareness' }, fallback: { zh: '故事尚未建立，等待用户进入个性化任务。', en: 'The story has not started yet. Personalization begins in the mission stage.' } },
  m2: { code: 'M2', label: { zh: '历史事件回溯', en: 'Historical risk archive' }, fallback: { zh: '历史事件正在补充卫星面临的风险背景。', en: 'Historical events are adding risk context for the satellite.' } },
  m3: { code: 'M3', label: { zh: '卫星身份与轨道', en: 'Satellite identity and orbit' }, fallback: { zh: '用户正在建立卫星身份、材料和任务路线。', en: 'The user is defining the satellite, materials, and mission route.' } },
  m4: { code: 'M4', label: { zh: '轨道生存决策', en: 'Orbital survival decisions' }, fallback: { zh: '用户的每一次决策都会改变卫星余量与结局。', en: 'Every decision changes the satellite margins and final outcome.' } },
  m5: { code: 'M5', label: { zh: '法律责任边界', en: 'Legal responsibility' }, fallback: { zh: '故事正在进入责任认定与治理边界。', en: 'The story is entering questions of attribution and governance.' } },
  m6: { code: 'M6', label: { zh: '清理方案评估', en: 'Cleanup assessment' }, fallback: { zh: '故事正在比较不同太空垃圾清理方式。', en: 'The story is comparing different debris-cleanup methods.' } },
  m7: { code: 'M7', label: { zh: '知识总结', en: 'Knowledge archive' }, fallback: { zh: '用户正在整理观测与辨析结果。', en: 'The user is consolidating observation and classification results.' } },
  m8: { code: 'M8', label: { zh: '观测报告', en: 'Observation report' }, fallback: { zh: '用户正在提交最终观测记录。', en: 'The user is preparing the final observation record.' } },
}

function text(value, language = 'zh') {
  if (!value || typeof value === 'string') return value || ''
  return value[language] || value.zh || value.en || ''
}

function fieldLabel(key, language) {
  return text(FIELD_LABELS[key], language) || key
}

function formatValue(value, language) {
  const separator = language === 'en' ? '; ' : '；'
  const connector = language === 'en' ? ': ' : '：'

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const label = item.label || item.id || ''
          const detail = item.beat || item.text || item.description || ''
          return [label, detail].filter(Boolean).join(connector)
        }
        return String(item ?? '')
      })
      .filter(Boolean)
      .join(separator)
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${fieldLabel(key, language)}${connector}${formatValue(nestedValue, language)}`)
      .filter(Boolean)
      .join(separator)
  }

  return String(value ?? '').trim()
}

export function formatAIOutput(result, language = 'zh') {
  if (typeof result === 'string') return result.trim()
  if (!result || typeof result !== 'object') return ''
  const connector = language === 'en' ? ': ' : '：'

  return Object.entries(result)
    .map(([key, value]) => {
      const formatted = formatValue(value, language)
      return formatted ? `${fieldLabel(key, language)}${connector}${formatted}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function inferImpact(result) {
  if (!result || typeof result !== 'object') return ''
  return result.storyUpdate
    || result.storyEnding
    || result.premise
    || result.explanation
    || result.feedback
    || result.narrative
    || result.story
    || ''
}

export function createAIOutputEvent(meta, result, options = {}) {
  const createdAt = options.createdAt ?? Date.now()
  const language = options.language === 'en' ? 'en' : 'zh'
  const stage = AI_STORY_STAGES[meta.stageId] || AI_STORY_STAGES.m1

  return {
    id: options.id || `ai-${meta.type}-${createdAt}`,
    type: meta.type,
    stageId: meta.stageId,
    stageCode: stage.code,
    stageLabel: text(stage.label, language),
    title: meta.title,
    choice: meta.choice || (language === 'en' ? 'Generated from the current story context' : '由当前故事上下文自动生成'),
    impact: meta.impact || inferImpact(result) || text(stage.fallback, language),
    content: formatAIOutput(result, language),
    createdAt,
  }
}

const STORY_TASK_TITLES = {
  STORY_OUTLINE: { zh: '故事坐标', en: 'Story coordinates' },
  STORY_OPENING: { zh: '故事开场', en: 'Opening scene' },
  STORY_CONTINUE: { zh: '故事推进', en: 'Story continuation' },
  STORY_BRANCH: { zh: '关键分支', en: 'Story branch' },
  STORY_ENDING: { zh: '故事结局', en: 'Story ending' },
  KNOWLEDGE_REVEAL: { zh: '知识揭示', en: 'Knowledge reveal' },
}

const PRODUCT_MODULE_TO_STAGE = {
  M2_IDENTITY: 'm3',
  M2_MATERIALS: 'm3',
  M2_MISSION: 'm3',
  M4_ORBITAL_EVENTS: 'm4',
  M5_CLEANUP: 'm6',
}

function knowledgeRevealText(displayContent) {
  if (!displayContent?.knowledge_title) return ''
  const chain = (displayContent.causal_chain || [])
    .map((point) => [point.point_title, point.point_text].filter(Boolean).join('：'))
    .filter(Boolean)
    .join('\n')
  return [
    displayContent.knowledge_title,
    displayContent.story_connection,
    chain,
    displayContent.reality_note,
  ].filter(Boolean).join('\n\n')
}

export function publicStoryStageToEvent(stage, language = 'zh') {
  if (!stage) return null
  const inputAction = stage.input_action || {}
  const stageId = PRODUCT_MODULE_TO_STAGE[inputAction.module]
    || (stage.task_type === 'KNOWLEDGE_REVEAL' || stage.task_type === 'STORY_ENDING' ? 'm6' : 'm3')
  const stageMeta = AI_STORY_STAGES[stageId] || AI_STORY_STAGES.m3
  const storyText = stage.task_type === 'KNOWLEDGE_REVEAL'
    ? knowledgeRevealText(stage.display_content) || stage.display_content?.story_text || ''
    : stage.display_content?.story_text || ''
  const title = text(STORY_TASK_TITLES[stage.task_type], language) || stage.task_type

  return {
    id: stage.stage_id,
    type: stage.task_type.toLowerCase(),
    stageId,
    stageCode: stageMeta.code,
    stageLabel: text(stageMeta.label, language),
    title,
    choice: inputAction.label || (language === 'en' ? 'Story session created' : '建立故事会话'),
    impact: stage.stage_summary || storyText,
    content: storyText,
    createdAt: stage.created_at_ms,
  }
}

export function publicStoryTimelineToEvents(timeline, language = 'zh') {
  return (timeline || [])
    .map((stage) => publicStoryStageToEvent(stage, language))
    .filter(Boolean)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export function getStoryPhase(entries, currentModule = 'm1', language = 'zh') {
  const latest = entries.at(-1)
  const stageId = currentModule || latest?.stageId || 'm1'
  const stage = AI_STORY_STAGES[stageId] || AI_STORY_STAGES.m1

  return {
    code: stage.code,
    label: text(stage.label, language),
    action: latest?.choice || (language === 'en' ? 'No story-changing choice has been made yet' : '尚未产生影响故事走线的选择'),
    impact: latest?.impact || text(stage.fallback, language),
  }
}

export function getTimelineTickScale(index, hoveredIndex) {
  if (hoveredIndex === null || hoveredIndex === undefined) return 0.28
  const distance = Math.abs(index - hoveredIndex)
  return [1, 0.76, 0.58, 0.43][distance] ?? 0.28
}
