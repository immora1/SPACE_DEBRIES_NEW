import { VALID_OUTLINE_FIXTURE, VALID_OPENING_FIXTURE } from './spec-assets.generated.js'

const legacy = VALID_OUTLINE_FIXTURE
export const CURRENT_OUTLINE_FIXTURE = {
  task_type: 'STORY_OUTLINE',
  event_anchor: {
    characters: legacy.event_anchor.characters.map(character => character.label),
    relationship: '你与外婆',
    time: legacy.event_anchor.time,
    location: legacy.event_anchor.location,
    core_event: legacy.event_anchor.core_event,
    user_expectation: legacy.event_anchor.user_expectation,
    core_emotion: legacy.event_anchor.core_emotion,
    irreplaceable_part: legacy.event_anchor.irreplaceable_part,
    key_facts: legacy.event_anchor.facts_to_preserve,
  },
  satellite_anchor: { name: 'TEST-SAT', function: '气象观测', relevant_capability: '云层观测数据更新' },
  primary_anomaly: 'WEATHER_UPDATE_DELAY',
  causal_chain: {
    A_satellite_event: '卫星短暂停止观测，等待工作姿态恢复。',
    B_hidden_mechanism: '观测中断使新数据暂时无法送达地面天气服务，终端继续显示上一批观测结果。',
    C_human_effect: '提示仍显示晴天，院子里已经下起雨。',
    event_connection: '晚到的天气提示压缩了灯片晾干与共同点灯的准备时间。',
  },
  story_nodes: [
    { node_id: 'node_01', task_type: 'STORY_OPENING', summary: '你和外婆开始修补灯片，卫星暂停观测。' },
    { node_id: 'node_02', task_type: 'STORY_CONTINUE', summary: '院子落雨，提示尚未更新，你移动灯架。' },
    { node_id: 'node_03', task_type: 'STORY_CONTINUE', summary: '共同点灯的准备时间缩短，留下等待处理的灯片接口。' },
    { node_id: 'node_04', task_type: 'STORY_ENDING', summary: '依据累计结果收束修补和共同点灯。' },
    { node_id: 'node_05', task_type: 'KNOWLEDGE_REVEAL', summary: '解释观测间断如何可能影响天气更新。' },
  ],
  ending_candidates: legacy.reachable_endings.map((ending, index) => ({
    ending_id: ending.ending_id, ending_type: ['complete', 'preserved', 'loss', 'uncertain', 'partial'][index],
    outcome: ending.outcome,
  })),
  initial_story_state: {
    event_integrity: 100, relationship_connection: 50, uncertainty: 10,
    current_node_id: 'node_01', active_consequences: [], last_user_action: null,
    known_to_user: legacy.initial_story_state.known_to_user,
    hidden_facts: ['观测中断使新数据暂时无法送达地面天气服务，终端继续显示上一批观测结果。'],
  },
}
export const CURRENT_OPENING_FIXTURE = {
  ...VALID_OPENING_FIXTURE,
  task_type: 'STORY_OPENING', node_id: 'node_01', next_node_id: 'node_02',
}
