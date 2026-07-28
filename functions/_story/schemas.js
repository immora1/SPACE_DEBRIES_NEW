import { z } from 'zod'
import { ACTION_TYPE, TASK_TYPE } from './constants.js'

const strictObject = (shape) => z.object(shape).strict()
const text = z.string().min(1).max(1200)
const shortText = z.string().min(1).max(240)
const stringList = z.array(z.string().min(1).max(240)).max(32)

export const StoryMetricsSchema = strictObject({
  event_integrity: z.number().min(0).max(100),
  relationship_connection: z.number().min(0).max(100),
  uncertainty: z.number().min(0).max(100),
})

export const UserActionSchema = strictObject({
  module: z.string().min(1).max(64),
  source_id: z.string().min(1).max(128),
  action_id: z.string().min(1).max(128),
  label: z.string().min(1).max(240),
})

export const StoryStateSchema = strictObject({
  current_node_id: z.string().min(1).max(128).nullable(),
  metrics: StoryMetricsSchema,
  confirmed_facts: stringList,
  known_to_user: stringList,
  hidden_facts: stringList,
  open_threads: stringList,
  active_consequences: stringList,
  story_tags: stringList,
  last_user_action: UserActionSchema.nullable(),
})

export const StoryStatePatchSchema = strictObject({
  metrics_delta: strictObject({
    event_integrity: z.number().min(-100).max(100),
    relationship_connection: z.number().min(-100).max(100),
    uncertainty: z.number().min(-100).max(100),
  }),
  add_confirmed_facts: stringList,
  add_known_to_user: stringList,
  add_hidden_facts: stringList,
  resolve_open_threads: stringList,
  add_open_threads: stringList,
  add_active_consequences: stringList,
  add_story_tags: stringList,
})

const ExtractedEventSchema = strictObject({
  people: stringList,
  relationships: stringList,
  time: z.string().max(240),
  place: z.string().max(240),
  core_event: shortText,
  user_expectation: shortText,
  core_emotion: shortText,
  irreplaceable_part: shortText,
})

const NarrativeRulesSchema = strictObject({
  hidden_cause: z.enum([
    'POSITIONING_OFFSET',
    'MESSAGE_DELAY',
    'COMMUNICATION_INTERRUPTION',
    'TIME_SYNC_ERROR',
    'WEATHER_DATA_DELAY',
    'TRAVEL_INFORMATION_ERROR',
  ]),
  secondary_phenomenon: z.string().max(240),
  perspective: z.literal('SECOND_PERSON'),
  tone: z.literal('RESTRAINED_REALISTIC'),
})

const StoryNodeSchema = strictObject({
  id: z.string().min(1).max(128),
  label: shortText,
  beat: text,
})

const AllowedEndingSchema = strictObject({
  id: z.string().min(1).max(128),
  label: shortText,
  condition_hint: shortText,
})

export const StoryOutlineSchema = strictObject({
  extracted_event: ExtractedEventSchema,
  narrative_rules: NarrativeRulesSchema,
  nodes: z.array(StoryNodeSchema).min(3).max(12),
  allowed_endings: z.array(AllowedEndingSchema).min(3).max(5),
})

export const StoryOutlineAIOutputSchema = strictObject({
  story_outline: StoryOutlineSchema,
  initial_story_state: StoryStateSchema,
})

const StoryChoiceSchema = strictObject({
  id: z.string().min(1).max(128),
  label: shortText,
  benefit: shortText,
  cost: shortText,
})

export const DisplayContentSchema = strictObject({
  story_text: text,
  choices: z.array(StoryChoiceSchema).max(4),
})

function stageOutputSchema(taskType) {
  return strictObject({
    node_id: z.string().min(1).max(128),
    task_type: z.literal(taskType),
    checkpoint: z.string().min(1).max(128),
    display_content: DisplayContentSchema,
    story_state_patch: StoryStatePatchSchema,
    stage_summary: shortText,
    node_completed: z.boolean(),
    next_node_id: z.string().min(1).max(128).nullable(),
  })
}

export const StoryOpeningAIOutputSchema = stageOutputSchema(TASK_TYPE.OPENING)
export const StoryContinueAIOutputSchema = stageOutputSchema(TASK_TYPE.CONTINUE)
export const StoryBranchAIOutputSchema = stageOutputSchema(TASK_TYPE.BRANCH)
export const StoryEndingAIOutputSchema = stageOutputSchema(TASK_TYPE.ENDING)
export const KnowledgeRevealAIOutputSchema = stageOutputSchema(TASK_TYPE.KNOWLEDGE_REVEAL)

export const AI_OUTPUT_SCHEMA_BY_TASK = Object.freeze({
  [TASK_TYPE.OUTLINE]: StoryOutlineAIOutputSchema,
  [TASK_TYPE.OPENING]: StoryOpeningAIOutputSchema,
  [TASK_TYPE.CONTINUE]: StoryContinueAIOutputSchema,
  [TASK_TYPE.BRANCH]: StoryBranchAIOutputSchema,
  [TASK_TYPE.ENDING]: StoryEndingAIOutputSchema,
  [TASK_TYPE.KNOWLEDGE_REVEAL]: KnowledgeRevealAIOutputSchema,
})

export const StoryUserInputSchema = strictObject({
  nickname: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(120),
  important_event: z.string().trim().min(1).max(1800),
  submitted_at_ms: z.number().int().nonnegative(),
})

export const CreateStoryRequestSchema = strictObject({
  session_id: z.string().uuid().optional(),
  nickname: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(120),
  important_event: z.string().trim().min(1).max(1800),
  satellite: z.record(z.string(), z.unknown()),
  game_context: strictObject({
    damage_level: z.number().min(0).max(100),
    history_event_ids: z.array(z.string().max(128)).max(64),
  }),
  language: z.enum(['zh', 'en']),
})

export const StoryActionRequestSchema = strictObject({
  session_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  action_type: z.enum(Object.values(ACTION_TYPE)),
  source_id: z.string().min(1).max(128),
  action_id: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()),
})

export const TechnicalMetricsSchema = strictObject({
  armor: z.number().min(0).max(100),
  fuel: z.number().min(0).max(100),
  mission_progress: z.number().min(0).max(100),
  reentry_risk: z.enum(['low', 'medium', 'high', 'mixed']),
})

export const GameStateSchema = strictObject({
  satellite_build: strictObject({
    satellite: z.record(z.string(), z.unknown()),
    materials: z.record(z.string(), z.string()),
  }),
  mission: strictObject({
    mission_id: z.string().nullable(),
    action_id: z.string().nullable(),
  }),
  orbital_events: strictObject({
    resolved: z.array(strictObject({
      event_id: z.string(),
      action_id: z.string(),
      outcome: z.enum(['correct', 'partial', 'wrong']),
    })).max(6),
  }),
  cleanup_test: strictObject({
    matches: z.array(strictObject({
      target_id: z.string(),
      method_id: z.string(),
    })).max(3),
  }),
  technical_metrics: TechnicalMetricsSchema,
})

export function parseWithSchema(schema, value, code = 'INVALID_INPUT') {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  const error = new Error(code)
  error.code = code
  error.issues = parsed.error.issues
  throw error
}
