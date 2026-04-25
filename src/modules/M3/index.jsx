import { useState } from 'react'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateEventNarrative, generateHistoryStory } from '../../services/ai'

const EASE = [0.16, 1, 0.3, 1]

const EVENTS = [
  { id: 'sputnik',   year: 1957, name: 'Sputnik 1 入轨',            nameEn: 'SPUTNIK 1',        description: '人类首颗人造卫星入轨，开启太空时代，也开始了碎片累积历史。',                           debrisCount: '—',      damage: 0 },
  { id: 'ablestar',  year: 1961, name: '首次在轨解体',               nameEn: 'FIRST BREAKUP',    description: 'Ablestar 上面级爆炸解体，产生有记录的第一批人工轨道碎片。',                           debrisCount: '~300',   damage: 1 },
  { id: 'kosmos954', year: 1978, name: 'Kosmos 954 核泄漏',          nameEn: 'KOSMOS 954',       description: '苏联核动力卫星失控再入，放射性碎片散落加拿大超过 600 km 范围。',                      debrisCount: '~50',    damage: 1 },
  { id: 'cerise',    year: 1996, name: 'Cerise 碎裂',                nameEn: 'CERISE COLLISION', description: 'Cerise 卫星被阿里亚娜残骸击中，首次有记录的在轨碎片碰撞，部分功能失效。',             debrisCount: '~5',     damage: 2 },
  { id: 'fengyun',   year: 2007, name: '风云一号 C 反卫测试',        nameEn: 'FY-1C ASAT TEST',  description: '中国摧毁自有气象卫星，单次产生 3,000+ 件可追踪碎片，LEO 碎片密度骤升。',             debrisCount: '3,000+', damage: 3 },
  { id: 'iridium',   year: 2009, name: '铱星-33 / Cosmos-2251 碰撞', nameEn: 'IRIDIUM × COSMOS', description: '首次大型运营卫星高速碰撞，产生约 2,000 件碎片，凯斯勒效应进入公众视野。',            debrisCount: '~2,000', damage: 3 },
  { id: 'iss2024',   year: 2024, name: 'ISS 电池托盘坠落',           nameEn: 'ISS BATTERY',      description: '国际空间站废弃电池托盘穿透佛罗里达民宅屋顶，法律归责至今悬而未决。',                  debrisCount: '~7',     damage: 1 },
]

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: '#6b6b66',
      marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #1a1a18',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{ display: 'inline-block', width: 10, height: 10, border: '1px solid #c8b89a', borderTopColor: 'transparent', borderRadius: '50%' }}
    />
  )
}

