import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, RotateCcw } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import useI18n from '../i18n/useI18n'
import { publicStoryTimelineToEvents } from '../services/aiTimeline'
import { retryBackgroundStory } from '../services/ai'
import './AIStoryRail.css'

export default function AIStoryRail() {
  const { language, pick } = useI18n()
  const storyTimeline = useAppStore((state) => state.storyTimeline)
  const storyId = useAppStore((state) => state.storyId)
  const storySessionReady = useAppStore((state) => state.storySessionReady)
  const pending = useAppStore((state) => state.storyBackgroundPending)
  const error = useAppStore((state) => state.storyBackgroundError)
  const entries = useMemo(() => publicStoryTimelineToEvents(storyTimeline, language)
    .filter((entry) => entry.content?.trim()), [storyTimeline, language])
  const seen = useRef(new Set())
  const restoring = useRef(Boolean(storyId))
  const [waiting, setWaiting] = useState([])
  const [archived, setArchived] = useState([])
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const cardRef = useRef(null)
  const dockRef = useRef(null)
  const returnFocusRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const activeId = selected || waiting[0]
  const active = entries.find((entry) => entry.id === activeId)
  const archiveEntries = entries.filter((entry) => archived.includes(entry.id) && entry.id !== activeId)
  const preview = !active && entries.find((entry) => entry.id === hovered)

  useEffect(() => {
    if (!storyId && !entries.length) {
      seen.current.clear()
      restoring.current = false
      setWaiting([])
      setArchived([])
      setSelected(null)
      setHovered(null)
      return
    }
    const fresh = entries.filter((entry) => !seen.current.has(entry.id)).map((entry) => entry.id)
    if (!fresh.length) return
    fresh.forEach((id) => seen.current.add(id))
    if (restoring.current) {
      setArchived((current) => [...current, ...fresh])
      restoring.current = false
    } else {
      setWaiting((current) => [...current, ...fresh])
    }
  }, [entries, storyId, storySessionReady])

  useEffect(() => {
    if (!activeId) return undefined
    returnFocusRef.current = document.activeElement
    cardRef.current?.focus({ preventScroll: true })
    function dismiss(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'click' && (cardRef.current?.contains(event.target) || dockRef.current?.contains(event.target))) return
      event.preventDefault()
      event.stopPropagation()
      setArchived((current) => current.includes(activeId) ? current : [...current, activeId])
      setWaiting((current) => current.filter((id) => id !== activeId))
      setSelected(null)
      setHovered(null)
      returnFocusRef.current?.focus?.({ preventScroll: true })
    }
    document.addEventListener('click', dismiss, true)
    document.addEventListener('keydown', dismiss, true)
    return () => {
      document.removeEventListener('click', dismiss, true)
      document.removeEventListener('keydown', dismiss, true)
    }
  }, [activeId])

  function collapse() {
    setArchived((current) => current.includes(activeId) ? current : [...current, activeId])
    setWaiting((current) => current.filter((id) => id !== activeId))
    setSelected(null)
    setHovered(null)
    returnFocusRef.current?.focus?.({ preventScroll: true })
  }

  function tilt(event) {
    if (reduceMotion || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--story-tilt-x', `${(0.5 - (event.clientY - rect.top) / rect.height) * 5}deg`)
    event.currentTarget.style.setProperty('--story-tilt-y', `${((event.clientX - rect.left) / rect.width - 0.5) * 5}deg`)
  }

  function resetTilt(event) {
    event.currentTarget.style.setProperty('--story-tilt-x', '0deg')
    event.currentTarget.style.setProperty('--story-tilt-y', '0deg')
  }

  if (!storySessionReady && !storyId) return null

  return (
    <div className="ai-story-hud" aria-label={pick('你的平行时空故事', 'Your parallel story')}>
      {active && <div className="ai-story-center">
        <motion.article
          key={active.id}
          layoutId={`story-card-${active.id}`}
          transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          ref={cardRef}
          className="ai-story-card"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ai-story-card-title"
          tabIndex={-1}
          onPointerMove={tilt}
          onPointerLeave={resetTilt}
        >
          <div className="ai-story-card__surface">
          <header>
            <span>PARALLEL LIFE / {String(entries.indexOf(active) + 1).padStart(2, '0')}</span>
            <button type="button" onClick={collapse} aria-label={pick('收起故事卡片', 'Collapse story card')}><ArrowDown size={18} /></button>
          </header>
          <h2 id="ai-story-card-title">{active.title}</h2>
          <div className="ai-story-card__body"><p>{active.content}</p></div>
          <footer>
            <span>{pick('点击卡片外部收起 · 故事保留在屏幕底部', 'Click outside to tuck this story along the bottom edge')}</span>
            {waiting.length > 1 && <span>{pick(`另有 ${waiting.length - 1} 段故事待阅读`, `${waiting.length - 1} more to read`)}</span>}
          </footer>
          </div>
        </motion.article>
      </div>}

      {!active && (error || pending > 0) && <div className="ai-story-status" role={error ? 'alert' : 'status'}>
        <span>{error
          ? pick('故事暂未送达，你可以继续浏览', 'Story delivery paused. Keep exploring.')
          : pick('平行时空的故事正在写来，你可以继续探索', 'Your parallel story is on its way. Keep exploring.')}</span>
        {error && <button type="button" onClick={() => void retryBackgroundStory()}><RotateCcw size={12} />{pick('重试', 'Retry')}</button>}
      </div>}

      {preview && <article className="ai-story-preview" aria-hidden="true">
        <span>PARALLEL LIFE / {String(entries.indexOf(preview) + 1).padStart(2, '0')}</span>
        <h3>{preview.title}</h3><p>{preview.content}</p>
        <small>{pick('点击卡片，展开阅读', 'Click the card to read')}</small>
      </article>}

      <nav ref={dockRef} className="ai-story-bottom" aria-label={pick('已收起的故事', 'Saved stories')}
        style={{ '--story-count': archiveEntries.length || 1 }}>
        {archiveEntries.map((entry, index) => <motion.button
          key={entry.id}
          layoutId={`story-card-${entry.id}`}
          transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          type="button"
          className="ai-story-bottom__card"
          style={{ '--story-index': index, zIndex: hovered === entry.id ? 20 : index + 1 }}
          aria-label={`${pick('重读', 'Read again')} ${String(entries.indexOf(entry) + 1).padStart(2, '0')} ${entry.title}`}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(entry.id) }}
          onPointerLeave={() => setHovered(null)}
          onFocus={() => setHovered(entry.id)}
          onBlur={() => setHovered(null)}
          onClick={() => { setSelected(entry.id); setHovered(null) }}
        >
          <span>{String(entries.indexOf(entry) + 1).padStart(2, '0')}</span>
          <strong>{entry.title}</strong>
        </motion.button>)}
      </nav>
    </div>
  )
}
