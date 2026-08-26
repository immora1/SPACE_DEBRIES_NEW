import { z } from 'zod'
import {
  ACTION_TYPE,
  INTERACTIVE_NODE_IDS,
  STORY_NODE_IDS,
  TASK_TYPE,
} from './constants.js'

const strictObject = (shape) => z.object(shape).strict()
const trimmedText = (max) => z.string().trim().min(1).max(max)
const stringList = z.array(trimmedText(500)).max(64)
const consequenceId = z.string().trim().min(1).max(128)

export const ImportantEventInputSchema = strictObject({
  people: z.array(trimmedText(120)).min(1).max(16),
  time: z.string().trim().max(240),
  location: z.string().trim().max(240),
  description: trimmedText(2400),
})

export const CanonicalStoryUserInputSchema = strictObject({
  important_event: ImportantEventInputSchema,
})

export const StoryUserInputSchema = strictObject({
  nickname: trimmedText(80),
  city: trimmedText(120),
  important_event: trimmedText(1800),
  submitted_at_ms: z.number().int().nonnegative(),
})

export const CreateStoryRequestSchema = strictObject({
  session_id: z.string().uuid().optional(),
  nickname: trimmedText(80),
  city: trimmedText(120),
  important_event: trimmedText(1800),
  satellite: z.record(z.string(), z.unknown()),
  game_context: strictObject({
    damage_level: z.number().min(0).max(100),
    history_event_ids: z.array(z.string().max(128)).max(64),
  }),
  language: z.enum(['zh', 'en']),
})

export const StoryOptionActionRequestSchema = strictObject({
  session_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  action_type: z.literal(ACTION_TYPE.STORY_OPTION_SELECT),
  node_id: z.enum(INTERACTIVE_NODE_IDS),
  option_id: z.string().trim().min(1).max(128),
  client_action_id: z.string().uuid(),
})

export const ProductActionRequestSchema = strictObject({
  session_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  action_type: z.enum([
    ACTION_TYPE.MATERIALS_COMMIT,
    ACTION_TYPE.MISSION_SELECT,
    ACTION_TYPE.ORBITAL_EVENT_RESOLVE,
    ACTION_TYPE.CLEANUP_PAIR_SUBMIT,
  ]),
  source_id: z.string().min(1).max(128),
  action_id: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()),
})

export const StoryActionRequestSchema = z.union([
  StoryOptionActionRequestSchema,
  ProductActionRequestSchema,
])

export const StoryMetricsSchema = strictObject({
  event_integrity: z.number().int().min(0).max(100),
  relationship_connection: z.number().int().min(0).max(100),
  uncertainty: z.number().int().min(0).max(100),
})

export const StoryStateDeltaSchema = strictObject({
  event_integrity: z.number().int().min(-100).max(100),
  relationship_connection: z.number().int().min(-100).max(100),
  uncertainty: z.number().int().min(-100).max(100),
})

export const StoryOptionSchema = strictObject({
  option_id: z.string().trim().min(1).max(128),
  label: trimmedText(160),
  effect_summary: trimmedText(800),
  state_delta: StoryStateDeltaSchema,
  add_consequence_ids: z.array(consequenceId).max(16),
  resolve_consequence_ids: z.array(consequenceId).max(16),
  key_outcome: z.string().trim().max(500),
})

export const ConsequenceSchema = strictObject({
  consequence_id: consequenceId,
  description: trimmedText(500),
})

export const StoryHandoffSchema = strictObject({
  current_situation: trimmedText(1000),
  unresolved_threads: z.array(trimmedText(500)).min(1).max(3),
})

export const LastStoryActionSchema = strictObject({
  node_id: z.enum(INTERACTIVE_NODE_IDS),
  option_id: z.string().trim().min(1).max(128),
  client_action_id: z.string().uuid(),
})

export const RuntimeStoryStateSchema = strictObject({
  confirmed_facts: stringList,
  known_to_user: stringList,
  hidden_facts: stringList,
  event_integrity: StoryMetricsSchema.shape.event_integrity,
  relationship_connection: StoryMetricsSchema.shape.relationship_connection,
  uncertainty: StoryMetricsSchema.shape.uncertainty,
  current_node_id: z.enum(STORY_NODE_IDS).nullable(),
  active_consequences: z.array(consequenceId).max(32),
  key_outcomes: stringList,
  last_user_action: LastStoryActionSchema.nullable(),
})

