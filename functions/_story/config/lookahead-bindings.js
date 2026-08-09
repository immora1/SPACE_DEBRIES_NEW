import { StoryError } from '../constants.js'

export const STORY_FLOW_VERSION = 'FIVE_STAGE_V1'

export const STORY_ARTIFACT_TYPE = Object.freeze({
  OUTLINE: 'OUTLINE',
  OPENING: 'OPENING',
  STAGE_1: 'STORY_STAGE_1',
  STAGE_2: 'STORY_STAGE_2',
  STAGE_3: 'STORY_STAGE_3',
  ENDING: 'ENDING',
  KNOWLEDGE_REVEAL: 'KNOWLEDGE_REVEAL',
})

export const STORY_ARTIFACT_SEQUENCE = Object.freeze([
  STORY_ARTIFACT_TYPE.OUTLINE,
  STORY_ARTIFACT_TYPE.OPENING,
  STORY_ARTIFACT_TYPE.STAGE_1,
  STORY_ARTIFACT_TYPE.STAGE_2,
  STORY_ARTIFACT_TYPE.STAGE_3,
  STORY_ARTIFACT_TYPE.ENDING,
  STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL,
])

export const LOOKAHEAD_BINDINGS = Object.freeze([
  Object.freeze({
    interaction_node_id: 'node_02',
    reveal_artifact: STORY_ARTIFACT_TYPE.STAGE_1,
    generate_artifact: STORY_ARTIFACT_TYPE.STAGE_1,
    generation_stage: 'CONTINUE',
    interaction_type: 'M2_MATERIALS',
  }),
  Object.freeze({
    interaction_node_id: 'node_03',
    reveal_artifact: STORY_ARTIFACT_TYPE.STAGE_2,
    generate_artifact: STORY_ARTIFACT_TYPE.STAGE_2,
    generation_stage: 'CONTINUE',
    interaction_type: 'M3_MISSION',
  }),
  Object.freeze({
    interaction_node_id: 'node_04',
    reveal_artifact: STORY_ARTIFACT_TYPE.STAGE_3,
    generate_artifact: STORY_ARTIFACT_TYPE.STAGE_3,
    generation_stage: 'CONTINUE',
    interaction_type: 'ORBIT_GAME_Q1',
  }),
  Object.freeze({
    interaction_node_id: 'node_05',
    reveal_artifact: STORY_ARTIFACT_TYPE.ENDING,
    generate_artifact: STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL,
    generation_stage: 'KNOWLEDGE',
    interaction_type: 'M6_COMPLETE',
  }),
])

export const M6_COMPLETE_LOOKAHEAD_BINDING = LOOKAHEAD_BINDINGS[3]

const BINDING_BY_NODE = new Map(
  LOOKAHEAD_BINDINGS.map((binding) => [binding.interaction_node_id, binding]),
)
const ARTIFACT_INDEX = new Map(
  STORY_ARTIFACT_SEQUENCE.map((artifactType, index) => [artifactType, index]),
)

export function artifactSequence(artifactType) {
  const sequence = ARTIFACT_INDEX.get(artifactType)
  if (sequence === undefined) {
    throw new StoryError(
      'STORY_ARTIFACT_TYPE_INVALID',
      `Unknown story artifact type: ${artifactType}.`,
      500,
    )
  }
  return sequence
}

export function prerequisiteArtifact(artifactType) {
  const sequence = artifactSequence(artifactType)
  return sequence > 0 ? STORY_ARTIFACT_SEQUENCE[sequence - 1] : null
}

export function resolveLookaheadBinding(nodeId) {
  const binding = BINDING_BY_NODE.get(nodeId)
  return binding ? structuredClone(binding) : null
}

export function storyStageNumber(artifactType) {
  const match = /^STORY_STAGE_(\d+)$/.exec(artifactType || '')
  return match ? Number(match[1]) : null
}

export function validateLookaheadBindings() {
  if (
    LOOKAHEAD_BINDINGS.length !== 4
    || LOOKAHEAD_BINDINGS[0].generate_artifact !== STORY_ARTIFACT_TYPE.STAGE_1
    || LOOKAHEAD_BINDINGS[1].generate_artifact !== STORY_ARTIFACT_TYPE.STAGE_2
    || LOOKAHEAD_BINDINGS[2].generate_artifact !== STORY_ARTIFACT_TYPE.STAGE_3
    || LOOKAHEAD_BINDINGS[3].generate_artifact !== STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL
    || new Set(STORY_ARTIFACT_SEQUENCE).size !== STORY_ARTIFACT_SEQUENCE.length
  ) {
    throw new StoryError(
      'LOOKAHEAD_BINDING_INVALID',
      'The five-stage node-to-artifact mapping is invalid.',
      500,
    )
  }
  return true
}

validateLookaheadBindings()
