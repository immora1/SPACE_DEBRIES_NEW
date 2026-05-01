// 决策反馈面板 — 右侧悬浮，故事更新为视觉焦点
import { motion } from 'framer-motion'

export default function DecisionFeedback({ feedback, onContinue, isLast, storyThread = [] }) {
  if (!feedback) return null

  const isCorrect = feedback.outcome === 'correct'
  const isPartial = feedback.outcome === 'partial'
  const accentColor = isCorrect ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444'
  const statusLabel = isCorrect ? '✓  任务日志' : isPartial ? '△  部分有效' : '✗  故障报告'
  const statusBg    = isCorrect ? 'rgba(16,185,129,0.08)' : isPartial ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'

  return (
    <motion.div
      key="feedback-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
      <div style={{
        height: 2,
        background: `linear-gradient(to right, transparent, ${accentColor}aa, transparent)`,
        flexShrink: 0,
      }} />

      <div style={{ padding: '22px 20px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Outcome header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 11,
            color: accentColor,
            background: statusBg,
            border: `1px solid ${accentColor}55`,
            borderRadius: 3,
            padding: '4px 12px',
            letterSpacing: '0.08em',
            display: 'inline-block',
          }}>
            {statusLabel}
          </div>
        </div>

        {/* AI technical log */}
        <div style={{
          borderLeft: `2px solid ${accentColor}55`,
          paddingLeft: 13,
          marginBottom: 16,
        }}>
          <p style={{
            fontFamily: 'Noto Serif SC, serif',
            fontSize: 13,
            color: '#c0c0b8',
            lineHeight: 1.85,
            margin: 0,
          }}>
            {feedback.aiLog || feedback.techNote}
          </p>
        </div>

        {/* Tech note */}
        {feedback.techNote && feedback.aiLog && (
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.055)',
            borderRadius: 4,
            padding: '8px 12px',
            marginBottom: 18,
          }}>
            <span style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 9, letterSpacing: '0.08em',
              color: '#2a2a40',
            }}>
              TECH NOTE ·{' '}
            </span>
            <span style={{
              fontFamily: 'Noto Sans SC, sans-serif',
              fontSize: 11,
              color: '#565650',
            }}>
              {feedback.techNote}
            </span>
          </div>
        )}

        {/* ══ PARALLEL TIMELINE — visual focus ══ */}
        {feedback.storyUpdate && (
          <div style={{
            background: 'rgba(107, 74, 150, 0.11)',
            border: '1px solid rgba(107, 74, 150, 0.30)',
            borderRadius: 8,
            padding: '16px 16px',
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, height: 1,
              background: 'linear-gradient(to right, rgba(139,92,246,0.38), transparent)',
            }} />
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 9, letterSpacing: '0.12em',
              color: 'rgba(139, 92, 246, 0.70)',
              marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>▸ PARALLEL TIMELINE</span>
              <span style={{ color: 'rgba(139,92,246,0.28)', fontSize: 8 }}>· 平行时空</span>
            </div>
            <p style={{
              fontFamily: 'Noto Serif SC, serif',
              fontSize: 14,
              color: '#c4b2d8',
              lineHeight: 1.95,
              margin: 0,
              fontStyle: 'italic',
            }}>
              {feedback.storyUpdate}
            </p>
            {storyThread.length > 0 && (
              <div style={{
                marginTop: 10,
                fontFamily: 'Space Mono, monospace',
                fontSize: 9,
                color: 'rgba(107,74,150,0.35)',
                textAlign: 'right',
              }}>
                第 {storyThread.length} 章
              </div>
            )}
          </div>
        )}

        {/* Delta chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          <DeltaChip label="护甲" delta={feedback.armorDelta} />
          <DeltaChip label="燃料" delta={feedback.fuelDelta} />
          <DeltaChip label="任务" delta={feedback.missionDelta} />
        </div>

        {/* Continue button */}
        <motion.button
          onClick={onContinue}
          whileHover={{ opacity: 0.85 }}
          whileTap={{ scale: 0.97 }}
          style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 12, letterSpacing: '0.12em',
            color: isLast ? '#0a0a0a' : '#c8b89a',
            background: isLast ? '#c8b89a' : 'transparent',
            border: `1px solid ${isLast ? '#c8b89a' : 'rgba(200,184,154,0.30)'}`,
            borderRadius: 3,
            padding: '10px 24px',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {isLast ? '查看结算 →' : '继续 →'}
        </motion.button>
      </div>

      <div style={{
        height: 1,
        background: `linear-gradient(to right, transparent, rgba(80,70,229,0.10), transparent)`,
        flexShrink: 0,
      }} />
    </motion.div>
  )
}

function DeltaChip({ label, delta }) {
  if (delta === 0 || delta == null) return null
  const pos = delta > 0
  const color = pos ? '#10b981' : '#ef4444'
  return (
    <span style={{
      fontFamily: 'Space Mono, monospace',
      fontSize: 11,
      color,
      background: pos ? 'rgba(16,185,129,0.09)' : 'rgba(239,68,68,0.09)',
      border: `1px solid ${color}50`,
      borderRadius: 3,
      padding: '3px 9px',
    }}>
      {label} {pos ? '+' : ''}{delta}%
    </span>
  )
}
