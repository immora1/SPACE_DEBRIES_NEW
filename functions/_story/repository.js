import { STORY_JOB_LEASE_MS, StoryError } from './constants.js'

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

function rowToStoryJob(row) {
  if (!row) return null
  return {
    ...row,
    config_snapshot: parseJson(row.config_snapshot_json, {}),
    metrics: parseJson(row.metrics_json, null),
    config_snapshot_json: undefined,
    metrics_json: undefined,
  }
}

function rowToArtifact(row) {
  if (!row) return null
  return {
    ...row,
    payload: parseJson(row.payload_json, null),
    known_to_user_additions: parseJson(row.known_to_user_additions_json, []),
    continuity_handoff: parseJson(row.continuity_handoff_json, null),
    model_metadata: parseJson(row.model_metadata_json, null),
    state_before: parseJson(row.state_before_json, null),
    state_after: parseJson(row.state_after_json, null),
    payload_json: undefined,
    known_to_user_additions_json: undefined,
    continuity_handoff_json: undefined,
    model_metadata_json: undefined,
    state_before_json: undefined,
    state_after_json: undefined,
  }
}

function rowToArtifactJob(row) {
  if (!row) return null
  return {
    ...row,
    snapshot: parseJson(row.snapshot_json, {}),
    metrics: parseJson(row.metrics_json, null),
    snapshot_json: undefined,
    metrics_json: undefined,
  }
}

function rowToInteraction(row) {
  if (!row) return null
  return {
    ...row,
    technical_effect: parseJson(row.technical_effect_json, null),
    narrative_effect: parseJson(row.narrative_effect_json, null),
    state_before: parseJson(row.state_before_json, null),
    state_delta: parseJson(row.state_delta_json, null),
    state_after: parseJson(row.state_after_json, null),
    add_consequence_ids: parseJson(row.add_consequence_ids_json, []),
    resolve_consequence_ids: parseJson(row.resolve_consequence_ids_json, []),
    site_interactions: parseJson(row.site_interactions_json, []),
    item_deltas: parseJson(row.item_deltas_json, []),
    combined_delta: parseJson(row.combined_delta_json, null),
    site_outcomes: parseJson(row.site_outcomes_json, []),
  }
}

function insertCleanupSnapshotStatement(db, snapshot, conditionalVersion) {
  return db.prepare(`
    INSERT INTO story_cleanup_match_snapshots (
      snapshot_id, story_id, completion_id, cleanup_target_id,
      cleanup_method_id, snapshot_json, created_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?
    FROM story_sessions
    WHERE story_id = ? AND version = ? AND status = 'in_progress'
  `).bind(
    snapshot.snapshot_id,
    snapshot.story_id,
    snapshot.completion_id,
    snapshot.cleanup_target_id,
    snapshot.cleanup_method_id,
    json(snapshot),
    Date.parse(snapshot.confirmed_at),
    snapshot.story_id,
    conditionalVersion,
  )
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
      site_interactions_json, item_deltas_json, combined_delta_json,
      site_outcomes_json,
      created_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
    json(interaction.site_interactions || []),
    json(interaction.item_deltas || []),
    json(interaction.combined_delta),
    json(interaction.site_outcomes || []),
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
        ,interaction_version = ?
        ,artifact_generation_version = ?
        ,last_confirmed_node = ?
        ,last_ready_artifact = ?
        ,last_revealed_artifact = ?
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
    story.interaction_version ?? story.version,
    story.artifact_generation_version ?? 0,
    story.last_confirmed_node || null,
    story.last_ready_artifact || null,
    story.last_revealed_artifact || null,
    story.story_id,
    expectedVersion,
  )
}

