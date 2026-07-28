import { StoryError } from './constants.js'

const JSON_FIELDS = [
  'user_input',
  'story_outline',
  'story_state',
  'game_state',
  'final_story',
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function json(value) {
  return value === null || value === undefined ? null : JSON.stringify(value)
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  return JSON.parse(value)
}

function rowToStory(row) {
  if (!row) return null
  const story = { ...row }
  for (const field of JSON_FIELDS) {
    story[field] = parseJson(row[`${field}_json`], field === 'final_story' ? null : {})
    delete story[`${field}_json`]
  }
  return story
}

function rowToStage(row) {
  return {
    ...row,
    input_action: parseJson(row.input_action_json, null),
    display_content: parseJson(row.display_content_json, {}),
    state_before: parseJson(row.state_before_json, {}),
    state_after: parseJson(row.state_after_json, {}),
    input_action_json: undefined,
    display_content_json: undefined,
    state_before_json: undefined,
    state_after_json: undefined,
  }
}

function insertStageStatement(db, stage, conditionalVersion = null) {
  const values = [
    stage.stage_id,
    stage.story_id,
    stage.stage_index,
    stage.task_type,
    stage.node_id,
    stage.checkpoint,
    json(stage.input_action),
    json(stage.display_content),
    stage.stage_summary,
    json(stage.state_before),
    json(stage.state_after),
    stage.created_at_ms,
  ]

  if (conditionalVersion === null) {
    return db.prepare(`
      INSERT INTO story_stages (
        stage_id, story_id, stage_index, task_type, node_id, checkpoint,
        input_action_json, display_content_json, stage_summary,
        state_before_json, state_after_json, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(...values)
  }

  return db.prepare(`
    INSERT INTO story_stages (
      stage_id, story_id, stage_index, task_type, node_id, checkpoint,
      input_action_json, display_content_json, stage_summary,
      state_before_json, state_after_json, created_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM story_sessions
    WHERE story_id = ?
      AND version = ?
      AND status = 'in_progress'
  `).bind(...values, stage.story_id, conditionalVersion)
}

function insertInteractionStatement(db, interaction, conditionalVersion) {
  return db.prepare(`
    INSERT INTO story_interactions (
      interaction_id, story_id, module, source_id, action_id, label,
      technical_effect_json, narrative_effect_json, created_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM story_sessions
    WHERE story_id = ?
      AND version = ?
      AND status = 'in_progress'
  `).bind(
    interaction.interaction_id,
    interaction.story_id,
    interaction.module,
    interaction.source_id,
    interaction.action_id,
    interaction.label,
    json(interaction.technical_effect),
    json(interaction.narrative_effect),
    interaction.created_at_ms,
    interaction.story_id,
    conditionalVersion,
  )
}

function updateStoryStatement(db, story, expectedVersion) {
  return db.prepare(`
    UPDATE story_sessions
    SET version = ?,
        status = ?,
        current_stage_index = ?,
        current_node_id = ?,
        current_checkpoint = ?,
        story_outline_json = ?,
        story_state_json = ?,
        game_state_json = ?,
        final_story_json = ?,
        last_activity_at_ms = ?,
        expires_at_ms = ?,
        completed_at_ms = ?
    WHERE story_id = ?
      AND version = ?
      AND status = 'in_progress'
  `).bind(
    story.version,
    story.status,
    story.current_stage_index,
    story.current_node_id,
    story.current_checkpoint,
    json(story.story_outline),
    json(story.story_state),
    json(story.game_state),
    json(story.final_story),
    story.last_activity_at_ms,
    story.expires_at_ms,
    story.completed_at_ms,
    story.story_id,
    expectedVersion,
  )
}

function changeCount(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0)
}

export class D1StoryRepository {
  constructor(db) {
    if (!db) throw new StoryError('STORY_DB_NOT_CONFIGURED', 'STORY_DB binding is not configured.', 503)
    this.db = db
  }

  async cleanupExpiredStories(now) {
    const result = await this.db.prepare(`
      DELETE FROM story_sessions
      WHERE status != 'completed'
        AND expires_at_ms IS NOT NULL
        AND expires_at_ms <= ?
    `).bind(now).run()
    return changeCount(result)
  }

  async createStory(story, stages) {
    const sessionStatement = this.db.prepare(`
      INSERT INTO story_sessions (
        story_id, session_id, display_label, version, status,
        current_stage_index, current_node_id, current_checkpoint,
        user_input_json, story_outline_json, story_state_json, game_state_json,
        final_story_json, created_at_ms, last_activity_at_ms, expires_at_ms, completed_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      story.story_id,
      story.session_id,
      story.display_label,
      story.version,
      story.status,
      story.current_stage_index,
      story.current_node_id,
      story.current_checkpoint,
      json(story.user_input),
      json(story.story_outline),
      json(story.story_state),
      json(story.game_state),
      json(story.final_story),
      story.created_at_ms,
      story.last_activity_at_ms,
      story.expires_at_ms,
      story.completed_at_ms,
    )

    await this.db.batch([
      sessionStatement,
      ...stages.map((stage) => insertStageStatement(this.db, stage)),
    ])
  }

  async getStory(storyId, sessionId) {
    const row = await this.db.prepare(`
      SELECT * FROM story_sessions
      WHERE story_id = ? AND session_id = ?
      LIMIT 1
    `).bind(storyId, sessionId).first()
    return rowToStory(row)
  }

  async getStages(storyId) {
    const result = await this.db.prepare(`
      SELECT * FROM story_stages
      WHERE story_id = ?
      ORDER BY stage_index ASC
    `).bind(storyId).all()
    return (result?.results || []).map(rowToStage)
  }

  async commitAdvance({ story, expectedVersion, interaction, stages }) {
    const statements = [
      insertInteractionStatement(this.db, interaction, expectedVersion),
      ...stages.map((stage) => insertStageStatement(this.db, stage, expectedVersion)),
      updateStoryStatement(this.db, story, expectedVersion),
    ]

    const results = await this.db.batch(statements)
    if (changeCount(results.at(-1)) === 0) {
      throw new StoryError('VERSION_CONFLICT', 'The story was updated by another request.', 409)
    }
  }
}

export class MemoryStoryRepository {
  constructor() {
    this.stories = new Map()
    this.stages = new Map()
    this.interactions = new Map()
  }

  async cleanupExpiredStories(now) {
    let removed = 0
    for (const [storyId, story] of this.stories) {
      if (story.status === 'completed' || story.expires_at_ms === null || story.expires_at_ms > now) continue
      this.stories.delete(storyId)
      this.stages.delete(storyId)
      this.interactions.delete(storyId)
      removed += 1
    }
    return removed
  }

  async createStory(story, stages) {
    if (this.stories.has(story.story_id)) throw new StoryError('STORY_EXISTS', 'Story already exists.', 409)
    this.stories.set(story.story_id, clone(story))
    this.stages.set(story.story_id, clone(stages))
    this.interactions.set(story.story_id, [])
  }

  async getStory(storyId, sessionId) {
    const story = this.stories.get(storyId)
    if (!story || story.session_id !== sessionId) return null
    return clone(story)
  }

  async getStages(storyId) {
    return clone(this.stages.get(storyId) || [])
  }

  async commitAdvance({ story, expectedVersion, interaction, stages }) {
    const current = this.stories.get(story.story_id)
    if (!current || current.version !== expectedVersion || current.status !== 'in_progress') {
      throw new StoryError('VERSION_CONFLICT', 'The story was updated by another request.', 409)
    }
    this.interactions.set(story.story_id, [
      ...(this.interactions.get(story.story_id) || []),
      clone(interaction),
    ])
    this.stages.set(story.story_id, [
      ...(this.stages.get(story.story_id) || []),
      ...clone(stages),
    ])
    this.stories.set(story.story_id, clone(story))
  }

  async getInteractions(storyId) {
    return clone(this.interactions.get(storyId) || [])
  }
}

export function createStoryRepository(env) {
  return new D1StoryRepository(env?.STORY_DB)
}
