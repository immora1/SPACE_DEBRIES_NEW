import Ajv from 'ajv'
import { StoryError, TASK_TYPE } from './constants.js'
import {
  continueSchemaEnvelope,
  endingSchemaEnvelope,
  knowledgeSchemaEnvelope,
  openingSchemaEnvelope,
  outlineSchemaEnvelope,
  validationRules,
} from './spec-assets.js'
import { consequenceIds } from './config/story-options.js'
import { relevantHiddenFacts } from './anomaly-facts.js'
import { analyzeEndingReachability } from './ending-reachability.js'

const ajv = new Ajv({
  allErrors: true,
  strict: true,
})

const validateOutlineJson = ajv.compile(outlineSchemaEnvelope.schema)
const validateOpeningJson = ajv.compile(openingSchemaEnvelope.schema)
const validateContinueJson = ajv.compile(continueSchemaEnvelope.schema)
const validateEndingJson = ajv.compile(endingSchemaEnvelope.schema)
const validateKnowledgeJson = ajv.compile(knowledgeSchemaEnvelope.schema)
const EXPECTED_NODES = validationRules.outline.expected_node_sequence

function schemaDetails(errors = []) {
  return errors.slice(0, 8).map((error) => ({
    path: error.instancePath || '/',
    keyword: error.keyword,
    property: error.params?.additionalProperty,
  }))
}

function schemaFailure(code, message, errors) {
  throw new StoryError(code, message, 502, schemaDetails(errors))
}

function outlineSchemaCode(errors = []) {
  if (errors.some((error) => error.keyword === 'additionalProperties')) {
    return 'OUTLINE_ADDITIONAL_FIELD_INVALID'
  }
  if (errors.some((error) => (
    error.instancePath === '/story_nodes'
    && ['minItems', 'maxItems'].includes(error.keyword)
  ))) {
    return 'OUTLINE_NODE_COUNT_INVALID'
  }
  if (errors.some((error) => error.instancePath.startsWith('/initial_story_state/'))) {
    return 'OUTLINE_INITIAL_STATE_INVALID'
  }
  return 'OUTLINE_SCHEMA_INVALID'
}

function openingSchemaCode(errors = []) {
  if (errors.some((error) => error.keyword === 'additionalProperties')) {
    return 'OPENING_ADDITIONAL_FIELD_INVALID'
  }
  return 'OPENING_SCHEMA_INVALID'
}

