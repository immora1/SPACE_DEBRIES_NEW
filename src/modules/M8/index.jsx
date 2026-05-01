import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

const MONO = 'Space Mono, monospace'
const SERIF = 'Noto Serif SC, serif'
const SANS = 'Noto Sans SC, sans-serif'
const EASE = [0.16, 1, 0.3, 1]
const CONTENT_MAX = 1080

const REQUIRED_FIELDS = [
  { id: 'time', label: '时间', hint: '例如 2026-05-02 21:37，尽量精确到分钟。' },
  { id: 'location', label: '地点', hint: '城市、区县、经纬度或可复现的观测位置。' },
  { id: 'direction', label: '方位', hint: '出现和消失的大致方位，如西南到东北。' },
  { id: 'duration', label: '持续时间', hint: '几秒、几十秒，还是数分钟。' },
  { id: 'motion', label: '运动特征', hint: '是否匀速、闪烁、分裂、拖尾、突然变亮。' },
  { id: 'evidence', label: '证据', hint: '照片、视频、截图、目击者或设备信息。' },
]

const BAD_REPORT = {
  text: '刚刚天上有一道很亮的东西飞过去，应该是太空垃圾，挺吓人的。',
  missing: ['没有时间', '没有地点', '没有方位', '没有持续时间', '没有判断依据'],
}

const GOOD_REPORT = {
  text: '2026-05-02 21:37，在上海徐汇区向西南方向观测到一条橙白色亮迹，持续约 7 秒，从西南向东北移动，末段出现 2 次碎裂闪光并留下短暂烟迹。手机拍到 3 秒视频，未听到声响。',
  fields: ['时间', '地点', '方位', '持续时间', '运动特征', '证据'],
}

const STANDARD_CARDS = [
  {
    id: 'debris',
    title: '太空垃圾再入',
    signal: '慢于流星，可能持续数秒到数十秒；常出现橙红色、碎裂、多个亮点同向移动。',
    warning: '不能只凭“很亮”判断。需要时间、方位、持续时长和碎裂特征。',
  },
  {
    id: 'meteor',
    title: '流星 / 火流星',
    signal: '通常极快，1–3 秒内划过；可能有短拖尾，偶尔爆闪。',
    warning: '如果持续几十秒并分裂成多点同向飞行，就要谨慎排除再入碎片。',
  },
  {
    id: 'satellite',
    title: '卫星 / 星链列车',
    signal: '通常匀速、无烟迹、无明显碎裂；星链可呈串珠状，亮度较稳定。',
    warning: '卫星过境不等于太空垃圾，报告中必须写出为何排除正常卫星。',
  },
]

const OBSERVATION_SET = [
  { id: 'obs01', img: '/covers/1.png', type: 'debris', title: '多点同向碎裂亮迹', clue: '持续 18 秒，橙红色，末段分裂成 5 个亮点。', reportHint: '重点记录碎裂数量和飞行方向。' },
  { id: 'obs02', img: '/covers/4.png', type: 'meteor', title: '短促高速火流星', clue: '持续 2 秒，单条亮线，突然爆闪后消失。', reportHint: '重点记录持续时间，不要直接写成太空垃圾。' },
  { id: 'obs03', img: '/covers/6.png', type: 'debris', title: '长时间缓慢再入带', clue: '持续 40 秒，多个亮点排成弧线缓慢移动。', reportHint: '适合写成疑似再入碎片报告。' },
  { id: 'obs04', img: '/covers/7.png', type: 'satellite', title: '匀速单点过境', clue: '亮点匀速穿过夜空，无拖尾，无碎裂。', reportHint: '更像正常卫星过境。' },
  { id: 'obs05', img: '/covers/8.png', type: 'debris', title: '火箭级段再入疑似', clue: '3 个主亮点伴随细小闪光，持续 25 秒。', reportHint: '记录是否有多个同步亮点。' },
  { id: 'obs06', img: '/covers/9.png', type: 'meteor', title: '垂直短亮迹', clue: '极快下落，持续不足 1 秒，没有持续碎裂。', reportHint: '更像流星。' },
  { id: 'obs07', img: '/covers/10.png', type: 'debris', title: '分段拖尾事件', clue: '亮迹分成前后两段，速度较慢，持续 12 秒。', reportHint: '报告里要写清前后段位置变化。' },
  { id: 'obs08', img: '/covers/11.png', type: 'satellite', title: '串珠状卫星列车', clue: '多个等距亮点，亮度稳定，匀速同轨移动。', reportHint: '应优先排查星链等卫星列车。' },
  { id: 'obs09', img: '/covers/12.png', type: 'debris', title: '低空碎裂闪光', clue: '亮度不稳定，末段出现散落点，持续 9 秒。', reportHint: '可写为疑似太空碎片再入。' },
  { id: 'obs10', img: '/source_1.png', type: 'satellite', title: '失效卫星想象图', clue: '图片本身不是地面观测记录。', reportHint: '不能当作观测报告证据。' },
  { id: 'obs11', img: '/source_2.png', type: 'debris', title: '碰撞碎片云示意', clue: '说明碎片来源，但不是目击照片。', reportHint: '可作为背景资料，不可替代现场记录。' },
  { id: 'obs12', img: '/source_3.png', type: 'debris', title: '操作遗留物示意', clue: '体现遗留来源，不等同再入目击。', reportHint: '报告需区分资料图和本人观测。' },
]