const CurrentContinueNodeSchema = strictObject({
  node_id: z.enum(INTERACTIVE_NODE_IDS),
  task_type: z.enum([TASK_TYPE.CONTINUE, TASK_TYPE.BRANCH]),
  summary: trimmedText(2400),
  entry_condition: trimmedText(1200),
})

export const ContinueContextSchema = strictObject({
  current_node: CurrentContinueNodeSchema,
  selected_option_effect: strictObject({
    option_id: z.string().trim().min(1).max(128),
    effect_summary: trimmedText(800),
  }),
  state_transition: strictObject({
    before: StoryMetricsSchema,
    delta: StoryStateDeltaSchema,
    after: StoryMetricsSchema,
    active_consequences: z.array(ConsequenceSchema).max(32),
  }),
  previous_handoff: StoryHandoffSchema,
  story_context: strictObject({
    core_event: trimmedText(2400),
    irreplaceable_part: trimmedText(1200),
    primary_anomaly: trimmedText(128),
  }),
  known_to_user: stringList,
})

export const EndingContextSchema = strictObject({
  current_node: strictObject({
    node_id: z.literal('node_09'),
    task_type: z.literal(TASK_TYPE.ENDING),
    summary: trimmedText(2400),
    entry_condition: trimmedText(1200),
  }),
  selected_ending: strictObject({
    ending_id: trimmedText(128),
    outcome: trimmedText(2400),
  }),
  previous_handoff: StoryHandoffSchema,
  story_context: strictObject({
    core_event: trimmedText(2400),
    user_expectation: trimmedText(1200),
    irreplaceable_part: trimmedText(1200),
    primary_anomaly: trimmedText(128),
  }),
  story_state: StoryMetricsSchema,
  active_consequences: z.array(ConsequenceSchema).max(32),
  key_outcomes: stringList,
  known_to_user: stringList,
})

export const KnowledgeContextSchema = strictObject({
  current_node: strictObject({
    node_id: z.literal('node_10'),
    task_type: z.literal(TASK_TYPE.KNOWLEDGE_REVEAL),
    summary: trimmedText(2400),
  }),
  primary_anomaly: trimmedText(128),
  hidden_facts: stringList,
  ending_summary: trimmedText(2400),
  next_node_context: trimmedText(2400),
  story_anomaly_effects: z.array(trimmedText(800)).min(1).max(4),
})

export const TechnicalMetricsSchema = strictObject({
  armor: z.number().min(0).max(100),
  fuel: z.number().min(0).max(100),
  mission_progress: z.number().min(0).max(100),
  reentry_risk: z.enum(['low', 'medium', 'high', 'mixed']),
})

const OrbitProfileSchema = strictObject({
  profile_id: z.string(),
  orbit_family: z.enum(['LEO', 'MEO', 'GEO']),
  label: z.string(),
  label_en: z.string(),
  altitude_km: z.number().nonnegative(),
  altitude_label: z.string(),
  altitude_label_en: z.string(),
  inclination_deg: z.number().min(0).max(180),
  environment: z.string(),
  environment_en: z.string(),
  event_weight_bias: z.record(z.string(), z.number()),
})

export const GameStateSchema = strictObject({
  satellite_build: strictObject({
    satellite: z.record(z.string(), z.unknown()),
    materials: z.record(z.string(), z.string()),
    material_profiles: z.record(
      z.string(),
      z.enum(['low', 'medium', 'high']),
    ).default({}),
  }),
  mission: strictObject({
    mission_id: z.string().nullable(),
    action_id: z.string().nullable(),
    label: z.string().nullable().default(null),
    label_en: z.string().nullable().default(null),
    anomaly_type: z.string().nullable().default(null),
    mission_effect: z.string().nullable().default(null),
    mission_effect_en: z.string().nullable().default(null),
    orbit_profile: OrbitProfileSchema.nullable().default(null),
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