export function normalizeFact(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function ensureNonEmpty(value, code, path) {
  if (!nonEmpty(value)) {
    throw new StoryError(code, `${path} must be a non-empty string.`, 502, [{ path }])
  }
}

function ensureUniqueStrings(values, code, path) {
  const normalized = values.map((value, index) => {
    ensureNonEmpty(value, code, `${path}/${index}`)
    return normalizeFact(value)
  })
  if (new Set(normalized).size !== normalized.length) {
    throw new StoryError(code, `${path} contains duplicate facts.`, 502, [{ path }])
  }
}

function ensureUniqueBy(values, keyOf, code, path) {
  const keys = values.map(keyOf)
  if (new Set(keys).size !== keys.length) {
    throw new StoryError(code, `${path} contains duplicate values.`, 502, [{ path }])
  }
}

function travelInformationDeviationIsSupported(outline) {
  const anchor = outline.event_anchor
  const coreAndIrreplaceable = normalizeFact(
    `${anchor.core_event}${anchor.irreplaceable_part}`,
  )
  const timingContext = normalizeFact(
    `${anchor.user_expectation}${anchor.irreplaceable_part}${anchor.time}${anchor.location}`,
  )

  const travelIsTheEvent = /(行程|旅程|旅行|交通|航班|车次|列车|飞机|登机|转机|赶车|乘车|接站|送达|配送)/u
    .test(coreAndIrreplaceable)
  const arrivalIsExplicit = /(抵达|到达|赶到|到场|送到|送达)/u.test(coreAndIrreplaceable)
  const arrivalIsTimeOrPlaceCritical = arrivalIsExplicit
    && /(之前|以前|准时|时间|地点|现场|错过|不可替代)/u.test(timingContext)

  return travelIsTheEvent || arrivalIsTimeOrPlaceCritical
}

function validateOutlineSemantics(outline) {
  if (outline.task_type !== TASK_TYPE.OUTLINE) {
    throw new StoryError('OUTLINE_TASK_TYPE_INVALID', 'task_type must be STORY_OUTLINE.', 502)
  }

  const anchor = outline.event_anchor
  for (const field of [
    'time',
    'location',
    'core_event',
    'user_expectation',
    'core_emotion',
    'irreplaceable_part',
  ]) {
    ensureNonEmpty(anchor[field], 'OUTLINE_EVENT_ANCHOR_INVALID', `/event_anchor/${field}`)
  }

  ensureUniqueBy(
    anchor.characters,
    (character) => {
      ensureNonEmpty(character.label, 'OUTLINE_EVENT_ANCHOR_INVALID', '/event_anchor/characters/label')
      ensureNonEmpty(character.relationship, 'OUTLINE_EVENT_ANCHOR_INVALID', '/event_anchor/characters/relationship')
      return `${normalizeFact(character.label)}:${normalizeFact(character.relationship)}`
    },
    'OUTLINE_EVENT_ANCHOR_INVALID',
    '/event_anchor/characters',
  )
  ensureUniqueStrings(
    anchor.facts_to_preserve,
    'OUTLINE_FACTS_INVALID',
    '/event_anchor/facts_to_preserve',
  )

  if (outline.story_nodes.length !== EXPECTED_NODES.length) {
    throw new StoryError(
      'OUTLINE_NODE_COUNT_INVALID',
      `story_nodes must contain exactly ${EXPECTED_NODES.length} items.`,
      502,
    )
  }
  ensureUniqueBy(
    outline.story_nodes,
    (node) => node.node_id,
    'OUTLINE_NODE_ID_DUPLICATE',
    '/story_nodes',
  )
  outline.story_nodes.forEach((node, index) => {
    const expected = EXPECTED_NODES[index]
    if (node.node_id !== expected.node_id || node.task_type !== expected.task_type) {
      throw new StoryError(
        'OUTLINE_NODE_SEQUENCE_INVALID',
        `story_nodes[${index}] must be ${expected.node_id}/${expected.task_type}.`,
        502,
        [{ path: `/story_nodes/${index}` }],
      )
    }
    ensureNonEmpty(node.summary, 'OUTLINE_NODE_CONTENT_INVALID', `/story_nodes/${index}/summary`)
    ensureNonEmpty(
      node.entry_condition,
      'OUTLINE_NODE_CONTENT_INVALID',
      `/story_nodes/${index}/entry_condition`,
    )
  })

  ensureUniqueBy(
    outline.reachable_endings,
    (ending) => ending.ending_id,
    'OUTLINE_ENDING_ID_DUPLICATE',
    '/reachable_endings',
  )
  ensureUniqueBy(
    outline.reachable_endings,
    (ending) => normalizeFact(ending.outcome),
    'OUTLINE_ENDING_OUTCOME_DUPLICATE',
    '/reachable_endings',
  )
  outline.reachable_endings.forEach((ending, index) => {
    ensureNonEmpty(
      ending.outcome,
      'OUTLINE_ENDING_CONTENT_INVALID',
      `/reachable_endings/${index}/outcome`,
    )
    const rule = ending.state_rule
    if (rule.fallback && (
      rule.conditions.length
      || rule.required_consequence_ids.length
      || rule.forbidden_consequence_ids.length
    )) {
      throw new StoryError(
        'OUTLINE_FALLBACK_RULE_INVALID',
        'The fallback ending cannot contain conditions or consequence constraints.',
        502,
        [{ path: `/reachable_endings/${index}/state_rule` }],
      )
    }
    const required = new Set(rule.required_consequence_ids)
    const forbidden = new Set(rule.forbidden_consequence_ids)
    const knownConsequenceIds = new Set(consequenceIds())
    if (
      required.size !== rule.required_consequence_ids.length
      || forbidden.size !== rule.forbidden_consequence_ids.length
      || [...required].some((consequenceId) => forbidden.has(consequenceId))
      || [...required, ...forbidden].some(
        (consequenceId) => !knownConsequenceIds.has(consequenceId),
      )
    ) {
      throw new StoryError(
        'OUTLINE_ENDING_CONSEQUENCE_INVALID',
        'Ending state_rule contains invalid consequence IDs.',
        502,
        [{ path: `/reachable_endings/${index}/state_rule` }],
      )
    }
  })
  if (outline.reachable_endings.filter((ending) => ending.state_rule.fallback).length !== 1) {
    throw new StoryError(
      'OUTLINE_FALLBACK_COUNT_INVALID',
      'Exactly one reachable ending must be the fallback.',
      502,
    )
  }

  const state = outline.initial_story_state
  for (const [field, values] of [
    ['confirmed_facts', state.confirmed_facts],
    ['known_to_user', state.known_to_user],
    ['hidden_facts', state.hidden_facts],
  ]) {
    ensureUniqueStrings(values, 'OUTLINE_INITIAL_STATE_INVALID', `/initial_story_state/${field}`)
  }
  if (
    state.current_node_id !== validationRules.outline.initial_story_state.current_node_id
    || state.active_consequences.length !== 0
    || state.last_user_action !== null
  ) {
    throw new StoryError(
      'OUTLINE_INITIAL_STATE_INVALID',
      'initial_story_state violates the fixed starting state.',
      502,
    )
  }

  if (
    outline.primary_anomaly === 'TRAVEL_INFO_DEVIATION'
    && !travelInformationDeviationIsSupported(outline)
  ) {
    throw new StoryError(
      'OUTLINE_TRAVEL_ANOMALY_UNSUPPORTED',
      'TRAVEL_INFO_DEVIATION is not directly supported by the core event or its irreplaceable conditions.',
      502,
    )
  }
  if (relevantHiddenFacts(state.hidden_facts, outline.primary_anomaly).length === 0) {
    throw new StoryError(
      'OUTLINE_HIDDEN_FACTS_INVALID',
      'initial_story_state.hidden_facts must contain a fact directly related to primary_anomaly.',
      502,
    )
  }
  const reachability = analyzeEndingReachability(outline)
  if (reachability.unreachable_non_fallback_ids.length > 0) {
    throw new StoryError(
      'OUTLINE_ENDING_UNREACHABLE',
      'Every non-fallback reachable ending must be selectable by at least one configured option path.',
      502,
      [{
        unreachable_ending_ids: reachability.unreachable_non_fallback_ids,
        reachable_metric_ranges: reachability.reachable_metric_ranges,
        selected_ending_ids: reachability.selected_ending_ids,
      }],
    )
  }
}

export function validateStoryOutline(value) {
  if (!validateOutlineJson(value)) {
    schemaFailure(
      outlineSchemaCode(validateOutlineJson.errors),
      'Story outline failed JSON Schema validation.',
      validateOutlineJson.errors,
    )
  }
  validateOutlineSemantics(value)
  return value
}

function paragraphCount(text) {
  return text
    .trim()
    .split(/(?:\r?\n){2,}/)
    .filter((paragraph) => paragraph.trim())
    .length
}

function chineseCharacterCount(text) {
  return text.match(/\p{Script=Han}/gu)?.length || 0
}

function containsObviousChoiceOrExplanation(text) {
  const patterns = [
    /(?:^|\n)\s*(?:选项\s*)?[A-DＡ-Ｄ][.、:：)]/u,
    /(?:^|\n)\s*[1-4一二三四][.、:：)]/u,
    /请选择|以下选项|你可以选择|故事分支|最终结局|知识解释/u,
    /太空垃圾|轨道碎片|卫星故障|卫星避碰|轨道环境恶化/u,
  ]
  return patterns.some((pattern) => pattern.test(text))
}

