// 游戏结算页：卫星命运 + 故事结局 + 知识清单 + 碎片描述
export default function ReflectionPage({ reflection, gameResult, onComplete }) {
  if (!reflection) return null

  const isSuccess = gameResult === 'success'
  const resultColor = isSuccess ? '#4a6741' : '#c8503a'
  const resultLabel = isSuccess ? '任务成功' : '卫星失联'
  const resultDesc  = isSuccess
    ? '卫星完成了预定任务，25年后按规定离轨。'
    : '护甲值/燃料耗尽，卫星失去控制，成为新的太空垃圾。'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(4,4,15,0.96)',
      zIndex: 20,
      overflowY: 'auto',
      padding: '48px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{ maxWidth: 640, width: '100%' }}>

        {/* 结果标题 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.15em',
            color: resultColor,
            marginBottom: 10,
          }}>
            ── MISSION RESULT ──
          </div>
          <h2 style={{
            fontFamily: 'Noto Serif SC, serif',
            fontSize: '28px',
            color: '#e8e8f8',
            margin: '0 0 8px',
            fontWeight: 300,
          }}>
            {resultLabel}
          </h2>
          <p style={{
            fontFamily: 'Noto Sans SC, sans-serif',
            fontSize: '13px',
            color: '#484878',
            margin: 0,
          }}>
            {resultDesc}
          </p>
        </div>

        {/* 卫星命运 */}
        <Section label="SATELLITE FATE · 卫星命运">
          <p style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '14px', color: '#d0cfc8', lineHeight: 1.9, margin: 0 }}>
            {reflection.satFate}
          </p>
        </Section>

        {/* 平行时空结局 */}
        <Section label="PARALLEL · 平行时空结局">
          <div style={{
            borderLeft: '2px solid rgba(107,74,122,0.5)',
            paddingLeft: 16,
          }}>
            <p style={{
              fontFamily: 'Noto Serif SC, serif',
              fontSize: '14px',
              color: '#c0aacf',
              lineHeight: 1.9,
              margin: 0,
              fontStyle: 'italic',
            }}>
              {reflection.storyEnding}
            </p>
          </div>
        </Section>

        {/* 知识点清单 */}
        <Section label="KNOWLEDGE · 本次学到">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(reflection.knowledgePoints || []).map((pt, i) => (
              <li key={i} style={{ display: 'flex', gap: 10 }}>
                <span style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '11px',
                  color: '#4a6741',
                  flexShrink: 0,
                  paddingTop: 2,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{
                  fontFamily: 'Noto Sans SC, sans-serif',
                  fontSize: '13px',
                  color: '#a0a09a',
                  lineHeight: 1.7,
                }}>
                  {pt}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 碎片描述（传给M6） */}
        {reflection.debrisDescription && (
          <Section label="DEBRIS OUTPUT · 产生碎片">
            <div style={{
              background: '#08081a',
              border: '1px solid #2a2a28',
              borderRadius: 4,
              padding: '10px 14px',
            }}>
              <p style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: '11px',
                color: '#484878',
                margin: 0,
                lineHeight: 1.7,
              }}>
                {reflection.debrisDescription}
              </p>
            </div>
          </Section>
        )}

        {/* 继续按钮 */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button
            onClick={onComplete}
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '12px',
              letterSpacing: '0.1em',
              color: '#e8e8f8',
              background: '#6b7fff',
              border: 'none',
              borderRadius: 2,
              padding: '12px 36px',
              cursor: 'pointer',
            }}
          >
            进入 M5 · 太空垃圾落地球 →
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: '10px',
        letterSpacing: '0.12em',
        color: '#484878',
        marginBottom: 12,
        borderBottom: '1px solid #2a2a28',
        paddingBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

