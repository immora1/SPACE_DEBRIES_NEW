// 威胁事件面板 — 白色磨砂玻璃面板内联
import { useState } from 'react'
import { motion } from 'framer-motion'

const ACCENT  = '#5046e5'
const TEXT    = '#121212'
const TEXT60  = 'rgba(18,18,18,0.60)'
const TEXT35  = 'rgba(18,18,18,0.35)'

const THREAT_INFO = {
  debris_approach:  { label: '碎片接近', color: '#dc2626', icon: '◈', bg: 'rgba(220,38,38,0.07)'  },
  solar_storm:      { label: '太阳风暴', color: '#d97706', icon: '☀', bg: 'rgba(217,119,6,0.07)'  },
  orbital_decay:    { label: '轨道衰减', color: '#7c3aed', icon: '↓', bg: 'rgba(124,58,237,0.07)' },
  cascade_fragment: { label: '级联碎片', color: '#dc2626', icon: '✦', bg: 'rgba(220,38,38,0.07)'  },
  fuel_leak:        { label: '燃料泄漏', color: '#d97706', icon: '⚠', bg: 'rgba(217,119,6,0.07)'  },
}

export default function EventCard({ event, onChoose, disabled, round, totalRounds, storyThread = [] }) {
  const [hovered, setHovered] = useState(null)
  if (!event) return null

  const info = THREAT_INFO[event.type] || { label: event.type, color: ACCENT, icon: '!', bg: 'rgba(80,70,229,0.07)' }
  const lastStory = storyThread.length > 0 ? storyThread[storyThread.length - 1] : null

  return (
    <motion.div
      key="event-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ padding: '16px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 9, letterSpacing: '0.14em', fontWeight: 700,
            color: TEXT35,
          }}>
            THREAT DETECTED
          </span>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700,
            color: TEXT60,
            background: 'rgba(18,18,18,0.06)',
            border: '1px solid rgba(18,18,18,0.10)',
            borderRadius: 2, padding: '2px 7px',
          }}>
            {round} / {totalRounds}
          </span>
        </div>

        {/* Previous story context */}
        {lastStory && (
          <div style={{
            marginBottom: 12, padding: '9px 12px',
            background: 'rgba(80,70,229,0.06)',
            borderLeft: '2px solid rgba(80,70,229,0.35)',
            borderRadius: '0 4px 4px 0',
          }}>
            <div style={{
              fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.10em',
              color: 'rgba(80,70,229,0.6)', fontWeight: 700, marginBottom: 4,
            }}>
              ▸ PARALLEL · 上一步
            </div>
            <p style={{
              fontFamily: 'Noto Serif SC, serif', fontSize: 11,
              color: TEXT60, lineHeight: 1.75, margin: 0, fontStyle: 'italic',
            }}>
              {lastStory}
            </p>
          </div>
        )}

        {/* Threat badge */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.09em', fontWeight: 700,
            color: info.color, background: info.bg,
            border: `1px solid ${info.color}40`,
            borderRadius: 2, padding: '3px 9px',
          }}>
            {info.icon}&nbsp;&nbsp;{info.label.toUpperCase()}
          </span>
        </div>

        {/* Event title */}
        <h3 style={{
          fontFamily: 'Noto Serif SC, serif', fontSize: 17, fontWeight: 700,
          color: TEXT, margin: '0 0 8px', lineHeight: 1.4,
        }}>
          {event.title}
        </h3>

        {/* Description */}
        <p style={{
          fontFamily: 'Noto Sans SC, sans-serif', fontSize: 12, fontWeight: 500,
          color: TEXT60, lineHeight: 1.80, margin: '0 0 10px',
        }}>
          {event.description}
        </p>

        {/* Historical reference */}
        <div style={{
          fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 600,
          color: 'rgba(80,70,229,0.65)', lineHeight: 1.65, marginBottom: 14,
          padding: '7px 10px',
          background: 'rgba(80,70,229,0.06)',
          borderLeft: '2px solid rgba(80,70,229,0.30)',
          borderRadius: '0 3px 3px 0',
        }}>
          {event.realRef}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(18,18,18,0.08)', marginBottom: 10 }} />

        {/* CHOOSE label */}
        <div style={{
          fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.14em', fontWeight: 700,
          color: TEXT35, marginBottom: 8,
        }}>
          CHOOSE RESPONSE
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
                  background: isHov ? 'rgba(80,70,229,0.08)' : 'rgba(18,18,18,0.04)',
                  border: `1px solid ${isHov ? 'rgba(80,70,229,0.40)' : 'rgba(18,18,18,0.10)'}`,
                  borderRadius: 4, padding: '10px 12px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  textAlign: 'left', opacity: disabled ? 0.4 : 1,
                  transition: 'all 0.18s', position: 'relative',
                }}
              >
                <div style={{
                  position: 'absolute', top: 9, right: 10,
                  fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
                  color: isHov ? ACCENT : TEXT35,
                  transition: 'color 0.18s',
                }}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <div style={{
                  fontFamily: 'Noto Sans SC, sans-serif', fontSize: 12, fontWeight: 600,
                  color: isHov ? TEXT : TEXT60,
                  marginBottom: 3, transition: 'color 0.18s',
                  paddingRight: 20, lineHeight: 1.4,
                }}>
                  {opt.label}
                </div>
                <div style={{
                  fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 600,
                  color: isHov ? 'rgba(80,70,229,0.70)' : TEXT35,
                  transition: 'color 0.18s',
                }}>
                  {opt.subtext}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
