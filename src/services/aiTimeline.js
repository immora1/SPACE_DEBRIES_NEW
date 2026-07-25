const FIELD_LABELS = {
  premise: '故事主线',
  checkpoints: '发展节点',
  successEnding: '成功走向',
  failureEnding: '风险走向',
  story: '故事内容',
  feedback: 'AI 分析',
  narrative: '事件叙事',
  storyUpdate: '故事变化',
  knowledgePoints: '知识要点',
  satFate: '卫星结局',
  debrisDescription: '碎片结果',
  storyEnding: '故事结局',
  question: '生成问题',
  explanation: 'AI 解释',
}

export const AI_STORY_STAGES = {
  m1: { code: 'M1', label: '太空垃圾认知', fallback: '故事尚未建立，等待用户进入个性化任务。' },
  m3: { code: 'M3', label: '历史事件回溯', fallback: '历史事件正在补充卫星面临的风险背景。' },
  m2: { code: 'M2', label: '卫星身份与轨道', fallback: '用户正在建立卫星身份、材料和任务路线。' },
  m4: { code: 'M4', label: '轨道生存决策', fallback: '用户的每一次决策都会改变卫星余量与结局。' },
  law: { code: 'M5', label: '法律责任边界', fallback: '故事正在进入责任认定与治理边界。' },
  m6: { code: 'M6', label: '清理方案评估', fallback: '故事正在比较不同太空垃圾清理方式。' },
  m7: { code: 'M7', label: '知识总结', fallback: '用户正在整理观测与辨析结果。' },
  m8: { code: 'M8', label: '观测报告', fallback: '用户正在提交最终观测记录。' },
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const label = item.label || item.id || ''
          const detail = item.beat || item.text || item.description || ''
          return [label, detail].filter(Boolean).join('：')
        }
        return String(item ?? '')
      })
      .filter(Boolean)
      .join('；')
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${FIELD_LABELS[key] || key}：${formatValue(nestedValue)}`)
      .filter(Boolean)
      .join('；')
  }

  return String(value ?? '').trim()
}

export function formatAIOutput(result) {
  if (typeof result === 'string') return result.trim()
  if (!result || typeof result !== 'object') return ''

  return Object.entries(result)
    .map(([key, value]) => {
      const formatted = formatValue(value)
      return formatted ? `${FIELD_LABELS[key] || key}：${formatted}` : ''
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
  const stage = AI_STORY_STAGES[meta.stageId] || AI_STORY_STAGES.m1

  return {
    id: options.id || `ai-${meta.type}-${createdAt}`,
    type: meta.type,
    stageId: meta.stageId,
    stageCode: stage.code,
    stageLabel: stage.label,
    title: meta.title,
    choice: meta.choice || '由当前故事上下文自动生成',
    impact: meta.impact || inferImpact(result) || stage.fallback,
    content: formatAIOutput(result),
    createdAt,
  }
}

export function getStoryPhase(entries, currentModule = 'm1') {
  const latest = entries.at(-1)
  const stageId = currentModule || latest?.stageId || 'm1'
  const stage = AI_STORY_STAGES[stageId] || AI_STORY_STAGES.m1

  return {
    code: stage.code,
    label: stage.label,
    action: latest?.choice || '尚未产生影响故事走线的选择',
    impact: latest?.impact || stage.fallback,
  }
}

export function getTimelineTickScale(index, hoveredIndex) {
  if (hoveredIndex === null || hoveredIndex === undefined) {
    return 0.28
  }

  const distance = Math.abs(index - hoveredIndex)
  return [1, 0.76, 0.58, 0.43][distance] ?? 0.28
}
