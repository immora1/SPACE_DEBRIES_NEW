import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateCleanupFeedback, generateCleanupEpilogue } from '../../services/ai'

const EASE = [0.16, 1, 0.3, 1]

const BARRIERS = [
  {
    id: 'speed',
    title: '速度',
    desc: '碎片相对速度可达 7–14 km/s，接触窗口极短，捕获动作必须高度精确。',
  },
  {
    id: 'quantity',
    title: '数量',
    desc: '可追踪碎片已达数万件，厘米级以下更多，任何单次任务都只能覆盖极小比例。',
  },
  {
    id: 'law',
    title: '法律',
    desc: '碎片通常仍归属原发射国，其他主体无法直接处置，跨国协调成本高。',
  },
  {
    id: 'cost',
    title: '成本',
    desc: '一次主动清理任务成本高，回报难量化，商业化持续运营模型尚未形成。',
  },
]

const TECHNOLOGIES = [
  {
    id: 'laser',
    label: '激光消融',
    labelEn: 'LASER ABLATION',
    desc: '对小型碎片施加微推力，改变轨道，使其更快再入。',
  },
  {
    id: 'sail',
    label: '帆式减速',
    labelEn: 'DRAG SAIL',
    desc: '为轻质碎片或小卫星增加受阻面积，利用稀薄大气阻力离轨。',
  },
  {
    id: 'arm',
    label: '机械臂捕获',
    labelEn: 'ROBOTIC ARM',
    desc: '近距离接近并固定大型失效目标，再执行受控离轨。',
  },
]

function buildDebrisSet({ gameResult, materials, debrisGenerated }) {
  const sourceText = (debrisGenerated && debrisGenerated[0]) || '轨道任务结束后产生的残余碎片'

  const highSurvival = ['titanium', 'ti_tank', 'kevlar'].includes(materials?.frame) || ['ti_tank', 'copv'].includes(materials?.propulsion)

  return [
    {
      id: 'd1',
      name: '厘米级高速碎片群',
      detail: '尺度 1–10 cm，密度高，传统机械捕获成本过高。',
      source: sourceText,
      ideal: 'laser',
    },
    {
      id: 'd2',
      name: gameResult === 'failure' ? '失控卫星主体残骸' : '退役卫星主体',
      detail: '体积大、质量高、姿态不可控，需近距离固定后拖离轨道。',
      source: gameResult === 'failure' ? '任务失败后遗留主要目标' : '任务完成后的大型在轨结构',
      ideal: 'arm',
    },
    {
      id: 'd3',
      name: highSurvival ? '高面积质量比复合碎片' : '轻质剥离薄片碎片',
      detail: '轻质、分散、受阻面积相对大，可通过增阻方案缩短在轨寿命。',
      source: '长期轨道环境侵蚀产生',
      ideal: 'sail',
    },
  ]
}

function fallbackFeedback(isCorrect) {
  return isCorrect
    ? '匹配合理：该技术可在当前碎片尺度和轨道条件下形成可执行清理路径。'
    : '匹配偏差：该技术与目标尺寸或动力学条件不匹配，清理效率会显著下降。'
}

