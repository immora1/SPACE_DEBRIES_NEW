import { STORY_SPEC_VERSION, TASK_TYPE } from './constants.js'
import { resolveOptionsForNode } from './config/story-options.js'
import {
  resolveNodeInteractionConfig,
  STORY_INTERACTION_MODE,
} from './config/node-interactions.js'
import {
  resolveLookaheadBinding,
  STORY_ARTIFACT_TYPE,
} from './config/lookahead-bindings.js'

function publicStage(stage) {
  if (!stage) return null
  return {
    stage_id: stage.stage_id,
    stage_index: stage.stage_index,
    task_type: stage.task_type,
    node_id: stage.node_id,
    checkpoint: stage.checkpoint,
    display_content: stage.display_content,
    stage_summary: stage.stage_summary,
    input_action: stage.input_action || null,
    created_at_ms: stage.created_at_ms,
  }
}

function publicGameState(gameState) {
  return {
    satellite_build: gameState.satellite_build,
    mission: gameState.mission,
    orbital_events: gameState.orbital_events,
    cleanup_test: gameState.cleanup_test,
    technical_metrics: gameState.technical_metrics,
  }
}

function publicGameStorySync(jobs, artifactJobs = [], story = null) {
  if (artifactJobs.length) {
    const queued = artifactJobs.filter((job) => (
      ['QUEUED', 'WAITING_PREREQUISITE'].includes(job.status)
    ))
    const processing = artifactJobs.find((job) => job.status === 'PROCESSING')
    const failed = artifactJobs.find((job) => job.status === 'FAILED')
    const ready = artifactJobs.filter((job) => job.status === 'READY')
    return {
      answered_questions: story?.game_state?.orbital_events?.resolved?.length || 0,
      total_questions: 6,
      generated_story_stages: ready.length,
      queued_story_stages: queued.length,
      generated_through_node: ready.at(-1)?.generated_from_node_id || null,
      queued_nodes: queued.map((job) => job.generated_from_node_id),
      current_generation_node: processing?.generated_from_node_id || null,
      has_failed_job: Boolean(failed),
      failed_node: failed?.generated_from_node_id || null,
      failed_job_id: failed?.job_id || null,
      queued_artifacts: queued.map((job) => job.artifact_type),
      current_generation_artifact: processing?.artifact_type || null,
      failed_artifact: failed?.artifact_type || null,
    }
  }
  const gameJobs = jobs.filter((job) => job.sequence <= 6)
  const generated = gameJobs.filter((job) => job.status === 'SUCCEEDED')
  const queued = jobs.filter((job) => ['QUEUED', 'RETRYABLE'].includes(job.status))
  const processing = jobs.find((job) => job.status === 'PROCESSING')
  const failed = jobs.find((job) => job.status === 'FAILED')
  return {
    answered_questions: gameJobs.length,
    total_questions: 6,
    generated_story_stages: generated.length,
    queued_story_stages: queued.length,
    generated_through_node: generated.at(-1)?.target_node_id || null,
    queued_nodes: queued.map((job) => job.target_node_id),
    current_generation_node: processing?.target_node_id || null,
    has_failed_job: Boolean(failed),
    failed_node: failed?.target_node_id || null,
    failed_job_id: failed?.job_id || null,
  }
}

function taskTypeForArtifact(artifactType) {
  if (artifactType === STORY_ARTIFACT_TYPE.OPENING) return TASK_TYPE.OPENING
  if (artifactType === STORY_ARTIFACT_TYPE.ENDING) return TASK_TYPE.ENDING
  if (artifactType === STORY_ARTIFACT_TYPE.KNOWLEDGE_REVEAL) {
    return TASK_TYPE.KNOWLEDGE_REVEAL
  }
  return TASK_TYPE.CONTINUE
}

function publicArtifactStage(artifact) {
  if (
    artifact.generation_status !== 'READY'
    || artifact.reveal_status !== 'REVEALED'
    || !artifact.payload
  ) return null
  const nodeIdByArtifact = {
    [STORY_ARTIFACT_TYPE.OPENING]: 'node_01',
    [STORY_ARTIFACT_TYPE.STAGE_1]: 'node_02',
    [STORY_ARTIFACT_TYPE.STAGE_2]: 'node_03',
    [STORY_ARTIFACT_TYPE.STAGE_3]: 'node_04',
    [STORY_ARTIFACT_TYPE.ENDING]: 'node_05',
  }
  return {
    stage_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    stage_index: artifact.sequence,
    task_type: taskTypeForArtifact(artifact.artifact_type),
    node_id: nodeIdByArtifact[artifact.artifact_type] || null,
    generated_from_node_id: artifact.generated_from_node_id,
    checkpoint: null,
    display_content: artifact.payload,
    stage_summary: artifact.model_metadata?.stage_summary
      || `${artifact.artifact_type} 已生成并揭示。`,
    input_action: artifact.model_metadata?.input_action || null,
    created_at_ms: artifact.completed_at_ms || artifact.created_at_ms,
  }
}