function factHasStorySupport(fact, storyText) {
  const factHan = (fact.match(/\p{Script=Han}/gu) || []).join('')
  const story = normalizeFact(storyText)
  if (factHan.length < 4) return story.includes(normalizeFact(fact))

  const bigrams = new Set()
  for (let index = 0; index < factHan.length - 1; index += 1) {
    bigrams.add(factHan.slice(index, index + 2))
  }
  const matched = [...bigrams].filter((bigram) => story.includes(bigram)).length
  return matched >= 2 && matched / bigrams.size >= 0.15
}

function leaksHiddenFact(text, hiddenFacts) {
  const normalizedText = normalizeFact(text)
  return hiddenFacts.some((fact) => {
    const normalizedHidden = normalizeFact(fact)
    return normalizedHidden.length >= 6 && normalizedText.includes(normalizedHidden)
  })
}

export function validateStoryOpening(value, runtimeState) {
  if (!validateOpeningJson(value)) {
    schemaFailure(
      openingSchemaCode(validateOpeningJson.errors),
      'Story opening failed JSON Schema validation.',
      validateOpeningJson.errors,
    )
  }

  const textRules = validationRules.opening.story_text
  const storyText = value.story_text
  ensureNonEmpty(storyText, 'OPENING_STORY_TEXT_INVALID', '/story_text')
  const paragraphs = paragraphCount(storyText)
  const chineseCharacters = chineseCharacterCount(storyText)
  if (
    paragraphs < textRules.min_paragraphs
    || paragraphs > textRules.max_paragraphs
    || chineseCharacters < textRules.target_chinese_chars_min
    || chineseCharacters > textRules.target_chinese_chars_max
    || !storyText.includes('你')
    || containsObviousChoiceOrExplanation(storyText)
  ) {
    throw new StoryError(
      'OPENING_STORY_TEXT_INVALID',
      'story_text violates paragraph, length, perspective, or stage-boundary rules.',
      502,
      [{
        paragraphs,
        chinese_characters: chineseCharacters,
        expected: {
          min_paragraphs: textRules.min_paragraphs,
          max_paragraphs: textRules.max_paragraphs,
          min_chinese_characters: textRules.target_chinese_chars_min,
          max_chinese_characters: textRules.target_chinese_chars_max,
          second_person_required: true,
        },
      }],
    )
  }

  if (leaksHiddenFact(storyText, runtimeState.hidden_facts)) {
    throw new StoryError(
      'OPENING_HIDDEN_FACT_LEAK',
      'story_text exposes a hidden fact.',
      502,
    )
  }

  const existingKnown = new Set(runtimeState.known_to_user.map(normalizeFact))
  const seen = new Set()
  const additions = []
  value.known_to_user_additions.forEach((fact, index) => {
    ensureNonEmpty(fact, 'OPENING_KNOWN_FACTS_INVALID', `/known_to_user_additions/${index}`)
    const normalized = normalizeFact(fact)
    if (existingKnown.has(normalized) || seen.has(normalized)) return
    if (!factHasStorySupport(fact, storyText)) {
      throw new StoryError(
        'OPENING_KNOWN_FACTS_INVALID',
        'known_to_user_additions must be supported by story_text.',
        502,
        [{ path: `/known_to_user_additions/${index}` }],
      )
    }
    if (leaksHiddenFact(fact, runtimeState.hidden_facts)) {
      throw new StoryError(
        'OPENING_HIDDEN_FACT_LEAK',
        'known_to_user_additions exposes a hidden fact.',
        502,
      )
    }
    seen.add(normalized)
    additions.push(fact.trim())
  })
  if (additions.length === 0) {
    throw new StoryError(
      'OPENING_KNOWN_FACTS_INVALID',
      'known_to_user_additions contains no new facts after deduplication.',
      502,
    )
  }

  const handoff = value.continuity_handoff
  ensureNonEmpty(
    handoff.current_situation,
    'OPENING_HANDOFF_INVALID',
    '/continuity_handoff/current_situation',
  )
  if (
    leaksHiddenFact(handoff.current_situation, runtimeState.hidden_facts)
    || /下一节点|后续节点|最终必然/u.test(handoff.current_situation)
  ) {
    throw new StoryError(
      'OPENING_HANDOFF_INVALID',
      'continuity_handoff contains hidden or future content.',
      502,
    )
  }
  ensureUniqueStrings(
    handoff.unresolved_threads,
    'OPENING_HANDOFF_INVALID',
    '/continuity_handoff/unresolved_threads',
  )
  if (handoff.unresolved_threads.some((thread) => leaksHiddenFact(thread, runtimeState.hidden_facts))) {
    throw new StoryError(
      'OPENING_HIDDEN_FACT_LEAK',
      'continuity_handoff exposes a hidden fact.',
      502,
    )
  }

  return {
    output: value,
    additions,
  }
}

