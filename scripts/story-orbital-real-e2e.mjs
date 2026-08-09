import { randomUUID } from 'node:crypto'
import {
  GAME_STORY_STAGE_BINDINGS,
  orbitalAnswerControlId,
} from '../functions/_story/config/game-story-bindings.js'
import { ORBITAL_EVENTS } from '../functions/_story/config/orbital-events.js'

const baseUrl = process.env.STORY_E2E_BASE_URL || 'http://127.0.0.1:3001'
const prefetchMode = process.env.STORY_E2E_PREFETCH_MODE === 'hit' ? 'hit' : 'miss'

async function call(path, options = {}) {
  const startedAt = performance.now()
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  const payload = await response.json()
  const durationMs = Math.round(performance.now() - startedAt)
  if (!response.ok || !payload.ok) {
    const error = new Error(payload?.error?.message || `HTTP ${response.status}`)
    error.code = payload?.error?.code || `HTTP_${response.status}`
    error.details = payload?.error?.details || null
    error.durationMs = durationMs
    throw error
  }
  return { story: payload.story, durationMs }
}

async function drainArtifactJobs(story, sessionId, report, limit = 30) {
  let current = story
  for (let index = 0; index < limit; index += 1) {
    if (current.game_story_sync?.queued_story_stages === 0) return current
    const processed = await call(
      `/api/stories/${current.story_id}/generations/process`,
      {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      },
    )
    current = processed.story
    report.generation_requests.push({
      duration_ms: processed.durationMs,
      current_node_id: current.current_node_id,
      processing_artifact: current.artifact_progress?.processing_artifact || null,
      last_ready_artifact: current.artifact_progress?.last_ready_artifact || null,
      queued_artifacts: current.artifact_progress?.queued_artifacts || [],
      has_failed_job: Boolean(current.game_story_sync?.has_failed_job),
    })
    console.log(
      `generation_${report.generation_requests.length} artifact=${current.artifact_progress?.last_ready_artifact || 'none'} duration_ms=${processed.durationMs}`,
    )
    if (
      current.game_story_sync?.has_failed_job
      && !report.manual_recoveries.some(
        (recovery) => recovery.artifact_type
          === current.artifact_progress?.failed_artifact,
      )
      && current.artifact_progress?.failed_job_id
    ) {
      const recovered = await call(
        `/api/stories/${current.story_id}/generations/process`,
        {
          method: 'POST',
          body: JSON.stringify({
            session_id: sessionId,
            retry_job_id: current.artifact_progress.failed_job_id,
          }),
        },
      )
      report.manual_recoveries.push({
        artifact_type: current.artifact_progress.failed_artifact,
        failed_job_id: current.artifact_progress.failed_job_id,
        duration_ms: recovered.durationMs,
      })
      current = recovered.story
      continue
    }
    if (current.game_story_sync?.has_failed_job) {
      throw Object.assign(new Error('A persistent artifact job failed.'), {
        code: 'ARTIFACT_JOB_FAILED',
      })
    }
  }
  throw Object.assign(new Error(`Artifact queue exceeded ${limit} worker turns.`), {
    code: 'ARTIFACT_QUEUE_DID_NOT_DRAIN',
  })
}

function materialAction(story, sessionId) {
  const selections = {
    frame: 'aluminum',
    solar: 'silicon',
    insulation: 'kapton',
    propulsion: 'aluminum-tank',
  }
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_02',
    module_id: 'M2',
    interactions: Object.entries(selections).map(([sectionId, optionId]) => ({
      section_id: sectionId,
      control_id: `m2-material-${sectionId}-${optionId}`,
      option_id: optionId,
    })),
    client_action_id: randomUUID(),
  }
}

function missionAction(story, sessionId) {
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'SITE_INTERACTION_COMMIT',
    node_id: 'node_03',
    module_id: 'M3',
    interactions: [{
      section_id: 'mission_candidates',
      control_id: 'm3-mission-weather',
      option_id: 'weather',
    }],
    client_action_id: randomUUID(),
  }
}

