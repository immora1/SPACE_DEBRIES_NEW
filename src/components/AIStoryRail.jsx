import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, GitBranch, MousePointer2, Sparkles } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import useI18n from '../i18n/useI18n'
import {
  getStoryPhase,
  getTimelineTickScale,
  publicStoryTimelineToEvents,
} from '../services/aiTimeline'
import { processQueuedStoryJobs, submitCurrentStoryOption } from '../services/ai'
import { getSiteInteractionProgress } from '../services/storySiteInteractions'
import './AIStoryRail.css'

export default function AIStoryRail() {
  const { language, pick } = useI18n()
  const aiTimeline = useAppStore((state) => state.aiTimeline)
  const storyTimeline = useAppStore((state) => state.storyTimeline)
  const storyId = useAppStore((state) => state.storyId)
  const storyStatus = useAppStore((state) => state.storyStatus)
  const storyFlowVersion = useAppStore((state) => state.storyFlowVersion)
  const currentModule = useAppStore((state) => state.currentModule)
  const storySessionReady = useAppStore((state) => state.storySessionReady)
  const currentStoryNode = useAppStore((state) => state.currentStoryNode)
  const currentStoryOptions = useAppStore((state) => state.currentStoryOptions)
  const currentStoryInteraction = useAppStore((state) => state.currentStoryInteraction)
  const materials = useAppStore((state) => state.materials)
  const publicGameState = useAppStore((state) => state.publicGameState)
  const storyLoading = useAppStore((state) => state.storyLoading)
  const gameStorySync = useAppStore((state) => state.gameStorySync)
  const artifactProgress = useAppStore((state) => state.artifactProgress)
  const publicStoryEntries = useMemo(
    () => publicStoryTimelineToEvents(storyTimeline, language),
    [language, storyTimeline],
  )
  const entries = publicStoryEntries.length ? publicStoryEntries : aiTimeline
  const phase = useMemo(
    () => getStoryPhase(entries, currentModule, language, {
      currentNodeId: currentStoryNode,
      currentInteraction: currentStoryInteraction,
      gameStorySync,
      storyStatus,
    }),
    [
      currentModule,
      currentStoryInteraction,
      currentStoryNode,
      entries,
      gameStorySync,
      language,
      storyStatus,
    ],
  )
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }), [language])
  const formatEventTime = (createdAt) => (
    createdAt
      ? timeFormatter.format(new Date(createdAt))
      : pick('历史记录', 'Archive')
  )

  const viewportRef = useRef(null)
  const closeTimerRef = useRef(0)
  const [hoverState, setHoverState] = useState(null)
  const [choiceError, setChoiceError] = useState('')
  const [pendingOptionId, setPendingOptionId] = useState(null)
  const retryActionRef = useRef(null)
  const generationKickRef = useRef(false)
  const hoveredIndex = hoverState?.index ?? null
  const hoveredEntry = hoveredIndex === null ? null : entries[hoveredIndex]
  const siteProgress = getSiteInteractionProgress(currentStoryInteraction, {
    materials,
    mission: publicGameState?.mission?.action_id || null,
    cleanupTargets: publicGameState?.cleanup_test?.target_set || [],
    cleanupMatches: publicGameState?.cleanup_test?.matches || [],
  })
  const storySessionMissing = !storySessionReady && !storyId
  const shouldShowMissingSession = storySessionMissing
    && ['m3', 'm4', 'm5', 'm6', 'm7'].includes(currentModule)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!storySessionReady || !viewport || !entries.length) return undefined

    const frameId = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      viewport.scrollTo({
        left: viewport.scrollWidth,
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [entries.length, storySessionReady])

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (
      generationKickRef.current
      || !storyId
      || !gameStorySync
      || gameStorySync.has_failed_job
      || artifactProgress?.failed_artifact
      || gameStorySync.queued_story_stages === 0
    ) return
    generationKickRef.current = true
    void processQueuedStoryJobs()
      .catch(() => {})
      .finally(() => {
        generationKickRef.current = false
      })
  }, [
    gameStorySync,
    artifactProgress,
    storyId,
  ])

  function cancelClose() {
    if (!closeTimerRef.current) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = 0
  }

  function openEntry(event, index) {
    cancelClose()
    const rect = event.currentTarget.getBoundingClientRect()
    const popoverHalfWidth = Math.min(190, Math.max(140, (window.innerWidth - 24) / 2))
    const center = rect.left + rect.width / 2
    const x = Math.max(
      popoverHalfWidth + 12,
      Math.min(window.innerWidth - popoverHalfWidth - 12, center),
    )
    setHoverState({ index, x })
  }

  function closeEntrySoon() {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = 0
      setHoverState(null)
    }, 120)
  }

  async function chooseStoryOption(optionId) {
    if (storyLoading) return
    const retry = retryActionRef.current?.optionId === optionId
      ? retryActionRef.current
      : {
          optionId,
          clientActionId: globalThis.crypto.randomUUID(),
        }
    retryActionRef.current = retry
    setPendingOptionId(optionId)
    setChoiceError('')
    try {
      await submitCurrentStoryOption(optionId, retry.clientActionId)
      retryActionRef.current = null
    } catch (error) {
      setChoiceError(error?.message || pick('故事推进失败，请重试。', 'Story generation failed. Please retry.'))
    } finally {
      setPendingOptionId(null)
    }
  }

  if (storySessionMissing && !shouldShowMissingSession) return null

  return (
    <div className="ai-story-hud" aria-label={pick('AI 个性化故事记录', 'AI personalized story log')}>
      <aside className="ai-story-phase" aria-live="polite">
        <div className="ai-story-phase__eyebrow">
          <GitBranch size={13} strokeWidth={1.7} />
          <span>CURRENT STORY PHASE</span>
        </div>
        <div className="ai-story-phase__heading">
          <b>{phase.code}</b>
          <h2>{phase.label}</h2>
        </div>
        <p>{phase.impact}</p>
        <div className="ai-story-phase__action">
          <MousePointer2 size={13} strokeWidth={1.7} />
          <span>{phase.action}</span>
        </div>
        {storySessionMissing ? (
          <section className="ai-story-phase__site-wait" aria-live="polite">
            <header>
              <span>STORY SESSION</span>
              <small>RECOVERY REQUIRED</small>
            </header>
            <p>{pick(
              '当前没有有效故事会话。若身份、卫星和材料信息仍完整，点击页面中的“重试生成”会自动恢复到当前任务节点。',
              'There is no active story session. If identity, satellite, and material data are still available, Retry generation will automatically restore the current mission node.',
            )}</p>
          </section>
        ) : artifactProgress?.waiting_reveal_artifact
          || artifactProgress?.processing_artifact
          || artifactProgress?.failed_artifact
          || currentStoryInteraction?.interaction_mode === 'SITE_GAME_RESULT'
          || (
            storyStatus !== 'completed'
            && gameStorySync?.answered_questions === gameStorySync?.total_questions
            && (
              gameStorySync?.queued_story_stages
              || gameStorySync?.current_generation_node
              || gameStorySync?.has_failed_job
            )
          ) ? (
          <section className="ai-story-phase__site-wait" aria-live="polite">
            <header>
              <span>STORY ARTIFACT SYNC</span>
              <small>{artifactProgress?.artifact_generation_version ?? gameStorySync?.generated_story_stages ?? 0}</small>
            </header>
            <p>{artifactProgress?.failed_artifact
              ? pick(
                  `${artifactProgress.failed_artifact} 两次生成均未通过，网站操作与数值状态已保存，无需重新操作。`,
                  `${artifactProgress.failed_artifact} failed both generation attempts. The site action and numeric state are saved; do not repeat the action.`,
                )
              : artifactProgress?.waiting_reveal_artifact
                ? pick(
                    `正在等待 ${artifactProgress.waiting_reveal_artifact}，当前网站操作已经保存。`,
                    `Waiting briefly for ${artifactProgress.waiting_reveal_artifact}; the current site action is already saved.`,
                  )
                : artifactProgress?.processing_artifact
                  ? pick(
                      `正在后台生成 ${artifactProgress.processing_artifact}，网站操作可继续。`,
                      `Generating ${artifactProgress.processing_artifact} in the background; site interactions can continue.`,
                    )
              : gameStorySync?.has_failed_job
                ? pick('故事生成遇到问题，游戏进度已保存，可单独重试故事。', 'Story generation hit a problem. Game progress is saved and the story can be retried separately.')
              : gameStorySync?.current_generation_node
                ? gameStorySync.current_generation_node === 'node_05'
                  ? pick('正在整理最终故事与知识揭示，游戏进度已保存。', 'Finalizing the story and knowledge reveal; game progress is saved.')
                  : pick(`正在后台生成 ${gameStorySync.current_generation_node}，游戏可继续。`, `Generating ${gameStorySync.current_generation_node} in the background; the game can continue.`)
                : gameStorySync?.queued_story_stages
                  ? currentStoryNode === 'node_05'
                    ? pick('正在整理最终故事与知识揭示，游戏进度已保存。', 'Finalizing the story and knowledge reveal; game progress is saved.')
                    : pick('故事已排队，将按节点顺序补齐，游戏可继续。', 'Story stages are queued and will be completed in order; the game can continue.')
                  : pick('请在右侧轨道事件面板确认答案。', 'Confirm an answer in the orbital-event panel.')}</p>
            {gameStorySync?.has_failed_job ? (
              <button
                type="button"
                onClick={() => void processQueuedStoryJobs({
                  retryJobId: artifactProgress?.failed_job_id
                    || gameStorySync.failed_job_id,
                }).catch(() => {})}
              >
                {pick('重试故事生成', 'Retry story generation')}
              </button>
            ) : null}
          </section>
        ) : currentStoryInteraction?.interaction_mode?.startsWith('SITE_') ? (
          <section className="ai-story-phase__site-wait" aria-live="polite">
            <header>
              <span>{currentStoryInteraction.node_id} / SITE INTERACTION</span>
              <small>{siteProgress.completed} / {siteProgress.total}</small>
            </header>
            <p>{pick(
              currentStoryInteraction.waiting_prompt?.zh || '请在页面主区域完成当前操作以推进故事。',
              currentStoryInteraction.waiting_prompt?.en || 'Complete the current action in the main page to continue the story.',
            )}</p>
          </section>
        ) : null}
        {storyFlowVersion !== 'FIVE_STAGE_V1' && currentStoryOptions.length ? (
          <section className="ai-story-phase__choices" aria-label={pick('当前故事选项', 'Current story options')}>
            <header>
              <span>{currentStoryNode} / {currentStoryOptions.length} OPTIONS</span>
              {storyLoading ? <small>{pick('生成中', 'GENERATING')}</small> : null}
            </header>
            <div>
              {currentStoryOptions.map((option, index) => (
                <button
                  key={option.option_id}
                  type="button"
                  disabled={storyLoading}
                  title={option.effect_summary}
                  onClick={() => void chooseStoryOption(option.option_id)}
                >
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{option.label}</span>
                  {pendingOptionId === option.option_id ? <i aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
            {choiceError ? <p role="alert">{choiceError}</p> : null}
          </section>
        ) : null}
      </aside>

      {hoveredEntry ? (
        <article
          className="ai-story-popover"
          style={{ '--ai-popover-x': `${hoverState.x}px` }}
          onPointerEnter={cancelClose}
          onPointerLeave={closeEntrySoon}
        >
          <header>
            <span>{hoveredEntry.stageCode} / AI RECORD</span>
            <time><Clock3 size={12} strokeWidth={1.7} />{formatEventTime(hoveredEntry.createdAt)}</time>
          </header>
          <h3>{hoveredEntry.title}</h3>
          <section>
            <div><Sparkles size={13} strokeWidth={1.7} /><b>{pick('AI 输出', 'AI output')}</b></div>
            <p className="ai-story-popover__output">{hoveredEntry.content}</p>
          </section>
          <section>
            <div><MousePointer2 size={13} strokeWidth={1.7} /><b>{pick('用户选择', 'User choice')}</b></div>
            <p>{hoveredEntry.choice}</p>
          </section>
          <section>
            <div><GitBranch size={13} strokeWidth={1.7} /><b>{pick('故事影响', 'Story impact')}</b></div>
            <p>{hoveredEntry.impact}</p>
          </section>
        </article>
      ) : null}

      {entries.length ? <div className="ai-story-rail">
        <div ref={viewportRef} className="ai-story-rail__viewport">
          <div className="ai-story-rail__track">
            {entries.map((entry, index) => {
              const scale = getTimelineTickScale(index, hoveredIndex)
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`ai-story-tick${index === hoveredIndex ? ' is-hovered' : ''}`}
                  style={{ '--ai-tick-scale': scale }}
                  aria-label={`${entry.stageCode} ${entry.title}`}
                  onPointerEnter={(event) => openEntry(event, index)}
                  onPointerLeave={closeEntrySoon}
                  onFocus={(event) => openEntry(event, index)}
                  onBlur={closeEntrySoon}
                >
                  <span className="ai-story-tick__line" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </div>
      </div> : null}
    </div>
  )
}
