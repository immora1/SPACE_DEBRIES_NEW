import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAIOutputEvent,
  formatAIOutput,
  getStoryPhase,
  getTimelineTickScale,
  publicStoryStageToEvent,
} from './aiTimeline.js'

test('formats every field in a structured AI response', () => {
  const output = formatAIOutput({
    feedback: '材料选择降低了再入残留。',
    knowledgePoints: ['预留燃料', '降低碰撞概率'],
  })

  assert.match(output, /AI 分析：材料选择降低了再入残留。/)
  assert.match(output, /知识要点：预留燃料；降低碰撞概率/)
})

test('creates a normalized event with stage and story influence', () => {
  const event = createAIOutputEvent({
    type: 'mission-story',
    stageId: 'm3',
    title: '任务路线生成',
    choice: '选择主动离轨任务',
  }, {
    story: '卫星开始为离轨预留燃料。',
  }, {
    id: 'event-1',
    createdAt: 12,
  })

  assert.equal(event.id, 'event-1')
  assert.equal(event.stageCode, 'M3')
  assert.equal(event.choice, '选择主动离轨任务')
  assert.equal(event.impact, '卫星开始为离轨预留燃料。')
  assert.match(event.content, /故事内容/)
})

test('current story phase follows the page while preserving the latest influence', () => {
  const phase = getStoryPhase([
    createAIOutputEvent({
      type: 'game-decision',
      stageId: 'm4',
      title: '轨道决策',
      choice: '执行规避机动',
      impact: '燃料减少，但碰撞风险下降。',
    }, { feedback: '正确决策。' }, { id: 'decision', createdAt: 20 }),
  ], 'm2')

  assert.equal(phase.code, 'M2')
  assert.equal(phase.action, '执行规避机动')
  assert.equal(phase.impact, '燃料减少，但碰撞风险下降。')
})

test('tick scale falls away from the hovered event without changing layout', () => {
  assert.equal(getTimelineTickScale(3, 3, 6), 1)
  assert.equal(getTimelineTickScale(2, 3, 6), 0.76)
  assert.equal(getTimelineTickScale(1, 3, 6), 0.58)
  assert.equal(getTimelineTickScale(0, 3, 6), 0.43)
  assert.equal(getTimelineTickScale(5, null, 6), 0.28)
})

test('Knowledge Reveal 分块字段无需旧 knowledge_text 也能完整展示', () => {
  const event = publicStoryStageToEvent({
    stage_id: 'knowledge-stage',
    task_type: 'KNOWLEDGE_REVEAL',
    input_action: {},
    stage_summary: '知识揭示完成。',
    created_at_ms: 30,
    display_content: {
      knowledge_title: '延迟更新如何影响现场判断',
      story_connection: '故事中的天气提示晚于天井里的雨点。',
      causal_chain: [
        { point_title: '轨道风险', point_text: '相关航天器可能调整工作状态。' },
        { point_title: '更新偏差', point_text: '局部数据更新可能短暂滞后。' },
        { point_title: '生活影响', point_text: '现场准备窗口因此变得不可靠。' },
      ],
      reality_note: '现实影响通常局部且短暂。',
      story_completed: true,
    },
  })

  assert.match(event.content, /延迟更新如何影响现场判断/)
  assert.match(event.content, /轨道风险：相关航天器可能调整工作状态/)
  assert.match(event.content, /现实影响通常局部且短暂/)
  assert.equal(event.content.includes('knowledge_text'), false)
})
