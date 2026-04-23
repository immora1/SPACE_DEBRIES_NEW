import { useState } from 'react'
import useAppStore from '../../store/useAppStore'
import { generateStoryOutline, generateOpeningStory } from '../../services/ai'

async function fetchSatellite(city) {
  try {
    const res = await fetch(`/api/satellite?city=${encodeURIComponent(city)}`)
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
    const s = data.satellite
    return {
      name: s.OBJECT_NAME?.trim() ?? 'UNKNOWN-SAT',
      noradId: s.NORAD_CAT_ID,
      altitudeKm: Math.round((s.APOGEE + s.PERIGEE) / 2) || 500,
      inclination: s.INCLINATION ?? 51.6,
      periodMin: s.PERIOD ?? 92,
      launchYear: s.LAUNCH_DATE ? new Date(s.LAUNCH_DATE).getFullYear() : 2020,
    }
  } catch {
    // 后备卫星
    return {
      name: 'FENGYUN 3D',
      noradId: 43010,
      altitudeKm: 836,
      inclination: 98.7,
      periodMin: 101,
      launchYear: 2017,
    }
  }
}

// ── 表单阶段 ──────────────────────────────────────────────────────────────────
function FormPhase({ onSubmit }) {
  const [form, setForm] = useState({ name: '', city: '', importantEvent: '' })
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const ready = form.name.trim() && form.city.trim() && form.importantEvent.trim()

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(form) }}
      style={{ animation: 'fadeUp .5s ease both' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginBottom: 44 }}>
        <div>
          <label className="mono-label" style={{ display: 'block', marginBottom: 10 }}>
            你的名字或代号
          </label>
          <input
            className="input-line"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="随便叫什么都行"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mono-label" style={{ display: 'block', marginBottom: 10 }}>
            你所在的城市
          </label>
          <input
            className="input-line"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="北京 / Shanghai / 成都 …"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mono-label" style={{ display: 'block', marginBottom: 10 }}>
            对你现在最重要的一件事
          </label>
          <textarea
            className="textarea-box"
            value={form.importantEvent}
            onChange={(e) => update('importantEvent', e.target.value)}
            placeholder="可以是一个计划、一段关系、一个正在等待的结果……"
            rows={3}
          />
        </div>
      </div>

      <button className="btn-primary" type="submit" disabled={!ready}>
        开始 →
      </button>
    </form>
  )
}

// ── 加载阶段 ──────────────────────────────────────────────────────────────────
function MatchingPhase({ status }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            border: '1px solid rgba(200,184,154,.3)',
            animation: `ping 1.4s ease-in-out ${i * .28}s infinite`,
          }} />
        ))}
      </div>
      <div className="mono-label" style={{ letterSpacing: '.2em' }}>{status}</div>
    </div>
  )
}

// ── 结果阶段 ──────────────────────────────────────────────────────────────────
function ResultPhase({ sat, story, onComplete }) {
  return (
    <div style={{ animation: 'fadeUp .7s ease both' }}>

      {/* 卫星信息卡 */}
      <div style={{
        border: '1px solid #2a2a28',
        background: '#111110',
        padding: '20px 24px',
        marginBottom: 28,
      }}>
        <div className="mono-label" style={{ marginBottom: 12 }}>已匹配卫星</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#f5f4f0', marginBottom: 18, letterSpacing: '.02em' }}>
          {sat.name}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { label: 'ALTITUDE',    value: `${sat.altitudeKm} km` },
            { label: 'INCLINATION', value: `${sat.inclination}°` },
            { label: 'PERIOD',      value: `${sat.periodMin} min` },
          ].map((d) => (
            <div key={d.label}>
              <div className="mono-label" style={{ marginBottom: 4, fontSize: 9 }}>{d.label}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: '#c8b89a' }}>
                {d.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 开场故事 */}
      {story && (
        <div style={{
          borderLeft: '2px solid rgba(200,184,154,.2)',
          paddingLeft: 18,
          marginBottom: 36,
        }}>
          <p className="story-text" style={{ margin: 0 }}>{story}</p>
        </div>
      )}

      <button className="btn-primary" onClick={onComplete}>
        进入 M1 · 太空垃圾是什么 →
      </button>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function Entrance({ onComplete }) {
  const setUser         = useAppStore((s) => s.setUser)
  const setSatellite    = useAppStore((s) => s.setSatellite)
  const setStoryOutline = useAppStore((s) => s.setStoryOutline)
  const setStoryChapter = useAppStore((s) => s.setStoryChapter)

  const [phase,  setPhase]  = useState('form')   // form | matching | result
  const [status, setStatus] = useState('')
  const [sat,    setSat]    = useState(null)
  const [story,  setStory]  = useState('')

  async function handleSubmit(form) {
    setUser(form)
    setPhase('matching')

    try {
      setStatus('SCANNING ORBIT')
      const satellite = await fetchSatellite(form.city)
      setSatellite(satellite)
      setSat(satellite)

      setStatus('BUILDING NARRATIVE')
      const outline = await generateStoryOutline({
        name: form.name,
        city: form.city,
        importantEvent: form.importantEvent,
        satellite,
      })
      setStoryOutline(outline)

      setStatus('WRITING STORY')
      const result = await generateOpeningStory({
        name: form.name,
        city: form.city,
        importantEvent: form.importantEvent,
        satellite,
        storyOutline: outline,
      })
      const storyText = result.story ?? ''
      setStory(storyText)
      setStoryChapter('opening', storyText)

      setPhase('result')
    } catch (err) {
      console.error(err)
      setStory('数据信号微弱，但卫星已就位。')
      setPhase('result')
    }
  }

  return (
    <section style={{
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '80px 32px',
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto', width: '100%' }}>

        {/* 站点标题 */}
        <div style={{ marginBottom: 52 }}>
          <div className="mono-label" style={{ marginBottom: 16 }}>
            SPACE_DEBRIES · 太空垃圾科普平台
          </div>
          <h1 style={{
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: 'clamp(30px, 6vw, 52px)',
            fontWeight: 700,
            color: '#f5f4f0',
            letterSpacing: '-.03em',
            lineHeight: 1.1,
            margin: '0 0 18px',
          }}>
            你的卫星<br />正在等待
          </h1>
          <p style={{ fontSize: 14, color: '#6b6b66', lineHeight: 1.8, margin: 0 }}>
            在接下来的体验里，一颗真实的卫星将与你的故事同步运行。
          </p>
        </div>

        {/* 阶段内容 */}
        {phase === 'form'     && <FormPhase onSubmit={handleSubmit} />}
        {phase === 'matching' && <MatchingPhase status={status} />}
        {phase === 'result'   && <ResultPhase sat={sat} story={story} onComplete={onComplete} />}

      </div>
    </section>
  )
}