function validateNarrativeText({
  storyText,
  code,
  minParagraphs,
  maxParagraphs,
  minChineseCharacters,
  maxChineseCharacters,
  requireSecondPerson = true,
  forbidChoices = true,
}) {
  ensureNonEmpty(storyText, code, '/story_text')
  const paragraphs = paragraphCount(storyText)
  const chineseCharacters = chineseCharacterCount(storyText)
  if (
    paragraphs < minParagraphs
    || paragraphs > maxParagraphs
    || chineseCharacters < minChineseCharacters
    || chineseCharacters > maxChineseCharacters
    || (requireSecondPerson && !storyText.includes('你'))
    || (forbidChoices && /(?:^|\n)\s*(?:选项\s*)?[A-DＡ-Ｄ][.、:：)]/u.test(storyText))
  ) {
    throw new StoryError(
      code,
      'story_text violates paragraph, length, perspective, or stage-boundary rules.',
      502,
      [{
        paragraphs,
        chinese_characters: chineseCharacters,
        expected: {
          min_paragraphs: minParagraphs,
          max_paragraphs: maxParagraphs,
          min_chinese_characters: minChineseCharacters,
          max_chinese_characters: maxChineseCharacters,
          second_person_required: requireSecondPerson,
        },
      }],
    )
  }
}

