import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateCleanupFeedback, generateCleanupEpilogue } from '../../services/ai'

const MONO  = 'Space Mono, monospace'
const SERIF = 'Noto Serif SC, serif'
const SANS  = 'Noto Sans SC, sans-serif'
const EASE  = [0.16, 1, 0.3, 1]

const BARRIERS = [
  {
    id: 'speed', title: '速度', titleEn: 'VELOCITY', stat: '7–14 km/s',
    desc: '碎片相对速度可达 7–14 km/s，交会窗口极短，任何捕获动作必须毫米级精确。',
  },
  {
    id: 'quantity', title: '数量', titleEn: 'QUANTITY', stat: '30,000+',
    desc: '可追踪碎片已逾 3 万件，厘米级以下更多，单次任务只能覆盖极小比例。',
  },
  {
    id: 'law', title: '法律', titleEn: 'LEGAL', stat: '1967',
    desc: '碎片归属原发射国永久持有，任何第三方在未获授权情况下无法处置他国碎片。',
  },
  {
    id: 'cost', title: '成本', titleEn: 'COST', stat: '$100M+',
    desc: '单次主动清理任务成本高达数亿美元，回报难量化，商业持续运营模型尚未成立。',
  },
]

const ALL_METHODS = [
  {
    id: 'laser', img: '/cleanup/1.png',
    title: '激光烧蚀', titleEn: 'LASER ABLATION', status: '研究阶段',
    desc: '高能激光照射碎片表面，产生的等离子体喷射提供微推力，改变轨道使其加速再入大气层。对 1–10 cm 高速小碎片效率最高。',
  },
  {
    id: 'arm', img: '/cleanup/2.png',
    title: '机械臂抓取', titleEn: 'ROBOTIC ARM', status: '任务中',
    desc: '清理卫星近距接近目标，伸出高精度机械臂固定失控卫星，再拖入大气层。ClearSpace-1 任务以此方案为目标 Vespa 残骸设计。',
  },
  {
    id: 'net', img: '/cleanup/3.png',
    title: '柔性捕捉网', titleEn: 'SPACE NET', status: '已测试',
    desc: '对旋转或形状不规则的碎片发射高强度网，包裹目标无需精确对准接口。RemoveDEBRIS 项目已完成在轨抛网测试。',
  },
  {
    id: 'harpoon', img: '/cleanup/4.png',
    title: '飞弹鱼叉', titleEn: 'HARPOON', status: '已测试',
    desc: '向碎片发射带倒钩的钛合金鱼叉，穿透金属外壳后通过缆绳拖离轨道。适合远距离捕获坚硬大型残骸结构。',
  },
  {
    id: 'tether', img: '/cleanup/5.png',
    title: '电动缆索', titleEn: 'ELECTRODYNAMIC TETHER', status: '研究阶段',
    desc: '释放数公里长的导电缆索切割地磁场，产生洛伦兹力令卫星减速，无需燃料即可离轨。寿命末期部署，可大幅压缩在轨残留时间。',
  },
  {
    id: 'sail', img: '/cleanup/6.png',
    title: '阻力帆', titleEn: 'DRAG SAIL', status: '已部署',
    desc: '寿命结束时展开大面积薄膜帆，利用稀薄大气阻力加速轨道衰减，将自然再入从数百年缩短至数年甚至数月。',
  },
]

const DRAG_TECHNOLOGIES = ALL_METHODS.filter(m => ['laser', 'arm', 'sail'].includes(m.id))