function insertArtifactStatement(db, artifact, conditionalVersion = null) {
  const values = [
    artifact.artifact_id,
    artifact.story_id,
    artifact.artifact_type,
    artifact.sequence,
    artifact.generated_from_node_id || null,
    artifact.generated_from_action_id || null,
    artifact.generation_status,
    artifact.reveal_status,
    json(artifact.payload),
    json(artifact.known_to_user_additions || []),
    json(artifact.continuity_handoff),
    json(artifact.model_metadata),
    json(artifact.state_before),
    json(artifact.state_after),
    artifact.reveal_requested_at_ms || null,
    artifact.revealed_at_ms || null,
    artifact.created_at_ms,
    artifact.completed_at_ms || null,
    artifact.updated_at_ms,
  ]
  if (conditionalVersion === null) {
    return db.prepare(`
      INSERT INTO story_artifacts (
        artifact_id, story_id, artifact_type, sequence,
        generated_from_node_id, generated_from_action_id,
        generation_status, reveal_status, payload_json,
        known_to_user_additions_json, continuity_handoff_json, model_metadata_json,
        state_before_json, state_after_json, reveal_requested_at_ms, revealed_at_ms,
        created_at_ms, completed_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(...values)
  }
  return db.prepare(`
    INSERT INTO story_artifacts (
      artifact_id, story_id, artifact_type, sequence,
      generated_from_node_id, generated_from_action_id,
      generation_status, reveal_status, payload_json,
      known_to_user_additions_json, continuity_handoff_json, model_metadata_json,
      state_before_json, state_after_json, reveal_requested_at_ms, revealed_at_ms,
      created_at_ms, completed_at_ms, updated_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM story_sessions
    WHERE story_id = ? AND version = ? AND status = 'in_progress'
  `).bind(...values, artifact.story_id, conditionalVersion)
}

function insertArtifactJobStatement(db, job, conditionalVersion = null) {
  const values = [
    job.job_id,
    job.story_id,
    job.artifact_id,
    job.artifact_type,
    job.generated_from_node_id || null,
    job.source_action_id || null,
    job.prerequisite_artifact || null,
    job.status,
    job.attempt_count || 0,
    json(job.snapshot),
    json(job.metrics),
    job.created_at_ms,
    job.started_at_ms || null,
    job.completed_at_ms || null,
    job.last_error_code || null,
    job.last_error_detail || null,
    job.updated_at_ms,
  ]
  if (conditionalVersion === null) {
    return db.prepare(`
      INSERT INTO story_artifact_jobs (
        job_id, story_id, artifact_id, artifact_type,
        generated_from_node_id, source_action_id, prerequisite_artifact,
        status, attempt_count, snapshot_json, metrics_json,
        created_at_ms, started_at_ms, completed_at_ms, last_error_code,
        last_error_detail, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(...values)
  }
  return db.prepare(`
    INSERT INTO story_artifact_jobs (
      job_id, story_id, artifact_id, artifact_type,
      generated_from_node_id, source_action_id, prerequisite_artifact,
      status, attempt_count, snapshot_json, metrics_json,
      created_at_ms, started_at_ms, completed_at_ms, last_error_code,
      last_error_detail, updated_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM story_sessions
    WHERE story_id = ? AND version = ? AND status = 'in_progress'
  `).bind(...values, job.story_id, conditionalVersion)
}

function insertQueuedStoryJobStatement(db, job, conditionalVersion) {
  return db.prepare(`
    INSERT INTO story_generation_jobs (
      job_id, story_id, source_action_id, client_action_id,
      request_fingerprint, question_id, answer_id, target_node_id,
      generation_stage, status, sequence, attempt_count,
      config_snapshot_json, metrics_json, created_at_ms, started_at_ms,
      completed_at_ms, last_error_code, updated_at_ms
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, 0, ?, ?, ?, NULL, NULL, NULL, ?
    FROM story_sessions
    WHERE story_id = ? AND version = ? AND status = 'in_progress'
  `).bind(
    job.job_id,
    job.story_id,
    job.source_action_id,
    job.client_action_id,
    job.request_fingerprint,
    job.question_id,
    job.answer_id,
    job.target_node_id,
    job.generation_stage,
    job.sequence,
    json(job.config_snapshot),
    json(job.metrics),
    job.created_at_ms,
    job.updated_at_ms,
    job.story_id,
    conditionalVersion,
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

  async createStory(story, stages, artifacts = [], artifactJobs = []) {
    const sessionStatement = this.db.prepare(`
      INSERT INTO story_sessions (
        story_id, session_id, request_fingerprint, display_label, version, status,
        current_stage_index, current_node_id, current_checkpoint,
        user_input_json, story_outline_json, story_state_json, game_state_json,
        prompt_metadata_json, final_story_json, last_generation_id,
        created_at_ms, last_activity_at_ms, expires_at_ms, completed_at_ms,
        interaction_version, artifact_generation_version,
        last_confirmed_node, last_ready_artifact, last_revealed_artifact
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      story.interaction_version ?? story.version,
      story.artifact_generation_version ?? 0,
      story.last_confirmed_node || null,
      story.last_ready_artifact || null,
      story.last_revealed_artifact || null,
    )

    try {
      await this.db.batch([
        sessionStatement,
        ...stages.map((stage) => insertStageStatement(this.db, stage)),
        ...artifacts.map((artifact) => insertArtifactStatement(this.db, artifact)),
        ...artifactJobs.map((job) => insertArtifactJobStatement(this.db, job)),
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

  async getStoryJobs(storyId) {
    const result = await this.db.prepare(`
      SELECT * FROM story_generation_jobs
      WHERE story_id = ?
      ORDER BY sequence ASC
    `).bind(storyId).all()
    return (result?.results || []).map(rowToStoryJob)
  }

  async getArtifacts(storyId) {
    const result = await this.db.prepare(`
      SELECT * FROM story_artifacts
      WHERE story_id = ?
      ORDER BY sequence ASC
    `).bind(storyId).all()
    return (result?.results || []).map(rowToArtifact)
  }

  async getArtifact(storyId, artifactType) {
    const row = await this.db.prepare(`
      SELECT * FROM story_artifacts
      WHERE story_id = ? AND artifact_type = ?
      LIMIT 1
    `).bind(storyId, artifactType).first()
    return rowToArtifact(row)
  }

  async getArtifactJobs(storyId) {
    const result = await this.db.prepare(`
      SELECT * FROM story_artifact_jobs
      WHERE story_id = ?
      ORDER BY created_at_ms ASC
    `).bind(storyId).all()
    return (result?.results || []).map(rowToArtifactJob)
  }

  async getArtifactJobBySourceAction(storyId, sourceActionId) {
    const row = await this.db.prepare(`
      SELECT * FROM story_artifact_jobs
      WHERE story_id = ? AND source_action_id = ?
      LIMIT 1
    `).bind(storyId, sourceActionId).first()
    return rowToArtifactJob(row)
  }

  async commitLookaheadInteraction({
    story,
    expectedVersion,
    interaction,
    artifact,
    artifactJob,
    revealArtifactType,
    revealRequestedAt,
    cleanupSnapshots = [],
  }) {
    const statements = []
    if (interaction) {
      statements.push(insertInteractionStatement(this.db, interaction, expectedVersion))
    }
    statements.push(...cleanupSnapshots.map((snapshot) => (
      insertCleanupSnapshotStatement(this.db, snapshot, expectedVersion)
    )))
    if (artifact) statements.push(insertArtifactStatement(this.db, artifact, expectedVersion))
    if (artifactJob) statements.push(insertArtifactJobStatement(this.db, artifactJob, expectedVersion))
    const revealIndex = revealArtifactType ? statements.length : -1
    if (revealArtifactType) statements.push(this.db.prepare(`
      UPDATE story_artifacts
      SET reveal_status = 'REVEALED',
          reveal_requested_at_ms = COALESCE(reveal_requested_at_ms, ?),
          revealed_at_ms = CASE
            WHEN generation_status = 'READY' THEN COALESCE(revealed_at_ms, ?)
            ELSE revealed_at_ms
          END,
          updated_at_ms = ?
      WHERE story_id = ? AND artifact_type = ? AND reveal_status = 'HIDDEN'
        AND EXISTS (
          SELECT 1 FROM story_sessions
          WHERE story_id = ? AND version = ? AND status = 'in_progress'
        )
    `).bind(
      revealRequestedAt,
      revealRequestedAt,
      revealRequestedAt,
      story.story_id,
      revealArtifactType,
      story.story_id,
      expectedVersion,
    ))
    const storyIndex = statements.length
    statements.push(updateStoryStatement(this.db, story, expectedVersion))

    try {
      const results = await this.db.batch(statements)
      if (
        (revealIndex >= 0 && changeCount(results[revealIndex]) !== 1)
        || changeCount(results[storyIndex]) !== 1
      ) {
        throw new StoryError('STALE_STORY_VERSION', 'The story version is stale.', 409)
      }
    } catch (error) {
      if (error instanceof StoryError) throw error
      if (/unique constraint failed/i.test(String(error?.message || ''))) {
        throw new StoryError(
          'LOOKAHEAD_ACTION_EXISTS',
          'This interaction or artifact generation already exists.',
          409,
        )
      }
      throw new StoryError('PERSISTENCE_FAILED', 'Could not commit the lookahead action.', 500)
    }
  }

  async claimNextArtifactJob(storyId, now) {
    const expired = await this.db.prepare(`
      SELECT job_id, artifact_id, attempt_count
      FROM story_artifact_jobs
      WHERE story_id = ? AND status = 'PROCESSING'
        AND started_at_ms IS NOT NULL AND started_at_ms <= ?
    `).bind(storyId, now - STORY_JOB_LEASE_MS).all()
    for (const job of expired?.results || []) {
      const retryable = Number(job.attempt_count) < 2
      await this.db.batch([
        this.db.prepare(`
          UPDATE story_artifact_jobs
          SET status = ?, last_error_code = 'WORKER_LEASE_EXPIRED',
              completed_at_ms = NULL, updated_at_ms = ?
          WHERE job_id = ? AND status = 'PROCESSING'
        `).bind(retryable ? 'QUEUED' : 'FAILED', now, job.job_id),
        this.db.prepare(`
          UPDATE story_artifacts
          SET generation_status = ?, updated_at_ms = ?
          WHERE artifact_id = ? AND generation_status = 'PROCESSING'
        `).bind(retryable ? 'QUEUED' : 'FAILED', now, job.artifact_id),
      ])
    }
    const processing = await this.db.prepare(`
      SELECT * FROM story_artifact_jobs
      WHERE story_id = ? AND status = 'PROCESSING'
      LIMIT 1
    `).bind(storyId).first()
    if (processing) return { state: 'busy', job: rowToArtifactJob(processing) }

    await this.db.prepare(`
      UPDATE story_artifact_jobs
      SET status = 'QUEUED', updated_at_ms = ?
      WHERE story_id = ? AND status = 'WAITING_PREREQUISITE'
        AND EXISTS (
          SELECT 1 FROM story_artifacts AS prerequisite
          WHERE prerequisite.story_id = story_artifact_jobs.story_id
            AND prerequisite.artifact_type = story_artifact_jobs.prerequisite_artifact
            AND prerequisite.generation_status = 'READY'
        )
    `).bind(now, storyId).run()

    const candidate = await this.db.prepare(`
      SELECT * FROM story_artifact_jobs
      WHERE story_id = ? AND status = 'QUEUED' AND attempt_count < 2
        AND (
          prerequisite_artifact IS NULL
          OR EXISTS (
            SELECT 1 FROM story_artifacts AS prerequisite
            WHERE prerequisite.story_id = story_artifact_jobs.story_id
              AND prerequisite.artifact_type = story_artifact_jobs.prerequisite_artifact
              AND prerequisite.generation_status = 'READY'
          )
        )
      ORDER BY created_at_ms ASC
      LIMIT 1
    `).bind(storyId).first()
    if (!candidate) return { state: 'idle', job: null }

    const results = await this.db.batch([
      this.db.prepare(`
        UPDATE story_artifact_jobs
        SET status = 'PROCESSING', attempt_count = attempt_count + 1,
            started_at_ms = ?, completed_at_ms = NULL, updated_at_ms = ?
        WHERE job_id = ? AND status = 'QUEUED' AND attempt_count < 2
          AND NOT EXISTS (
            SELECT 1 FROM story_artifact_jobs
            WHERE story_id = ? AND status = 'PROCESSING'
          )
      `).bind(now, now, candidate.job_id, storyId),
      this.db.prepare(`
        UPDATE story_artifacts
        SET generation_status = 'PROCESSING', updated_at_ms = ?
        WHERE artifact_id = ? AND generation_status IN (
          'QUEUED', 'WAITING_PREREQUISITE'
        )
      `).bind(now, candidate.artifact_id),
    ])
    if (changeCount(results[0]) !== 1 || changeCount(results[1]) !== 1) {
      return { state: 'busy', job: null }
    }
    return {
      state: 'claimed',
      job: rowToArtifactJob({
        ...candidate,
        status: 'PROCESSING',
        attempt_count: Number(candidate.attempt_count) + 1,
        started_at_ms: now,
        updated_at_ms: now,
      }),
    }
  }

  async failArtifactJob(jobId, errorCode, errorDetail, metrics, now) {
    const current = await this.db.prepare(`
      SELECT * FROM story_artifact_jobs WHERE job_id = ? LIMIT 1
    `).bind(jobId).first()
    if (!current || current.status !== 'PROCESSING') return null
    const retryable = Number(current.attempt_count) < 2
    const status = retryable ? 'QUEUED' : 'FAILED'
    await this.db.batch([
      this.db.prepare(`
        UPDATE story_artifact_jobs
        SET status = ?, last_error_code = ?, last_error_detail = ?, metrics_json = ?,
            completed_at_ms = ?, updated_at_ms = ?
        WHERE job_id = ? AND status = 'PROCESSING'
      `).bind(
        status,
        errorCode,
        errorDetail || null,
        json(metrics),
        retryable ? null : now,
        now,
        jobId,
      ),
      this.db.prepare(`
        UPDATE story_artifacts
        SET generation_status = ?, updated_at_ms = ?
        WHERE artifact_id = ? AND generation_status = 'PROCESSING'
      `).bind(status, now, current.artifact_id),
    ])
    return status
  }

  async retryArtifactJob(storyId, jobId, now) {
    const current = await this.db.prepare(`
      SELECT job_id, artifact_id, status
      FROM story_artifact_jobs
      WHERE story_id = ? AND job_id = ?
      LIMIT 1
    `).bind(storyId, jobId).first()
    if (!current || current.status !== 'FAILED') {
      throw new StoryError(
        'ARTIFACT_JOB_NOT_RECOVERABLE',
        'The artifact generation job is not recoverable.',
        409,
      )
    }
    const results = await this.db.batch([
      this.db.prepare(`
        UPDATE story_artifact_jobs
        SET status = 'QUEUED', attempt_count = 0, started_at_ms = NULL,
            completed_at_ms = NULL, last_error_code = NULL,
            last_error_detail = NULL, updated_at_ms = ?
        WHERE story_id = ? AND job_id = ? AND status = 'FAILED'
      `).bind(now, storyId, jobId),
      this.db.prepare(`
        UPDATE story_artifacts
        SET generation_status = 'QUEUED', updated_at_ms = ?
        WHERE story_id = ? AND artifact_id = ? AND generation_status = 'FAILED'
      `).bind(now, storyId, current.artifact_id),
    ])
    if (changeCount(results[0]) !== 1 || changeCount(results[1]) !== 1) {
      throw new StoryError(
        'ARTIFACT_RECOVERY_CONFLICT',
        'The artifact recovery request conflicted with another worker.',
        409,
      )
    }
  }

  async completeArtifactJob({
    storyId,
    expectedArtifactGenerationVersion,
    artifact,
    job,
    stage,
    metrics,
    sessionPatch = {},
    now,
  }) {
    const statements = [
      this.db.prepare(`
        UPDATE story_artifacts
        SET generation_status = 'READY', payload_json = ?,
            known_to_user_additions_json = ?, continuity_handoff_json = ?,
            model_metadata_json = ?, state_before_json = ?, state_after_json = ?,
            completed_at_ms = ?,
            revealed_at_ms = CASE
              WHEN reveal_status = 'REVEALED' THEN COALESCE(revealed_at_ms, ?)
              ELSE revealed_at_ms
            END,
            updated_at_ms = ?
        WHERE artifact_id = ? AND generation_status = 'PROCESSING'
      `).bind(
        json(artifact.payload),
        json(artifact.known_to_user_additions || []),
        json(artifact.continuity_handoff),
        json(artifact.model_metadata),
        json(artifact.state_before),
        json(artifact.state_after),
        now,
        now,
        now,
        artifact.artifact_id,
      ),
      this.db.prepare(`
        UPDATE story_artifact_jobs
        SET status = 'READY', metrics_json = ?, completed_at_ms = ?,
            last_error_code = NULL, last_error_detail = NULL, updated_at_ms = ?
        WHERE job_id = ? AND status = 'PROCESSING'
      `).bind(json(metrics), now, now, job.job_id),
    ]
    if (stage) statements.push(insertStageStatement(this.db, stage))
    const sessionIndex = statements.length
    statements.push(this.db.prepare(`
      UPDATE story_sessions
      SET artifact_generation_version = artifact_generation_version + 1,
          current_stage_index = MAX(current_stage_index, ?),
          last_ready_artifact = ?,
          last_revealed_artifact = CASE
            WHEN EXISTS (
              SELECT 1 FROM story_artifacts
              WHERE artifact_id = ? AND reveal_status = 'REVEALED'
            ) THEN ?
            ELSE last_revealed_artifact
          END,
          status = COALESCE(?, status),
          current_node_id = CASE WHEN ? THEN ? ELSE current_node_id END,
          current_checkpoint = CASE WHEN ? THEN ? ELSE current_checkpoint END,
          final_story_json = CASE WHEN ? THEN ? ELSE final_story_json END,
          story_state_json = CASE WHEN ? THEN ? ELSE story_state_json END,
          completed_at_ms = CASE WHEN ? THEN ? ELSE completed_at_ms END,
          expires_at_ms = CASE WHEN ? THEN ? ELSE expires_at_ms END,
          last_activity_at_ms = ?
      WHERE story_id = ? AND artifact_generation_version = ?
    `).bind(
      artifact.sequence,
      artifact.artifact_type,
      artifact.artifact_id,
      artifact.artifact_type,
      sessionPatch.status || null,
      Object.hasOwn(sessionPatch, 'current_node_id') ? 1 : 0,
      sessionPatch.current_node_id ?? null,
      Object.hasOwn(sessionPatch, 'current_checkpoint') ? 1 : 0,
      sessionPatch.current_checkpoint ?? null,
      Object.hasOwn(sessionPatch, 'final_story') ? 1 : 0,
      json(sessionPatch.final_story),
      Object.hasOwn(sessionPatch, 'story_state') ? 1 : 0,
      json(sessionPatch.story_state),
      Object.hasOwn(sessionPatch, 'completed_at_ms') ? 1 : 0,
      sessionPatch.completed_at_ms ?? null,
      Object.hasOwn(sessionPatch, 'expires_at_ms') ? 1 : 0,
      sessionPatch.expires_at_ms ?? null,
      now,
      storyId,
      expectedArtifactGenerationVersion,
    ))
    const results = await this.db.batch(statements)
    if (
      changeCount(results[0]) !== 1
      || changeCount(results[1]) !== 1
      || changeCount(results[sessionIndex]) !== 1
    ) {
      throw new StoryError(
        'ARTIFACT_GENERATION_CONFLICT',
        'The artifact generation result could not be committed atomically.',
        409,
      )
    }
  }

  async getStoryJobByClientAction(storyId, clientActionId) {
    const row = await this.db.prepare(`
      SELECT * FROM story_generation_jobs
      WHERE story_id = ? AND client_action_id = ?
      LIMIT 1
    `).bind(storyId, clientActionId).first()
    return rowToStoryJob(row)
  }

  async getInteractionByClientAction(storyId, clientActionId) {
    const row = await this.db.prepare(`
      SELECT * FROM story_interactions
      WHERE story_id = ? AND client_action_id = ?
      LIMIT 1
    `).bind(storyId, clientActionId).first()
    return rowToInteraction(row)
  }

  async getCleanupSnapshots(storyId) {
    const result = await this.db.prepare(`
      SELECT snapshot_json FROM story_cleanup_match_snapshots
      WHERE story_id = ?
      ORDER BY created_at_ms ASC, cleanup_target_id ASC
    `).bind(storyId).all()
    return (result?.results || []).map((row) => parseJson(row.snapshot_json, {}))
  }

  async confirmGameAnswer({ story, expectedVersion, job }) {
    const insert = insertQueuedStoryJobStatement(this.db, job, expectedVersion)
    try {
      const results = await this.db.batch([
        insert,
        updateStoryStatement(this.db, story, expectedVersion),
      ])
      if (changeCount(results[0]) !== 1 || changeCount(results[1]) !== 1) {
        throw new StoryError('STALE_STORY_VERSION', 'The story version is stale.', 409)
      }
    } catch (error) {
      if (error instanceof StoryError) throw error
      if (/unique constraint failed/i.test(String(error?.message || ''))) {
        throw new StoryError(
          'STORY_GENERATION_JOB_EXISTS',
          'This orbital question already has a generation job.',
          409,
        )
      }
      throw new StoryError('PERSISTENCE_FAILED', 'Could not confirm the game answer.', 500)
    }
    return clone(job)
  }

  async completeCleanupMatching({ story, expectedVersion, snapshots, job }) {
    const snapshotStatements = snapshots.map((snapshot) => (
      insertCleanupSnapshotStatement(this.db, snapshot, expectedVersion)
    ))
    const jobIndex = snapshotStatements.length
    const storyIndex = jobIndex + 1
    try {
      const results = await this.db.batch([
        ...snapshotStatements,
        insertQueuedStoryJobStatement(this.db, job, expectedVersion),
        updateStoryStatement(this.db, story, expectedVersion),
      ])
      if (
        snapshotStatements.some((_, index) => changeCount(results[index]) !== 1)
        || changeCount(results[jobIndex]) !== 1
        || changeCount(results[storyIndex]) !== 1
      ) {
        throw new StoryError('STALE_STORY_VERSION', 'The story version is stale.', 409)
      }
    } catch (error) {
      if (error instanceof StoryError) throw error
      if (/unique constraint failed/i.test(String(error?.message || ''))) {
        throw new StoryError('M6_COMPLETION_EXISTS', 'This M6 completion was already submitted.', 409)
      }
      throw new StoryError('PERSISTENCE_FAILED', 'Could not freeze the M6 result.', 500)
    }
    return clone(job)
  }

  async claimNextStoryJob(storyId, now) {
    await this.db.prepare(`
      UPDATE story_generation_jobs
      SET status = 'RETRYABLE', last_error_code = 'WORKER_LEASE_EXPIRED',
          completed_at_ms = NULL, updated_at_ms = ?
      WHERE story_id = ? AND status = 'PROCESSING'
        AND started_at_ms IS NOT NULL AND started_at_ms <= ?
    `).bind(now, storyId, now - STORY_JOB_LEASE_MS).run()
    const processing = await this.db.prepare(`
      SELECT * FROM story_generation_jobs
      WHERE story_id = ? AND status = 'PROCESSING'
      LIMIT 1
    `).bind(storyId).first()
    if (processing) return { state: 'busy', job: rowToStoryJob(processing) }

    const candidate = await this.db.prepare(`
      SELECT candidate.*
      FROM story_generation_jobs AS candidate
      WHERE candidate.story_id = ?
        AND candidate.status IN ('QUEUED', 'RETRYABLE')
        AND NOT EXISTS (
          SELECT 1 FROM story_generation_jobs AS previous
          WHERE previous.story_id = candidate.story_id
            AND previous.sequence < candidate.sequence
            AND previous.status != 'SUCCEEDED'
        )
      ORDER BY candidate.sequence ASC
      LIMIT 1
    `).bind(storyId).first()
    if (!candidate) return { state: 'idle', job: null }

    try {
      const result = await this.db.prepare(`
        UPDATE story_generation_jobs
        SET status = 'PROCESSING', attempt_count = attempt_count + 1,
            started_at_ms = ?, last_error_code = NULL, updated_at_ms = ?
        WHERE job_id = ? AND status IN ('QUEUED', 'RETRYABLE')
          AND NOT EXISTS (
            SELECT 1 FROM story_generation_jobs
            WHERE story_id = ? AND status = 'PROCESSING'
          )
      `).bind(now, now, candidate.job_id, storyId).run()
      if (changeCount(result) !== 1) return { state: 'busy', job: null }
      return {
        state: 'claimed',
        job: rowToStoryJob({
          ...candidate,
          status: 'PROCESSING',
          attempt_count: Number(candidate.attempt_count) + 1,
          started_at_ms: now,
          updated_at_ms: now,
        }),
      }
    } catch (error) {
      if (/unique constraint failed/i.test(String(error?.message || ''))) {
        return { state: 'busy', job: null }
      }
      throw error
    }
  }

  async failStoryJob(jobId, errorCode, metrics, now) {
    await this.db.prepare(`
      UPDATE story_generation_jobs
      SET status = 'FAILED', last_error_code = ?, metrics_json = ?,
          completed_at_ms = ?, updated_at_ms = ?
      WHERE job_id = ? AND status = 'PROCESSING'
    `).bind(errorCode, json(metrics), now, now, jobId).run()
  }

  async updateStoryJobMetrics(jobId, metrics, now) {
    await this.db.prepare(`
      UPDATE story_generation_jobs
      SET metrics_json = ?, updated_at_ms = ?
      WHERE job_id = ?
    `).bind(json(metrics), now, jobId).run()
  }

  async retryStoryJob(storyId, jobId, now) {
    const result = await this.db.prepare(`
      UPDATE story_generation_jobs
      SET status = 'RETRYABLE', completed_at_ms = NULL, updated_at_ms = ?
      WHERE story_id = ? AND job_id = ? AND status = 'FAILED'
    `).bind(now, storyId, jobId).run()
    if (changeCount(result) !== 1) {
      throw new StoryError('STORY_JOB_NOT_RETRYABLE', 'The story job is not retryable.', 409)
    }
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
    storyJob = null,
    jobMetrics = null,
    nextStoryJob = null,
  }) {
    const statements = []
    if (interaction) statements.push(insertInteractionStatement(this.db, interaction, expectedVersion))
    statements.push(...stages.map((stage) => insertStageStatement(this.db, stage, expectedVersion)))
    const nextStoryJobIndex = nextStoryJob ? statements.length : -1
    if (nextStoryJob) {
      statements.push(insertQueuedStoryJobStatement(this.db, nextStoryJob, expectedVersion))
    }
    const storyUpdateIndex = statements.length
    statements.push(updateStoryStatement(this.db, story, expectedVersion))
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
    if (storyJob) {
      statements.push(this.db.prepare(`
        UPDATE story_generation_jobs
        SET status = 'SUCCEEDED', metrics_json = ?, completed_at_ms = ?,
            last_error_code = NULL, updated_at_ms = ?
        WHERE job_id = ? AND status = 'PROCESSING'
          AND EXISTS (
            SELECT 1 FROM story_sessions
            WHERE story_id = ? AND version = ?
          )
      `).bind(
        json(jobMetrics),
        story.last_activity_at_ms,
        story.last_activity_at_ms,
        storyJob.job_id,
        story.story_id,
        story.version,
      ))
    }

    const results = await this.db.batch(statements)
    if (changeCount(results[storyUpdateIndex]) === 0) {
      throw new StoryError('VERSION_CONFLICT', 'The story was updated by another request.', 409)
    }
    if (nextStoryJob && changeCount(results[nextStoryJobIndex]) === 0) {
      throw new StoryError(
        'GENERATION_COMMIT_FAILED',
        'The follow-up story generation job could not be queued.',
        500,
      )
    }
    let resultIndex = storyUpdateIndex + 1
    if (generation && changeCount(results[resultIndex++]) === 0) {
      throw new StoryError(
        'GENERATION_COMMIT_FAILED',
        'The story generation could not be finalized.',
        500,
      )
    }
    if (storyJob && changeCount(results[resultIndex]) === 0) {
      throw new StoryError(
        'GENERATION_COMMIT_FAILED',
        'The queued story generation could not be finalized.',
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
    return (result?.results || []).map(rowToInteraction)
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
    this.storyJobs = new Map()
    this.cleanupSnapshots = new Map()
    this.artifacts = new Map()
    this.artifactJobs = new Map()
  }

  async cleanupExpiredStories(now) {
    let removed = 0
    for (const [storyId, story] of this.stories) {
      if (story.status === 'completed' || story.expires_at_ms === null || story.expires_at_ms > now) continue
      this.stories.delete(storyId)
      this.storyBySession.delete(story.session_id)
      this.stages.delete(storyId)
      this.interactions.delete(storyId)
      this.cleanupSnapshots.delete(storyId)
      this.artifacts.delete(storyId)
      for (const [jobId, job] of this.artifactJobs) {
        if (job.story_id === storyId) this.artifactJobs.delete(jobId)
      }
      for (const [jobId, job] of this.storyJobs) {
        if (job.story_id === storyId) this.storyJobs.delete(jobId)
      }
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

  async createStory(story, stages, artifacts = [], artifactJobs = []) {
    if (this.stories.has(story.story_id) || this.storyBySession.has(story.session_id)) {
      throw new StoryError('STORY_EXISTS', 'Story already exists.', 409)
    }
    const storySnapshot = clone(story)
    const stageSnapshots = clone(stages)
    this.stories.set(story.story_id, storySnapshot)
    this.storyBySession.set(story.session_id, story.story_id)
    this.stages.set(story.story_id, stageSnapshots)
    this.interactions.set(story.story_id, [])
    this.artifacts.set(story.story_id, clone(artifacts))
    for (const job of artifactJobs) this.artifactJobs.set(job.job_id, clone(job))
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

  async getStoryJobs(storyId) {
    return clone(
      [...this.storyJobs.values()]
        .filter((job) => job.story_id === storyId)
        .sort((a, b) => a.sequence - b.sequence),
    )
  }

  async getArtifacts(storyId) {
    return clone(
      (this.artifacts.get(storyId) || []).sort((a, b) => a.sequence - b.sequence),
    )
  }

  async getArtifact(storyId, artifactType) {
    const artifact = (this.artifacts.get(storyId) || [])
      .find((item) => item.artifact_type === artifactType)
    return artifact ? clone(artifact) : null
  }

  async getArtifactJobs(storyId) {
    return clone(
      [...this.artifactJobs.values()]
        .filter((job) => job.story_id === storyId)
        .sort((a, b) => a.created_at_ms - b.created_at_ms),
    )
  }

  async getArtifactJobBySourceAction(storyId, sourceActionId) {
    const job = [...this.artifactJobs.values()].find((item) => (
      item.story_id === storyId && item.source_action_id === sourceActionId
    ))
    return job ? clone(job) : null
  }

  async commitLookaheadInteraction({
    story,
    expectedVersion,
    interaction,
    artifact,
    artifactJob,
    revealArtifactType,
    revealRequestedAt,
    cleanupSnapshots = [],
  }) {
    const current = this.stories.get(story.story_id)
    if (!current || current.version !== expectedVersion || current.status !== 'in_progress') {
      throw new StoryError('STALE_STORY_VERSION', 'The story version is stale.', 409)
    }
    const artifacts = this.artifacts.get(story.story_id) || []
    const reveal = revealArtifactType
      ? artifacts.find((item) => item.artifact_type === revealArtifactType)
      : null
    if (revealArtifactType && (!reveal || reveal.reveal_status !== 'HIDDEN')) {
      throw new StoryError('LOOKAHEAD_REVEAL_CONFLICT', 'The reveal artifact is unavailable.', 409)
    }
    if (artifact && artifacts.some((item) => item.artifact_type === artifact.artifact_type)) {
      throw new StoryError('LOOKAHEAD_ACTION_EXISTS', 'The artifact already exists.', 409)
    }
    if (artifactJob && [...this.artifactJobs.values()].some((item) => (
      item.story_id === story.story_id && item.artifact_type === artifactJob.artifact_type
    ))) {
      throw new StoryError('LOOKAHEAD_ACTION_EXISTS', 'The artifact job already exists.', 409)
    }
    if (reveal) {
      Object.assign(reveal, {
        reveal_status: 'REVEALED',
        reveal_requested_at_ms: reveal.reveal_requested_at_ms || revealRequestedAt,
        revealed_at_ms: reveal.generation_status === 'READY'
          ? reveal.revealed_at_ms || revealRequestedAt
          : reveal.revealed_at_ms,
        updated_at_ms: revealRequestedAt,
      })
    }
    if (artifact) artifacts.push(clone(artifact))
    if (artifactJob) this.artifactJobs.set(artifactJob.job_id, clone(artifactJob))
    if (interaction) {
      this.interactions.set(story.story_id, [
        ...(this.interactions.get(story.story_id) || []),
        clone(interaction),
      ])
    }
    if (cleanupSnapshots.length) this.cleanupSnapshots.set(story.story_id, clone(cleanupSnapshots))
    this.artifacts.set(story.story_id, artifacts)
    this.stories.set(story.story_id, clone(story))
  }

  async claimNextArtifactJob(storyId, now) {
    const jobs = [...this.artifactJobs.values()]
      .filter((job) => job.story_id === storyId)
      .sort((a, b) => a.created_at_ms - b.created_at_ms)
    const artifacts = this.artifacts.get(storyId) || []
    for (const job of jobs) {
      if (
        job.status === 'PROCESSING'
        && job.started_at_ms !== null
        && job.started_at_ms <= now - STORY_JOB_LEASE_MS
      ) {
        const retryable = job.attempt_count < 2
        Object.assign(job, {
          status: retryable ? 'QUEUED' : 'FAILED',
          last_error_code: 'WORKER_LEASE_EXPIRED',
          completed_at_ms: retryable ? null : now,
          updated_at_ms: now,
        })
        const artifact = artifacts.find((item) => item.artifact_id === job.artifact_id)
        if (artifact) artifact.generation_status = retryable ? 'QUEUED' : 'FAILED'
      }
    }
    const processing = jobs.find((job) => job.status === 'PROCESSING')
    if (processing) return { state: 'busy', job: clone(processing) }
    for (const job of jobs.filter((item) => item.status === 'WAITING_PREREQUISITE')) {
      const prerequisite = artifacts.find(
        (item) => item.artifact_type === job.prerequisite_artifact,
      )
      if (prerequisite?.generation_status === 'READY') job.status = 'QUEUED'
    }
    const candidate = jobs.find((job) => {
      if (job.status !== 'QUEUED' || job.attempt_count >= 2) return false
      if (!job.prerequisite_artifact) return true
      return artifacts.some((item) => (
        item.artifact_type === job.prerequisite_artifact
        && item.generation_status === 'READY'
      ))
    })
    if (!candidate) return { state: 'idle', job: null }
    Object.assign(candidate, {
      status: 'PROCESSING',
      attempt_count: candidate.attempt_count + 1,
      started_at_ms: now,
      completed_at_ms: null,
      updated_at_ms: now,
    })
    const artifact = artifacts.find((item) => item.artifact_id === candidate.artifact_id)
    artifact.generation_status = 'PROCESSING'
    artifact.updated_at_ms = now
    return { state: 'claimed', job: clone(candidate) }
  }

  async failArtifactJob(jobId, errorCode, errorDetail, metrics, now) {
    const job = this.artifactJobs.get(jobId)
    if (!job || job.status !== 'PROCESSING') return null
    const retryable = job.attempt_count < 2
    const status = retryable ? 'QUEUED' : 'FAILED'
    Object.assign(job, {
      status,
      last_error_code: errorCode,
      last_error_detail: errorDetail || null,
      metrics: clone(metrics),
      completed_at_ms: retryable ? null : now,
      updated_at_ms: now,
    })
    const artifact = (this.artifacts.get(job.story_id) || [])
      .find((item) => item.artifact_id === job.artifact_id)
    if (artifact) Object.assign(artifact, { generation_status: status, updated_at_ms: now })
    return status
  }

  async retryArtifactJob(storyId, jobId, now) {
    const job = this.artifactJobs.get(jobId)
    if (!job || job.story_id !== storyId || job.status !== 'FAILED') {
      throw new StoryError(
        'ARTIFACT_JOB_NOT_RECOVERABLE',
        'The artifact generation job is not recoverable.',
        409,
      )
    }
    const artifact = (this.artifacts.get(storyId) || [])
      .find((item) => item.artifact_id === job.artifact_id)
    if (!artifact || artifact.generation_status !== 'FAILED') {
      throw new StoryError(
        'ARTIFACT_RECOVERY_CONFLICT',
        'The artifact recovery request conflicted with another worker.',
        409,
      )
    }
    Object.assign(job, {
      status: 'QUEUED',
      attempt_count: 0,
      started_at_ms: null,
      completed_at_ms: null,
      last_error_code: null,
      last_error_detail: null,
      updated_at_ms: now,
    })
    Object.assign(artifact, {
      generation_status: 'QUEUED',
      updated_at_ms: now,
    })
  }

  async completeArtifactJob({
    storyId,
    expectedArtifactGenerationVersion,
    artifact,
    job,
    stage,
    metrics,
    sessionPatch = {},
    now,
  }) {
    const story = this.stories.get(storyId)
    const currentArtifact = (this.artifacts.get(storyId) || [])
      .find((item) => item.artifact_id === artifact.artifact_id)
    const currentJob = this.artifactJobs.get(job.job_id)
    if (
      !story
      || story.artifact_generation_version !== expectedArtifactGenerationVersion
      || currentArtifact?.generation_status !== 'PROCESSING'
      || currentJob?.status !== 'PROCESSING'
    ) {
      throw new StoryError(
        'ARTIFACT_GENERATION_CONFLICT',
        'The artifact generation result could not be committed atomically.',
        409,
      )
    }
    Object.assign(currentArtifact, clone(artifact), {
      generation_status: 'READY',
      completed_at_ms: now,
      revealed_at_ms: currentArtifact.reveal_status === 'REVEALED'
        ? currentArtifact.revealed_at_ms || now
        : currentArtifact.revealed_at_ms,
      updated_at_ms: now,
    })
    Object.assign(currentJob, {
      status: 'READY',
      metrics: clone(metrics),
      completed_at_ms: now,
      last_error_code: null,
      updated_at_ms: now,
    })
    if (stage) {
      this.stages.set(storyId, [...(this.stages.get(storyId) || []), clone(stage)])
    }
    Object.assign(story, clone(sessionPatch), {
      artifact_generation_version: story.artifact_generation_version + 1,
      current_stage_index: Math.max(story.current_stage_index, artifact.sequence),
      last_ready_artifact: artifact.artifact_type,
      last_revealed_artifact: currentArtifact.reveal_status === 'REVEALED'
        ? artifact.artifact_type
        : story.last_revealed_artifact,
      last_activity_at_ms: now,
    })
  }

  async getStoryJobByClientAction(storyId, clientActionId) {
    const job = [...this.storyJobs.values()].find((item) => (
      item.story_id === storyId && item.client_action_id === clientActionId
    ))
    return job ? clone(job) : null
  }

  async getInteractionByClientAction(storyId, clientActionId) {
    const interaction = (this.interactions.get(storyId) || []).find(
      (item) => item.client_action_id === clientActionId,
    )
    return interaction ? clone(interaction) : null
  }

  async getCleanupSnapshots(storyId) {
    return clone(this.cleanupSnapshots.get(storyId) || [])
  }

  async confirmGameAnswer({ story, expectedVersion, job }) {
    const current = this.stories.get(story.story_id)
    if (!current || current.version !== expectedVersion || current.status !== 'in_progress') {
      throw new StoryError('STALE_STORY_VERSION', 'The story version is stale.', 409)
    }
    const conflict = [...this.storyJobs.values()].some((item) => (
      item.story_id === story.story_id
      && (
        item.question_id === job.question_id
        || item.sequence === job.sequence
        || item.client_action_id === job.client_action_id
      )
    ))
    if (conflict) {
      throw new StoryError(
        'STORY_GENERATION_JOB_EXISTS',
        'This orbital question already has a generation job.',
        409,
      )
    }
    this.storyJobs.set(job.job_id, clone({ ...job, status: 'QUEUED' }))
    this.stories.set(story.story_id, clone(story))
    return clone(job)
  }

  async completeCleanupMatching({ story, expectedVersion, snapshots, job }) {
    const current = this.stories.get(story.story_id)
    if (!current || current.version !== expectedVersion || current.status !== 'in_progress') {
      throw new StoryError('STALE_STORY_VERSION', 'The story version is stale.', 409)
    }
    const jobs = [...this.storyJobs.values()]
    const conflict = jobs.some((item) => (
      item.story_id === story.story_id
      && (
        item.question_id === job.question_id
        || item.sequence === job.sequence
        || item.client_action_id === job.client_action_id
      )
    ))
    if (conflict || this.cleanupSnapshots.has(story.story_id)) {
      throw new StoryError('M6_COMPLETION_EXISTS', 'This M6 completion was already submitted.', 409)
    }
    this.cleanupSnapshots.set(story.story_id, clone(snapshots))
    this.storyJobs.set(job.job_id, clone({ ...job, status: 'QUEUED' }))
    this.stories.set(story.story_id, clone(story))
    return clone(job)
  }

  async claimNextStoryJob(storyId, now) {
    const jobs = [...this.storyJobs.values()]
      .filter((job) => job.story_id === storyId)
      .sort((a, b) => a.sequence - b.sequence)
    for (const job of jobs) {
      if (
        job.status === 'PROCESSING'
        && job.started_at_ms !== null
        && job.started_at_ms <= now - STORY_JOB_LEASE_MS
      ) {
        Object.assign(job, {
          status: 'RETRYABLE',
          last_error_code: 'WORKER_LEASE_EXPIRED',
          completed_at_ms: null,
          updated_at_ms: now,
        })
      }
    }
    const processing = jobs.find((job) => job.status === 'PROCESSING')
    if (processing) return { state: 'busy', job: clone(processing) }
    const candidate = jobs.find((job) => (
      ['QUEUED', 'RETRYABLE'].includes(job.status)
      && jobs.every((previous) => (
        previous.sequence >= job.sequence || previous.status === 'SUCCEEDED'
      ))
    ))
    if (!candidate) return { state: 'idle', job: null }
    Object.assign(candidate, {
      status: 'PROCESSING',
      attempt_count: candidate.attempt_count + 1,
      started_at_ms: now,
      last_error_code: null,
      updated_at_ms: now,
    })
    return { state: 'claimed', job: clone(candidate) }
  }

  async failStoryJob(jobId, errorCode, metrics, now) {
    const job = this.storyJobs.get(jobId)
    if (!job || job.status !== 'PROCESSING') return
    Object.assign(job, {
      status: 'FAILED',
      last_error_code: errorCode,
      metrics: clone(metrics),
      completed_at_ms: now,
      updated_at_ms: now,
    })
  }

  async updateStoryJobMetrics(jobId, metrics, now) {
    const job = this.storyJobs.get(jobId)
    if (!job) return
    job.metrics = clone(metrics)
    job.updated_at_ms = now
  }

  async retryStoryJob(storyId, jobId, now) {
    const job = this.storyJobs.get(jobId)
    if (!job || job.story_id !== storyId || job.status !== 'FAILED') {
      throw new StoryError('STORY_JOB_NOT_RETRYABLE', 'The story job is not retryable.', 409)
    }
    Object.assign(job, { status: 'RETRYABLE', completed_at_ms: null, updated_at_ms: now })
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
    storyJob = null,
    jobMetrics = null,
    nextStoryJob = null,
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
    let storyJobSnapshot = null
    if (storyJob) {
      const currentJob = this.storyJobs.get(storyJob.job_id)
      if (!currentJob || currentJob.status !== 'PROCESSING') {
        throw new StoryError(
          'GENERATION_COMMIT_FAILED',
          'The queued story generation could not be finalized.',
          500,
        )
      }
      storyJobSnapshot = {
        ...clone(currentJob),
        status: 'SUCCEEDED',
        metrics: clone(jobMetrics),
        completed_at_ms: story.last_activity_at_ms,
        last_error_code: null,
        updated_at_ms: story.last_activity_at_ms,
      }
    }
    if (nextStoryJob) {
      const conflict = [...this.storyJobs.values()].some((item) => (
        item.story_id === nextStoryJob.story_id
        && (
          item.question_id === nextStoryJob.question_id
          || item.sequence === nextStoryJob.sequence
          || item.client_action_id === nextStoryJob.client_action_id
        )
      ))
      if (conflict) {
        throw new StoryError(
          'GENERATION_COMMIT_FAILED',
          'The follow-up story generation job already exists.',
          500,
        )
      }
    }
    const interactionSnapshot = clone(interaction)
    const stageSnapshots = clone(stages)
    const storySnapshot = {
      ...clone(story),
      story_outline: clone(current.story_outline),
    }
    if (interactionSnapshot) {
      this.interactions.set(story.story_id, [
        ...(this.interactions.get(story.story_id) || []),
        interactionSnapshot,
      ])
    }
    this.stages.set(story.story_id, [
      ...(this.stages.get(story.story_id) || []),
      ...stageSnapshots,
    ])
    this.stories.set(story.story_id, storySnapshot)
    if (generationSnapshot) {
      this.generations.set(generationSnapshot.generation_id, generationSnapshot)
    }
    if (storyJobSnapshot) {
      this.storyJobs.set(storyJobSnapshot.job_id, storyJobSnapshot)
    }
    if (nextStoryJob) {
      this.storyJobs.set(nextStoryJob.job_id, clone({
        ...nextStoryJob,
        status: 'QUEUED',
      }))
    }
  }

  async getInteractions(storyId) {
    return clone(this.interactions.get(storyId) || [])
  }
}

export function createStoryRepository(env) {
  return new D1StoryRepository(env?.STORY_DB)
}
