import { z } from 'zod'
import {
  ACTION_TYPE,
  INTERACTIVE_NODE_IDS,
  STORY_NODE_IDS,
  TASK_TYPE,
} from './constants.js'
import { STORY_ARTIFACT_SEQUENCE } from './config/lookahead-bindings.js'

const strictObject = (shape) => z.object(shape).strict()
const trimmedText = (max) => z.string().trim().min(1).max(max)
const stringList = z.array(trimmedText(500)).max(64)
const consequenceId = z.string().trim().min(1).max(128)

export const StoryArtifactTypeSchema = z.enum(STORY_ARTIFACT_SEQUENCE)

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

export const SiteInteractionRequestItemSchema = strictObject({
  section_id: z.string().trim().min(1).max(128),
  control_id: z.string().trim().min(1).max(160),
  option_id: z.string().trim().min(1).max(128),
})

export const SiteInteractionCommitRequestSchema = strictObject({
  session_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  action_type: z.literal(ACTION_TYPE.SITE_INTERACTION_COMMIT),
  node_id: z.enum(INTERACTIVE_NODE_IDS),
  module_id: z.string().trim().min(1).max(128),
  interactions: z.array(SiteInteractionRequestItemSchema).max(32),
  client_action_id: z.string().uuid(),
})

const OrbitalStoryNodeSchema = z.literal('node_04')

export const GameAnswerConfirmRequestSchema = strictObject({
  session_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  action_type: z.literal(ACTION_TYPE.GAME_ANSWER_CONFIRM),
  node_id: OrbitalStoryNodeSchema,
  game_module_id: z.literal('M4_ORBITAL_EVENTS'),
  question_id: z.string().trim().min(1).max(128),
  answer_id: z.string().trim().min(1).max(128),
  control_id: z.string().trim().min(1).max(160),
  client_action_id: z.string().uuid(),
})

export const M6MatchUpdateRequestSchema = strictObject({
  session_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  action_type: z.literal(ACTION_TYPE.M6_MATCH_UPDATE),
  node_id: z.literal('node_05'),
  module_id: z.literal('M6_CLEANUP_MATCHING'),
  cleanup_target_id: z.string().trim().min(1).max(128),
  cleanup_method_id: z.string().trim().min(1).max(128),
  client_action_id: z.string().uuid(),
})

