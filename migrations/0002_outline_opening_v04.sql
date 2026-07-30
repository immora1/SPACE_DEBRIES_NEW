ALTER TABLE story_sessions
ADD COLUMN request_fingerprint TEXT;

ALTER TABLE story_sessions
ADD COLUMN prompt_metadata_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_session_idempotency
ON story_sessions(session_id);

ALTER TABLE story_stages
ADD COLUMN story_text TEXT;

ALTER TABLE story_stages
ADD COLUMN known_to_user_additions_json TEXT;

ALTER TABLE story_stages
ADD COLUMN continuity_handoff_json TEXT;

ALTER TABLE story_stages
ADD COLUMN model_metadata_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_single_opening_stage
ON story_stages(story_id, node_id)
WHERE node_id = 'node_01';
