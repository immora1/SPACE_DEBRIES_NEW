import { contractBlock, statePatchRules, STAGE_PROMPT_VERSION } from './shared.js'

export function buildOpeningPrompt(stageContract) {
  return `阶段 Prompt 版本：${STAGE_PROMPT_VERSION}
你现在只执行 STORY_OPENING。
根据用户重要事件、材料组合、任务类型和既有 story_outline 写故事开场。
使用第二人称“你”，120 至 220 个中文字符。只呈现生活中的细微异常，不揭示轨道原因，不提前给出结局。
checkpoint 必须使用 stage_contract.next_checkpoint，node_id 与 next_node_id 必须来自 story_outline。
${statePatchRules()}

stage_contract:
${contractBlock(stageContract)}`
}
