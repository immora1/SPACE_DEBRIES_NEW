import { StoryError, TASK_TYPE } from './constants.js'
import {
  ContinueContextSchema,
  EndingContextSchema,
  KnowledgeContextSchema,
  OpeningContextSchema,
  StoryHandoffSchema,
} from './schemas.js'
import {
  describeConsequences,
  resolveOptionsForNode,
} from './config/story-options.js'
import {
  applyStateDelta,
  storyMetrics,
} from './state-reducer.js'
import {
  storyStageNumber,
  STORY_ARTIFACT_TYPE,
} from './config/lookahead-bindings.js'
import {
  relevantHiddenFacts,
  storyAnomalyEffects,
} from './anomaly-facts.js'

function clone(value) {
  return structuredClone(value)
}

function parseContext(schema, value, code) {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  throw new StoryError(
    code,
    'Story model context failed runtime validation.',
    500,
    parsed.error.issues,
  )
}

export function findOutlineNode(outline, nodeId) {
  const node = outline?.story_nodes?.find((item) => item.node_id === nodeId)
  if (!node) {
    throw new StoryError(
      'OUTLINE_NODE_NOT_FOUND',
      `The immutable outline does not contain ${nodeId}.`,
      500,
    )
  }
  return clone(node)
}

export function findOutlineStage(outline, artifactType) {
  const stageNumber = storyStageNumber(artifactType)
  const nodeId = artifactType === STORY_ARTIFACT_TYPE.OPENING
    ? 'node_01'
    : artifactType === STORY_ARTIFACT_TYPE.ENDING
      ? 'node_05'
      : stageNumber
        ? `node_0${stageNumber + 1}`
        : null
  const stage = outline?.story_nodes?.find((item) => item.node_id === nodeId)
  if (!stage) {
    throw new StoryError(
      'OUTLINE_STAGE_NOT_FOUND',
      `The immutable outline does not contain ${artifactType}.`,
      500,
    )
  }
  return clone(stage)
}

export function latestContinuityHandoff(stages) {
  const stage = [...stages]
    .reverse()
    .find((item) => item?.continuity_handoff)
  if (!stage) {
    throw new StoryError(
      'PREVIOUS_HANDOFF_MISSING',
      'The previous narrative handoff is missing.',
      500,
    )
  }
  return StoryHandoffSchema.parse(clone(stage.continuity_handoff))
}

export function buildContinueContext({
  story,
  option,
  transition,
  previousHandoff,
}) {
  const currentNode = findOutlineNode(story.story_outline, story.current_node_id)
  const configuredOption = resolveOptionsForNode(story, currentNode.node_id)
    .find((item) => item.option_id === option.option_id)
  const expectedAfter = applyStateDelta(transition.before, transition.delta)
  const activeIds = transition.state.active_consequences
  if (
    !configuredOption
    || JSON.stringify(configuredOption) !== JSON.stringify(option)
    || JSON.stringify(option.state_delta) !== JSON.stringify(transition.delta)
    || JSON.stringify(expectedAfter) !== JSON.stringify(transition.after)
    || JSON.stringify(expectedAfter) !== JSON.stringify(storyMetrics(transition.state))
    || new Set(activeIds).size !== activeIds.length
  ) {
    throw new StoryError(
      'CONTINUE_CONTEXT_INCONSISTENT',
      'Continue context does not match the current node, option, state transition, or consequences.',
      500,
    )
  }
  const context = {
    current_node: currentNode,
    selected_option_effect: {
      option_id: option.option_id,
      effect_summary: option.effect_summary,
    },
    state_transition: {
      before: transition.before,
      delta: transition.delta,
      after: transition.after,
      active_consequences: describeConsequences(
        activeIds,
      ),
    },
    previous_handoff: clone(previousHandoff),
    story_context: {
      core_event: story.story_outline.event_anchor.core_event,
      irreplaceable_part: story.story_outline.event_anchor.irreplaceable_part,
      primary_anomaly: story.story_outline.primary_anomaly,
    },
    known_to_user: clone(transition.state.known_to_user),
  }
  return parseContext(ContinueContextSchema, context, 'CONTINUE_CONTEXT_INVALID')
}

export function buildOpeningContext(outline) {
  const currentStage = findOutlineStage(outline, STORY_ARTIFACT_TYPE.OPENING)
  const anchor = outline.event_anchor
  return parseContext(OpeningContextSchema, {
    event_anchor: {
      characters: clone(anchor.characters),
      time: anchor.time,
      location: anchor.location,
      core_emotion: anchor.core_emotion,
      facts_to_preserve: clone(anchor.facts_to_preserve),
    },
    core_event: anchor.core_event,
    user_expectation: anchor.user_expectation,
    irreplaceable_part: anchor.irreplaceable_part,
    primary_anomaly: outline.primary_anomaly,
    current_node: {
      node_id: 'node_01',
      summary: currentStage.summary,
      entry_condition: currentStage.entry_condition,
    },
    known_to_user: [...new Set(outline.initial_story_state.known_to_user)],
  }, 'OPENING_CONTEXT_INVALID')
}