function buildDebrisSet({ gameResult, materials, debrisGenerated }) {
  const sourceText = (debrisGenerated && debrisGenerated[0]) || '轨道任务结束后产生的残余碎片'
  const highSurvival = ['titanium', 'ti_tank', 'kevlar'].includes(materials?.frame)
    || ['ti_tank', 'copv'].includes(materials?.propulsion)

  return [
    {
      id: 'd1', ideal: 'laser',
      name: '厘米级高速碎片群',
      detail: '尺度 1–10 cm，密度高，传统机械捕获成本过高，激光微推方案可批量施加微小轨道变化。',
      source: sourceText,
    },
    {
      id: 'd2', ideal: 'arm',
      name: gameResult === 'failure' ? '失控卫星主体残骸' : '退役卫星主体',
      detail: '体积大、质量高、姿态不可控，需近距离固定后执行受控离轨。',
      source: gameResult === 'failure' ? '任务失败后遗留的主要目标' : '任务完成后的大型在轨结构',
    },
    {
      id: 'd3', ideal: 'sail',
      name: highSurvival ? '高面积质量比复合碎片' : '轻质剥离薄片碎片',
      detail: '轻质、分散、受阻面积相对大，通过增加气动阻力可有效缩短在轨寿命。',
      source: '长期轨道环境侵蚀产生',
    },
  ]
}

