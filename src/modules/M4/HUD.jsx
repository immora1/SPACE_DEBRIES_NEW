// HUD 状态栏 — 白色磨砂玻璃面板内联，无独立定位
const TEXT   = '#121212'
const TEXT55 = 'rgba(18,18,18,0.55)'
const TEXT35 = 'rgba(18,18,18,0.35)'

export default function HUD({ armor, fuel, missionProgress, round, totalRounds, satelliteName }) {
  function barColor(val) {
    if (val > 60) return '#10b981'
    if (val > 30) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div style={{ padding: '16px 20px 14px', flexShrink: 0 }}>
      {/* Satellite name */}
      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase',
        color: TEXT35, fontWeight: 700, marginBottom: 3,
      }}>
        ACTIVE SAT
      </div>
      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
        color: TEXT,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 14,
      }}>
        {satelliteName || 'UNKNOWN-SAT'}
      </div>

      {/* Stat bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <StatBar label="ARMOR"   value={armor}           color={barColor(armor)} />
        <StatBar label="FUEL"    value={fuel}            color={barColor(fuel)} />
        <StatBar label="MISSION" value={missionProgress} color="#5046e5" />
      </div>

      {/* Round dots */}
      <div style={{
        marginTop: 12, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTop: '1px solid rgba(18,18,18,0.08)',
      }}>
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 8, letterSpacing: '0.12em', color: TEXT35, fontWeight: 700,
        }}>
          ROUND
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i < round
                ? '#5046e5'
                : i === round - 1
                  ? '#5046e5'
                  : 'rgba(18,18,18,0.12)',
              boxShadow: i === round - 1 ? '0 0 5px rgba(80,70,229,0.6)' : 'none',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatBar({ label, value, color }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 8, letterSpacing: '0.1em', color: TEXT35, fontWeight: 700,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 9, color, fontWeight: 700,
        }}>
          {Math.round(clamped)}%
        </span>
      </div>
      <div style={{
        height: 3, background: 'rgba(18,18,18,0.08)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${clamped}%`,
          background: color, borderRadius: 2,
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1), background 0.4s ease',
        }} />
      </div>
    </div>
  )
}