function percentile(values, ratio) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  return sorted[index]
}

function generationAttemptCount(attempts) {
  if (Number.isInteger(attempts) && attempts >= 0) return attempts
  return Array.isArray(attempts) ? attempts.length : 0
}

function publicArtifactProgress(story, artifacts, artifactJobs) {
  const processing = artifactJobs.find((job) => job.status === 'PROCESSING')
  const failed = artifactJobs.find((job) => job.status === 'FAILED')
  const revealPending = artifacts.find((artifact) => (
    artifact.reveal_status === 'REVEALED'
    && artifact.generation_status !== 'READY'
  ))
  const prefetchArtifacts = artifacts.filter((artifact) => (
    artifact.artifact_type === STORY_ARTIFACT_TYPE.ENDING
    || /^STORY_STAGE_[1-3]$/.test(artifact.artifact_type)
  ))
  const completedRevealWaits = prefetchArtifacts
    .filter((artifact) => (
      artifact.reveal_requested_at_ms !== null
      && artifact.revealed_at_ms !== null
    ))
    .map((artifact) => Math.max(
      0,
      artifact.revealed_at_ms - artifact.reveal_requested_at_ms,
    ))
  const prefetchHitCount = prefetchArtifacts.filter((artifact) => (
    artifact.reveal_requested_at_ms !== null
    && artifact.completed_at_ms !== null
    && artifact.completed_at_ms <= artifact.reveal_requested_at_ms
  )).length
  const prefetchMissCount = prefetchArtifacts.filter((artifact) => (
    artifact.reveal_requested_at_ms !== null
    && (
      artifact.completed_at_ms === null
      || artifact.completed_at_ms > artifact.reveal_requested_at_ms
    )
  )).length
  const prefetchSampleCount = prefetchHitCount + prefetchMissCount
  const outlineArtifact = artifacts.find(
    (artifact) => artifact.artifact_type === STORY_ARTIFACT_TYPE.OUTLINE,
  )
  const openingArtifact = artifacts.find(
    (artifact) => artifact.artifact_type === STORY_ARTIFACT_TYPE.OPENING,
  )
  const initialAttempts = [outlineArtifact, openingArtifact].reduce(
    (total, artifact) => total + generationAttemptCount(
      artifact?.model_metadata?.attempts,
    ),
    0,
  )
  const artifactModelCalls = artifactJobs.reduce(
    (total, job) => total + (job.attempt_count || 0),
    0,
  )
  const providerDurationTotal = [outlineArtifact, openingArtifact]
    .reduce((total, artifact) => (
      total + (artifact?.model_metadata?.performance?.model_duration_ms || 0)
    ), 0)
    + artifactJobs.reduce(
      (total, job) => total + (job.metrics?.model_duration_ms || 0),
      0,
    )
  return {
    interaction_version: story.interaction_version ?? story.version,
    artifact_generation_version: story.artifact_generation_version ?? 0,
    last_confirmed_node: story.last_confirmed_node || null,
    last_ready_artifact: story.last_ready_artifact || null,
    last_revealed_artifact: story.last_revealed_artifact || null,
    processing_artifact: processing?.artifact_type || null,
    waiting_reveal_artifact: revealPending?.artifact_type || null,
    failed_artifact: failed?.artifact_type || null,
    failed_job_id: failed?.job_id || null,
    failed_error_code: failed?.last_error_code || null,
    queued_artifacts: artifactJobs
      .filter((job) => ['QUEUED', 'WAITING_PREREQUISITE'].includes(job.status))
      .map((job) => job.artifact_type),
    artifacts: artifacts.map((artifact) => ({
      artifact_type: artifact.artifact_type,
      sequence: artifact.sequence,
      generated_from_node_id: artifact.generated_from_node_id,
      generation_status: artifact.generation_status,
      reveal_status: artifact.reveal_status,
      prerequisite_artifact: artifactJobs.find(
        (job) => job.artifact_type === artifact.artifact_type,
      )?.prerequisite_artifact || null,
      prefetch_hit: artifact.reveal_requested_at_ms !== null
        ? artifact.completed_at_ms !== null
          && artifact.completed_at_ms <= artifact.reveal_requested_at_ms
        : null,
      artifact_reveal_wait_ms: artifact.reveal_requested_at_ms !== null
        && artifact.revealed_at_ms !== null
        ? Math.max(0, artifact.revealed_at_ms - artifact.reveal_requested_at_ms)
        : null,
    })),
    metrics: {
      prefetch_hit_count: prefetchHitCount,
      prefetch_miss_count: prefetchMissCount,
      prefetch_hit_rate: prefetchSampleCount > 0
        ? prefetchHitCount / prefetchSampleCount
        : null,
      reveal_wait_samples_ms: completedRevealWaits,
      median_artifact_reveal_wait_ms: percentile(completedRevealWaits, 0.5),
      p90_artifact_reveal_wait_ms: percentile(completedRevealWaits, 0.9),
      model_calls_per_story: initialAttempts + artifactModelCalls,
      continue_calls_per_story: artifactJobs
        .filter((job) => /^STORY_STAGE_[1-3]$/.test(job.artifact_type))
        .reduce((total, job) => total + (job.attempt_count || 0), 0),
      provider_duration_total_ms: providerDurationTotal,
      user_visible_wait_ms: completedRevealWaits.reduce(
        (total, duration) => total + duration,
        0,
      ),
      initial_outline_duration_ms:
        outlineArtifact?.model_metadata?.performance?.total_stage_duration_ms
        ?? null,
      initial_opening_duration_ms:
        openingArtifact?.model_metadata?.performance?.total_stage_duration_ms
        ?? null,
    },
  }
}

