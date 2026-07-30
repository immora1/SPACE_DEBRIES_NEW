import { StoryError } from './constants.js'

const JSON_FIELDS = [
  'user_input',
  'story_outline',
  'story_state',
  'game_state',
  'prompt_metadata',
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
    known_to_user_additions: parseJson(row.known_to_user_additions_json, []),
    continuity_handoff: parseJson(row.continuity_handoff_json, null),
    model_metadata: parseJson(row.model_metadata_json, null),
    state_before: parseJson(row.state_before_json, {}),
    state_after: parseJson(row.state_after_json, {}),
    input_action_json: undefined,
    display_content_json: undefined,
    known_to_user_additions_json: undefined,
    continuity_handoff_json: undefined,
    model_metadata_json: undefined,
    state_before_json: undefined,
    state_after_json: undefined,
  }
}

function rowToGeneration(row) {
  if (!row) return null
  return {
    ...row,
    state_before: parseJson(row.state_before_json, {}),
    option_snapshot: parseJson(row.option_snapshot_json, {}),
    validated_ending_output: parseJson(row.validated_ending_output_json, null),
    state_before_json: undefined,
    option_snapshot_json: undefined,
    validated_ending_output_json: undefined,
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
    stage.story_text,
    json(stage.known_to_user_additions),
    json(stage.continuity_handoff),
    json(stage.model_metadata),
    stage.stage_summary,
    json(stage.state_before),
    json(stage.state_after),
    stage.created_at_ms,
  ]

  if (conditionalVersion === null) {
    return db.prepare(`
      INSERT INTO story_stages (
        stage_id, story_id, stage_index, task_type, node_id, checkpoint,
        input_action_json, display_content_json, story_text,
        known_to_user_additions_json, continuity_handoff_json, model_metadata_json, stage_summary,
        state_before_json, state_after_json, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(...values)
  }

  return db.prepare(`
    INSERT INTO story_stages (
      stage_id, story_id, stage_index, task_type, node_id, checkpoint,
      input_action_json, display_content_json, story_text,
      known_to_user_additions_json, continuity_handoff_json, model_metadata_json, stage_summary,
      state_before_json, state_after_json, created_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      technical_effect_json, narrative_effect_json,
      client_action_id, idempotency_key,
      state_before_json, state_delta_json, state_after_json,
      add_consequence_ids_json, resolve_consequence_ids_json, key_outcome,
      created_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
    interaction.client_action_id || null,
    interaction.idempotency_key || null,
    json(interaction.state_before),
    json(interaction.state_delta),
    json(interaction.state_after),
    json(interaction.add_consequence_ids || []),
    json(interaction.resolve_consequence_ids || []),
    interaction.key_outcome || '',
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
        story_state_json = ?,
        game_state_json = ?,
        final_story_json = ?,
        last_generation_id = ?,
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
    json(story.story_state),
    json(story.game_state),
    json(story.final_story),
    story.last_generation_id || null,
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
        story_id, session_id, request_fingerprint, display_label, version, status,
        current_stage_index, current_node_id, current_checkpoint,
        user_input_json, story_outline_json, story_state_json, game_state_json,
        prompt_metadata_json, final_story_json, last_generation_id,
        created_at_ms, last_activity_at_ms, expires_at_ms, completed_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      story.story_id,
      story.session_id,
      story.request_fingerprint,
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
      json(story.prompt_metadata),
      json(story.final_story),
      story.last_generation_id || null,
      story.created_at_ms,
      story.last_activity_at_ms,
      story.expires_at_ms,
      story.completed_at_ms,
    )

    try {
      await this.db.batch([
        sessionStatement,
        ...stages.map((stage) => insertStageStatement(this.db, stage)),
      ])
    } catch (error) {
      if (/unique constraint failed:\s*story_sessions\.(?:story_id|session_id)/i.test(
        String(error?.message || ''),
      )) {
        throw new StoryError('STORY_EXISTS', 'Story already exists.', 409)
      }
      throw new StoryError('PERSISTENCE_FAILED', 'Story persistence failed.', 500)
    }
  }

  async getStoryBySessionId(sessionId) {
    if (!sessionId) return null
    const row = await this.db.prepare(`
      SELECT * FROM story_sessions
      WHERE session_id = ?
      LIMIT 1
    `).bind(sessionId).first()
    return rowToStory(row)
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

  async getGenerationByIdempotencyKey(idempotencyKey) {
    const row = await this.db.prepare(`
      SELECT * FROM story_generations
      WHERE idempotency_key = ?
      LIMIT 1
    `).bind(idempotencyKey).first()
    return rowToGeneration(row)
  }

  async getGenerationByClientAction(storyId, clientActionId) {
    const row = await this.db.prepare(`
      SELECT * FROM story_generations
      WHERE story_id = ? AND client_action_id = ?
      LIMIT 1
    `).bind(storyId, clientActionId).first()
    return rowToGeneration(row)
  }

  async beginGeneration(generation) {
    const existingByAction = await this.getGenerationByClientAction(
      generation.story_id,
      generation.client_action_id,
    )
    if (existingByAction) {
      if (existingByAction.request_fingerprint !== generation.request_fingerprint) {
        throw new StoryError(
          'CLIENT_ACTION_ID_REUSED',
          'client_action_id was already used for a different story choice.',
          409,
        )
      }
      if (existingByAction.status !== 'failed') {
        return {
          state: existingByAction.status,
          generation: existingByAction,
        }
      }
      try {
        const retry = await this.db.prepare(`
          UPDATE story_generations
          SET status = 'pending',
              error_code = NULL,
              updated_at_ms = ?
          WHERE generation_id = ?
            AND status = 'failed'
            AND EXISTS (
              SELECT 1 FROM story_sessions
              WHERE story_id = ?
                AND version = ?
                AND current_node_id = ?
                AND status = 'in_progress'
            )
        `).bind(
          generation.updated_at_ms,
          existingByAction.generation_id,
          generation.story_id,
          generation.expected_version,
          generation.node_id,
        ).run()
        if (changeCount(retry) === 1) {
          return {
            state: 'started',
            generation: {
              ...existingByAction,
              status: 'pending',
              error_code: null,
              updated_at_ms: generation.updated_at_ms,
            },
          }
        }
      } catch (error) {
        if (!/unique constraint failed/i.test(String(error?.message || ''))) throw error
      }
      throw new StoryError(
        'VERSION_CONFLICT',
        'The story changed before this failed choice could be retried.',
        409,
      )
    }

    try {
      const result = await this.db.prepare(`
        INSERT INTO story_generations (
          generation_id, idempotency_key, story_id, node_id, option_id,
          client_action_id, request_fingerprint, expected_version, status,
          state_before_json, option_snapshot_json,
          result_version, error_code, created_at_ms, updated_at_ms
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, NULL, ?, ?
        FROM story_sessions
        WHERE story_id = ?
          AND version = ?
          AND current_node_id = ?
          AND status = 'in_progress'
      `).bind(
        generation.generation_id,
        generation.idempotency_key,
        generation.story_id,
        generation.node_id,
        generation.option_id,
        generation.client_action_id,
        generation.request_fingerprint,
        generation.expected_version,
        json(generation.state_before),
        json(generation.option_snapshot),
        generation.created_at_ms,
        generation.updated_at_ms,
        generation.story_id,
        generation.expected_version,
        generation.node_id,
      ).run()
      if (changeCount(result) === 1) {
        return {
          state: 'started',
          generation: clone(generation),
        }
      }
    } catch (error) {
      if (!/unique constraint failed/i.test(String(error?.message || ''))) {
        throw new StoryError(
          'PERSISTENCE_FAILED',
          'Could not create the story generation record.',
          500,
        )
      }
      const existing = await this.getGenerationByIdempotencyKey(
        generation.idempotency_key,
      )
      if (existing) return { state: existing.status, generation: existing }
      throw new StoryError(
        'GENERATION_IN_PROGRESS',
        'Another choice is already being generated for this story version.',
        409,
      )
    }
    throw new StoryError(
      'VERSION_CONFLICT',
      'The story changed before generation could start.',
      409,
    )
  }

  async markGenerationFailed(generationId, errorCode, now) {
    await this.db.prepare(`
      UPDATE story_generations
      SET status = 'failed',
          error_code = ?,
          validated_ending_output_json = NULL,
          updated_at_ms = ?
      WHERE generation_id = ?
        AND status = 'pending'
    `).bind(errorCode, now, generationId).run()
  }

  async saveValidatedEnding(generationId, {
    storyId,
    expectedVersion,
    nodeId,
    output,
    now,
  }) {
    const result = await this.db.prepare(`
      UPDATE story_generations
      SET validated_ending_output_json = ?,
          updated_at_ms = ?
      WHERE generation_id = ?
        AND status = 'pending'
        AND EXISTS (
          SELECT 1 FROM story_sessions
          WHERE story_id = ?
            AND version = ?
            AND current_node_id = ?
            AND status = 'in_progress'
        )
    `).bind(
      json(output),
      now,
      generationId,
      storyId,
      expectedVersion,
      nodeId,
    ).run()
    if (changeCount(result) !== 1) {
      throw new StoryError(
        'ENDING_PENDING_SAVE_FAILED',
        'The validated ending could not be staged before Knowledge Reveal.',
        500,
      )
    }
    return clone(output)
  }

  async commitAdvance({
    story,
    expectedVersion,
    interaction,
    stages,
    generation = null,
  }) {
    const statements = [
      insertInteractionStatement(this.db, interaction, expectedVersion),
      ...stages.map((stage) => insertStageStatement(this.db, stage, expectedVersion)),
      updateStoryStatement(this.db, story, expectedVersion),
    ]
    if (generation) {
      statements.push(this.db.prepare(`
        UPDATE story_generations
        SET status = 'succeeded',
            result_version = ?,
            error_code = NULL,
            validated_ending_output_json = NULL,
            updated_at_ms = ?
        WHERE generation_id = ?
          AND status = 'pending'
          AND EXISTS (
            SELECT 1 FROM story_sessions
            WHERE story_id = ?
              AND version = ?
              AND last_generation_id = ?
          )
      `).bind(
        story.version,
        story.last_activity_at_ms,
        generation.generation_id,
        story.story_id,
        story.version,
        generation.generation_id,
      ))
    }

    const results = await this.db.batch(statements)
    const storyUpdateIndex = generation ? -2 : -1
    if (changeCount(results.at(storyUpdateIndex)) === 0) {
      throw new StoryError('VERSION_CONFLICT', 'The story was updated by another request.', 409)
    }
    if (generation && changeCount(results.at(-1)) === 0) {
      throw new StoryError(
        'GENERATION_COMMIT_FAILED',
        'The story generation could not be finalized.',
        500,
      )
    }
  }

  async getInteractions(storyId) {
    const result = await this.db.prepare(`
      SELECT * FROM story_interactions
      WHERE story_id = ?
      ORDER BY created_at_ms ASC
    `).bind(storyId).all()
    return (result?.results || []).map((row) => ({
      ...row,
      technical_effect: parseJson(row.technical_effect_json, null),
      narrative_effect: parseJson(row.narrative_effect_json, null),
      state_before: parseJson(row.state_before_json, null),
      state_delta: parseJson(row.state_delta_json, null),
      state_after: parseJson(row.state_after_json, null),
      add_consequence_ids: parseJson(row.add_consequence_ids_json, []),
      resolve_consequence_ids: parseJson(row.resolve_consequence_ids_json, []),
    }))
  }
}

export class MemoryStoryRepository {
  constructor() {
    this.stories = new Map()
    this.storyBySession = new Map()
    this.stages = new Map()
    this.interactions = new Map()
    this.generations = new Map()
    this.generationByIdempotency = new Map()
    this.generationByClientAction = new Map()
  }

  async cleanupExpiredStories(now) {
    let removed = 0
    for (const [storyId, story] of this.stories) {
      if (story.status === 'completed' || story.expires_at_ms === null || story.expires_at_ms > now) continue
      this.stories.delete(storyId)
      this.storyBySession.delete(story.session_id)
      this.stages.delete(storyId)
      this.interactions.delete(storyId)
      for (const [generationId, generation] of this.generations) {
        if (generation.story_id !== storyId) continue
        this.generations.delete(generationId)
        this.generationByIdempotency.delete(generation.idempotency_key)
        this.generationByClientAction.delete(
          `${generation.story_id}:${generation.client_action_id}`,
        )
      }
      removed += 1
    }
    return removed
  }

  async createStory(story, stages) {
    if (this.stories.has(story.story_id) || this.storyBySession.has(story.session_id)) {
      throw new StoryError('STORY_EXISTS', 'Story already exists.', 409)
    }
    const storySnapshot = clone(story)
    const stageSnapshots = clone(stages)
    this.stories.set(story.story_id, storySnapshot)
    this.storyBySession.set(story.session_id, story.story_id)
    this.stages.set(story.story_id, stageSnapshots)
    this.interactions.set(story.story_id, [])
  }

  async getStoryBySessionId(sessionId) {
    const storyId = this.storyBySession.get(sessionId)
    return storyId ? clone(this.stories.get(storyId)) : null
  }

  async getStory(storyId, sessionId) {
    const story = this.stories.get(storyId)
    if (!story || story.session_id !== sessionId) return null
    return clone(story)
  }

  async getStages(storyId) {
    return clone(this.stages.get(storyId) || [])
  }

  async getGenerationByIdempotencyKey(idempotencyKey) {
    const generationId = this.generationByIdempotency.get(idempotencyKey)
    return generationId ? clone(this.generations.get(generationId)) : null
  }

  async getGenerationByClientAction(storyId, clientActionId) {
    const generationId = this.generationByClientAction.get(
      `${storyId}:${clientActionId}`,
    )
    return generationId ? clone(this.generations.get(generationId)) : null
  }

  async beginGeneration(generation) {
    const actionKey = `${generation.story_id}:${generation.client_action_id}`
    const existingId = this.generationByClientAction.get(actionKey)
    if (existingId) {
      const existing = this.generations.get(existingId)
      if (existing.request_fingerprint !== generation.request_fingerprint) {
        throw new StoryError(
          'CLIENT_ACTION_ID_REUSED',
          'client_action_id was already used for a different story choice.',
          409,
        )
      }
      if (existing.status === 'failed') {
        const story = this.stories.get(generation.story_id)
        if (
          !story
          || story.version !== generation.expected_version
          || story.current_node_id !== generation.node_id
          || story.status !== 'in_progress'
        ) {
          throw new StoryError(
            'VERSION_CONFLICT',
            'The story changed before this failed choice could be retried.',
            409,
          )
        }
        const pendingConflict = [...this.generations.values()].some((item) => (
          item.generation_id !== existing.generation_id
          && item.story_id === generation.story_id
          && item.expected_version === generation.expected_version
          && item.status === 'pending'
        ))
        if (pendingConflict) {
          throw new StoryError(
            'GENERATION_IN_PROGRESS',
            'Another choice is already being generated for this story version.',
            409,
          )
        }
        existing.status = 'pending'
        existing.error_code = null
        existing.updated_at_ms = generation.updated_at_ms
        return { state: 'started', generation: clone(existing) }
      }
      return { state: existing.status, generation: clone(existing) }
    }

    const story = this.stories.get(generation.story_id)
    if (
      !story
      || story.version !== generation.expected_version
      || story.current_node_id !== generation.node_id
      || story.status !== 'in_progress'
    ) {
      throw new StoryError(
        'VERSION_CONFLICT',
        'The story changed before generation could start.',
        409,
      )
    }
    const pendingConflict = [...this.generations.values()].some((item) => (
      item.story_id === generation.story_id
      && item.expected_version === generation.expected_version
      && item.status === 'pending'
    ))
    if (pendingConflict) {
      throw new StoryError(
        'GENERATION_IN_PROGRESS',
        'Another choice is already being generated for this story version.',
        409,
      )
    }
    const snapshot = clone({ ...generation, status: 'pending' })
    this.generations.set(generation.generation_id, snapshot)
    this.generationByIdempotency.set(
      generation.idempotency_key,
      generation.generation_id,
    )
    this.generationByClientAction.set(actionKey, generation.generation_id)
    return { state: 'started', generation: clone(snapshot) }
  }

  async markGenerationFailed(generationId, errorCode, now) {
    const generation = this.generations.get(generationId)
    if (!generation || generation.status !== 'pending') return
    generation.status = 'failed'
    generation.error_code = errorCode
    generation.validated_ending_output = null
    generation.updated_at_ms = now
  }

  async saveValidatedEnding(generationId, {
    storyId,
    expectedVersion,
    nodeId,
    output,
    now,
  }) {
    const generation = this.generations.get(generationId)
    const story = this.stories.get(storyId)
    if (
      !generation
      || generation.status !== 'pending'
      || !story
      || story.version !== expectedVersion
      || story.current_node_id !== nodeId
      || story.status !== 'in_progress'
    ) {
      throw new StoryError(
        'ENDING_PENDING_SAVE_FAILED',
        'The validated ending could not be staged before Knowledge Reveal.',
        500,
      )
    }
    generation.validated_ending_output = clone(output)
    generation.updated_at_ms = now
    return clone(generation.validated_ending_output)
  }

  async commitAdvance({
    story,
    expectedVersion,
    interaction,
    stages,
    generation = null,
  }) {
    const current = this.stories.get(story.story_id)
    if (!current || current.version !== expectedVersion || current.status !== 'in_progress') {
      throw new StoryError('VERSION_CONFLICT', 'The story was updated by another request.', 409)
    }
    let generationSnapshot = null
    if (generation) {
      const currentGeneration = this.generations.get(generation.generation_id)
      if (
        !currentGeneration
        || currentGeneration.status !== 'pending'
        || currentGeneration.expected_version !== expectedVersion
      ) {
        throw new StoryError(
          'GENERATION_COMMIT_FAILED',
          'The story generation could not be finalized.',
          500,
        )
      }
      generationSnapshot = {
        ...clone(currentGeneration),
        status: 'succeeded',
        result_version: story.version,
        error_code: null,
        validated_ending_output: null,
        updated_at_ms: story.last_activity_at_ms,
      }
    }
    const interactionSnapshot = clone(interaction)
    const stageSnapshots = clone(stages)
    const storySnapshot = {
      ...clone(story),
      story_outline: clone(current.story_outline),
    }
    this.interactions.set(story.story_id, [
      ...(this.interactions.get(story.story_id) || []),
      interactionSnapshot,
    ])
    this.stages.set(story.story_id, [
      ...(this.stages.get(story.story_id) || []),
      ...stageSnapshots,
    ])
    this.stories.set(story.story_id, storySnapshot)
    if (generationSnapshot) {
      this.generations.set(generationSnapshot.generation_id, generationSnapshot)
    }
  }

  async getInteractions(storyId) {
    return clone(this.interactions.get(storyId) || [])
  }
}

export function createStoryRepository(env) {
  return new D1StoryRepository(env?.STORY_DB)
}
