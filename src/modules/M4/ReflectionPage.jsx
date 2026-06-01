const RESULT_STYLES = `
  .m4-result-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    overflow: auto;
    padding: clamp(18px, 4vh, 42px) 20px;
    background: rgba(4,4,15,0.72);
    backdrop-filter: blur(5px);
    place-items: center;
  }

  .m4-result-card {
    position: relative;
    width: min(1040px, calc(100vw - 40px));
    max-height: min(860px, calc(100vh - 40px));
    overflow: auto;
    color: #15151d;
    background: rgba(250,249,246,0.975);
    border: 1px solid rgba(255,255,255,0.72);
    box-shadow: 0 24px 84px rgba(0,0,0,0.38);
  }

  .m4-result-card::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 3px;
    background: var(--result-color);
    content: "";
  }

  .m4-result-header,
  .m4-result-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 15px 20px;
    border-bottom: 1px solid rgba(21,21,29,0.12);
  }

  .m4-result-label {
    color: rgba(21,21,29,0.48);
    font-family: "Space Mono", monospace;
    font-size: 8px;
    letter-spacing: 0.16em;
    line-height: 1.6;
    text-transform: uppercase;
  }

  .m4-result-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(290px, 0.8fr);
    border-bottom: 1px solid rgba(21,21,29,0.12);
  }

  .m4-result-summary {
    padding: 24px 22px 26px;
  }

  .m4-result-state {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--result-color);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.14em;
  }

  .m4-result-state::before {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--result-color);
    content: "";
  }

  .m4-result-summary h2 {
    margin: 13px 0 7px;
    color: #15151d;
    font-family: "Noto Serif SC", serif;
    font-size: clamp(28px, 3vw, 38px);
    font-weight: 400;
    letter-spacing: 0.03em;
    line-height: 1.28;
  }

  .m4-result-summary p {
    max-width: 620px;
    margin: 0;
    color: rgba(21,21,29,0.6);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    line-height: 1.9;
  }

  .m4-result-telemetry {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-left: 1px solid rgba(21,21,29,0.12);
  }

  .m4-result-metric {
    display: flex;
    min-height: 100%;
    flex-direction: column;
    justify-content: center;
    padding: 18px 14px;
  }

  .m4-result-metric + .m4-result-metric {
    border-left: 1px solid rgba(21,21,29,0.1);
  }

  .m4-result-metric strong {
    margin: 8px 0 5px;
    color: #15151d;
    font-family: "Space Mono", monospace;
    font-size: clamp(18px, 2.2vw, 26px);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .m4-result-body {
    display: grid;
    grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
  }

  .m4-result-column + .m4-result-column {
    border-left: 1px solid rgba(21,21,29,0.12);
  }

  .m4-result-block {
    padding: 19px 20px 20px;
  }

  .m4-result-block + .m4-result-block {
    border-top: 1px solid rgba(21,21,29,0.1);
  }

  .m4-result-copy {
    margin: 10px 0 0;
    color: rgba(21,21,29,0.72);
    font-family: "Noto Serif SC", serif;
    font-size: 14px;
    line-height: 1.9;
  }

  .m4-result-story {
    margin-top: 11px;
    padding-left: 13px;
    border-left: 2px solid var(--result-color);
    color: rgba(21,21,29,0.67);
    font-family: "Noto Serif SC", serif;
    font-size: 13px;
    font-style: italic;
    line-height: 1.9;
  }

  .m4-result-knowledge {
    display: grid;
    gap: 9px;
    margin: 11px 0 0;
    padding: 0;
    list-style: none;
  }

  .m4-result-knowledge li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 8px;
    color: rgba(21,21,29,0.66);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    line-height: 1.65;
  }

  .m4-result-index {
    color: var(--result-color);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.08em;
  }

  .m4-result-debris {
    margin-top: 11px;
    padding: 10px 11px;
    color: rgba(21,21,29,0.62);
    background: rgba(21,21,29,0.035);
    border: 1px solid rgba(21,21,29,0.12);
    font-family: "Space Mono", "Noto Sans SC", monospace;
    font-size: 10px;
    line-height: 1.8;
  }

  .m4-result-footer {
    border-top: 1px solid rgba(21,21,29,0.12);
    border-bottom: 0;
    background: rgba(21,21,29,0.025);
  }

  .m4-result-continue {
    min-width: 250px;
    padding: 11px 18px;
    border: 1px solid #15151d;
    color: #f8f7f4;
    background: #15151d;
    cursor: pointer;
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.14em;
    line-height: 1.4;
    text-transform: uppercase;
    transition: opacity 180ms ease, background-color 180ms ease;
  }

  .m4-result-continue:hover,
  .m4-result-continue:focus-visible {
    opacity: 0.78;
  }

  .m4-result-continue:focus-visible {
    outline: 2px solid var(--result-color);
    outline-offset: 3px;
  }

  @media (max-width: 820px) {
    .m4-result-hero,
    .m4-result-body {
      display: block;
    }

    .m4-result-telemetry,
    .m4-result-column + .m4-result-column {
      border-top: 1px solid rgba(21,21,29,0.12);
      border-left: 0;
    }
  }

  @media (max-width: 540px) {
    .m4-result-overlay {
      padding: 10px;
      place-items: start center;
    }

    .m4-result-card {
      width: calc(100vw - 20px);
      max-height: none;
    }

    .m4-result-header,
    .m4-result-footer {
      align-items: stretch;
      flex-direction: column;
    }

    .m4-result-continue {
      width: 100%;
      min-width: 0;
    }
  }
`