export function buildArtifactContinueContext({
  story,
  artifactType,
  source,
  snapshot,
  previousHandoff,
}) {
  const artifactPlan = findOutlineStage(story.story_outline, artifactType)
  const sequence = storyStageNumber(artifactType)
  const expectedAfter = applyStateDelta(
    storyMetrics(snapshot.state_before),
    snapshot.state_delta,
  )
  if (
    !sequence
    || JSON.stringify(expectedAfter) !== JSON.stringify(storyMetrics(snapshot.state_after))
    || JSON.stringify(snapshot.active_consequences_after)
      !== JSON.stringify(snapshot.state_after.active_consequences)
  ) {
    throw new StoryError(
      'ARTIFACT_CONTEXT_INCONSISTENT',
      'Artifact context does not match its immutable state snapshot.',
      500,
    )
  }
  return parseContext(ContinueContextSchema, {
    current_node: {
      node_id: artifactPlan.node_id,
      task_type: TASK_TYPE.CONTINUE,
      summary: artifactPlan.summary,
      entry_condition: artifactPlan.entry_condition,
    },
    generation_source: {
      interaction_node_id: snapshot.generated_from_node_id,
      interaction_type: source.interaction_type,
      effect_summary: source.effect_summary || '',
      interaction_snapshot: clone(snapshot.interaction_snapshot),
    },
    state_transition: {
      before: storyMetrics(snapshot.state_before),
      delta: clone(snapshot.state_delta),
      after: storyMetrics(snapshot.state_after),
      active_consequences: describeConsequences(snapshot.active_consequences_after),
    },
    previous_handoff: clone(previousHandoff),
    story_context: {
      core_event: story.story_outline.event_anchor.core_event,
      irreplaceable_part: story.story_outline.event_anchor.irreplaceable_part,
      primary_anomaly: story.story_outline.primary_anomaly,
    },
    known_to_user: clone(snapshot.state_after.known_to_user),
  }, 'CONTINUE_CONTEXT_INVALID')
}

export function buildSiteInteractionContinueContext({
  story,
  snapshots,
  transition,
  previousHandoff,
}) {
  const currentNode = findOutlineNode(story.story_outline, story.current_node_id)
  const expectedCombined = snapshots.reduce((total, snapshot) => ({
    event_integrity: total.event_integrity + snapshot.state_delta.event_integrity,
    relationship_connection:
      total.relationship_connection + snapshot.state_delta.relationship_connection,
    uncertainty: total.uncertainty + snapshot.state_delta.uncertainty,
  }), {
    event_integrity: 0,
    relationship_connection: 0,
    uncertainty: 0,
  })
  const expectedAfter = applyStateDelta(transition.before, expectedCombined)
  const activeIds = transition.state.active_consequences
  if (
    snapshots.length === 0
    || snapshots.some((snapshot) => snapshot.target_node_id !== currentNode.node_id)
    || JSON.stringify(expectedCombined) !== JSON.stringify(transition.combined_delta)
    || JSON.stringify(expectedAfter) !== JSON.stringify(transition.after)
    || JSON.stringify(expectedAfter) !== JSON.stringify(storyMetrics(transition.state))
    || new Set(activeIds).size !== activeIds.length
  ) {
    throw new StoryError(
      'CONTINUE_CONTEXT_INCONSISTENT',
      'Site interaction context does not match the node, item deltas, aggregate state, or consequences.',
      500,
    )
  }
  const context = {
    current_node: currentNode,
    site_interactions: snapshots.map((snapshot) => ({
      section_id: snapshot.section_id,
      option_id: snapshot.option_id,
      effect_summary: snapshot.effect_summary,
    })),
    state_transition: {
      before: transition.before,
      combined_delta: transition.combined_delta,
      after: transition.after,
      active_consequences: describeConsequences(activeIds),
    },
    previous_handoff: clone(previousHandoff),
    story_context: {
      core_event: story.story_outline.event_anchor.core_event,
      irreplaceable_part: story.story_outline.event_anchor.irreplaceable_part,
      primary_anomaly: story.story_outline.primary_anomaly,
    },
    known_to_user: clone(transition.state.known_to_user),
  }
  return parseContext(ContinueContextSchema, context, 'CONTINUE_CONTEXT_INVALID')
}

