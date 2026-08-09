CREATE TABLE IF NOT EXISTS story_cleanup_match_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  completion_id TEXT NOT NULL,
  cleanup_target_id TEXT NOT NULL,
  cleanup_method_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(story_id, cleanup_target_id),
  UNIQUE(story_id, completion_id, cleanup_target_id),
  FOREIGN KEY(story_id) REFERENCES story_sessions(story_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_cleanup_snapshots_story
ON story_cleanup_match_snapshots(story_id, created_at_ms);

CREATE INDEX IF NOT EXISTS idx_story_cleanup_snapshots_completion
ON story_cleanup_match_snapshots(story_id, completion_id);
