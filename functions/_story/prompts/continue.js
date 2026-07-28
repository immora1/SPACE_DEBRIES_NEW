import { contractBlock, statePatchRules, STAGE_PROMPT_VERSION } from './shared.js'

export function buildContinuePrompt(stageContract) {
  return `阶段 Prompt 版本：${STAGE_PROMPT_VERSION}
你现在只执行 STORY_CONTINUE。
根据 story_state、最近操作与固定后果推进一个阶段，不得重复上一阶段，也不得提前结束核心事件。
材料与清理阶段可写成简短的叙事反馈；M4 决策必须让用户选择的收益和代价在生活线索中产生可辨别变化。
使用第二人称“你”，80 至 180 个中文字符。
checkpoint 必须使用 stage_contract.next_checkpoint。
${statePatchRules()}

stage_contract:
${contractBlock(stageContract)}`
}