function siteInteractionSnapshots(interactions) {
  return interactions.flatMap((interaction) => (
    interaction.site_interactions
    || interaction.technical_effect?.site_interactions
    || []
  ))
}

function siteInteractionOutcomes(interactions) {
  return interactions.flatMap((interaction) => (
    interaction.site_outcomes
    || interaction.narrative_effect?.site_outcomes
    || []
  ))
}

function gameAnswerSnapshots(interactions) {
  return siteInteractionSnapshots(interactions)
    .filter((snapshot) => snapshot.module_id === 'M4_ORBITAL_EVENTS')
    .sort((a, b) => a.question_order - b.question_order)
}

export function buildEndingContext({
  story,
  selectedEnding,
  runtimeState,
  previousHandoff,
  interactions = [],
}) {
  const endingPlan = findOutlineStage(story.story_outline, STORY_ARTIFACT_TYPE.ENDING)
  const anchor = story.story_outline.event_anchor
  const context = {
    current_node: {
      node_id: 'node_05',
      task_type: TASK_TYPE.ENDING,
      summary: endingPlan.summary,
      entry_condition: endingPlan.entry_condition,
    },
    selected_ending: {
      ending_id: selectedEnding.ending_id,
      outcome: selectedEnding.outcome,
    },
    previous_handoff: clone(previousHandoff),
    story_context: {
      core_event: anchor.core_event,
      user_expectation: anchor.user_expectation,
      irreplaceable_part: anchor.irreplaceable_part,
      primary_anomaly: story.story_outline.primary_anomaly,
    },
    story_state: storyMetrics(runtimeState),
    active_consequences: describeConsequences(runtimeState.active_consequences),
    key_outcomes: [
      ...clone(runtimeState.key_outcomes),
      ...clone(siteInteractionOutcomes(interactions)),
    ],
    known_to_user: clone(runtimeState.known_to_user),
    selected_game_answers: gameAnswerSnapshots(interactions).map((snapshot) => ({
      question_id: snapshot.question_id,
      question_order: snapshot.question_order,
      answer_id: snapshot.option_id,
      answer_name: snapshot.option_name,
      effect_summary: snapshot.effect_summary,
    })),
  }
  return parseContext(EndingContextSchema, context, 'ENDING_CONTEXT_INVALID')
}

export function buildKnowledgeContext({
  story,
  endingOutput,
  stages,
  interactions = [],
  cleanupGameResult = null,
}) {
  const knowledgePlan = {
    task_type: TASK_TYPE.KNOWLEDGE_REVEAL,
    summary: '解释故事中实际出现的主要异常机制，并连接真实材料、任务、轨道决策与清理配对。',
  }
  const hiddenFacts = relevantHiddenFacts(
    story.story_state.hidden_facts,
    story.story_outline.primary_anomaly,
  )
  if (hiddenFacts.length === 0) {
    throw new StoryError(
      'KNOWLEDGE_HIDDEN_FACTS_MISSING',
      'No hidden fact is directly related to the primary anomaly.',
      500,
    )
  }
  const context = {
    current_node: {
      node_id: 'node_10',
      task_type: knowledgePlan.task_type,
      summary: knowledgePlan.summary,
    },
    primary_anomaly: story.story_outline.primary_anomaly,
    hidden_facts: clone(hiddenFacts),
    ending_summary: endingOutput.ending_summary,
    next_node_context: endingOutput.next_node_context,
    story_anomaly_effects: storyAnomalyEffects({
      nextNodeContext: endingOutput.next_node_context,
      stages,
      primaryAnomaly: story.story_outline.primary_anomaly,
    }),
    selected_site_options: siteInteractionSnapshots(interactions)
      .filter((snapshot) => snapshot.module_id !== 'M4_ORBITAL_EVENTS')
      .filter((snapshot) => snapshot.knowledge_profile)
      .map((snapshot) => ({
        module_id: snapshot.module_id,
        section_id: snapshot.section_id,
        section_name: snapshot.section_name,
        option_id: snapshot.option_id,
        option_name: snapshot.option_name,
        knowledge_profile: clone(snapshot.knowledge_profile),
      })),
    selected_game_answers: gameAnswerSnapshots(interactions)
      .filter((snapshot) => snapshot.knowledge_profile)
      .map((snapshot) => ({
        question_id: snapshot.question_id,
        question_order: snapshot.question_order,
        answer_id: snapshot.option_id,
        answer_name: snapshot.option_name,
        knowledge_profile: clone(snapshot.knowledge_profile),
      })),
    ...(cleanupGameResult
      ? { cleanup_game_result: clone(cleanupGameResult) }
      : {}),
  }
  return parseContext(KnowledgeContextSchema, context, 'KNOWLEDGE_CONTEXT_INVALID')
}

