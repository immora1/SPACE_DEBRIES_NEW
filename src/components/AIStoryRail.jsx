import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, GitBranch, MousePointer2, Sparkles } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import {
  getStoryPhase,
  getTimelineTickScale,
} from '../services/aiTimeline'
import './AIStoryRail.css'

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function formatEventTime(createdAt) {
  return createdAt ? timeFormatter.format(new Date(createdAt)) : '历史记录'
}

export default function AIStoryRail() {
  const aiTimeline = useAppStore((state) => state.aiTimeline)
  const currentModule = useAppStore((state) => state.currentModule)
  const storySessionReady = useAppStore((state) => state.storySessionReady)
  const entries = aiTimeline
  const phase = useMemo(
    () => getStoryPhase(entries, currentModule),
    [currentModule, entries],
  )

  const viewportRef = useRef(null)
  const closeTimerRef = useRef(0)
  const [hoverState, setHoverState] = useState(null)
  const hoveredIndex = hoverState?.index ?? null
  const hoveredEntry = hoveredIndex === null ? null : entries[hoveredIndex]

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

  if (!storySessionReady) return null

  return (
    <div className="ai-story-hud" aria-label="AI 个性化故事记录">
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
            <div><Sparkles size={13} strokeWidth={1.7} /><b>AI 输出</b></div>
            <p className="ai-story-popover__output">{hoveredEntry.content}</p>
          </section>
          <section>
            <div><MousePointer2 size={13} strokeWidth={1.7} /><b>用户选择</b></div>
            <p>{hoveredEntry.choice}</p>
          </section>
          <section>
            <div><GitBranch size={13} strokeWidth={1.7} /><b>故事影响</b></div>
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