function answerAction(story, sessionId, order) {
  const stage = GAME_STORY_STAGE_BINDINGS[order - 1]
  const event = ORBITAL_EVENTS[order - 1]
  const answer = event.options[(order - 1) % event.options.length]
  return {
    session_id: sessionId,
    version: story.version,
    action_type: 'GAME_ANSWER_CONFIRM',
    node_id: stage.target_node_id,
    game_module_id: stage.game_module_id,
    question_id: event.id,
    answer_id: answer.id,
    control_id: orbitalAnswerControlId(event.id, answer.id),
    client_action_id: randomUUID(),
  }
}

const sessionId = randomUUID()
const report = {
  model_flow: 'real HTTP API',
  prefetch_mode: prefetchMode,
  session_id: sessionId,
  story_id: null,
  create_duration_ms: null,
  material_duration_ms: null,
  mission_duration_ms: null,
  answer_acknowledgements: [],
  generation_requests: [],
  cleanup_match_acknowledgements: [],
  cleanup_completion: null,
  manual_recoveries: [],
  timeline: [],
  completed: false,
}

try {
  const created = await call('/api/stories', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      nickname: 'E2E_TEST_ACTOR',
      city: '合成测试城市',
      important_event: '这是自动化端到端测试使用的合成故事：测试角色要在模拟展览关闭前修复一盏虚构的纪念灯，并与两名虚构同伴完成点灯流程。以上人物、地点和事件均不对应真实个人。',
      satellite: {
        name: 'E2E-ORBITAL-STORY',
        noradId: 99001,
        altitudeKm: 790,
        inclination: 98.2,
      },
      game_context: { damage_level: 0, history_event_ids: [] },
      language: 'zh',
    }),
  })
  let story = created.story
  report.story_id = story.story_id
  report.create_duration_ms = created.durationMs
  console.log(`created node=${story.current_node_id} duration_ms=${created.durationMs}`)

  if (prefetchMode === 'hit') {
    story = await drainArtifactJobs(story, sessionId, report)
  }

  const material = await call(`/api/stories/${story.story_id}/actions`, {
    method: 'POST',
    body: JSON.stringify(materialAction(story, sessionId)),
  })
  story = material.story
  report.material_duration_ms = material.durationMs
  console.log(`material node=${story.current_node_id} duration_ms=${material.durationMs}`)

  if (prefetchMode === 'hit') {
    story = await drainArtifactJobs(story, sessionId, report)
  }

  if (process.env.STORY_E2E_STOP_AFTER === 'material') {
    report.timeline = story.timeline.map((stage) => ({
      stage_index: stage.stage_index,
      node_id: stage.node_id,
      task_type: stage.task_type,
    }))
    console.log(`REAL_E2E_MATERIAL_RESULT=${JSON.stringify(report)}`)
    throw Object.assign(new Error('Material checkpoint completed.'), {
      code: 'STOP_AFTER_MATERIAL_COMPLETE',
    })
  }

  const mission = await call(`/api/stories/${story.story_id}/actions`, {
    method: 'POST',
    body: JSON.stringify(missionAction(story, sessionId)),
  })
  story = mission.story
  report.mission_duration_ms = mission.durationMs
  console.log(`mission node=${story.current_node_id} duration_ms=${mission.durationMs}`)

  if (prefetchMode === 'hit') {
    story = await drainArtifactJobs(story, sessionId, report)
  }

  for (let order = 1; order <= GAME_STORY_STAGE_BINDINGS.length; order += 1) {
    const action = answerAction(story, sessionId, order)
    const accepted = await call(`/api/stories/${story.story_id}/actions`, {
      method: 'POST',
      body: JSON.stringify(action),
    })
    story = accepted.story
    report.answer_acknowledgements.push({
      order,
      question_id: action.question_id,
      answer_id: action.answer_id,
      target_node_id: action.node_id,
      duration_ms: accepted.durationMs,
      job_status: story.action_confirmation?.artifact_job_status || null,
      answered_questions: story.game_story_sync?.answered_questions || 0,
    })
    console.log(`answer_${order} ack_ms=${accepted.durationMs} status=${story.action_confirmation?.artifact_job_status}`)
    if (prefetchMode === 'hit') {
      story = await drainArtifactJobs(story, sessionId, report)
    }
  }

  if (story.current_node_id !== 'node_05') {
    throw Object.assign(new Error(`Expected node_05 after all six orbital answers, received ${story.current_node_id}.`), {
      code: 'M6_NOT_READY',
    })
  }

  const cleanupTargets = story.public_game_state?.cleanup_test?.target_set || []
  if (cleanupTargets.length !== 3) {
    throw Object.assign(new Error(`Expected 3 backend cleanup targets, received ${cleanupTargets.length}.`), {
      code: 'M6_TARGET_SET_INVALID',
    })
  }
  for (const target of cleanupTargets) {
    const accepted = await call(`/api/stories/${story.story_id}/actions`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        version: story.version,
        action_type: 'M6_MATCH_UPDATE',
        node_id: 'node_05',
        module_id: 'M6_CLEANUP_MATCHING',
        cleanup_target_id: target.cleanup_target_id,
        cleanup_method_id: target.preferred_method_id,
        client_action_id: randomUUID(),
      }),
    })
    story = accepted.story
    report.cleanup_match_acknowledgements.push({
      cleanup_target_id: target.cleanup_target_id,
      cleanup_method_id: target.preferred_method_id,
      accepted: story.action_confirmation?.accepted === true,
      is_allowed_match: story.action_confirmation?.cleanup_match?.is_allowed_match === true,
      duration_ms: accepted.durationMs,
    })
    console.log(`cleanup_match target=${target.cleanup_target_id} method=${target.preferred_method_id} ack_ms=${accepted.durationMs}`)
  }

  const completion = await call(`/api/stories/${story.story_id}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      version: story.version,
      action_type: 'M6_MATCH_COMPLETE',
      node_id: 'node_05',
      module_id: 'M6_CLEANUP_MATCHING',
      completion_id: randomUUID(),
      client_action_id: randomUUID(),
    }),
  })
  story = completion.story
  report.cleanup_completion = {
    duration_ms: completion.durationMs,
    snapshot_count: story.action_confirmation?.snapshot_count || 0,
    job_status: story.action_confirmation?.artifact_job_status || null,
  }
  console.log(`cleanup_complete snapshots=${report.cleanup_completion.snapshot_count} ack_ms=${completion.durationMs}`)

  story = await drainArtifactJobs(story, sessionId, report)

  report.timeline = story.timeline.map((stage) => ({
    stage_index: stage.stage_index,
    node_id: stage.node_id,
    task_type: stage.task_type,
    artifact_type: stage.artifact_type,
    generated_from_node_id: stage.generated_from_node_id,
  }))
  report.completed = story.status === 'completed'
  report.ending_present = Boolean(story.final_story_if_completed?.ending)
  report.knowledge_present = Boolean(story.final_story_if_completed?.knowledge_reveal)
  report.artifact_metrics = story.artifact_progress?.metrics || null
  console.log(`REAL_E2E_RESULT=${JSON.stringify(report)}`)
  if (!report.completed) process.exitCode = 1
} catch (error) {
  if (error.code === 'STOP_AFTER_MATERIAL_COMPLETE') {
    process.exitCode = 0
  } else {
    console.error(`REAL_E2E_PARTIAL=${JSON.stringify(report)}`)
    console.error(`REAL_E2E_FAILED code=${error.code || 'UNKNOWN'} duration_ms=${error.durationMs ?? 'n/a'} message=${error.message} details=${JSON.stringify(error.details || null)}`)
    process.exitCode = 1
  }
}
