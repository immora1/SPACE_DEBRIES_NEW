// AI 即时反馈展示：任务日志 / 故障报告 + 平行时空故事更新 + 技术注释
import { useEffect, useRef } from 'react'

export default function DecisionFeedback({ feedback, onContinue, isLast }) {
  const ref = useRef()

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [feedback])

  if (!feedback) return null

  const isCorrect  = feedback.outcome === 'correct'
  const isPartial  = feedback.outcome === 'partial'
  const accentColor = isCorrect ? '#4a6741' : isPartial ? '#c8a040' : '#c8503a'
  const statusLabel = isCorrect ? '✓ 任务日志' : isPartial ? '△ 部分有效' : '✗ 故障报告'

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(10,10,10,0.99) 70%, rgba(10,10,10,0) 100%)',
        padding: '0 24px 28px',
        zIndex: 10,
      }}
    >
      {/* 任务日志 / 故障报告 */}
      <div style={{
        borderLeft: `2px solid ${accentColor}`,
        paddingLeft: 14,
        marginBottom: 16,
      }}>
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '10px',
          color: accentColor,
          letterSpacing: '0.1em',
          marginBottom: 6,
        }}>
          {statusLabel}
        </div>
        <p style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: '13px',
          color: '#d0cfc8',
          lineHeight: 1.8,
          margin: 0,
        }}>
          {feedback.aiLog || feedback.techNote}
        </p>
      </div>

      {/* 技术注释（来自 gameData） */}
      {feedback.techNote && feedback.aiLog && (
        <div style={{
          background: '#111110',
          border: '1px solid #2a2a28',
          borderRadius: 4,
          padding: '8px 12px',
          marginBottom: 14,
        }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#6b6b66', letterSpacing: '0.08em' }}>
            TECH NOTE ·{' '}
          </span>
          <span style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: '12px', color: '#8a8a84' }}>
            {feedback.techNote}
          </span>
        </div>
      )}

      {/* 平行时空故事更新 */}
      {feedback.storyUpdate && (
        <div style={{
          background: 'rgba(107,74,122,0.12)',
          border: '1px solid rgba(107,74,122,0.3)',
          borderRadius: 4,
          padding: '10px 14px',
          marginBottom: 18,
        }}>
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '10px',
            color: '#6b4a7a',
            letterSpacing: '0.08em',
            marginBottom: 5,
          }}>
            PARALLEL · 平行时空
          </div>
          <p style={{
            fontFamily: 'Noto Serif SC, serif',
            fontSize: '13px',
            color: '#c0aacf',
            lineHeight: 1.8,
            margin: 0,
            fontStyle: 'italic',
          }}>
            {feedback.storyUpdate}
          </p>
        </div>
      )}

      {/* 数值变化指示 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <DeltaChip label="护甲" delta={feedback.armorDelta} />
        <DeltaChip label="燃料" delta={feedback.fuelDelta} />
        <DeltaChip label="任务" delta={feedback.missionDelta} />
      </div>

      {/* 继续按钮 */}
      <button
        onClick={onContinue}
        style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '12px',
          letterSpacing: '0.1em',
          color: '#c8b89a',
          background: 'transparent',
          border: '1px solid #c8b89a',
          borderRadius: 2,
          padding: '8px 24px',
          cursor: 'pointer',
        }}
      >
        {isLast ? '查看结算 →' : '继续 →'}
      </button>
    </div>
  )
}

function DeltaChip({ label, delta }) {
  if (delta === 0 || delta == null) return null
  const color = delta > 0 ? '#4a6741' : '#c8503a'
  const sign  = delta > 0 ? '+' : ''
  return (
    <span style={{
      fontFamily: 'Space Mono, monospace',
      fontSize: '11px',
      color,
      background: delta > 0 ? 'rgba(74,103,65,0.15)' : 'rgba(200,80,58,0.15)',
      border: `1px solid ${color}`,
      borderRadius: 2,
      padding: '2px 8px',
    }}>
      {label} {sign}{delta}%
    </span>
  )
}
