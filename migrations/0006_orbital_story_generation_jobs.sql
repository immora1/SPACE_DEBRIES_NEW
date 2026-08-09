CREATE TABLE IF NOT EXISTS story_generation_jobs (
  job_id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  source_action_id TEXT NOT NULL,
  client_action_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  generation_stage TEXT NOT NULL CHECK (generation_stage IN ('CONTINUE', 'ENDING', 'KNOWLEDGE')),
  status TEXT NOT NULL CHECK (
    status IN ('QUEUED', 'PROCESSING', 'RETRYABLE', 'SUCCEEDED', 'FAILED')
  ),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 7),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  config_snapshot_json TEXT NOT NULL,
  metrics_json TEXT,
  created_at_ms INTEGER NOT NULL,
  started_at_ms INTEGER,
  completed_at_ms INTEGER,
  last_error_code TEXT,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(story_id, question_id),
  UNIQUE(story_id, sequence),
  UNIQUE(story_id, client_action_id),
  FOREIGN KEY(story_id) REFERENCES story_sessions(story_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_generation_jobs_queue
ON story_generation_jobs(story_id, sequence, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_generation_jobs_processing
ON story_generation_jobs(story_id)
WHERE status = 'PROCESSING';
