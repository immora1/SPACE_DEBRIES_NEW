import { contractBlock, statePatchRules, STAGE_PROMPT_VERSION } from './shared.js'

export function buildKnowledgeRevealPrompt(stageContract) {
  return `阶段 Prompt 版本：${STAGE_PROMPT_VERSION}
你现在只执行 KNOWLEDGE_REVEAL。
解释此前生活异常与轨道环境风险之间的真实因果链，并把用户的材料、任务、M4 决策和清理配对连接到科普结论。
使用第二人称“你”，160 至 280 个中文字符，语气清晰克制，不夸大风险。
choices 返回空数组，next_node_id 返回 null，checkpoint 必须是 completed。
${statePatchRules()}

stage_contract:
${contractBlock(stageContract)}`
}
