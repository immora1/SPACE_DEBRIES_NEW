// HUD：护甲值 / 燃料值 / 任务进度 + 当前轮次
export default function HUD({ armor, fuel, missionProgress, round, totalRounds, satelliteName }) {
  function barColor(val) {
    if (val > 60) return '#4a6741'   // sci绿：良好
    if (val > 30) return '#c8a040'   // 金：警告
    return '#c8503a'                  // 红：危险
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      padding: '16px 24px',
      background: 'linear-gradient(to bottom, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0) 100%)',
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', flexWrap: 'wrap' }}>

        {/* 卫星名 + 轮次 */}
        <div style={{ minWidth: 160 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#6b6b66', letterSpacing: '0.1em', marginBottom: 4 }}>
            ACTIVE SATELLITE
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', color: '#c8b89a', fontWeight: 'bold' }}>
            {satelliteName || 'UNKNOWN-SAT'}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#6b6b66', marginTop: 4 }}>
            EVENT {round} / {totalRounds}
          </div>
        </div>

        {/* 护甲值 */}
        <StatBar label="ARMOR" value={armor} color={barColor(armor)} unit="%" />

        {/* 燃料值 */}
        <StatBar label="FUEL" value={fuel} color={barColor(fuel)} unit="%" />

        {/* 任务进度 */}
        <StatBar label="MISSION" value={missionProgress} color="#3d5a7a" unit="%" />
      </div>
    </div>
  )
}

function StatBar({ label, value, color, unit }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#6b6b66', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color }}>
          {Math.round(clamped)}{unit}
        </span>
      </div>
      <div style={{ height: 3, background: '#2a2a28', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${clamped}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.6s ease, background 0.3s ease',
        }} />
      </div>
    </div>
  )
}
