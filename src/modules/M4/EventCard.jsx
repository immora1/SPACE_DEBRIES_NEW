// 威胁事件卡片 + 三个决策选项
// phase: 'event'（展示威胁）| 'decision'（用户选择）
import { useState } from 'react'

const THREAT_LABELS = {
  debris_approach:  '碎片接近',
  solar_storm:      '太阳风暴',
  orbital_decay:    '轨道衰减',
  cascade_fragment: '级联碎片',
  fuel_leak:        '燃料泄漏',
}

const THREAT_COLORS = {
  debris_approach:  '#c8503a',
  solar_storm:      '#c8a040',
  orbital_decay:    '#6b4a7a',
  cascade_fragment: '#c8503a',
  fuel_leak:        '#c8a040',
}

export default function EventCard({ event, onChoose, disabled }) {
  const [hovered, setHovered] = useState(null)

  if (!event) return null

  const typeColor = THREAT_COLORS[event.type] || '#c8b89a'
  const typeLabel = THREAT_LABELS[event.type] || event.type

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(to top, rgba(10,10,10,0.98) 60%, rgba(10,10,10,0) 100%)',
      padding: '0 24px 28px',
      zIndex: 10,
    }}>

      {/* 威胁类型标签 */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '10px',
          letterSpacing: '0.12em',
          color: typeColor,
          border: `1px solid ${typeColor}`,
          padding: '2px 8px',
          borderRadius: 2,
        }}>
          ⚠ {typeLabel.toUpperCase()}
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#6b6b66' }}>
          {event.realRef}
        </span>
      </div>

      {/* 威胁标题 */}
      <h3 style={{
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '18px',
        color: '#f5f4f0',
        margin: '0 0 8px',
        fontWeight: 400,
      }}>
        {event.title}
      </h3>

      {/* 威胁描述 */}
      <p style={{
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '13px',
        color: '#a0a09a',
        lineHeight: 1.7,
        margin: '0 0 18px',
        maxWidth: 680,
      }}>
        {event.description}
      </p>

      {/* 三个选项 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {event.options.map((opt) => (
          <button
            key={opt.id}
            disabled={disabled}
            onMouseEnter={() => setHovered(opt.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChoose(opt)}
            style={{
              flex: '1 1 180px',
              background: hovered === opt.id ? '#1a1a18' : '#111110',
              border: `1px solid ${hovered === opt.id ? '#c8b89a' : '#2a2a28'}`,
              borderRadius: 4,
              padding: '12px 16px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: disabled ? 0.5 : 1,
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <div style={{
              fontFamily: 'Noto Sans SC, sans-serif',
              fontSize: '13px',
              color: hovered === opt.id ? '#f5f4f0' : '#d0cfc8',
              marginBottom: 4,
              transition: 'color 0.2s',
            }}>
              {opt.label}
            </div>
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '10px',
              color: '#6b6b66',
              letterSpacing: '0.05em',
            }}>
              {opt.subtext}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
