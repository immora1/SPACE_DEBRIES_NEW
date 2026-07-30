import { StoryError, TASK_TYPE } from './constants.js'
import {
  ContinueContextSchema,
  EndingContextSchema,
  KnowledgeContextSchema,
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

export function buildEndingContext({
  story,
  selectedEnding,
  runtimeState,
  previousHandoff,
}) {
  const currentNode = findOutlineNode(story.story_outline, 'node_09')
  const anchor = story.story_outline.event_anchor
  const context = {
    current_node: currentNode,
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
    key_outcomes: clone(runtimeState.key_outcomes),
    known_to_user: clone(runtimeState.known_to_user),
  }
  return parseContext(EndingContextSchema, context, 'ENDING_CONTEXT_INVALID')
}

export function buildKnowledgeContext({
  story,
  endingOutput,
  stages,
}) {
  const currentNode = findOutlineNode(story.story_outline, 'node_10')
  if (currentNode.task_type !== TASK_TYPE.KNOWLEDGE_REVEAL) {
    throw new StoryError(
      'KNOWLEDGE_NODE_INVALID',
      'node_10 must be KNOWLEDGE_REVEAL.',
      500,
    )
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
      node_id: currentNode.node_id,
      task_type: currentNode.task_type,
      summary: currentNode.summary,
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
  }
  return parseContext(KnowledgeContextSchema, context, 'KNOWLEDGE_CONTEXT_INVALID')
}

