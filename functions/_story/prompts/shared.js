export const STAGE_PROMPT_VERSION = 'baseline-v0.2'

export function contractBlock(contract) {
  return JSON.stringify(contract, null, 2)
}

export function statePatchRules() {
  return [
    'story_state_patch 只能追加或小幅调整叙事状态，不得改写 confirmed_facts。',
    '不得返回或修改 game_state、technical_metrics、燃料、装甲或任务进度。',
    '固定交互后果已经由后端计算；叙事必须忠实体现 stage_contract.fixed_effect。',
    '除 KNOWLEDGE_REVEAL 外，story_text 不得直接说出隐藏的轨道技术原因。',
    '所有字段必须存在；没有选项时 choices 返回空数组。',
  ].join('\n')
}