function validateNarrativeAdditions(
  value,
  runtimeState,
  prefix,
  { requireStorySupport = false } = {},
) {
  const existingKnown = new Set(runtimeState.known_to_user.map(normalizeFact))
  const seen = new Set()
  const additions = []
  value.known_to_user_additions.forEach((fact, index) => {
    ensureNonEmpty(
      fact,
      `${prefix}_KNOWN_FACTS_INVALID`,
      `/known_to_user_additions/${index}`,
    )
    const normalized = normalizeFact(fact)
    if (existingKnown.has(normalized) || seen.has(normalized)) return
    if (requireStorySupport && !factHasStorySupport(fact, value.story_text)) {
      throw new StoryError(
        `${prefix}_KNOWN_FACTS_INVALID`,
        'known_to_user_additions must be supported by story_text.',
        502,
        [{ path: `/known_to_user_additions/${index}` }],
      )
    }
    if (leaksHiddenFact(fact, runtimeState.hidden_facts)) {
      throw new StoryError(
        `${prefix}_HIDDEN_FACT_LEAK`,
        'known_to_user_additions exposes a hidden fact.',
        502,
      )
    }
    seen.add(normalized)
    additions.push(fact.trim())
  })
  return additions
}

function validateNarrativeHandoff(value, runtimeState, prefix) {
  const handoff = value.continuity_handoff
  ensureNonEmpty(
    handoff.current_situation,
    `${prefix}_HANDOFF_INVALID`,
    '/continuity_handoff/current_situation',
  )
  ensureUniqueStrings(
    handoff.unresolved_threads,
    `${prefix}_HANDOFF_INVALID`,
    '/continuity_handoff/unresolved_threads',
  )
  const handoffText = [
    handoff.current_situation,
    ...handoff.unresolved_threads,
  ].join('\n')
  if (
    leaksHiddenFact(handoffText, runtimeState.hidden_facts)
    || /下一节点|后续节点|最终必然/u.test(handoffText)
  ) {
    throw new StoryError(
      `${prefix}_HANDOFF_INVALID`,
      'continuity_handoff contains hidden or future content.',
      502,
    )
  }
}

