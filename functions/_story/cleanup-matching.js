import { CHECKPOINT, StoryError, assertStory } from './constants.js'
import {
  CLEANUP_MODULE_ID,
  buildCleanupTargetSet,
  cleanupTargetIds,
  evaluateCleanupMatch,
} from './config/cleanup-pairs.js'
import { cloneState } from './state-reducer.js'

export function ensureCleanupTargetSet(story) {
  const gameState = cloneState(story.game_state)
  gameState.cleanup_test ||= {}
  gameState.cleanup_test.matches ||= []
  gameState.cleanup_test.target_set ||= []
  gameState.cleanup_test.completed ??= false
  gameState.cleanup_test.completion_id ??= null
  gameState.cleanup_test.completed_at ??= null
  gameState.cleanup_test.frozen_snapshot_ids ||= []
  if (gameState.cleanup_test.target_set.length === 0) {
    gameState.cleanup_test.target_set = buildCleanupTargetSet({
      ...story,
      game_state: gameState,
    })
  }
  return gameState
}

function feedback(evaluation) {
  if (evaluation.is_preferred_match) {
    return evaluation.rule.explanation_profile.why_suitable[0]
  }
  if (evaluation.is_allowed_match) {
    return evaluation.rule.explanation_profile.tradeoffs[0]
  }
  return evaluation.method.mechanism_profile.unsuitable_target_traits[0]
    ? `${evaluation.method.cleanup_method_name}的适用边界与该目标不一致，请结合目标尺寸、结构和运动状态重新判断。`
    : '该方法未被当前目标的后端配对规则允许，请重新判断。'
}

export function resolveCleanupMatchUpdate(story, request) {
  assertStory(story.current_node_id === 'node_05', 'NODE_CONFLICT', 'M6 matching is only available after node_05 Ending has been selected.', 409)
  assertStory(story.current_checkpoint === CHECKPOINT.CLEANUP, 'INVALID_CHECKPOINT', 'The story is not waiting for cleanup matching.', 409)
  const gameState = ensureCleanupTargetSet(story)
  assertStory(!gameState.cleanup_test.completed, 'M6_ALREADY_COMPLETED', 'The cleanup matching result is already frozen.', 409)
  const targetExists = gameState.cleanup_test.target_set.some(
    (target) => target.cleanup_target_id === request.cleanup_target_id,
  )
  assertStory(targetExists, 'CLEANUP_TARGET_NOT_FOUND', 'Unknown cleanup target.', 400)
  const evaluation = evaluateCleanupMatch(
    request.cleanup_target_id,
    request.cleanup_method_id,
    gameState.cleanup_test.target_set,
  )
  if (!evaluation) {
    throw new StoryError('CLEANUP_METHOD_NOT_FOUND', 'Unknown cleanup method.', 400)
  }

  const existingIndex = gameState.cleanup_test.matches.findIndex(
    (match) => match.cleanup_target_id === request.cleanup_target_id,
  )
  const existing = existingIndex >= 0 ? gameState.cleanup_test.matches[existingIndex] : null
  const match = {
    cleanup_target_id: request.cleanup_target_id,
    cleanup_method_id: evaluation.method.cleanup_method_id,
    is_allowed_match: evaluation.is_allowed_match,
    is_preferred_match: evaluation.is_preferred_match,
    attempt_count: (existing?.attempt_count || 0) + 1,
    changed_count: (existing?.changed_count || 0) + (
      existing && existing.cleanup_method_id !== evaluation.method.cleanup_method_id ? 1 : 0
    ),
  }
  if (existingIndex >= 0) gameState.cleanup_test.matches[existingIndex] = match
  else gameState.cleanup_test.matches.push(match)

  return {
    gameState,
    evaluation,
    match,
    feedback: feedback(evaluation),
  }
}

export function freezeCleanupMatchSnapshots(story, completionId, confirmedAt, createId) {
  const gameState = ensureCleanupTargetSet(story)
  const expectedTargetIds = cleanupTargetIds(gameState.cleanup_test.target_set)
  const matches = gameState.cleanup_test.matches
  const submittedTargetIds = matches.map((match) => match.cleanup_target_id).sort()
  assertStory(
    expectedTargetIds.length > 0
      && JSON.stringify(expectedTargetIds) === JSON.stringify(submittedTargetIds),
    'M6_MATCH_SET_INCOMPLETE',
    'Every configured cleanup target must have exactly one final match.',
    409,
    { expected_target_ids: expectedTargetIds, submitted_target_ids: submittedTargetIds },
  )
  assertStory(
    matches.every((match) => match.is_allowed_match),
    'M6_MATCH_SET_INVALID',
    'Every cleanup target must use an allowed method before completion.',
    409,
  )
  const methodIds = matches.map((match) => match.cleanup_method_id)
  assertStory(
    new Set(methodIds).size === methodIds.length,
    'M6_METHOD_REUSED',
    'A cleanup method cannot be assigned to multiple final targets.',
    409,
  )

  const snapshots = matches.map((match) => {
    const evaluation = evaluateCleanupMatch(
      match.cleanup_target_id,
      match.cleanup_method_id,
      gameState.cleanup_test.target_set,
    )
    assertStory(evaluation, 'M6_SNAPSHOT_CONFIG_MISSING', 'Cleanup snapshot configuration is missing.', 500)
    return {
      snapshot_id: createId(),
      story_id: story.story_id,
      completion_id: completionId,
      module_id: CLEANUP_MODULE_ID,
      cleanup_target_id: evaluation.target.cleanup_target_id,
      cleanup_target_name: evaluation.target.cleanup_target_name,
      cleanup_method_id: evaluation.method.cleanup_method_id,
      cleanup_method_name: evaluation.method.cleanup_method_name,
      target_profile: cloneState(evaluation.target.target_profile),
      mechanism_profile: cloneState(evaluation.method.mechanism_profile),
      is_allowed_match: evaluation.is_allowed_match,
      is_preferred_match: evaluation.is_preferred_match,
      explanation_profile: cloneState(evaluation.rule.explanation_profile),
      attempt_count: match.attempt_count,
      changed_count: match.changed_count,
      confirmed_at: confirmedAt,
    }
  })
  return { gameState, snapshots }
}

export function cleanupKnowledgeResult(snapshots) {
  return {
    module_id: CLEANUP_MODULE_ID,
    completed: true,
    total_targets: snapshots.length,
    allowed_matches: snapshots.filter((snapshot) => snapshot.is_allowed_match).length,
    preferred_matches: snapshots.filter((snapshot) => snapshot.is_preferred_match).length,
    matches: snapshots.map((snapshot) => ({
      cleanup_target_id: snapshot.cleanup_target_id,
      cleanup_target_name: snapshot.cleanup_target_name,
      cleanup_method_id: snapshot.cleanup_method_id,
      cleanup_method_name: snapshot.cleanup_method_name,
      is_allowed_match: snapshot.is_allowed_match,
      is_preferred_match: snapshot.is_preferred_match,
      target_profile: cloneState(snapshot.target_profile),
      mechanism_profile: cloneState(snapshot.mechanism_profile),
      explanation_profile: cloneState(snapshot.explanation_profile),
    })),
  }
}
