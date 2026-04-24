import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateStoryOutline, generateOpeningStory } from '../../services/ai'

const EASE = [0.16, 1, 0.3, 1]

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

export default function Entrance({ onComplete }) {
  const setUser         = useAppStore((s) => s.setUser)
  const setSatellite    = useAppStore((s) => s.setSatellite)
  const setStoryOutline = useAppStore((s) => s.setStoryOutline)
  const setStoryChapter = useAppStore((s) => s.setStoryChapter)
  const setCurrentModule = useAppStore((s) => s.setCurrentModule)

  const [step, setStep]   = useState('form')   // form | matching | generating | result
  const [form, setForm]   = useState({ name: '', city: '', importantEvent: '' })
  const [sat, setSat]     = useState(null)
  const [story, setStory] = useState('')
  const [error, setError] = useState(null)

  const ready = form.name.trim() && form.city.trim() && form.importantEvent.trim()

  async function handleSubmit() {
    if (!ready) return
    setError(null)
    setStep('matching')
    setCurrentModule('entrance')

    try {
      // 1. 匹配真实卫星
      const satellite = await fetchSatellite(form.city)
      setUser(form)
      setSatellite(satellite)
      setSat(satellite)

      // 2. 生成故事大纲
      setStep('generating')
      let outline = null
      try {
        outline = await generateStoryOutline({
          name: form.name,
          city: form.city,
          importantEvent: form.importantEvent,
          satellite,
        })
        setStoryOutline(outline)
      } catch (e) {
        console.warn('outline failed, continuing without:', e)
      }

      // 3. 生成开场故事
      let openingStory = ''
      try {
        const result = await generateOpeningStory({
          name: form.name,
          city: form.city,
          importantEvent: form.importantEvent,
          satellite,
          storyOutline: outline,
        })
        openingStory = result.story ?? ''
      } catch {
        openingStory = `${satellite.name} 于 ${satellite.launchYear} 年进入轨道，高度 ${satellite.altitudeKm} 公里。在那个平行宇宙里，它刚刚完成初始化，任务系统就绪，状态正常。而你最重要的那件事，正处于前夜。一切尚好。`
      }

      setStory(openingStory)
      setStoryChapter('opening', openingStory)
      setStep('result')
    } catch {
      setError('匹配失败，请重试')
      setStep('form')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* 顶部标题栏 */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #2a2a28' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          SPACE_DEBRIES · ENTRANCE
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <AnimatePresence mode="wait">

          {/* ── 表单 ── */}
          {step === 'form' && (
            <motion.div key="form"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}
              style={{ width: '100%', maxWidth: 480 }}
            >
              <div style={{ marginBottom: 48 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                  ENTRANCE · 个人信息
                </div>
                <h1 style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 22, color: '#f5f4f0', lineHeight: 1.5, marginBottom: 12 }}>
                  在平行宇宙里，<br />一颗卫星正在等待你的名字。
                </h1>
                <p style={{ color: '#6b6b66', fontSize: 13, lineHeight: 1.7 }}>
                  填写下面三项，系统将为你匹配一颗真实卫星，并开始一段关于你和太空垃圾的故事。
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {[
                  { key: 'name',          label: '你的名字或代号',     hint: '卫星将以此命名档案',       placeholder: '例：林远 / YUAN',    type: 'input'    },
                  { key: 'city',          label: '所在城市',          hint: '用于匹配飞过你头顶的卫星',  placeholder: '例：北京、上海、成都', type: 'input'    },
                  { key: 'importantEvent', label: '对你最重要的一件事', hint: '可以是时刻、人、经历',     placeholder: '写下它……',            type: 'textarea' },
                ].map((f) => (
                  <div key={f.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#c8b89a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {f.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#6b6b66' }}>{f.hint}</span>
                    </div>
                    {f.type === 'input' ? (
                      <input
                        value={form[f.key]}
                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{
                          width: '100%', background: 'transparent', border: 'none',
                          borderBottom: '1px solid #2a2a28', padding: '8px 0',
                          color: '#f5f4f0', fontSize: 13, outline: 'none', fontFamily: 'sans-serif',
                        }}
                      />
                    ) : (
                      <textarea
                        value={form[f.key]}
                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        rows={4}
                        style={{
                          width: '100%', background: 'transparent', border: '1px solid #2a2a28',
                          padding: 12, color: '#f5f4f0', fontSize: 13, outline: 'none',
                          resize: 'none', fontFamily: 'sans-serif', marginTop: 4,
                        }}
                      />
                    )}
                  </div>
                ))}

                {error && (
                  <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#f87171' }}>{error}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!ready}
                  style={{
                    fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                    textTransform: 'uppercase', padding: '14px 24px',
                    border: '1px solid rgba(200,184,154,0.4)', color: '#c8b89a',
                    background: 'transparent', cursor: ready ? 'pointer' : 'not-allowed',
                    opacity: ready ? 1 : 0.3, transition: 'opacity 0.2s',
                  }}
                >
                  匹配我的卫星 →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── 加载中 ── */}
          {(step === 'matching' || step === 'generating') && (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ width: 80, height: 80, margin: '0 auto 24px', position: 'relative' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    position: 'absolute', inset: i * 12, borderRadius: '50%',
                    border: '1px solid rgba(200,184,154,0.3)',
                    animation: `ping 1.5s ease-out ${i * 0.3}s infinite`,
                  }} />
                ))}
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.12em', marginBottom: 8 }}>
                {step === 'matching' ? 'SCANNING ORBIT' : 'WRITING STORY'}
              </p>
              <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 14, color: 'rgba(245,244,240,0.7)' }}>
                {step === 'matching' ? '正在从真实轨道数据中匹配卫星……' : '正在生成你的故事开头……'}
              </p>
            </motion.div>
          )}

          {/* ── 结果 ── */}
          {step === 'result' && sat && (
            <motion.div key="result"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ width: '100%', maxWidth: 480 }}
            >
              {/* 卫星信息卡 */}
              <div style={{ border: '1px solid #2a2a28', background: '#111110', padding: 20, marginBottom: 32 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  已匹配卫星 · MATCHED
                </div>
                <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 18, color: '#f5f4f0', marginBottom: 16 }}>
                  {sat.name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: '轨道高度', value: `${sat.altitudeKm} km` },
                    { label: '倾角',     value: `${sat.inclination}°` },
                    { label: '发射年份', value: sat.launchYear },
                  ].map((s) => (
                    <div key={s.label}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b6b66', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                        {s.label}
                      </div>
                      <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, color: '#f5f4f0' }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 开场故事 */}
              {story && (
                <div style={{ marginBottom: 32, paddingLeft: 16, borderLeft: '2px solid rgba(139,115,85,0.3)' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                    第一段 · 开场
                  </div>
                  <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 14, color: 'rgba(245,244,240,0.85)', lineHeight: 1.8 }}>
                    {story}
                  </p>
                </div>
              )}

              <button
                onClick={onComplete}
                style={{
                  fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                  textTransform: 'uppercase', padding: '14px 24px',
                  border: '1px solid rgba(200,184,154,0.4)', color: '#c8b89a',
                  background: 'transparent', cursor: 'pointer', width: '100%',
                }}
              >
                进入第一章：太空垃圾是什么 →
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
