import validators from './current-validators.generated.cjs'
import { StoryError } from './constants.js'
import { appendUniqueFacts } from './state-reducer.js'

function require(condition, code, message, details) {
  if (!condition) throw new StoryError(code, message, 502, details)
}

function schema(task, value, prefix) {
  const validate = validators[task]
  require(validate(value), `${prefix}_SCHEMA_INVALID`, 'Output does not match the current story schema.', validate.errors)
}

const sequence = ['STORY_OPENING', 'STORY_CONTINUE', 'STORY_CONTINUE', 'STORY_ENDING', 'KNOWLEDGE_REVEAL']
export function validateStoryOutline(value) {
  schema('STORY_OUTLINE', value, 'OUTLINE')
  require(value.initial_story_state.last_user_action === null && value.initial_story_state.active_consequences.length === 0,
    'OUTLINE_INITIAL_STATE_INVALID', 'Initial state cannot contain previous actions or game consequences.')
  require(value.story_nodes.every((node, index) => node.node_id === `node_0${index + 1}`
    && node.task_type === sequence[index] && node.summary.trim()),
  'OUTLINE_NODE_SEQUENCE_INVALID', 'Expected five ordered story nodes; GAME is not a node.')
  require(new Set(value.ending_candidates.map(ending => ending.ending_id)).size === value.ending_candidates.length,
    'OUTLINE_ENDING_ID_DUPLICATE', 'Ending candidate IDs must be unique.')
  require(value.ending_candidates.every(ending => ending.ending_id.trim() && ending.ending_type.trim() && ending.outcome.trim()),
    'OUTLINE_ENDING_CONTENT_INVALID', 'Ending candidates must contain an ID, type and outcome.')
  require(Object.values(value.causal_chain).every(text => text.trim()),
    'OUTLINE_CAUSAL_CHAIN_INVALID', 'The satellite event, hidden mechanism and human effect must be populated.')
  return value
}

function narrative(value, prefix, limits, hiddenMechanism) {
  const [minChars, maxChars, minParagraphs, maxParagraphs] = limits
  const text = value.story_text
  const count = (text.match(/\p{Script=Han}/gu) || []).length
  const paragraphs = text.trim().split(/\n\s*\n/u).length
  require(count >= minChars && count <= maxChars && paragraphs >= minParagraphs && paragraphs <= maxParagraphs
    && text.includes('你') && !/(?:^|\n)\s*(?:选项\s*)?[A-DＡ-Ｄ][.、:：)]/u.test(text),
  `${prefix}_STORY_TEXT_INVALID`, 'Narrative length, paragraphs or perspective do not match the prompt.', [{
    paragraphs, chinese_characters: count, expected: {
      min_paragraphs: minParagraphs, max_paragraphs: maxParagraphs,
      min_chinese_characters: minChars, max_chinese_characters: maxChars,
    },
  }])
  // A may be narrated. Only the complete hidden mechanism B is withheld.
  const normalize = text => text.replace(/[\s\p{P}\p{S}]+/gu, '')
  if (hiddenMechanism) {
    require(!normalize(JSON.stringify(value)).includes(normalize(hiddenMechanism)),
      `${prefix}_HIDDEN_FACT_LEAK`, 'The narrative exposes the hidden mechanism B.')
  }
}

function additions(value, runtimeState, prefix) {
  require(value.continuity_handoff.current_situation.trim()
    && value.continuity_handoff.unresolved_threads.every(text => text.trim())
    && value.known_to_user_additions.every(text => text.trim()),
  `${prefix}_HANDOFF_INVALID`, 'Narrative facts and continuity handoff must not be blank.')
  return { output: value,
    additions: appendUniqueFacts(runtimeState.known_to_user, value.known_to_user_additions)
      .slice(runtimeState.known_to_user.length) }
}

export function validateStoryOpening(value, runtimeState, hiddenMechanism) {
  schema('STORY_OPENING', value, 'OPENING')
  narrative(value, 'OPENING', [300, 450, 3, 5], hiddenMechanism)
  return additions(value, runtimeState, 'OPENING')
}

export function validateStoryContinue(value, runtimeState, hiddenMechanism) {
  schema('STORY_CONTINUE', value, 'CONTINUE')
  const second = value.node_id === 'node_02'
  require(value.node_id === runtimeState.current_node_id
    && value.next_stage === (second ? 'STORY_CONTINUE' : 'GAME')
    && value.next_node_id === (second ? 'node_03' : null),
  'CONTINUE_NODE_INVALID', 'Continuation must match the current node and its next stage.')
  narrative(value, 'CONTINUE', [350, 500, 3, 5], hiddenMechanism)
  return additions(value, runtimeState, 'CONTINUE')
}

export function validateStoryEnding(value, { endingCandidates, hiddenMechanism }) {
  schema('STORY_ENDING', value, 'ENDING')
  require(endingCandidates.some(ending => ending.ending_id === value.selected_ending_id
    && ending.ending_type === value.selected_ending_type),
  'ENDING_ID_MISMATCH', 'The selected ending ID and type must match an outline candidate.')
  narrative(value, 'ENDING', [450, 650, 4, 6], hiddenMechanism)
  require(value.ending_summary.trim() && Object.values(value.next_node_context).every(text => text.trim()),
    'ENDING_NEXT_CONTEXT_INVALID', 'Ending summary and A/C handoff must not be blank.')
  return value
}

export function validateKnowledgeReveal(value) {
  schema('KNOWLEDGE_REVEAL', value, 'KNOWLEDGE')
  const text = [value.knowledge_title, value.story_connection, value.reality_note,
    ...value.causal_chain.flatMap(point => [point.point_title, point.point_text])].join('')
  const count = (text.match(/\p{Script=Han}/gu) || []).length
  require(count >= 300 && count <= 450, 'KNOWLEDGE_TEXT_INVALID',
    'Knowledge must contain 300 to 450 Chinese characters.', [{ chinese_characters: count }])
  return value
}
