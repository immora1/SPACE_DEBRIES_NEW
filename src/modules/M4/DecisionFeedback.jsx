// 决策反馈面板 — 内容区（按钮已提取到面板底部固定区）
import { motion } from 'framer-motion'

const TEXT   = '#121212'
const TEXT60 = 'rgba(18,18,18,0.60)'
const TEXT35 = 'rgba(18,18,18,0.35)'

export default function DecisionFeedback({ feedback, storyThread = [] }) {
  if (!feedback) return null

  const isCorrect = feedback.outcome === 'correct'
  const isPartial = feedback.outcome === 'partial'
  const accentColor = isCorrect ? '#059669' : isPartial ? '#d97706' : '#dc2626'
  const statusLabel = isCorrect ? '✓  任务日志' : isPartial ? '△  部分有效' : '✗  故障报告'
  const statusBg    = isCorrect ? 'rgba(5,150,105,0.08)' : isPartial ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)'

  return (
    <motion.div
      key="feedback-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ padding: '16px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Outcome badge */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
            color: accentColor, background: statusBg,
            border: `1px solid ${accentColor}40`,
            borderRadius: 3, padding: '4px 12px',
            letterSpacing: '0.07em', display: 'inline-block',
          }}>
            {statusLabel}
          </div>
        </div>

        {/* AI technical log */}
        <div style={{ borderLeft: `2px solid ${accentColor}50`, paddingLeft: 12, marginBottom: 14 }}>
          <p style={{
            fontFamily: 'Noto Serif SC, serif', fontSize: 12, fontWeight: 600,
            color: TEXT60, lineHeight: 1.85, margin: 0,
          }}>
            {feedback.aiLog || feedback.techNote}
          </p>
        </div>

        {/* Tech note */}
        {feedback.techNote && feedback.aiLog && (
          <div style={{
            background: 'rgba(18,18,18,0.04)', border: '1px solid rgba(18,18,18,0.09)',
            borderRadius: 4, padding: '7px 10px', marginBottom: 14,
          }}>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.08em',
              fontWeight: 700, color: TEXT35,
            }}>
              TECH NOTE ·{' '}
            </span>
            <span style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: 11, fontWeight: 500, color: TEXT60 }}>
              {feedback.techNote}
            </span>
          </div>
        )}

        {/* Parallel Timeline */}
        {feedback.storyUpdate && (
          <div style={{
            background: 'rgba(80,70,229,0.06)', border: '1px solid rgba(80,70,229,0.20)',
            borderRadius: 6, padding: '14px', marginBottom: 16, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              background: 'linear-gradient(to right, rgba(80,70,229,0.30), transparent)',
            }} />
            <div style={{
              fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.12em', fontWeight: 700,
              color: 'rgba(80,70,229,0.65)', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>▸ PARALLEL TIMELINE</span>
              <span style={{ color: 'rgba(80,70,229,0.30)', fontSize: 7 }}>· 平行时空</span>
            </div>
            <p style={{
              fontFamily: 'Noto Serif SC, serif', fontSize: 13, fontWeight: 600,
              color: TEXT, lineHeight: 1.90, margin: 0,
            }}>
              {feedback.storyUpdate}
            </p>
            {storyThread.length > 0 && (
              <div style={{
                marginTop: 8, fontFamily: 'Space Mono, monospace', fontSize: 8, fontWeight: 700,
                color: TEXT35, textAlign: 'right',
              }}>
                第 {storyThread.length} 章
              </div>
            )}
          </div>
        )}

        {/* Delta chips */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <DeltaChip label="护甲" delta={feedback.armorDelta} />
          <DeltaChip label="燃料" delta={feedback.fuelDelta} />
          <DeltaChip label="任务" delta={feedback.missionDelta} />
        </div>
      </div>
    </motion.div>
  )
}

function DeltaChip({ label, delta }) {
  if (delta === 0 || delta == null) return null
  const pos = delta > 0
  const color = pos ? '#059669' : '#dc2626'
  return (
    <span style={{
      fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
      color,
      background: pos ? 'rgba(5,150,105,0.09)' : 'rgba(220,38,38,0.09)',
      border: `1px solid ${color}45`,
      borderRadius: 3, padding: '3px 8px',
    }}>
      {label} {pos ? '+' : ''}{delta}%
    </span>
  )
}
