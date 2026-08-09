ALTER TABLE story_sessions
ADD COLUMN interaction_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE story_sessions
ADD COLUMN artifact_generation_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE story_sessions
ADD COLUMN last_confirmed_node TEXT;

ALTER TABLE story_sessions
ADD COLUMN last_ready_artifact TEXT;

ALTER TABLE story_sessions
ADD COLUMN last_revealed_artifact TEXT;

CREATE TABLE IF NOT EXISTS story_artifacts (
  artifact_id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 0 AND 11),
  generated_from_node_id TEXT,
  generated_from_action_id TEXT,
  generation_status TEXT NOT NULL CHECK (
    generation_status IN (
      'NOT_STARTED', 'QUEUED', 'WAITING_PREREQUISITE',
      'PROCESSING', 'READY', 'FAILED'
    )
  ),
  reveal_status TEXT NOT NULL CHECK (reveal_status IN ('HIDDEN', 'REVEALED')),
  payload_json TEXT,
  known_to_user_additions_json TEXT,
  continuity_handoff_json TEXT,
  model_metadata_json TEXT,
  state_before_json TEXT,
  state_after_json TEXT,
  reveal_requested_at_ms INTEGER,
  revealed_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(story_id, artifact_type),
  UNIQUE(story_id, sequence),
  FOREIGN KEY(story_id) REFERENCES story_sessions(story_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_artifacts_progress
ON story_artifacts(story_id, sequence, generation_status, reveal_status);

CREATE TABLE IF NOT EXISTS story_artifact_jobs (
  job_id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  generated_from_node_id TEXT,
  source_action_id TEXT,
  prerequisite_artifact TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('QUEUED', 'WAITING_PREREQUISITE', 'PROCESSING', 'READY', 'FAILED')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 2),
  snapshot_json TEXT NOT NULL,
  metrics_json TEXT,
  created_at_ms INTEGER NOT NULL,
  started_at_ms INTEGER,
  completed_at_ms INTEGER,
  last_error_code TEXT,
  last_error_detail TEXT,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(story_id, artifact_type),
  UNIQUE(artifact_id),
  FOREIGN KEY(story_id) REFERENCES story_sessions(story_id) ON DELETE CASCADE,
  FOREIGN KEY(artifact_id) REFERENCES story_artifacts(artifact_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_artifact_jobs_queue
ON story_artifact_jobs(story_id, status, created_at_ms);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_artifact_jobs_processing
ON story_artifact_jobs(story_id)
WHERE status = 'PROCESSING';
