import specs from './current-spec.generated.js'
import { STORY_SPEC_VERSION } from './constants.js'

// Legacy validation/fixture consumers are separate from the active model registry.
export {
  STORY_BACKEND_CONTRACTS, STORY_CONSEQUENCE_IDS, STORY_CONTEXT_EXAMPLES,
  STORY_VALIDATION_RULES as validationRules,
} from './spec-assets.generated.js'
export { STORY_SPEC_VERSION }
export const STORY_OPENING_SPEC_VERSION = STORY_SPEC_VERSION
export const STORY_OUTLINE_PROMPT_TEMPLATE = specs.STORY_OUTLINE.promptTemplate
export const STORY_OPENING_PROMPT_TEMPLATE = specs.STORY_OPENING.promptTemplate
export const STORY_CONTINUE_PROMPT_TEMPLATE = specs.STORY_CONTINUE.promptTemplate
export const STORY_ENDING_PROMPT_TEMPLATE = specs.STORY_ENDING.promptTemplate
export const KNOWLEDGE_REVEAL_PROMPT_TEMPLATE = specs.KNOWLEDGE_REVEAL.promptTemplate
export const outlineSchemaEnvelope = specs.STORY_OUTLINE.schemaEnvelope
export const openingSchemaEnvelope = specs.STORY_OPENING.schemaEnvelope
export const continueSchemaEnvelope = specs.STORY_CONTINUE.schemaEnvelope
export const endingSchemaEnvelope = specs.STORY_ENDING.schemaEnvelope
export const knowledgeSchemaEnvelope = specs.KNOWLEDGE_REVEAL.schemaEnvelope

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

export function getStorySpec(taskType) {
  return specs[taskType] || null
}

export function buildStoryPrompt(taskType, input, retryReason = '') {
  const spec = getStorySpec(taskType)
  if (!spec) throw new Error(`Unsupported story task: ${taskType}`)
  const variableName = { STORY_OPENING: 'opening_context', STORY_CONTINUE: 'continue_context',
    STORY_ENDING: 'ending_context', KNOWLEDGE_REVEAL: 'knowledge_context' }[taskType]
  const variables = taskType === 'STORY_OUTLINE'
    ? { story_user_input: input.story_user_input, matched_satellite: input.matched_satellite }
    : { [variableName]: input }
  // One pass prevents placeholder-like user text from becoming another substitution.
  const rendered = spec.promptTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (variables[key] === undefined) throw new Error(`Missing prompt input: ${key}`)
    return stableStringify(variables[key])
  })
  if (!retryReason) return rendered
  const reason = String(retryReason).replace(/\s+/g, ' ').trim().slice(0, 320)
  return `${rendered}\n\n后端校验反馈：上一次输出未通过校验（${reason}）。请只修正这些问题并重新输出完整 JSON。`
}
