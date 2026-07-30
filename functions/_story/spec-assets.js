import { TASK_TYPE } from './constants.js'
import {
  KNOWLEDGE_REVEAL_PROMPT_TEMPLATE,
  KNOWLEDGE_REVEAL_SCHEMA_ENVELOPE,
  STORY_BACKEND_CONTRACTS,
  STORY_CONSEQUENCE_IDS,
  STORY_CONTEXT_EXAMPLES,
  STORY_CONTINUE_PROMPT_TEMPLATE,
  STORY_CONTINUE_SCHEMA_ENVELOPE,
  STORY_ENDING_PROMPT_TEMPLATE,
  STORY_ENDING_SCHEMA_ENVELOPE,
  STORY_OPENING_SCHEMA_ENVELOPE,
  STORY_OPENING_PROMPT_TEMPLATE,
  STORY_OPENING_SPEC_VERSION,
  STORY_OUTLINE_SCHEMA_ENVELOPE,
  STORY_OUTLINE_PROMPT_TEMPLATE,
  STORY_SPEC_VERSION,
  STORY_VALIDATION_RULES,
} from './spec-assets.generated.js'

const outlineSchemaEnvelope = STORY_OUTLINE_SCHEMA_ENVELOPE
const openingSchemaEnvelope = STORY_OPENING_SCHEMA_ENVELOPE
const continueSchemaEnvelope = STORY_CONTINUE_SCHEMA_ENVELOPE
const endingSchemaEnvelope = STORY_ENDING_SCHEMA_ENVELOPE
const knowledgeSchemaEnvelope = KNOWLEDGE_REVEAL_SCHEMA_ENVELOPE
const validationRules = STORY_VALIDATION_RULES

const SPEC_BY_TASK = Object.freeze({
  [TASK_TYPE.OUTLINE]: Object.freeze({
    variableName: 'story_user_input',
    promptTemplate: STORY_OUTLINE_PROMPT_TEMPLATE,
    schemaEnvelope: outlineSchemaEnvelope,
  }),
  [TASK_TYPE.OPENING]: Object.freeze({
    variableName: 'story_outline',
    promptTemplate: STORY_OPENING_PROMPT_TEMPLATE,
    schemaEnvelope: openingSchemaEnvelope,
  }),
  [TASK_TYPE.CONTINUE]: Object.freeze({
    variableName: 'continue_context',
    promptTemplate: STORY_CONTINUE_PROMPT_TEMPLATE,
    schemaEnvelope: continueSchemaEnvelope,
  }),
  [TASK_TYPE.BRANCH]: Object.freeze({
    variableName: 'continue_context',
    promptTemplate: STORY_CONTINUE_PROMPT_TEMPLATE,
    schemaEnvelope: continueSchemaEnvelope,
  }),
  [TASK_TYPE.ENDING]: Object.freeze({
    variableName: 'ending_context',
    promptTemplate: STORY_ENDING_PROMPT_TEMPLATE,
    schemaEnvelope: endingSchemaEnvelope,
  }),
  [TASK_TYPE.KNOWLEDGE_REVEAL]: Object.freeze({
    variableName: 'knowledge_context',
    promptTemplate: KNOWLEDGE_REVEAL_PROMPT_TEMPLATE,
    schemaEnvelope: knowledgeSchemaEnvelope,
  }),
})

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  )
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

export function getStorySpec(taskType) {
  return SPEC_BY_TASK[taskType] || null
}

export function buildStoryPrompt(taskType, input, retryReason = '') {
  const spec = getStorySpec(taskType)
  if (!spec) throw new Error(`Unsupported v0.4 task type: ${taskType}`)

  const placeholder = `{{${spec.variableName}}}`
  if (!spec.promptTemplate.includes(placeholder)) {
    throw new Error(`Prompt placeholder missing: ${placeholder}`)
  }

  const rendered = spec.promptTemplate.replace(placeholder, stableStringify(input))
  if (!retryReason) return rendered

  const conciseReason = String(retryReason).replace(/\s+/g, ' ').trim().slice(0, 320)
  return `${rendered}\n\n后端校验反馈：上一次输出未通过校验（${conciseReason}）。请只修正这些问题并重新输出完整 JSON。`
}

export {
  KNOWLEDGE_REVEAL_PROMPT_TEMPLATE,
  STORY_BACKEND_CONTRACTS,
  STORY_CONSEQUENCE_IDS,
  STORY_CONTEXT_EXAMPLES,
  STORY_CONTINUE_PROMPT_TEMPLATE,
  STORY_ENDING_PROMPT_TEMPLATE,
  STORY_OPENING_PROMPT_TEMPLATE,
  STORY_OPENING_SPEC_VERSION,
  STORY_OUTLINE_PROMPT_TEMPLATE,
  STORY_SPEC_VERSION,
  continueSchemaEnvelope,
  endingSchemaEnvelope,
  knowledgeSchemaEnvelope,
  outlineSchemaEnvelope,
  openingSchemaEnvelope,
  validationRules,
}
