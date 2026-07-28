export function buildStageContract({
  story,
  taskType,
  action,
  fixedEffect,
  nextCheckpoint,
}) {
  return {
    task_type: taskType,
    story_id: story.story_id,
    language: story.language || 'zh',
    current_checkpoint: story.current_checkpoint,
    next_checkpoint: nextCheckpoint,
    user_input: story.user_input,
    story_outline: story.story_outline,
    story_state: story.story_state,
    game_state: story.game_state,
    user_action: action,
    fixed_effect: fixedEffect,
  }
}
