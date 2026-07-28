import { contractBlock, STAGE_PROMPT_VERSION } from './shared.js'

export function buildOutlinePrompt(stageContract) {
  return `阶段 Prompt 版本：${STAGE_PROMPT_VERSION}
你现在只执行 STORY_OUTLINE。
提取用户重要事件的必要事实，选择一个现实可信的隐藏异常机制，生成 3 至 12 个连续节点和 3 至 5 种允许结局。
city 仅用于卫星匹配；除非 important_event 本身明确提到该城市，否则不得把 city 写入故事事实。
initial_story_state 的指标必须位于 0 到 100；隐藏原因只能放在 hidden_facts，不能放在 known_to_user。

stage_contract:
${contractBlock(stageContract)}`
}
