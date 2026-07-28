import { TASK_TYPE } from './constants.js'

function publicStage(stage) {
  if (!stage) return null
  return {
    stage_id: stage.stage_id,
    stage_index: stage.stage_index,
    task_type: stage.task_type,
    node_id: stage.node_id,
    checkpoint: stage.checkpoint,
    display_content: stage.display_content,
    stage_summary: stage.stage_summary,
    input_action: stage.input_action || null,
    created_at_ms: stage.created_at_ms,
  }
}

function publicGameState(gameState) {
  return {
    satellite_build: gameState.satellite_build,
    mission: gameState.mission,
    orbital_events: gameState.orbital_events,
    cleanup_test: gameState.cleanup_test,
    technical_metrics: gameState.technical_metrics,
  }
}

export function toPublicStoryDTO(story, stages = []) {
  const timeline = stages
    .map(publicStage)
    .filter((stage) => stage?.display_content?.story_text)
    .sort((a, b) => a.stage_index - b.stage_index)
  const currentStage = timeline.at(-1) || null
  const ending = timeline.findLast?.((stage) => stage.task_type === TASK_TYPE.ENDING)
    || [...timeline].reverse().find((stage) => stage.task_type === TASK_TYPE.ENDING)
  const reveal = timeline.findLast?.((stage) => stage.task_type === TASK_TYPE.KNOWLEDGE_REVEAL)
    || [...timeline].reverse().find((stage) => stage.task_type === TASK_TYPE.KNOWLEDGE_REVEAL)

  return {
    story_id: story.story_id,
    version: story.version,
    status: story.status,
    current_stage_index: story.current_stage_index,
    current_checkpoint: story.current_checkpoint,
    public_game_state: publicGameState(story.game_state),
    current_stage: currentStage,
    timeline,
    final_story_if_completed: story.status === 'completed'
      ? {
          ending: ending?.display_content || null,
          knowledge_reveal: reveal?.display_content || null,
        }
      : null,
  }
}