export default function M3({ onComplete }) {
  const satellite           = useAppStore((s) => s.satellite)
  const user                = useAppStore((s) => s.user)
  const storyOutline        = useAppStore((s) => s.storyOutline)
  const setDamageLevel      = useAppStore((s) => s.setDamageLevel)
  const setClickedHistoryEvents = useAppStore((s) => s.setClickedHistoryEvents)
  const setStoryChapter     = useAppStore((s) => s.setStoryChapter)

  const [expandedIds, setExpandedIds] = useState(new Set())
  const [narratives,  setNarratives]  = useState({})
  const [loadingId,   setLoadingId]   = useState(null)
  const [clickedIds,  setClickedIds]  = useState(new Set())
  const [storyState,  setStoryState]  = useState('idle')
  const [story,       setStory]       = useState('')

  const launchYear      = satellite?.launchYear ?? 9999
  const activatedEvents = EVENTS.filter((e) => e.year >= launchYear)
  const allClicked      = activatedEvents.length === 0 || activatedEvents.every((e) => clickedIds.has(e.id))

  const totalDamage = EVENTS
    .filter((e) => e.year >= launchYear && clickedIds.has(e.id))
    .reduce((sum, e) => sum + e.damage, 0)

  function toggleGray(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleActiveClick(event) {
    if (loadingId || clickedIds.has(event.id)) return
    setLoadingId(event.id)
    try {
      const result = await generateEventNarrative({ event, satellite, user, storyOutline })
      const narrative = result.narrative ?? ''

      const newClickedIds = new Set(clickedIds)
      newClickedIds.add(event.id)
      const newDamage = EVENTS
        .filter((e) => e.year >= launchYear && newClickedIds.has(e.id))
        .reduce((sum, e) => sum + e.damage, 0)

      setNarratives((prev) => ({ ...prev, [event.id]: narrative }))
      setClickedIds(newClickedIds)
      setDamageLevel(newDamage)
      setClickedHistoryEvents([...newClickedIds])
    } catch {
      // silently fail — user can retry by clicking again
    }
    setLoadingId(null)
  }

  async function handleGenerateStory() {
    if (storyState !== 'idle') return
    setStoryState('loading')
    try {
      const visitedEvents = activatedEvents.filter((e) => clickedIds.has(e.id))
      const result = await generateHistoryStory({ visitedEvents, satellite, user, damageLevel: totalDamage, storyOutline })
      const text = result.story ?? ''
      setStory(text)
      setStoryChapter('m3', text)
      setStoryState('done')
    } catch {
      setStoryState('error')
    }
  }

  // Split events around launch year
  const preEvents  = EVENTS.filter((e) => e.year < launchYear)
  const postEvents = EVENTS.filter((e) => e.year >= launchYear)

  function EventCard({ event }) {
    const isActive  = event.year >= launchYear
    const isClicked = clickedIds.has(event.id)
    const isLoading = loadingId === event.id
    const isExpanded = expandedIds.has(event.id)
    const narrative = narratives[event.id]

    const yearColor  = isActive ? '#c8b89a' : '#2e2e2c'
    const nameColor  = isActive ? (isClicked ? '#c8b89a' : '#e0dcd6') : (isExpanded ? '#5a5856' : '#484644')
    const borderLeft = isActive
      ? (isClicked ? '2px solid #c8b89a' : '2px solid rgba(200,184,154,0.25)')
      : 'none'

    function handleClick() {
      if (isActive) { handleActiveClick(event) }
      else { toggleGray(event.id) }
    }

    return (
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Year + dot */}
        <div style={{ width: 44, flexShrink: 0, textAlign: 'right', paddingTop: 14 }}>
          <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 10, color: yearColor, letterSpacing: '-0.02em' }}>
            {event.year}
          </span>
        </div>

        {/* Vertical line segment + dot */}
        <div style={{ width: 16, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 1, height: 14, background: '#1e1e1c' }} />
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#c8b89a' : '#252524', border: `1px solid ${isActive ? '#c8b89a' : '#2e2e2c'}`, flexShrink: 0 }} />
          <div style={{ width: 1, flex: 1, background: '#1e1e1c', minHeight: 14 }} />
        </div>

        {/* Card body */}
        <div
          onClick={handleClick}
          style={{
            flex: 1, marginBottom: 2,
            padding: '12px 14px',
            borderLeft,
            background: isActive && !isClicked ? 'rgba(200,184,154,0.03)' : 'transparent',
            cursor: isActive ? (isClicked || isLoading ? 'default' : 'pointer') : 'pointer',
            transition: 'background 0.15s ease, border-color 0.2s ease',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 7, color: isActive ? '#6b5a44' : '#282826', letterSpacing: '0.1em' }}>
              {event.nameEn}
            </span>
            <span style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 14, color: nameColor, transition: 'color 0.2s ease' }}>
              {event.name}
            </span>
            <span style={{
              marginLeft: 'auto', fontFamily: 'monospace', fontSize: 8,
              color: isActive ? '#6b5a44' : '#222220',
              border: `1px solid ${isActive ? 'rgba(200,184,154,0.2)' : '#1e1e1c'}`,
              padding: '1px 6px', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {event.debrisCount}
            </span>
          </div>

          {/* Description — always visible for active, toggle for gray */}
          {(isActive || isExpanded) && (
            <p style={{ fontSize: 11, color: isActive ? '#4a4846' : '#343230', lineHeight: 1.8, margin: 0, marginBottom: isClicked || isLoading ? 10 : 0 }}>
              {event.description}
            </p>
          )}

          {/* Loading state */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <Spinner />
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b5a44', letterSpacing: '0.08em' }}>RETRIEVING SATELLITE LOG...</span>
            </div>
          )}

          {/* Narrative */}
          {isClicked && narrative && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ marginTop: 10, padding: '10px 12px', borderLeft: '1px solid rgba(200,184,154,0.2)', background: 'rgba(200,184,154,0.04)' }}
            >
              <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 12, color: '#b0a090', lineHeight: 1.9, margin: 0, fontStyle: 'italic' }}>
                {narrative}
              </p>
            </motion.div>
          )}

          {/* Active hint for unclicked events */}
          {isActive && !isClicked && !isLoading && (
            <div style={{ marginTop: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(200,184,154,0.35)', letterSpacing: '0.08em' }}>
                ↵ 点击查看卫星记录
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', minHeight: '100vh' }}>

      {/* 顶部标题栏 */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #1a1a18' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          SPACE_DEBRIES · M3 · 重大历史事件
        </span>
      </div>

      {/* 导言 */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 32px 56px' }}>
        <h2 style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 24, fontWeight: 400, color: '#f5f4f0', lineHeight: 1.6, marginBottom: 12, letterSpacing: '0.02em' }}>
          每一次碰撞都留下了痕迹，<br />每一片碎片都还在轨道上。
        </h2>
        <p style={{ fontSize: 12, color: '#6b6b66', lineHeight: 1.9, maxWidth: 460 }}>
          从 1957 年第一颗卫星入轨至今，人类在太空留下的碎片从未减少。
          {satellite && launchYear < 9999 && (
            <span> 你的卫星 <span style={{ color: '#c8b89a' }}>{satellite.name}</span> 于 {launchYear} 年入轨——灰色事件发生在你之前，金色事件与你同处一个时代。</span>
          )}
        </p>
      </div>

      {/* 时间线 */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 32px 80px' }}>
        <SectionLabel>01 · 太空垃圾历史时间线</SectionLabel>

        {/* 灰色事件（发射前） */}
        {preEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}

        {/* 发射年份分隔线 */}
        {satellite && launchYear < 9999 && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', margin: '8px 0' }}>
            <div style={{ width: 44, flexShrink: 0 }} />
            <div style={{ width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 1, height: '100%', background: '#c8b89a', opacity: 0.4 }} />
            </div>
            <div style={{ flex: 1, padding: '10px 14px', borderLeft: '2px solid rgba(200,184,154,0.5)', background: 'rgba(200,184,154,0.05)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#c8b89a', letterSpacing: '0.12em' }}>
                ▶&nbsp;&nbsp;YOUR SATELLITE LAUNCHED HERE · {satellite.name} · {launchYear}
              </span>
            </div>
          </div>
        )}

        {/* 激活事件（发射后） */}
        {postEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}

        {/* 受损统计 */}
        {clickedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ marginTop: 32, padding: '14px 14px 14px 16px', borderLeft: '2px solid #c8b89a', background: 'rgba(200,184,154,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b5a44', letterSpacing: '0.1em' }}>CUMULATIVE DAMAGE LEVEL</span>
            <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 20, color: '#c8b89a' }}>{totalDamage}</span>
          </motion.div>
        )}

        {/* 生成故事按钮 */}
        {allClicked && activatedEvents.length > 0 && storyState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ textAlign: 'center', marginTop: 48 }}
          >
            <button
              onClick={handleGenerateStory}
              style={{
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                color: '#c8b89a', background: 'transparent',
                border: '1px solid rgba(200,184,154,0.4)', padding: '12px 28px',
                cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(200,184,154,0.08)'; e.currentTarget.style.borderColor = '#c8b89a' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(200,184,154,0.4)' }}
            >
              生成第三章叙事 →
            </button>
          </motion.div>
        )}

        {storyState === 'loading' && (
          <div style={{ textAlign: 'center', marginTop: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Spinner />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b5a44', letterSpacing: '0.1em' }}>GENERATING CHAPTER THREE...</span>
          </div>
        )}

        {storyState === 'error' && (
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b4444', letterSpacing: '0.08em' }}>生成失败，请重试</span>
            <button
              onClick={() => { setStoryState('idle') }}
              style={{ marginLeft: 16, fontFamily: 'monospace', fontSize: 10, color: '#c8b89a', background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}
            >
              重试
            </button>
          </div>
        )}

        {/* 故事区域 */}
        {storyState === 'done' && story && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            style={{ marginTop: 48, borderTop: '1px solid #1a1a18', paddingTop: 32 }}
          >
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b6b66', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                第三段 · 裂缝出现 · {satellite?.name ?? ''}
              </span>
            </div>
            <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 15, color: '#c8b89a', lineHeight: 2.0, letterSpacing: '0.02em' }}>
              {story}
            </p>

            {/* 进入下一章 */}
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <button
                onClick={onComplete}
                style={{
                  fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                  color: '#c8b89a', background: 'transparent',
                  border: '1px solid rgba(200,184,154,0.4)', padding: '12px 28px',
                  cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(200,184,154,0.08)'; e.currentTarget.style.borderColor = '#c8b89a' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(200,184,154,0.4)' }}
              >
                进入下一章：卫星生存游戏 →
              </button>
            </div>
          </motion.div>
        )}

        {/* 如果没有激活事件（发射年极早）直接显示进入按钮 */}
        {activatedEvents.length === 0 && satellite && (
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#484640', marginBottom: 24, letterSpacing: '0.08em' }}>
              你的卫星在所有主要事件之前入轨，已无激活事件需要记录。
            </p>
            <button
              onClick={onComplete}
              style={{
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                color: '#c8b89a', background: 'transparent',
                border: '1px solid rgba(200,184,154,0.4)', padding: '12px 28px',
                cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(200,184,154,0.08)'; e.currentTarget.style.borderColor = '#c8b89a' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(200,184,154,0.4)' }}
            >
              进入下一章：卫星生存游戏 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