export default function ReflectionPage({ reflection, gameResult, missionStats, onComplete }) {
  if (!reflection) return null

  const isSuccess = gameResult === 'success'
  const resultColor = isSuccess ? '#16835d' : '#b13b32'
  const resultLabel = isSuccess ? '任务完成' : '卫星失联'
  const resultCode = isSuccess ? 'NOMINAL EXIT' : 'LOSS OF CONTROL'
  const resultDesc = isSuccess
    ? '卫星完成预定任务并保留离轨能力。任务数据已归档，可以进入下一阶段。'
    : '卫星失去控制并成为新的轨道碎片来源。任务数据已归档，可以进入下一阶段。'

  return (
    <div className="m4-result-overlay">
      <style>{RESULT_STYLES}</style>
      <section
        className="m4-result-card"
        aria-label="卫星生存任务结算"
        style={{ '--result-color': resultColor }}
      >
        <header className="m4-result-header">
          <span className="m4-result-label">MISSION DEBRIEF · ORBITAL SURVIVAL</span>
          <span className="m4-result-label">ROUND 06 / 06</span>
        </header>

        <div className="m4-result-hero">
          <div className="m4-result-summary">
            <div className="m4-result-state">{resultCode}</div>
            <h2>{resultLabel}</h2>
            <p>{resultDesc}</p>
          </div>

          <div className="m4-result-telemetry" aria-label="最终任务数据">
            <Metric label="ARMOR" value={missionStats?.armor} />
            <Metric label="FUEL" value={missionStats?.fuel} />
            <Metric label="MISSION" value={missionStats?.missionProgress} />
          </div>
        </div>

        <div className="m4-result-body">
          <div className="m4-result-column">
            <ResultBlock label="SATELLITE FATE · 卫星命运">
              <p className="m4-result-copy">{reflection.satFate}</p>
            </ResultBlock>

            <ResultBlock label="PARALLEL TIMELINE · 平行时空结局">
              <div className="m4-result-story">{reflection.storyEnding}</div>
            </ResultBlock>
          </div>

          <div className="m4-result-column">
            <ResultBlock label="KNOWLEDGE LOG · 本次学到">
              <ul className="m4-result-knowledge">
                {(reflection.knowledgePoints || []).map((point, index) => (
                  <li key={`${index}-${point}`}>
                    <span className="m4-result-index">{String(index + 1).padStart(2, '0')}</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </ResultBlock>

            {reflection.debrisDescription && (
              <ResultBlock label="DEBRIS OUTPUT · 产生碎片">
                <div className="m4-result-debris">{reflection.debrisDescription}</div>
              </ResultBlock>
            )}
          </div>
        </div>

        <footer className="m4-result-footer">
          <div>
            <div className="m4-result-label">NEXT STAGE</div>
            <div className="m4-result-label">M5 · DEBRIS RE-ENTRY</div>
          </div>
          <button className="m4-result-continue" onClick={onComplete}>
            进入 M5 · 太空垃圾落地球 →
          </button>
        </footer>
      </section>
    </div>
  )
}

function Metric({ label, value }) {
  const normalizedValue = Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null

  return (
    <div className="m4-result-metric">
      <span className="m4-result-label">{label}</span>
      <strong>{normalizedValue === null ? '--' : `${normalizedValue}%`}</strong>
      <span className="m4-result-label">{normalizedValue === null ? 'NO DATA' : 'FINAL VALUE'}</span>
    </div>
  )
}

function ResultBlock({ label, children }) {
  return (
    <section className="m4-result-block">
      <div className="m4-result-label">{label}</div>
      {children}
    </section>
  )
}