export const M6MatchCompleteRequestSchema = strictObject({
  session_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  action_type: z.literal(ACTION_TYPE.M6_MATCH_COMPLETE),
  node_id: z.literal('node_05'),
  module_id: z.literal('M6_CLEANUP_MATCHING'),
  completion_id: z.string().uuid(),
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
  SiteInteractionCommitRequestSchema,
  GameAnswerConfirmRequestSchema,
  M6MatchUpdateRequestSchema,
  M6MatchCompleteRequestSchema,
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

export const OpeningContextSchema = strictObject({
  event_anchor: strictObject({
    characters: z.array(strictObject({
      label: trimmedText(160),
      relationship: trimmedText(500),
    })).min(1).max(16),
    time: z.string().trim().max(240),
    location: z.string().trim().max(240),
    core_emotion: trimmedText(800),
    facts_to_preserve: z.array(trimmedText(500)).min(1).max(32),
  }),
  core_event: trimmedText(2400),
  user_expectation: trimmedText(1200),
  irreplaceable_part: trimmedText(1200),
  primary_anomaly: trimmedText(128),
  current_node: strictObject({
    node_id: z.literal('node_01'),
    summary: trimmedText(2400),
    entry_condition: trimmedText(1200),
  }),
  known_to_user: stringList,
})

export const MaterialKnowledgeProfileSchema = strictObject({
  keywords: z.array(trimmedText(160)).max(16),
  safe_facts: z.array(trimmedText(800)).max(16),
  design_tradeoffs: z.array(trimmedText(800)).max(16),
  debris_relevance: z.array(trimmedText(800)).max(16),
})

export const MissionKnowledgeProfileSchema = strictObject({
  keywords: z.array(trimmedText(160)).max(16),
  safe_facts: z.array(trimmedText(800)).max(16),
  mission_relevance: z.array(trimmedText(800)).max(16),
  debris_relevance: z.array(trimmedText(800)).max(16),
  operational_tradeoffs: z.array(trimmedText(800)).max(16),
})

export const SiteKnowledgeProfileSchema = z.union([
  MaterialKnowledgeProfileSchema,
  MissionKnowledgeProfileSchema,
])

export const GameAnswerKnowledgeProfileSchema = strictObject({
  keywords: z.array(trimmedText(160)).max(16),
  safe_facts: z.array(trimmedText(800)).max(16),
  decision_tradeoffs: z.array(trimmedText(800)).max(16),
  debris_relevance: z.array(trimmedText(800)).max(16),
  operational_relevance: z.array(trimmedText(800)).max(16),
})

export const CleanupMechanismProfileSchema = strictObject({
  mechanism_summary: trimmedText(1200),
  suitable_target_traits: z.array(trimmedText(500)).min(1).max(16),
  unsuitable_target_traits: z.array(trimmedText(500)).max(16),
  operational_tradeoffs: z.array(trimmedText(800)).min(1).max(16),
  safety_constraints: z.array(trimmedText(800)).max(16),
  debris_relevance: z.array(trimmedText(800)).min(1).max(16),
  safe_facts: z.array(trimmedText(800)).min(1).max(16),
})

export const CleanupTargetProfileSchema = strictObject({
  target_type: trimmedText(500),
  size: z.string().trim().max(500),
  mass: z.string().trim().max(500),
  motion_state: z.string().trim().max(500),
  orbit_or_context: z.string().trim().max(800),
  structural_traits: z.array(trimmedText(500)).min(1).max(16),
  risk_traits: z.array(trimmedText(800)).min(1).max(16),
  safe_facts: z.array(trimmedText(800)).min(1).max(16),
})

export const CleanupExplanationProfileSchema = strictObject({
  why_suitable: z.array(trimmedText(800)).min(1).max(16),
  tradeoffs: z.array(trimmedText(800)).min(1).max(16),
  why_other_methods_may_be_limited: z.array(trimmedText(800)).max(16),
})

export const CleanupKnowledgeMatchSchema = strictObject({
  cleanup_target_id: trimmedText(128),
  cleanup_target_name: trimmedText(500),
  cleanup_method_id: trimmedText(128),
  cleanup_method_name: trimmedText(500),
  is_allowed_match: z.boolean(),
  is_preferred_match: z.boolean(),
  target_profile: CleanupTargetProfileSchema,
  mechanism_profile: CleanupMechanismProfileSchema,
  explanation_profile: CleanupExplanationProfileSchema,
})

export const TaskProfileSchema = strictObject({
  objective_summary: trimmedText(800),
  task_description: trimmedText(1200).optional(),
  orbit_or_range: trimmedText(500).optional(),
  related_satellite: trimmedText(500).optional(),
  related_payload: trimmedText(500).optional(),
})

export const SelectedSiteOptionSnapshotSchema = strictObject({
  binding_id: z.string().trim().min(1).max(160),
  module_id: z.string().trim().min(1).max(128),
  section_id: z.string().trim().min(1).max(128),
  section_name: trimmedText(160),
  control_id: z.string().trim().min(1).max(160),
  option_id: z.string().trim().min(1).max(128),
  option_name: trimmedText(160),
  task_id: z.string().trim().min(1).max(128).optional(),
  task_name: trimmedText(160).optional(),
  target_node_id: z.enum(INTERACTIVE_NODE_IDS),
  effect_summary: trimmedText(800),
  state_delta: StoryStateDeltaSchema,
  add_consequence_ids: z.array(consequenceId).max(16),
  resolve_consequence_ids: z.array(consequenceId).max(16),
  key_outcome: z.string().trim().max(500),
  knowledge_profile: z.union([
    SiteKnowledgeProfileSchema,
    GameAnswerKnowledgeProfileSchema,
  ]).optional(),
  task_profile: TaskProfileSchema.optional(),
  selected_at: z.string().datetime(),
})

export const SiteInteractionOutcomeSchema = strictObject({
  module_id: z.string().trim().min(1).max(128),
  section_id: z.string().trim().min(1).max(128),
  control_id: z.string().trim().min(1).max(160),
  option_id: z.string().trim().min(1).max(128),
  option_name: trimmedText(160),
  outcome: trimmedText(500),
})

const LegacyLastStoryActionSchema = strictObject({
  node_id: z.enum(INTERACTIVE_NODE_IDS),
  option_id: z.string().trim().min(1).max(128),
  client_action_id: z.string().uuid(),
})

const SiteLastStoryActionSchema = strictObject({
  node_id: z.enum(INTERACTIVE_NODE_IDS),
  module_id: z.string().trim().min(1).max(128),
  interaction_mode: z.enum([
    'SITE_SINGLE',
    'SITE_GROUP_SINGLE',
    'SITE_COMPOSITE',
    'SITE_GAME_RESULT',
  ]),
  client_action_id: z.string().uuid(),
})

const GameLastStoryActionSchema = strictObject({
  node_id: OrbitalStoryNodeSchema,
  module_id: z.literal('M4_ORBITAL_EVENTS'),
  question_id: z.string().trim().min(1).max(128),
  answer_id: z.string().trim().min(1).max(128),
  client_action_id: z.string().uuid(),
})

export const LastStoryActionSchema = z.union([
  LegacyLastStoryActionSchema,
  SiteLastStoryActionSchema,
  GameLastStoryActionSchema,
])

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

export const LegacyOptionContinueContextSchema = strictObject({
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

export const SiteInteractionContinueContextSchema = strictObject({
  current_node: CurrentContinueNodeSchema,
  site_interactions: z.array(strictObject({
    section_id: z.string().trim().min(1).max(128),
    option_id: z.string().trim().min(1).max(128),
    effect_summary: trimmedText(800),
  })).min(1).max(32),
  state_transition: strictObject({
    before: StoryMetricsSchema,
    combined_delta: StoryStateDeltaSchema,
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

export const ContinueContextSchema = z.union([
  LegacyOptionContinueContextSchema,
  SiteInteractionContinueContextSchema,
  strictObject({
    current_node: strictObject({
      node_id: z.enum(['node_02', 'node_03', 'node_04']),
      task_type: z.literal(TASK_TYPE.CONTINUE),
      summary: trimmedText(2400),
      entry_condition: trimmedText(1200),
    }),
    generation_source: strictObject({
      interaction_node_id: z.enum(['node_02', 'node_03', 'node_04']),
      interaction_type: trimmedText(128),
      effect_summary: z.string().trim().max(2400),
      interaction_snapshot: z.record(z.string(), z.unknown()),
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
  }),
])

export const StoryArtifactGenerationSnapshotSchema = strictObject({
  generated_from_node_id: z.enum(STORY_NODE_IDS),
  source_action_id: trimmedText(240),
  interaction_version: z.number().int().nonnegative(),
  state_before: RuntimeStoryStateSchema,
  state_delta: StoryStateDeltaSchema,
  state_after: RuntimeStoryStateSchema,
  active_consequences_after: z.array(consequenceId).max(32),
  key_outcomes_available: z.array(z.unknown()).max(128),
  interaction_snapshot: z.record(z.string(), z.unknown()),
  selected_ending: strictObject({
    ending_id: trimmedText(128),
    outcome: trimmedText(2400),
  }).optional(),
})

export const EndingContextSchema = strictObject({
  current_node: strictObject({
    node_id: z.literal('node_05'),
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
  key_outcomes: z.array(z.union([
    trimmedText(500),
    SiteInteractionOutcomeSchema,
  ])).max(96),
  known_to_user: stringList,
  selected_game_answers: z.array(strictObject({
    question_id: z.string().trim().min(1).max(128),
    question_order: z.number().int().min(1).max(6),
    answer_id: z.string().trim().min(1).max(128),
    answer_name: trimmedText(160),
    effect_summary: trimmedText(800),
  })).length(6),
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
  selected_site_options: z.array(strictObject({
    module_id: z.string().trim().min(1).max(128),
    section_id: z.string().trim().min(1).max(128),
    section_name: trimmedText(160),
    option_id: z.string().trim().min(1).max(128),
    option_name: trimmedText(160),
    knowledge_profile: SiteKnowledgeProfileSchema,
  })).max(32),
  selected_game_answers: z.array(strictObject({
    question_id: z.string().trim().min(1).max(128),
    question_order: z.number().int().min(1).max(6),
    answer_id: z.string().trim().min(1).max(128),
    answer_name: trimmedText(160),
    knowledge_profile: GameAnswerKnowledgeProfileSchema,
  })).max(6),
  cleanup_game_result: strictObject({
    module_id: z.literal('M6_CLEANUP_MATCHING'),
    completed: z.literal(true),
    total_targets: z.number().int().min(1).max(32),
    allowed_matches: z.number().int().min(0).max(32),
    preferred_matches: z.number().int().min(0).max(32),
    matches: z.array(CleanupKnowledgeMatchSchema).min(1).max(32),
  }).optional(),
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
      cleanup_target_id: z.string(),
      cleanup_method_id: z.string(),
      is_allowed_match: z.boolean(),
      is_preferred_match: z.boolean(),
      attempt_count: z.number().int().positive(),
      changed_count: z.number().int().nonnegative(),
    })).max(3),
    target_set: z.array(strictObject({
      cleanup_target_id: z.string(),
      cleanup_target_name: z.string(),
      ui_target_id: z.string(),
      code: z.string(),
      source: z.string(),
      target_profile: CleanupTargetProfileSchema,
      preferred_method_id: z.string(),
    })).max(3),
    completed: z.boolean(),
    completion_id: z.string().uuid().nullable(),
    completed_at: z.string().datetime().nullable(),
    frozen_snapshot_ids: z.array(z.string().uuid()).max(3),
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
