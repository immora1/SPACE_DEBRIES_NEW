ALTER TABLE story_sessions
ADD COLUMN last_generation_id TEXT;

ALTER TABLE story_interactions
ADD COLUMN client_action_id TEXT;

ALTER TABLE story_interactions
ADD COLUMN idempotency_key TEXT;

ALTER TABLE story_interactions
ADD COLUMN state_before_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN state_delta_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN state_after_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN add_consequence_ids_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN resolve_consequence_ids_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN key_outcome TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_interaction_idempotency
ON story_interactions(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS story_generations (
  generation_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  story_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  client_action_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  expected_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'succeeded', 'failed')
  ),
  state_before_json TEXT NOT NULL,
  option_snapshot_json TEXT NOT NULL,
  result_version INTEGER,
  error_code TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(story_id, client_action_id),
  FOREIGN KEY(story_id) REFERENCES story_sessions(story_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_generation_single_pending
ON story_generations(story_id, expected_version)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_story_generation_story
ON story_generations(story_id, created_at_ms);
