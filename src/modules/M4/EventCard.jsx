// 右侧悬浮威胁事件面板 — glassmorphism 设计，从右侧滑入
import { useState } from 'react'
import { motion } from 'framer-motion'

const ACCENT = '#5046e5'

const THREAT_INFO = {
  debris_approach:  { label: '碎片接近', color: '#ef4444', icon: '◈', bg: 'rgba(239,68,68,0.08)'  },
  solar_storm:      { label: '太阳风暴', color: '#f59e0b', icon: '☀', bg: 'rgba(245,158,11,0.08)' },
  orbital_decay:    { label: '轨道衰减', color: '#8b5cf6', icon: '↓', bg: 'rgba(139,92,246,0.08)' },
  cascade_fragment: { label: '级联碎片', color: '#ef4444', icon: '✦', bg: 'rgba(239,68,68,0.08)'  },
  fuel_leak:        { label: '燃料泄漏', color: '#f59e0b', icon: '⚠', bg: 'rgba(245,158,11,0.08)' },
}

export default function EventCard({ event, onChoose, disabled, round, totalRounds, storyThread = [] }) {
  const [hovered, setHovered] = useState(null)

  if (!event) return null

  const info = THREAT_INFO[event.type] || { label: event.type, color: '#c8b89a', icon: '!', bg: 'rgba(200,184,154,0.08)' }
  const lastStory = storyThread.length > 0 ? storyThread[storyThread.length - 1] : null

  return (
    <motion.div
      key="event-panel"
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      style={{
        position: 'absolute',
        right: 0, top: 0,
        width: 360,
        height: '100%',
        background: 'rgba(4, 4, 14, 0.90)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderLeft: `1px solid rgba(80, 70, 229, 0.22)`,
        boxShadow: '-16px 0 48px rgba(0, 0, 0, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        overflowY: 'auto',
      }}
    >
      {/* Top accent line */}
      <div style={{
        height: 2,
        background: `linear-gradient(to right, transparent, ${ACCENT}cc, transparent)`,
        flexShrink: 0,
      }} />

      <div style={{ padding: '22px 20px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 10, letterSpacing: '0.12em',
            color: 'rgba(80,70,229,0.7)',
          }}>
            THREAT DETECTED
          </span>
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 10,
            color: '#3a3a5a',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 2,
            padding: '2px 8px',
          }}>
            {round} / {totalRounds}
          </span>
        </div>

        {/* Previous story context */}
        {lastStory && (
          <div style={{
            marginBottom: 18,
            padding: '10px 13px',
            background: 'rgba(107, 74, 122, 0.08)',
            borderLeft: '2px solid rgba(107, 74, 122, 0.30)',
            borderRadius: '0 4px 4px 0',
          }}>
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 9, letterSpacing: '0.1em',
              color: 'rgba(139, 92, 246, 0.55)',
              marginBottom: 5,
            }}>
              ▸ PARALLEL · 上一步
            </div>
            <p style={{
              fontFamily: 'Noto Serif SC, serif',
              fontSize: 12,
              color: '#504860',
              lineHeight: 1.78,
              margin: 0,
              fontStyle: 'italic',
            }}>
              {lastStory}
            </p>
          </div>
        )}

        {/* Threat badge */}
        <div style={{ marginBottom: 12 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 10, letterSpacing: '0.1em',
            color: info.color,
            background: info.bg,
            border: `1px solid ${info.color}55`,
            borderRadius: 2,
            padding: '3px 10px',
          }}>
            {info.icon}&nbsp;&nbsp;{info.label.toUpperCase()}
          </span>
        </div>

        {/* Event title */}
        <h3 style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: 19, fontWeight: 400,
          color: '#f0efe8',
          margin: '0 0 10px',
          lineHeight: 1.4,
        }}>
          {event.title}
        </h3>

        {/* Description */}
        <p style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: 13,
          color: '#7a7a74',
          lineHeight: 1.82,
          margin: '0 0 12px',
        }}>
          {event.description}
        </p>

        {/* Historical reference */}
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 10,
          color: 'rgba(80,70,229,0.50)',
          lineHeight: 1.65,
          marginBottom: 20,
          padding: '8px 12px',
          background: 'rgba(80, 70, 229, 0.05)',
          borderLeft: `2px solid rgba(80, 70, 229, 0.22)`,
          borderRadius: '0 3px 3px 0',
        }}>
          {event.realRef}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 14 }} />

        {/* CHOOSE label */}
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 9, letterSpacing: '0.14em',
          color: '#32324a',
          marginBottom: 10,
        }}>
          CHOOSE RESPONSE
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {event.options.map((opt, idx) => {
            const isHov = hovered === opt.id
            return (
              <motion.button
                key={opt.id}
                onHoverStart={() => setHovered(opt.id)}
                onHoverEnd={() => setHovered(null)}
                whileTap={{ scale: 0.985 }}
                onClick={() => !disabled && onChoose(opt)}
                style={{
                  background: isHov
                    ? 'rgba(80, 70, 229, 0.10)'
                    : 'rgba(255, 255, 255, 0.025)',
                  border: `1px solid ${isHov ? 'rgba(80,70,229,0.45)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 6,
                  padding: '12px 14px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  opacity: disabled ? 0.4 : 1,
                  transition: 'all 0.18s',
                  position: 'relative',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 10, right: 12,
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 10,
                  color: isHov ? ACCENT : '#2a2a42',
                  fontWeight: 'bold',
                  transition: 'color 0.18s',
                }}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <div style={{
                  fontFamily: 'Noto Sans SC, sans-serif',
                  fontSize: 13,
                  color: isHov ? '#f0efe8' : '#b4b4ac',
                  marginBottom: 4,
                  transition: 'color 0.18s',
                  paddingRight: 22,
                  lineHeight: 1.4,
                }}>
                  {opt.label}
                </div>
                <div style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 10,
                  color: isHov ? 'rgba(80,70,229,0.65)' : '#32324a',
                  transition: 'color 0.18s',
                }}>
                  {opt.subtext}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      <div style={{
        height: 1,
        background: `linear-gradient(to right, transparent, rgba(80,70,229,0.12), transparent)`,
        flexShrink: 0,
      }} />
    </motion.div>
  )
}