export function toPublicStoryDTO(
  story,
  stages = [],
  jobs = [],
  artifacts = [],
  artifactJobs = [],
) {
  const usesArtifacts = artifacts.length > 0
  const timeline = (usesArtifacts
    ? artifacts.map(publicArtifactStage)
    : stages.map(publicStage))
    .filter((stage) => stage?.display_content?.story_text)
    .sort((a, b) => a.stage_index - b.stage_index)
  const currentStage = timeline.at(-1) || null
  const ending = timeline.findLast?.((stage) => stage.task_type === TASK_TYPE.ENDING)
    || [...timeline].reverse().find((stage) => stage.task_type === TASK_TYPE.ENDING)
  const reveal = timeline.findLast?.((stage) => stage.task_type === TASK_TYPE.KNOWLEDGE_REVEAL)
    || [...timeline].reverse().find((stage) => stage.task_type === TASK_TYPE.KNOWLEDGE_REVEAL)
  const usesCurrentContract = story.status === 'in_progress'
    && story.prompt_metadata?.spec_version === STORY_SPEC_VERSION
  const interactionConfig = usesCurrentContract
    ? resolveNodeInteractionConfig(story.current_node_id)
    : null
  const currentOptions = interactionConfig?.interaction_mode
    === STORY_INTERACTION_MODE.LEGACY_STORY_OPTION
    ? resolveOptionsForNode(story, story.current_node_id).map((option) => ({
        option_id: option.option_id,
        label: option.label,
        effect_summary: option.effect_summary,
      }))
    : []
  const currentInteraction = interactionConfig
    ? {
        node_id: interactionConfig.node_id,
        interaction_mode: interactionConfig.interaction_mode,
        module_id: interactionConfig.module_id,
        required_sections: interactionConfig.required_sections,
        trigger_mode: interactionConfig.trigger_mode,
        legacy_option_fallback: interactionConfig.legacy_option_fallback,
        waiting_prompt: interactionConfig.waiting_prompt,
      }
    : null

  return {
    story_id: story.story_id,
    version: story.interaction_version ?? story.version,
    interaction_version: story.interaction_version ?? story.version,
    artifact_generation_version: story.artifact_generation_version ?? 0,
    story_flow_version: story.prompt_metadata?.story_flow_version || null,
    status: story.status,
    current_stage_index: story.current_stage_index,
    current_node_id: story.current_node_id,
    current_checkpoint: story.current_checkpoint,
    current_options: currentOptions,
    current_interaction: currentInteraction,
    story_text: currentStage?.display_content?.story_text || '',
    public_game_state: publicGameState(story.game_state),
    current_stage: currentStage,
    timeline,
    final_story_if_completed: story.status === 'completed'
      ? {
          ending: ending?.display_content || null,
          knowledge_reveal: reveal?.display_content || null,
      }
      : null,
    game_story_sync: publicGameStorySync(jobs, artifactJobs, story),
    artifact_progress: usesArtifacts
      ? publicArtifactProgress(story, artifacts, artifactJobs)
      : null,
    lookahead_binding: usesArtifacts && story.current_node_id
      ? resolveLookaheadBinding(story.current_node_id)
      : null,
  }
}
