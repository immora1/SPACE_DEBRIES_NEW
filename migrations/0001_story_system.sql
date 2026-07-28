PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS story_sessions (
  story_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  display_label TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (
    status IN ('creating', 'in_progress', 'completed', 'failed')
  ),
  current_stage_index INTEGER NOT NULL DEFAULT 0,
  current_node_id TEXT,
  current_checkpoint TEXT,
  user_input_json TEXT NOT NULL,
  story_outline_json TEXT,
  story_state_json TEXT NOT NULL,
  game_state_json TEXT NOT NULL,
  final_story_json TEXT,
  created_at_ms INTEGER NOT NULL,
  last_activity_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER,
  completed_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_story_expiry
ON story_sessions(status, expires_at_ms);

CREATE TABLE IF NOT EXISTS story_stages (
  stage_id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  stage_index INTEGER NOT NULL,
  task_type TEXT NOT NULL,
  node_id TEXT,
  checkpoint TEXT,
  input_action_json TEXT,
  display_content_json TEXT NOT NULL,
  stage_summary TEXT NOT NULL,
  state_before_json TEXT NOT NULL,
  state_after_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(story_id, stage_index),
  FOREIGN KEY(story_id) REFERENCES story_sessions(story_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_stages_story
ON story_stages(story_id, stage_index);

CREATE TABLE IF NOT EXISTS story_interactions (
  interaction_id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  module TEXT NOT NULL,
  source_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  label TEXT NOT NULL,
  technical_effect_json TEXT,
  narrative_effect_json TEXT,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY(story_id) REFERENCES story_sessions(story_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_interactions_story
ON story_interactions(story_id, created_at_ms);