const SAMPLE_COMMENTS = {
  obs01: [
    { name: '成都观测者', text: '我会补一条方位角：如果手机指南针可信，最好写成“约 240° 到 55°”。' },
    { name: '轨道社群志愿者', text: '持续 18 秒且多点同向，确实比普通流星更接近再入碎片特征。' },
  ],
  obs03: [
    { name: '南京天文社', text: '这类长时间事件最好附视频原始文件，截图容易丢失速度信息。' },
    { name: '数据校对员', text: '请补充云量和遮挡情况，否则亮度判断会有偏差。' },
  ],
}

function emptyReport(city) {
  return {
    time: '',
    location: city || '',
    direction: '',
    duration: '',
    motion: '',
    evidence: '',
    classification: 'debris',
    confidence: 'medium',
    note: '',
  }
}

function scoreReport(report) {
  const filled = REQUIRED_FIELDS.filter(f => report[f.id]?.trim()).length
  const hasClass = !!report.classification
  const hasNote = report.note.trim().length >= 16
  return Math.round(((filled + (hasClass ? 1 : 0) + (hasNote ? 1 : 0)) / 8) * 100)
}

export default function M8({ onComplete }) {
  const { user, setStoryChapter } = useAppStore()
  const [lessonStep, setLessonStep] = useState(0)
  const [practice, setPractice] = useState({})
  const [selectedId, setSelectedId] = useState('obs01')
  const [report, setReport] = useState(() => emptyReport(user?.city))
  const [reports, setReports] = useState([])
  const [activeCommunityId, setActiveCommunityId] = useState('obs01')

  const selected = OBSERVATION_SET.find(o => o.id === selectedId) || OBSERVATION_SET[0]
  const activeCommunity = OBSERVATION_SET.find(o => o.id === activeCommunityId) || selected
  const reportScore = scoreReport(report)
  const practiceScore = useMemo(() => {
    const answered = Object.keys(practice)
    if (!answered.length) return 0
    const correct = answered.filter(id => practice[id] === OBSERVATION_SET.find(o => o.id === id)?.type).length
    return Math.round((correct / answered.length) * 100)
  }, [practice])
  const practiceDone = Object.keys(practice).length >= 6 && practiceScore >= 66
  const canSubmit = selected && reportScore >= 75
  const canComplete = reports.length > 0 && practiceDone

  function setField(key, value) {
    setReport(prev => ({ ...prev, [key]: value }))
  }

  function submitReport() {
    if (!canSubmit) return
    const next = {
      id: `${selected.id}-${Date.now()}`,
      imageId: selected.id,
      imageTitle: selected.title,
      author: user?.name || '匿名观测者',
      report: { ...report },
      score: reportScore,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    setReports(prev => [next, ...prev])
    setActiveCommunityId(selected.id)
    setReport(emptyReport(user?.city))
  }

  function handleComplete() {
    if (!canComplete) return
    setStoryChapter('m8', `用户提交了一份观测报告，并进入社区学习他人的补充细节。`)
    onComplete()
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', padding: '80px 24px' }}>
      <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto' }}>
        <div style={{ marginBottom: 46 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: '#5a5a56', marginBottom: 12 }}>
            MODULE 08 · OBSERVATION & COMMUNITY
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, color: '#f5f4f0', margin: '0 0 14px' }}>
            学会写一份有效的太空垃圾观测报告。
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: 0, lineHeight: 1.75, maxWidth: 780 }}>
            科学家通常只能稳定追踪较大的在轨物体。更小、更短暂、更接近地面的再入事件，需要公众报告补足细节。
            这一节把你从“观看者”转成“记录者”。
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, marginBottom: 44 }}>
          <div style={{
            background: '#0d0d0b',
            border: '1px solid #1c1c1a',
            borderRadius: 4,
            padding: 18,
            alignSelf: 'start',
            position: 'sticky',
            top: 72,
          }}>
            {[
              ['01', '身份转变', '从被动观看变成可复核的记录者'],
              ['02', '观测教学', '知道一份报告为什么有效'],
              ['03', '事件与报告', '选图并写结构化报告'],
              ['04', '社区互动', '阅读他人补充并学习盲点'],
            ].map(([n, title, desc], idx) => (
              <button
                key={n}
                onClick={() => setLessonStep(Math.min(idx, 2))}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: lessonStep === idx ? 'rgba(200,184,154,0.06)' : 'transparent',
                  border: `1px solid ${lessonStep === idx ? 'rgba(200,184,154,0.25)' : 'transparent'}`,
                  borderRadius: 4,
                  padding: '12px 10px',
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a' }}>{n}</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: '#3a3a38' }}>{idx < 3 ? 'LESSON' : 'COMMUNITY'}</span>
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 15, color: '#f0efe8', marginBottom: 4 }}>{title}</div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: '#6a6a64', lineHeight: 1.55 }}>{desc}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <section style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 4, padding: 22 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
                01 · 身份转变衔接
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: '1px solid #242420', padding: 16, borderRadius: 4 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: '#3a3a38', marginBottom: 8 }}>BAD REPORT</div>
                  <p style={{ fontFamily: SERIF, fontSize: 15, color: '#9a9a92', lineHeight: 1.8, margin: '0 0 12px' }}>{BAD_REPORT.text}</p>
                  {BAD_REPORT.missing.map(m => (
                    <span key={m} style={{ display: 'inline-block', fontFamily: MONO, fontSize: 8, color: '#e07030', border: '1px solid rgba(224,112,48,0.22)', padding: '2px 6px', margin: '0 5px 5px 0' }}>{m}</span>
                  ))}
                </div>
                <div style={{ border: '1px solid rgba(200,184,154,0.22)', padding: 16, borderRadius: 4, background: 'rgba(200,184,154,0.025)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a', marginBottom: 8 }}>VALID REPORT</div>
                  <p style={{ fontFamily: SERIF, fontSize: 15, color: '#d8d3c8', lineHeight: 1.8, margin: '0 0 12px' }}>{GOOD_REPORT.text}</p>
                  {GOOD_REPORT.fields.map(m => (
                    <span key={m} style={{ display: 'inline-block', fontFamily: MONO, fontSize: 8, color: '#78c88c', border: '1px solid rgba(120,200,140,0.22)', padding: '2px 6px', margin: '0 5px 5px 0' }}>{m}</span>
                  ))}
                </div>
              </div>
            </section>

            <section style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 4, padding: 22 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
                02 · 观测教学模块
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                {STANDARD_CARDS.map((card, idx) => (
                  <motion.button
                    key={card.id}
                    onClick={() => setLessonStep(idx)}
                    whileHover={{ y: -3 }}
                    style={{
                      textAlign: 'left',
                      background: lessonStep === idx ? 'rgba(200,184,154,0.055)' : '#090908',
                      border: `1px solid ${lessonStep === idx ? 'rgba(200,184,154,0.35)' : '#20201e'}`,
                      borderRadius: 4,
                      padding: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a', marginBottom: 10 }}>步骤 {idx + 1}</div>
                    <div style={{ fontFamily: SERIF, fontSize: 16, color: '#f0efe8', marginBottom: 8 }}>{card.title}</div>
                    <div style={{ fontFamily: SANS, fontSize: 11, color: '#7a7a72', lineHeight: 1.65 }}>{card.signal}</div>
                  </motion.button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={lessonStep}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  style={{ borderLeft: '3px solid #c8b89a', padding: '10px 14px', background: 'rgba(200,184,154,0.025)' }}
                >
                  <div style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a', marginBottom: 5 }}>判断提醒</div>
                  <div style={{ fontFamily: SANS, fontSize: 12, color: '#8a8a82', lineHeight: 1.75 }}>{STANDARD_CARDS[lessonStep]?.warning}</div>
                </motion.div>
              </AnimatePresence>
            </section>

            <section style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 4, padding: 22 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
                03 · 交互场景判断练习
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {OBSERVATION_SET.slice(0, 8).map(item => {
                  const answer = practice[item.id]
                  const right = answer && answer === item.type
                  return (
                    <div key={item.id} style={{ border: `1px solid ${answer ? (right ? '#2a4a2a' : '#4a2a1a') : '#1c1c1a'}`, borderRadius: 4, overflow: 'hidden', background: '#080807' }}>
                      <div style={{ height: 96, position: 'relative', overflow: 'hidden' }}>
                        <img src={item.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.66 }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080807, transparent)' }} />
                      </div>
                      <div style={{ padding: 10 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 13, color: '#f0efe8', lineHeight: 1.4, marginBottom: 6 }}>{item.title}</div>
                        <div style={{ fontFamily: SANS, fontSize: 10, color: '#5a5a56', lineHeight: 1.45, minHeight: 42 }}>{item.clue}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          {['debris', 'meteor', 'satellite'].map(type => (
                            <button
                              key={type}
                              onClick={() => setPractice(prev => ({ ...prev, [item.id]: type }))}
                              style={{
                                flex: 1,
                                background: answer === type ? '#c8b89a' : 'transparent',
                                color: answer === type ? '#0a0a0a' : '#5a5a56',
                                border: '1px solid #2a2a28',
                                fontFamily: MONO,
                                fontSize: 8,
                                padding: '4px 0',
                                cursor: 'pointer',
                              }}
                            >
                              {type === 'debris' ? '垃圾' : type === 'meteor' ? '流星' : '卫星'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: practiceDone ? '#78c88c' : '#5a5a56', marginTop: 12 }}>
                PRACTICE SCORE · {practiceScore}% · 已判断 {Object.keys(practice).length}/8
              </div>
            </section>
          </div>
        </div>

        <section style={{ marginBottom: 42 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            04 · 事件与社区模块
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 4, padding: 18 }}>
              <div style={{ fontFamily: SERIF, fontSize: 18, color: '#f0efe8', marginBottom: 12 }}>选择图片</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {OBSERVATION_SET.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedId(item.id); setActiveCommunityId(item.id) }}
                    style={{
                      height: 88,
                      border: `1px solid ${selectedId === item.id ? 'rgba(200,184,154,0.55)' : '#1c1c1a'}`,
                      background: '#080807',
                      padding: 0,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <img src={item.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: selectedId === item.id ? 0.76 : 0.48 }} />
                    <div style={{ position: 'absolute', left: 6, bottom: 5, fontFamily: MONO, fontSize: 8, color: '#c8b89a' }}>{item.type.toUpperCase()}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 4, padding: 18 }}>
              <div style={{ fontFamily: SERIF, fontSize: 18, color: '#f0efe8', marginBottom: 8 }}>写观测报告</div>
              <p style={{ fontFamily: SANS, fontSize: 11, color: '#6a6a64', lineHeight: 1.65, margin: '0 0 12px' }}>
                当前图片：{selected.title}。提示：{selected.reportHint}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {REQUIRED_FIELDS.map(field => (
                  <label key={field.id} style={{ display: 'block' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: '#5a5a56', marginBottom: 4 }}>{field.label}</div>
                    <input
                      value={report[field.id]}
                      onChange={e => setField(field.id, e.target.value)}
                      placeholder={field.hint}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#080807',
                        border: '1px solid #242420',
                        color: '#d8d3c8',
                        fontFamily: SANS,
                        fontSize: 11,
                        padding: '8px 9px',
                        outline: 'none',
                      }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <select value={report.classification} onChange={e => setField('classification', e.target.value)} style={{ background: '#080807', border: '1px solid #242420', color: '#d8d3c8', fontFamily: SANS, fontSize: 11, padding: 8 }}>
                  <option value="debris">疑似太空垃圾再入</option>
                  <option value="meteor">更像流星</option>
                  <option value="satellite">更像正常卫星</option>
                  <option value="unknown">无法判断</option>
                </select>
                <select value={report.confidence} onChange={e => setField('confidence', e.target.value)} style={{ background: '#080807', border: '1px solid #242420', color: '#d8d3c8', fontFamily: SANS, fontSize: 11, padding: 8 }}>
                  <option value="low">低置信度</option>
                  <option value="medium">中置信度</option>
                  <option value="high">高置信度</option>
                </select>
              </div>
              <textarea
                value={report.note}
                onChange={e => setField('note', e.target.value)}
                placeholder="补充说明：你为什么这样判断？有哪些不确定？"
                style={{ width: '100%', minHeight: 82, resize: 'vertical', marginTop: 8, boxSizing: 'border-box', background: '#080807', border: '1px solid #242420', color: '#d8d3c8', fontFamily: SANS, fontSize: 11, lineHeight: 1.7, padding: 10, outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: reportScore >= 75 ? '#78c88c' : '#5a5a56' }}>REPORT QUALITY · {reportScore}%</span>
                <button onClick={submitReport} disabled={!canSubmit} style={{ background: canSubmit ? '#c8b89a' : 'transparent', color: canSubmit ? '#0a0a0a' : '#4a4a46', border: `1px solid ${canSubmit ? '#c8b89a' : '#2a2a28'}`, fontFamily: MONO, fontSize: 10, padding: '8px 12px', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                  提交到社区
                </button>
              </div>
            </div>
          </div>
        </section>

        <section style={{ background: '#0d0d0b', border: '1px solid #1c1c1a', borderRadius: 4, padding: 22, marginBottom: 36 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            05 · 社区互动
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
            <div>
              <img src={activeCommunity.img} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', opacity: 0.68, border: '1px solid #242420' }} />
              <div style={{ fontFamily: SERIF, fontSize: 16, color: '#f0efe8', margin: '10px 0 4px' }}>{activeCommunity.title}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: '#6a6a64', lineHeight: 1.65 }}>{activeCommunity.clue}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[...(SAMPLE_COMMENTS[activeCommunity.id] || []), ...reports.filter(r => r.imageId === activeCommunity.id).map(r => ({ name: r.author, text: `${r.report.time || '未填时间'} · ${r.report.location || '未填地点'} · ${r.report.note}` }))].map((comment, idx) => (
                <motion.div key={`${comment.name}-${idx}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ border: '1px solid #20201e', borderRadius: 4, padding: '12px 14px', background: '#090908' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a', marginBottom: 6 }}>{comment.name}</div>
                  <div style={{ fontFamily: SANS, fontSize: 12, color: '#8a8a82', lineHeight: 1.7 }}>{comment.text}</div>
                </motion.div>
              ))}
              {!((SAMPLE_COMMENTS[activeCommunity.id] || []).length || reports.some(r => r.imageId === activeCommunity.id)) && (
                <div style={{ fontFamily: SANS, fontSize: 12, color: '#5a5a56', border: '1px dashed #2a2a28', padding: 14 }}>这个图片社区还没有讨论。提交一份报告后，它会出现在这里。</div>
              )}
            </div>
          </div>
        </section>

        <motion.button
          onClick={handleComplete}
          disabled={!canComplete}
          whileHover={canComplete ? { opacity: 0.85 } : {}}
          whileTap={canComplete ? { scale: 0.985 } : {}}
          style={{
            width: '100%',
            padding: '16px 0',
            background: canComplete ? '#c8b89a' : 'transparent',
            border: `1px solid ${canComplete ? '#c8b89a' : '#2a2a28'}`,
            color: canComplete ? '#0a0a0a' : '#5a5a56',
            fontFamily: SERIF,
            fontSize: 14,
            letterSpacing: '0.1em',
            cursor: canComplete ? 'pointer' : 'not-allowed',
            opacity: canComplete ? 1 : 0.38,
          }}
        >
          {!practiceDone ? '先完成判断练习' : reports.length === 0 ? '提交一份观测报告' : '完成观测教学'}
        </motion.button>
      </div>
    </div>
  )
}
