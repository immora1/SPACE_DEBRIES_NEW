// HUD 状态栏 — 左上角半透明面板，SPACE GAME 风格
export default function HUD({ armor, fuel, missionProgress, round, totalRounds, satelliteName }) {
  function barColor(val) {
    if (val > 60) return '#10b981'
    if (val > 30) return '#f59e0b'
    return '#ef4444'
  }
  function glowColor(val) {
    if (val > 60) return 'rgba(16,185,129,0.5)'
    if (val > 30) return 'rgba(245,158,11,0.5)'
    return 'rgba(239,68,68,0.5)'
  }

  return (
    <div style={{
      position: 'absolute',
      top: 20, left: 20,
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      <div style={{
        background: 'rgba(4, 4, 14, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(80, 70, 229, 0.18)',
        borderRadius: 8,
        padding: '14px 18px',
        minWidth: 220,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Top accent */}
        <div style={{
          height: 1,
          background: 'linear-gradient(to right, rgba(80,70,229,0.6), transparent)',
          marginBottom: 12,
          marginLeft: -18, marginRight: -18,
          paddingLeft: 18,
        }} />

        {/* Satellite name */}
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 9, letterSpacing: '0.12em',
          color: 'rgba(80,70,229,0.6)',
          marginBottom: 3,
        }}>
          ACTIVE SAT
        </div>
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 12,
          color: '#6b7fff',
          fontWeight: 'bold',
          letterSpacing: '0.05em',
          marginBottom: 12,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 200,
        }}>
          {satelliteName || 'UNKNOWN-SAT'}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <StatBar label="ARMOR"   value={armor}           color={barColor(armor)}           glow={glowColor(armor)} />
          <StatBar label="FUEL"    value={fuel}            color={barColor(fuel)}            glow={glowColor(fuel)} />
          <StatBar label="MISSION" value={missionProgress} color="rgba(80,130,200,0.9)"     glow="rgba(80,130,200,0.4)" />
        </div>

        {/* Round counter */}
        <div style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 9, letterSpacing: '0.1em',
            color: '#2a2a40',
          }}>
            ROUND
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: i < round
                  ? 'rgba(80,70,229,0.8)'
                  : i === round - 1
                    ? 'rgba(80,70,229,1)'
                    : 'rgba(255,255,255,0.08)',
                boxShadow: i === round - 1 ? '0 0 6px rgba(80,70,229,0.8)' : 'none',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBar({ label, value, color, glow }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 9, letterSpacing: '0.1em',
          color: '#28283e',
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 10,
          color,
        }}>
          {Math.round(clamped)}%
        </span>
      </div>
      <div style={{
        height: 4,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          width: `${clamped}%`,
          background: color,
          borderRadius: 2,
          boxShadow: `0 0 6px ${glow}`,
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1), background 0.4s ease',
        }} />
      </div>
    </div>
  )
}

