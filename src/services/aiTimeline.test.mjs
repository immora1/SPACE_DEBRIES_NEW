import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAIOutputEvent,
  formatAIOutput,
  getStoryPhase,
  getTimelineTickScale,
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
