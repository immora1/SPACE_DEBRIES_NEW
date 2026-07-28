import { TASK_TYPE, StoryError } from '../constants.js'
import { buildOutlinePrompt } from './outline.js'
import { buildOpeningPrompt } from './opening.js'
import { buildContinuePrompt } from './continue.js'
import { buildEndingPrompt } from './ending.js'
import { buildKnowledgeRevealPrompt } from './knowledge-reveal.js'

const BUILDERS = {
  [TASK_TYPE.OUTLINE]: buildOutlinePrompt,
  [TASK_TYPE.OPENING]: buildOpeningPrompt,
  [TASK_TYPE.CONTINUE]: buildContinuePrompt,
  [TASK_TYPE.BRANCH]: buildContinuePrompt,
  [TASK_TYPE.ENDING]: buildEndingPrompt,
  [TASK_TYPE.KNOWLEDGE_REVEAL]: buildKnowledgeRevealPrompt,
}

export function buildStagePrompt(taskType, stageContract) {
  const builder = BUILDERS[taskType]
  if (!builder) throw new StoryError('UNKNOWN_TASK_TYPE', `Unsupported task type: ${taskType}`, 500)
  return builder(stageContract)
}
