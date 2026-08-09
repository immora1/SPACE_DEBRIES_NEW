ALTER TABLE story_interactions
ADD COLUMN site_interactions_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN item_deltas_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN combined_delta_json TEXT;

ALTER TABLE story_interactions
ADD COLUMN site_outcomes_json TEXT;

CREATE INDEX IF NOT EXISTS idx_story_interactions_module_node
ON story_interactions(story_id, module, source_id, created_at_ms);
