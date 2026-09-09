import { createInitialGameState } from '../../functions/_story/state-reducer.js'
import { resolveProductAction } from '../../functions/_story/product-actions.js'

export function initialStoryProgress(input) {
  return { gameState: createInitialGameState(input), checkpoint: 'materials' }
}

export function advanceStoryProgress(progress, action) {
  const result = resolveProductAction({
    game_state: progress.gameState,
    current_checkpoint: progress.checkpoint,
  }, action)
  return { gameState: result.gameState, checkpoint: result.nextCheckpoint }
}

// A lost HTTP response must not apply the same choice a second time on retry.
export function storyActionAcknowledged(story, action) {
  const state = story.public_game_state
  if (!state) return false
  switch (action.action_type) {
    case 'MATERIALS_COMMIT':
      return Object.entries(action.payload.selections).every(([part, selection]) =>
        state.satellite_build?.materials?.[part] === selection)
    case 'MISSION_SELECT':
      return state.mission?.action_id === action.action_id
        || state.mission?.mission_id === action.action_id
    case 'ORBITAL_EVENT_RESOLVE':
      return state.orbital_events?.resolved?.some(item =>
        item.event_id === action.source_id && item.action_id === action.action_id) || false
    case 'CLEANUP_PAIR_SUBMIT':
      return state.cleanup_test?.matches?.some(item =>
        item.target_id === action.source_id && item.method_id === action.action_id) || false
    default:
      return false
  }
}