export default function M6({ onComplete }) {
  const user = useAppStore((s) => s.user)
  const satellite = useAppStore((s) => s.satellite)
  const materials = useAppStore((s) => s.materials)
  const gameResult = useAppStore((s) => s.gameResult)
  const debrisGenerated = useAppStore((s) => s.debrisGenerated)
  const storyOutline = useAppStore((s) => s.storyOutline)
  const setStoryChapter = useAppStore((s) => s.setStoryChapter)

  const satName = satellite?.name ?? satellite?.OBJECT_NAME ?? '未知卫星'
  const satAlt = satellite?.altitudeKm ?? satellite?.APOGEE ?? 836
  const satInc = satellite?.inclination ?? satellite?.INCLINATION ?? 98
  const satObj = { name: satName, altitudeKm: satAlt, inclination: satInc }

  const debrisSet = useMemo(
    () => buildDebrisSet({ gameResult, materials, debrisGenerated }),
    [gameResult, materials, debrisGenerated],
  )

  const [matches, setMatches] = useState({})
  const [feedbackMap, setFeedbackMap] = useState({})
  const [loadingDebrisId, setLoadingDebrisId] = useState(null)

  const [epilogueState, setEpilogueState] = useState('idle')
  const [epilogue, setEpilogue] = useState('')

  const allMatched = debrisSet.length > 0 && debrisSet.every((d) => !!matches[d.id])
  const correctCount = debrisSet.filter((d) => matches[d.id]?.isCorrect).length
  const accuracy = debrisSet.length ? correctCount / debrisSet.length : 0

  async function handleDrop(debrisId, technologyId) {
    if (loadingDebrisId) return

    const debris = debrisSet.find((d) => d.id === debrisId)
    const tech = TECHNOLOGIES.find((t) => t.id === technologyId)
    if (!debris || !tech) return

    const isCorrect = debris.ideal === technologyId

    setMatches((prev) => ({
      ...prev,
      [debrisId]: { technologyId, isCorrect },
    }))

    setLoadingDebrisId(debrisId)
    try {
      const res = await generateCleanupFeedback({
        debris: debris.name,
        technology: tech.label,
        isCorrect,
      })
      setFeedbackMap((prev) => ({
        ...prev,
        [debrisId]: res.feedback || fallbackFeedback(isCorrect),
      }))
    } catch {
      setFeedbackMap((prev) => ({
        ...prev,
        [debrisId]: fallbackFeedback(isCorrect),
      }))
    } finally {
      setLoadingDebrisId(null)
    }
  }

  useEffect(() => {
    if (!allMatched || epilogueState !== 'idle') return

    const run = async () => {
      setEpilogueState('loading')
      try {
        const res = await generateCleanupEpilogue({
          accuracy,
          satellite: satObj,
          user,
          storyOutline,
        })
        setEpilogue(res.epilogue || '')
        setEpilogueState('done')
      } catch {
        setEpilogue(
          `${satName} 的碎片清理方案已经启动。平行时空里，那件最重要的事没有被定格，它仍然等待下一步行动。`,
        )
        setEpilogueState('error')
      }
    }

    run()
  }, [accuracy, allMatched, epilogueState, satName, satObj, storyOutline, user])

  function onDragStart(e, technologyId) {
    e.dataTransfer.setData('text/plain', technologyId)
  }

  function onDragOver(e) {
    e.preventDefault()
  }

  function onDropDebris(e, debrisId) {
    e.preventDefault()
    const technologyId = e.dataTransfer.getData('text/plain')
    handleDrop(debrisId, technologyId)
  }

  function handleContinue() {
    if (!allMatched || (epilogueState !== 'done' && epilogueState !== 'error')) return
    setStoryChapter('m6', epilogue)
    onComplete()
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0' }}>
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #1a1a18' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b6b66', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          SPACE_DEBRIES · M6 · 怎么清理太空垃圾
        </span>
      </div>

      <section style={{ maxWidth: 820, margin: '0 auto', padding: '80px 32px 26px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(245,244,240,0.35)', letterSpacing: '0.12em', marginBottom: 16 }}>
          SECTION 01 · 清理障碍
        </div>
        <h2 style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 28, fontWeight: 400, color: 'rgba(245,244,240,0.9)', margin: '0 0 10px' }}>
          真正困难的，不只是技术本身。
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.42)', lineHeight: 1.95, margin: '0 0 24px' }}>
          目前没有商业规模化清理案例。速度、数量、法律与成本，决定了每一次清理都必须精确取舍。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          {BARRIERS.map((item) => (
            <div key={item.id} style={{ border: '1px solid rgba(245,244,240,0.1)', background: 'rgba(245,244,240,0.02)', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(200,184,154,0.8)', marginBottom: 8 }}>{item.title}</div>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(245,244,240,0.5)', lineHeight: 1.8 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 980, margin: '0 auto', padding: '80px 32px 20px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(245,244,240,0.35)', letterSpacing: '0.12em', marginBottom: 16 }}>
          SECTION 02 · 拖拽匹配
        </div>
        <h3 style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 24, fontWeight: 400, color: 'rgba(245,244,240,0.86)', margin: '0 0 10px' }}>
          为这批碎片选择最合适的清理方式。
        </h3>
        <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.42)', lineHeight: 1.9, margin: '0 0 24px' }}>
          把左侧技术卡拖到右侧碎片目标上。每次匹配会返回即时解释。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
          <div style={{ border: '1px solid rgba(245,244,240,0.1)', background: 'rgba(245,244,240,0.02)', padding: 16 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(245,244,240,0.4)', marginBottom: 12 }}>可用清理技术</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TECHNOLOGIES.map((tech) => (
                <div
                  key={tech.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, tech.id)}
                  style={{
                    border: '1px solid rgba(245,244,240,0.14)',
                    background: 'rgba(245,244,240,0.03)',
                    padding: '12px 12px',
                    cursor: 'grab',
                  }}
                >
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(200,184,154,0.82)', marginBottom: 4 }}>{tech.labelEn}</div>
                  <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 16, color: 'rgba(245,244,240,0.82)', marginBottom: 6 }}>{tech.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(245,244,240,0.46)', lineHeight: 1.75 }}>{tech.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {debrisSet.map((debris) => {
              const result = matches[debris.id]
              const pickedTech = TECHNOLOGIES.find((t) => t.id === result?.technologyId)

              return (
                <div
                  key={debris.id}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDropDebris(e, debris.id)}
                  style={{
                    border: '1px solid rgba(245,244,240,0.1)',
                    background: 'rgba(245,244,240,0.02)',
                    padding: '14px 14px',
                    minHeight: 120,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 17, color: 'rgba(245,244,240,0.84)' }}>{debris.name}</div>
                    {result && (
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: 10,
                        color: result.isCorrect ? 'rgba(120,200,140,0.86)' : 'rgba(224,112,48,0.92)',
                        border: `1px solid ${result.isCorrect ? 'rgba(120,200,140,0.42)' : 'rgba(224,112,48,0.46)'}`,
                        padding: '2px 8px',
                        height: 20,
                      }}>
                        {result.isCorrect ? '匹配正确' : '匹配偏差'}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(245,244,240,0.5)', lineHeight: 1.75 }}>{debris.detail}</p>
                  <div style={{ fontSize: 11, color: 'rgba(245,244,240,0.36)', marginBottom: 8 }}>来源：{debris.source}</div>

                  {pickedTech && (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(200,184,154,0.86)', marginBottom: 6 }}>
                      已选择：{pickedTech.label}
                    </div>
                  )}

                  {loadingDebrisId === debris.id && (
                    <motion.div
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 1.3, repeat: Infinity }}
                      style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(245,244,240,0.38)', letterSpacing: '0.08em' }}
                    >
                      ANALYZING MATCH...
                    </motion.div>
                  )}

                  {feedbackMap[debris.id] && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(245,244,240,0.58)', lineHeight: 1.75 }}>
                      {feedbackMap[debris.id]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '80px 32px 96px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(245,244,240,0.35)', letterSpacing: '0.12em', marginBottom: 16 }}>
          SECTION 03 · 尾声
        </div>
        <div style={{ borderTop: '1px solid rgba(245,244,240,0.1)', paddingTop: 20 }}>
          <div style={{ marginBottom: 14, fontFamily: 'monospace', fontSize: 11, color: 'rgba(245,244,240,0.5)' }}>
            匹配准确率：{Math.round(accuracy * 100)}% ({correctCount}/{debrisSet.length})
          </div>

          <AnimatePresence>
            {epilogueState === 'loading' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.1em', marginBottom: 16 }}
              >
                GENERATING EPILOGUE...
              </motion.div>
            )}
          </AnimatePresence>

          {(epilogueState === 'done' || epilogueState === 'error') && (
            <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 15, color: 'rgba(245,244,240,0.78)', lineHeight: 2, margin: '0 0 22px' }}>
              {epilogue}
            </p>
          )}

          <button
            onClick={handleContinue}
            disabled={!allMatched || (epilogueState !== 'done' && epilogueState !== 'error')}
            style={{
              width: '100%',
              padding: '16px 0',
              background: 'transparent',
              border: '1px solid rgba(245,244,240,0.2)',
              cursor: !allMatched || (epilogueState !== 'done' && epilogueState !== 'error') ? 'not-allowed' : 'pointer',
              opacity: !allMatched || (epilogueState !== 'done' && epilogueState !== 'error') ? 0.35 : 1,
              fontFamily: '"Noto Serif SC", serif',
              fontSize: 14,
              color: 'rgba(245,244,240,0.72)',
              letterSpacing: '0.1em',
            }}
          >
            继续 →
          </button>
        </div>
      </section>
    </div>
  )
}
