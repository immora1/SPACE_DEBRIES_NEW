import { StoryError } from '../constants.js'
import { ORBITAL_EVENTS } from './orbital-events.js'

export const ORBITAL_GAME_MODULE_ID = 'M4_ORBITAL_EVENTS'
export const ORBITAL_STORY_STAGE_COUNT = 6

export function orbitalAnswerControlId(questionId, answerId) {
  return `m4-orbital:${questionId}:${answerId}`
}

export const GAME_STORY_STAGE_BINDINGS = Object.freeze(
  ORBITAL_EVENTS.map((event, index) => Object.freeze({
    game_module_id: ORBITAL_GAME_MODULE_ID,
    question_id: event.id,
    question_order: index + 1,
    target_node_id: 'node_04',
    generation_stage: index === 0
      ? 'CONTINUE'
      : index === ORBITAL_STORY_STAGE_COUNT - 1
        ? 'ENDING'
        : 'STATE_ONLY',
    triggers_story_generation: index === 0,
    trigger_mode: 'ON_ANSWER_CONFIRM',
    legacy_option_fallback: false,
  })),
)

export const GAME_ANSWER_STORY_BINDINGS = Object.freeze(
  GAME_STORY_STAGE_BINDINGS.flatMap((stage) => {
    const event = ORBITAL_EVENTS[stage.question_order - 1]
    return event.options.map((answer) => Object.freeze({
      binding_id: `m4:${event.id}:${answer.id}:v1`,
      ...stage,
      answer_id: answer.id,
      answer_name: answer.label,
      control_id: orbitalAnswerControlId(event.id, answer.id),
      question_title: event.title,
      original_game_outcome: answer.outcome,
      technical_effect: Object.freeze({ ...answer.technical_effect }),
      effect_summary: answer.narrative_effect.consequence,
      state_delta: Object.freeze({ ...answer.narrative_effect.metrics_delta }),
      add_consequence_ids: Object.freeze([]),
      resolve_consequence_ids: Object.freeze([]),
      key_outcome: '',
      knowledge_profile: Object.freeze({
        keywords: Object.freeze([event.title, answer.label]),
        safe_facts: Object.freeze([answer.narrative_effect.consequence]),
        decision_tradeoffs: Object.freeze([]),
        debris_relevance: Object.freeze([]),
        operational_relevance: Object.freeze([]),
      }),
    }))
  }),
)

const STAGE_BY_QUESTION = new Map(
  GAME_STORY_STAGE_BINDINGS.map((binding) => [binding.question_id, binding]),
)
const ANSWER_BY_KEY = new Map(
  GAME_ANSWER_STORY_BINDINGS.map((binding) => [
    `${binding.question_id}:${binding.answer_id}`,
    binding,
  ]),
)

export function validateGameStoryBindings() {
  const stages = GAME_STORY_STAGE_BINDINGS
  if (
    stages.length !== ORBITAL_STORY_STAGE_COUNT
    || new Set(stages.map((item) => item.question_id)).size !== stages.length
    || stages.some((item, index) => item.question_order !== index + 1)
    || stages.some((item) => item.target_node_id !== 'node_04')
    || stages.at(-1)?.generation_stage !== 'ENDING'
    || stages[0]?.generation_stage !== 'CONTINUE'
    || !stages[0]?.triggers_story_generation
    || stages.slice(1).some((item) => item.triggers_story_generation)
    || stages.slice(1, -1).some((item) => item.generation_stage !== 'STATE_ONLY')
    || stages.some((item) => item.legacy_option_fallback)
  ) {
    throw new StoryError(
      'STORY_STAGE_MAPPING_INVALID',
      'The orbital-event story stage mapping is invalid.',
      500,
    )
  }
  for (const event of ORBITAL_EVENTS) {
    if (event.options.length !== 3) {
      throw new StoryError(
        'STORY_STAGE_MAPPING_INVALID',
        `Question ${event.id} must retain exactly its three configured answers.`,
        500,
      )
    }
    for (const option of event.options) {
      if (!ANSWER_BY_KEY.has(`${event.id}:${option.id}`)) {
        throw new StoryError(
          'STORY_STAGE_MAPPING_INVALID',
          `No story binding exists for ${event.id}/${option.id}.`,
          500,
        )
      }
    }
  }
  return true
}

validateGameStoryBindings()

export function resolveGameStoryStage(questionId) {
  const binding = STAGE_BY_QUESTION.get(questionId)
  return binding ? structuredClone(binding) : null
}

export function resolveQuestionForStoryNode(nodeId, questionOrder = 1) {
  const binding = nodeId === 'node_04'
    ? GAME_STORY_STAGE_BINDINGS[questionOrder - 1]
    : null
  return binding ? structuredClone(binding) : null
}

export function resolveGameAnswerStoryBinding(questionId, answerId) {
  const binding = ANSWER_BY_KEY.get(`${questionId}:${answerId}`)
  return binding ? structuredClone(binding) : null
}