// ── 翻转卡片：鼠标悬停正反面翻转 ─────────────────────────────────────────────
function MethodCard({ m, index }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      style={{ perspective: '1000px', height: 300 }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.72s cubic-bezier(0.2, 0.8, 0.2, 1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        animationDelay: `${index * 0.06}s`,
      }}>

        {/* ── 正面 ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          background: '#0d0d0b', border: '1px solid #1c1c1a',
          overflow: 'hidden',
        }}>
          <img
            src={m.img} alt={m.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.72, display: 'block' }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 35%, rgba(13,13,11,0.92) 75%, #0d0d0b 100%)',
          }} />
          <div style={{
            position: 'absolute', top: 10, right: 10,
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em',
            color: '#c8b89a', background: 'rgba(10,9,8,0.82)',
            padding: '3px 8px', border: '1px solid rgba(200,184,154,0.22)',
          }}>
            {m.status}
          </div>
          <div style={{ position: 'absolute', bottom: 20, left: 16, right: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 5 }}>
              {m.titleEn}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 16, color: '#f0efe8', fontWeight: 400 }}>
              {m.title}
            </div>
          </div>
        </div>

        {/* ── 背面 ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: '#0d0d0b',
          border: '1px solid #2a2a28',
          borderLeft: '3px solid #c8b89a',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '28px 24px',
          boxSizing: 'border-box',
        }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#c8b89a', letterSpacing: '0.12em', marginBottom: 12 }}>
            {m.titleEn}
          </div>
          <div style={{ width: 28, height: 1, background: '#3a3a38', marginBottom: 18 }} />
          <div style={{ fontFamily: SERIF, fontSize: 17, color: '#f0efe8', fontWeight: 400, marginBottom: 16 }}>
            {m.title}
          </div>
          <p style={{
            fontFamily: SANS, fontSize: 12, color: '#9a9a92',
            lineHeight: 1.85, margin: 0,
          }}>
            {m.desc}
          </p>
        </div>

      </div>
    </div>
  )
}

function fallbackFeedback(isCorrect) {
  return isCorrect
    ? '匹配合理：该技术可在当前碎片尺度和轨道条件下形成可执行清理路径。'
    : '匹配偏差：该技术与目标尺寸或动力学条件不匹配，清理效率会显著下降。'
}

export default function M6({ onComplete }) {
  const { user, satellite, materials, gameResult, debrisGenerated, storyOutline, setStoryChapter } = useAppStore()

  const satName = satellite?.name ?? satellite?.OBJECT_NAME ?? '未知卫星'
  const satAlt  = satellite?.altitudeKm ?? satellite?.APOGEE ?? 836
  const satInc  = satellite?.inclination ?? satellite?.INCLINATION ?? 98
  const satObj  = { name: satName, altitudeKm: satAlt, inclination: satInc }

  const debrisSet = useMemo(
    () => buildDebrisSet({ gameResult, materials, debrisGenerated }),
    [gameResult, materials, debrisGenerated],
  )

  const [matches,        setMatches]        = useState({})
  const [feedbackMap,    setFeedbackMap]    = useState({})
  const [loadingId,      setLoadingId]      = useState(null)
  const [dragOverId,     setDragOverId]     = useState(null)
  const [epilogueState,  setEpilogueState]  = useState('idle')
  const [epilogue,       setEpilogue]       = useState('')

  const allMatched   = debrisSet.length > 0 && debrisSet.every(d => !!matches[d.id])
  const correctCount = debrisSet.filter(d => matches[d.id]?.isCorrect).length
  const accuracy     = debrisSet.length ? correctCount / debrisSet.length : 0
  const canContinue  = allMatched && (epilogueState === 'done' || epilogueState === 'error')

  async function handleDrop(debrisId, techId) {
    if (loadingId) return
    const debris = debrisSet.find(d => d.id === debrisId)
    const tech   = DRAG_TECHNOLOGIES.find(t => t.id === techId)
    if (!debris || !tech) return

    const isCorrect = debris.ideal === techId
    setMatches(prev => ({ ...prev, [debrisId]: { technologyId: techId, isCorrect } }))
    setLoadingId(debrisId)
    try {
      const res = await generateCleanupFeedback({ debris: debris.name, technology: tech.title, isCorrect })
      setFeedbackMap(prev => ({ ...prev, [debrisId]: res.feedback || fallbackFeedback(isCorrect) }))
    } catch {
      setFeedbackMap(prev => ({ ...prev, [debrisId]: fallbackFeedback(isCorrect) }))
    } finally {
      setLoadingId(null)
    }
  }

  useEffect(() => {
    if (!allMatched || epilogueState !== 'idle') return
    setEpilogueState('loading')
    generateCleanupEpilogue({ accuracy, satellite: satObj, user, storyOutline })
      .then(res => { setEpilogue(res.epilogue || ''); setEpilogueState('done') })
      .catch(() => {
        setEpilogue(`${satName} 的碎片清理方案已经启动。平行时空里，那件最重要的事没有被定格，它仍然等待下一步行动。`)
        setEpilogueState('error')
      })
  }, [accuracy, allMatched, epilogueState, satName, satObj, storyOutline, user])

  function onDragStart(e, techId)    { e.dataTransfer.setData('text/plain', techId) }
  function onDragOver(e, debrisId)   { e.preventDefault(); setDragOverId(debrisId) }
  function onDragLeave()             { setDragOverId(null) }
  function onDropDebris(e, debrisId) {
    e.preventDefault(); setDragOverId(null)
    handleDrop(debrisId, e.dataTransfer.getData('text/plain'))
  }

  function handleContinue() {
    if (!canContinue) return
    setStoryChapter('m6', epilogue)
    onComplete()
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', padding: '80px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: '#5a5a56', marginBottom: 12 }}>
            MODULE 06 · CLEANUP
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, color: '#f5f4f0', margin: '0 0 14px' }}>
            怎么清理太空垃圾
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: 0, lineHeight: 1.75 }}>
            目前没有商业规模化清理案例。速度、数量、法律与成本，构成了每一次清理的四重障碍。
            三类技术路径已进入测试阶段，但距离规模化仍有距离。
          </p>
        </div>

        {/* ── Section 01 · 四重障碍 ── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            01 · 四重障碍
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {BARRIERS.map(b => (
              <div key={b.id} style={{
                background: '#0d0d0b', border: '1px solid #1c1c1a',
                borderRadius: 3, padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 15, color: '#f0efe8', fontWeight: 400 }}>{b.title}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: '#c8b89a' }}>{b.stat}</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em', color: '#2a2a28', marginBottom: 8 }}>
                  {b.titleEn}
                </div>
                <p style={{ fontFamily: SANS, fontSize: 12, color: '#6a6a64', margin: 0, lineHeight: 1.7 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 02 · 六种清理技术 ── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            02 · 六种清理技术
          </div>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: '0 0 20px', lineHeight: 1.75 }}>
            三类主要路径：激光微推、物理捕获、离轨增阻。每种方案针对特定碎片尺度与轨道条件，
            实际任务中通常需要组合使用。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ALL_METHODS.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                style={{
                  background: '#0d0d0b', border: '1px solid #1c1c1a',
                  borderRadius: 3, overflow: 'hidden',
                }}
              >
                {/* Image */}
                <div style={{ position: 'relative', height: 148, overflow: 'hidden' }}>
                  <img
                    src={m.img} alt={m.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.72, display: 'block' }}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, transparent 25%, #0d0d0b 100%)',
                  }} />
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em',
                    color: '#c8b89a', background: 'rgba(10,9,8,0.80)',
                    padding: '3px 8px', border: '1px solid rgba(200,184,154,0.22)',
                  }}>
                    {m.status}
                  </div>
                </div>
                {/* Text */}
                <div style={{ padding: '12px 16px 16px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', color: '#3a3a38', marginBottom: 5 }}>
                    {m.titleEn}
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 14, color: '#f0efe8', fontWeight: 400, marginBottom: 8 }}>
                    {m.title}
                  </div>
                  <p style={{ fontFamily: SANS, fontSize: 11, color: '#6a6a64', margin: 0, lineHeight: 1.65 }}>
                    {m.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Section 03 · 拖拽匹配 ── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            03 · 拖拽匹配
          </div>
          <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 300, color: '#f5f4f0', margin: '0 0 10px' }}>
            为这批碎片选择清理方式。
          </h3>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: '0 0 24px', lineHeight: 1.75 }}>
            把左侧技术卡拖到右侧碎片目标上。每次匹配会返回即时分析。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 14 }}>
            {/* ── Left: tech drag cards ── */}
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: '#3a3a38', marginBottom: 10 }}>
                可用技术 · 拖拽
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DRAG_TECHNOLOGIES.map(tech => (
                  <div
                    key={tech.id}
                    draggable
                    onDragStart={e => onDragStart(e, tech.id)}
                    style={{
                      background: '#0d0d0b', border: '1px solid #222220',
                      borderRadius: 3, overflow: 'hidden', cursor: 'grab', userSelect: 'none',
                    }}
                  >
                    <div style={{ position: 'relative', height: 76, overflow: 'hidden' }}>
                      <img
                        src={tech.img} alt={tech.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55, display: 'block', pointerEvents: 'none' }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #0d0d0b 100%)' }} />
                    </div>
                    <div style={{ padding: '8px 12px 12px' }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: '#c8b89a', letterSpacing: '0.08em', marginBottom: 3 }}>
                        {tech.titleEn}
                      </div>
                      <div style={{ fontFamily: SERIF, fontSize: 13, color: '#f0efe8' }}>{tech.title}</div>
                      <p style={{ fontFamily: SANS, fontSize: 10, color: '#5a5a56', margin: '5px 0 0', lineHeight: 1.55 }}>
                        {tech.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: debris drop zones ── */}
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: '#3a3a38', marginBottom: 10 }}>
                目标碎片 · 放置区
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {debrisSet.map(debris => {
                  const result    = matches[debris.id]
                  const pickedTech = DRAG_TECHNOLOGIES.find(t => t.id === result?.technologyId)
                  const isOver    = dragOverId === debris.id
                  const isLoading = loadingId === debris.id

                  return (
                    <div
                      key={debris.id}
                      onDragOver={e => onDragOver(e, debris.id)}
                      onDragLeave={onDragLeave}
                      onDrop={e => onDropDebris(e, debris.id)}
                      style={{
                        background: isOver ? 'rgba(200,184,154,0.04)' : '#0d0d0b',
                        border: `1px solid ${
                          isOver    ? 'rgba(200,184,154,0.35)' :
                          result?.isCorrect === true  ? '#2a4a2a' :
                          result?.isCorrect === false ? '#4a2a1a' :
                          '#1c1c1a'
                        }`,
                        borderRadius: 3, padding: '14px 16px', minHeight: 104,
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 14, color: '#f0efe8', fontWeight: 400 }}>
                          {debris.name}
                        </div>
                        {result && (
                          <span style={{
                            fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, marginLeft: 10,
                            color: result.isCorrect ? '#78c88c' : '#e07030',
                            border: `1px solid ${result.isCorrect ? '#2a4a2a' : '#4a2a1a'}`,
                            padding: '2px 7px',
                          }}>
                            {result.isCorrect ? '匹配正确' : '匹配偏差'}
                          </span>
                        )}
                      </div>

                      <p style={{ fontFamily: SANS, fontSize: 11, color: '#6a6a64', margin: '0 0 6px', lineHeight: 1.7 }}>
                        {debris.detail}
                      </p>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: '#2e2e2c', marginBottom: 8 }}>
                        来源 · {debris.source}
                      </div>

                      {pickedTech && !isLoading && (
                        <div style={{ fontFamily: MONO, fontSize: 10, color: '#c8b89a', marginBottom: 6, letterSpacing: '0.05em' }}>
                          → {pickedTech.title}
                        </div>
                      )}

                      {isLoading && (
                        <motion.div
                          animate={{ opacity: [0.3, 0.8, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          style={{ fontFamily: MONO, fontSize: 9, color: '#5a5a56', letterSpacing: '0.1em' }}
                        >
                          ANALYZING...
                        </motion.div>
                      )}

                      {feedbackMap[debris.id] && (
                        <p style={{ fontFamily: SANS, fontSize: 11, color: '#8a8a82', margin: '6px 0 0', lineHeight: 1.7 }}>
                          {feedbackMap[debris.id]}
                        </p>
                      )}

                      {!result && !isLoading && (
                        <div style={{
                          fontFamily: MONO, fontSize: 9, color: '#2a2a28', letterSpacing: '0.08em',
                          border: '1px dashed #2a2a28', padding: '5px 10px',
                          display: 'inline-block', marginTop: 4,
                        }}>
                          拖拽技术到此处
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 04 · 故事尾声 ── */}
        <div style={{ borderTop: '1px solid #1c1c1a', paddingTop: 36 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: '#5a5a56', marginBottom: 16 }}>
            04 · 故事尾声
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: '#5a5a56' }}>匹配准确率</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: '#c8b89a' }}>
              {Math.round(accuracy * 100)}%  ·  {correctCount}/{debrisSet.length}
            </div>
          </div>

          <AnimatePresence>
            {epilogueState === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontFamily: MONO, fontSize: 10, color: '#5a5a56', letterSpacing: '0.1em', marginBottom: 20 }}
              >
                <motion.span animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  GENERATING EPILOGUE...
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {(epilogueState === 'done' || epilogueState === 'error') && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{
                background: '#0d0d0b',
                border: '1px solid #242420',
                borderLeft: '3px solid #c8b89a',
                borderRadius: 3, padding: '20px 24px', marginBottom: 28,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: '#5a5a56', marginBottom: 12 }}>
                PARALLEL TIMELINE · CHAPTER 06 · EPILOGUE
              </div>
              <p style={{ fontFamily: SERIF, fontSize: 14, color: '#aeaea6', lineHeight: 1.95, margin: 0, fontStyle: 'italic' }}>
                {epilogue}
              </p>
            </motion.div>
          )}

          <motion.button
            onClick={handleContinue}
            disabled={!canContinue}
            whileHover={canContinue ? { opacity: 0.85 } : {}}
            whileTap={canContinue ? { scale: 0.98 } : {}}
            style={{
              width: '100%', padding: '16px 0',
              background: canContinue ? '#c8b89a' : 'transparent',
              border: `1px solid ${canContinue ? '#c8b89a' : '#2a2a28'}`,
              borderRadius: 2, cursor: canContinue ? 'pointer' : 'not-allowed',
              opacity: canContinue ? 1 : 0.32,
              fontFamily: SERIF, fontSize: 14,
              color: canContinue ? '#0a0a0a' : '#5a5a56',
              letterSpacing: '0.1em', transition: 'all 0.2s',
            }}
          >
            {!allMatched
              ? `还有 ${debrisSet.length - Object.keys(matches).length} 个碎片未匹配`
              : epilogueState === 'loading'
              ? '生成故事中…'
              : '继续 →'}
          </motion.button>
        </div>

      </div>
    </div>
  )
}