export function validateStoryContinue(value, runtimeState) {
  if (!validateContinueJson(value)) {
    schemaFailure(
      'CONTINUE_SCHEMA_INVALID',
      'Story continuation failed JSON Schema validation.',
      validateContinueJson.errors,
    )
  }
  validateNarrativeText({
    storyText: value.story_text,
    code: 'CONTINUE_STORY_TEXT_INVALID',
    minParagraphs: 3,
    maxParagraphs: 5,
    minChineseCharacters: 350,
    maxChineseCharacters: 550,
  })
  if (/(?:不是|没有)[^。\n]{0,80}而是/u.test(value.story_text)) {
    throw new StoryError(
      'CONTINUE_STYLE_INVALID',
      'story_text contains a prohibited negative contrast construction.',
      502,
    )
  }
  if (leaksHiddenFact(value.story_text, runtimeState.hidden_facts)) {
    throw new StoryError(
      'CONTINUE_HIDDEN_FACT_LEAK',
      'story_text exposes a hidden fact.',
      502,
    )
  }
  const additions = validateNarrativeAdditions(value, runtimeState, 'CONTINUE')
  validateNarrativeHandoff(value, runtimeState, 'CONTINUE')
  return {
    output: value,
    additions,
  }
}

export function validateStoryEnding(value, {
  selectedEndingId,
  hiddenFacts = [],
}) {
  if (!validateEndingJson(value)) {
    schemaFailure(
      'ENDING_SCHEMA_INVALID',
      'Story ending failed JSON Schema validation.',
      validateEndingJson.errors,
    )
  }
  if (
    value.task_type !== TASK_TYPE.ENDING
    || value.node_id !== 'node_09'
    || value.next_node_id !== 'node_10'
    || value.selected_ending_id !== selectedEndingId
  ) {
    throw new StoryError(
      'ENDING_ID_MISMATCH',
      'The model did not execute the backend-selected ending.',
      502,
    )
  }
  validateNarrativeText({
    storyText: value.story_text,
    code: 'ENDING_STORY_TEXT_INVALID',
    minParagraphs: 4,
    maxParagraphs: 6,
    minChineseCharacters: 450,
    maxChineseCharacters: 700,
  })
  if (leaksHiddenFact(value.story_text, hiddenFacts)) {
    throw new StoryError(
      'ENDING_HIDDEN_FACT_LEAK',
      'The ending exposes a hidden technical fact.',
      502,
    )
  }
  ensureNonEmpty(value.ending_summary, 'ENDING_SUMMARY_INVALID', '/ending_summary')
  ensureNonEmpty(
    value.next_node_context,
    'ENDING_NEXT_CONTEXT_INVALID',
    '/next_node_context',
  )
  return value
}

export function validateKnowledgeReveal(value) {
  if (!validateKnowledgeJson(value)) {
    schemaFailure(
      'KNOWLEDGE_SCHEMA_INVALID',
      'Knowledge reveal failed JSON Schema validation.',
      validateKnowledgeJson.errors,
    )
  }
  if (
    value.task_type !== TASK_TYPE.KNOWLEDGE_REVEAL
    || value.node_id !== 'node_10'
    || value.story_completed !== true
  ) {
    throw new StoryError(
      'KNOWLEDGE_STAGE_INVALID',
      'Knowledge reveal returned invalid stage markers.',
      502,
    )
  }
  const combined = [
    value.knowledge_title,
    value.story_connection,
    ...value.causal_chain.flatMap((point) => [point.point_title, point.point_text]),
    value.reality_note,
  ].join('')
  const chineseCharacters = chineseCharacterCount(combined)
  if (chineseCharacters < 300 || chineseCharacters > 500) {
    throw new StoryError(
      'KNOWLEDGE_TEXT_INVALID',
      'Knowledge reveal must contain 300 to 500 Chinese characters.',
      502,
      [{ chinese_characters: chineseCharacters }],
    )
  }
  return value
}
