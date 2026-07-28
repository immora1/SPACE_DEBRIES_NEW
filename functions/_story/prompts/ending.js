import { contractBlock, statePatchRules, STAGE_PROMPT_VERSION } from './shared.js'

export function buildEndingPrompt(stageContract) {
  return `阶段 Prompt 版本：${STAGE_PROMPT_VERSION}
你现在只执行 STORY_ENDING。
根据累计 story_state、六次轨道事件决策与三组清理配对，为用户最重要的事情生成因果一致的结局。
使用第二人称“你”，180 至 320 个中文字符。结局可以保留、延续、部分改变、错过或留下不可替代的缺口，但不得无视累计操作。
此阶段仍不得解释隐藏技术原因。choices 返回空数组，next_node_id 返回 null。
${statePatchRules()}

stage_contract:
${contractBlock(stageContract)}`
}
