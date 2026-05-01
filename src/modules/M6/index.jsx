import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateCleanupFeedback, generateCleanupEpilogue } from '../../services/ai'

const MONO  = 'Space Mono, monospace'
const SERIF = 'Noto Serif SC, serif'
const SANS  = 'Noto Sans SC, sans-serif'
const EASE  = [0.16, 1, 0.3, 1]
const CONTENT_MAX = 1080

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
    details: [
      ['原理', '地面或轨道平台用高能激光加热碎片表面，烧蚀喷流形成反冲力。'],
      ['目标', '适合厘米级高速小碎片，不需要接触目标。'],
      ['限制', '需要极高指向精度，且要避免误伤正常航天器。'],
    ],
  },
  {
    id: 'arm', img: '/cleanup/2.png',
    title: '机械臂抓取', titleEn: 'ROBOTIC ARM', status: '任务中',
    desc: '清理卫星近距接近目标，伸出高精度机械臂固定失控卫星，再拖入大气层。ClearSpace-1 任务以此方案为目标 Vespa 残骸设计。',
    details: [
      ['原理', '清理航天器先交会靠近，再用机械臂锁定主体结构。'],
      ['目标', '适合大型退役卫星、火箭上面级等可识别目标。'],
      ['限制', '目标若翻滚剧烈，接近和抓取风险会显著上升。'],
    ],
  },
  {
    id: 'net', img: '/cleanup/3.png',
    title: '柔性捕捉网', titleEn: 'SPACE NET', status: '已测试',
    desc: '对旋转或形状不规则的碎片发射高强度网，包裹目标无需精确对准接口。RemoveDEBRIS 项目已完成在轨抛网测试。',
    details: [
      ['原理', '发射柔性高强度网，张开后包裹目标，再由母星拖拽离轨。'],
      ['目标', '适合形状不规则、没有标准对接口的中大型残骸。'],
      ['进展', 'RemoveDEBRIS 曾完成在轨抛网捕获演示。'],
    ],
  },
  {
    id: 'harpoon', img: '/cleanup/4.png',
    title: '飞弹鱼叉', titleEn: 'HARPOON', status: '已测试',
    desc: '向碎片发射带倒钩的钛合金鱼叉，穿透金属外壳后通过缆绳拖离轨道。适合远距离捕获坚硬大型残骸结构。',
    details: [
      ['原理', '鱼叉高速射入金属外壳，倒钩固定后由缆绳牵引。'],
      ['目标', '适合坚硬、外壳较厚的大型残骸或火箭结构。'],
      ['风险', '穿透冲击可能制造二次碎片，因此目标选择很关键。'],
    ],
  },
  {
    id: 'tether', img: '/cleanup/5.png',
    title: '电动缆索', titleEn: 'ELECTRODYNAMIC TETHER', status: '研究阶段',
    desc: '释放数公里长的导电缆索切割地磁场，产生洛伦兹力令卫星减速，无需燃料即可离轨。寿命末期部署，可大幅压缩在轨残留时间。',
    details: [
      ['原理', '导电缆索切割地磁场产生电流，洛伦兹力提供持续减速。'],
      ['目标', '适合卫星寿命末期主动部署，减少长期滞留。'],
      ['优势', '不依赖推进剂，能把离轨过程从多年压缩到更短周期。'],
    ],
  },
  {
    id: 'sail', img: '/cleanup/6.png',
    title: '阻力帆', titleEn: 'DRAG SAIL', status: '已部署',
    desc: '寿命结束时展开大面积薄膜帆，利用稀薄大气阻力加速轨道衰减，将自然再入从数百年缩短至数年甚至数月。',
    details: [
      ['原理', '展开大面积薄膜，提高迎风面积，让稀薄大气更快拖慢轨道速度。'],
      ['目标', '适合低轨小卫星和轻质结构的寿命末期离轨。'],
      ['优势', '结构简单、成本低，可作为任务结束后的被动清理装置。'],
    ],
  },
]

const DRAG_TECHNOLOGIES = ALL_METHODS.filter(m => ['laser', 'arm', 'sail'].includes(m.id))

const MATERIAL_META = {
  frame: {
    aluminum: { label: '铝合金主框架', risk: '低存活', note: '再入时大多烧蚀，但碰撞后会形成可追踪金属片。' },
    titanium: { label: '钛合金主框架', risk: '高存活', note: '高熔点大块结构更可能长期滞留或再入存活。' },
    cfrp: { label: '碳纤维复合主框架', risk: '纤维化', note: '破碎后容易形成轻质复合材料片和纤维颗粒。' },
  },
  solar: {
    silicon: { label: '硅基太阳能板', risk: '玻璃碎裂', note: '玻璃盖片和硅片会形成密集小碎片。' },
    gaas: { label: '砷化镓太阳能板', risk: '中等存活', note: '电池层与铝基底可能产生片状和滴状残留。' },
    flexible: { label: '柔性薄膜太阳能板', risk: '薄膜剥离', note: '在轨更容易剥离成轻薄高面积碎片。' },
  },
  insulation: {
    mli: { label: '多层铝箔隔热毯', risk: '微粒多', note: '冷热循环和撞击后会释放大量薄片与微粒。' },
    honeycomb: { label: '铝蜂窝板', risk: '结构碎片', note: '蜂窝结构碰撞后会裂成片状和块状混合碎片。' },
    kevlar: { label: '凯夫拉吸收层', risk: '高韧性', note: '纤维层韧性高，碎片可能呈轻质复合絮片。' },
  },
  propulsion: {
    ti_tank: { label: '钛合金球形贮箱', risk: '高存活', note: '厚壁球形结构很难完全烧蚀，属于重点清理目标。' },
    al_tank: { label: '铝合金贮箱', risk: '低存活', note: '壁薄但碰撞后仍可能形成金属片和阀体残件。' },
    copv: { label: '复合材料缠绕贮箱', risk: '爆裂风险', note: '复合外层和金属内衬可能形成混合碎片。' },
  },
}

function materialInfo(materials, part) {
  return MATERIAL_META[part]?.[materials?.[part]] || null
}

function buildDebrisSet({ gameResult, materials, debrisGenerated }) {
  const sourceText = (debrisGenerated && debrisGenerated[0]) || '轨道任务结束后产生的残余碎片'
  const frame = materialInfo(materials, 'frame')
  const solar = materialInfo(materials, 'solar')
  const insulation = materialInfo(materials, 'insulation')
  const propulsion = materialInfo(materials, 'propulsion')
  const result = typeof gameResult === 'string' ? gameResult : gameResult?.result
  const failed = result === 'failure'
  const highSurvival = ['titanium', 'kevlar'].includes(materials?.frame)
    || ['ti_tank', 'copv'].includes(materials?.propulsion)
    || materials?.insulation === 'kevlar'
  const microSource = [solar, insulation].filter(Boolean).map(m => m.label).join(' + ') || '外露薄片与隔热层'
  const bodySource = [frame, propulsion].filter(Boolean).map(m => m.label).join(' + ') || '卫星主体结构'
  const lightSource = [solar, insulation, frame].filter(Boolean).map(m => m.label).join(' / ') || '轻质外露结构'

  return [
    {
      id: 'd1', ideal: 'laser',
      name: `${microSource} 释放的厘米级高速碎片群`,
      detail: `${solar?.note || '太阳能板碎裂会形成玻璃和电池片残骸'}${insulation ? ` ${insulation.note}` : ''} 这类 1–10 cm 碎片数量多、速度高，逐个机械捕获不现实，适合用激光微推批量改变轨道。`,
      source: `M4 事件记录：${sourceText}`,
      context: `M1 选择材料：${microSource}`,
    },
    {
      id: 'd2', ideal: 'arm',
      name: failed ? `${bodySource} 构成的失控主体` : `${bodySource} 构成的退役主体`,
      detail: `${frame?.note || '主体框架决定碎片尺寸和存活率'} ${propulsion?.note || '推进系统残件通常质量集中'} 目标体积大、质量高，若姿态不可控，需要近距离固定后执行受控离轨。`,
      source: failed ? `M4 结果：任务失败，主体成为新的清理目标` : `M4 结果：任务完成后仍需处理大型在轨结构`,
      context: `最终护甲 ${gameResult?.finalArmor ?? '未知'} / 燃料 ${gameResult?.finalFuel ?? '未知'} / 任务进度 ${gameResult?.finalMission ?? '未知'}`,
    },
    {
      id: 'd3', ideal: 'sail',
      name: highSurvival ? `${lightSource} 形成的复合轻质颗粒` : `${lightSource} 剥离的轻质薄片`,
      detail: `${insulation?.note || solar?.note || '轻薄材料容易形成高面积质量比碎片'} 这些碎片质量小、受阻面积相对大，增加气动阻力能更有效缩短轨道寿命。`,
      source: `M1 个性化材料路径：${lightSource}`,
      context: highSurvival ? '含高熔点或复合材料，需优先缩短在轨滞留时间。' : '以轻质薄片为主，适合增阻离轨思路。',
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
      style={{ perspective: '1200px', height: 330 }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        animationDelay: `${index * 0.06}s`,
        filter: flipped ? 'drop-shadow(0 18px 34px rgba(0,0,0,0.45))' : 'drop-shadow(0 10px 24px rgba(0,0,0,0.28))',
      }}>

        {/* ── 正面 ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: flipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
          opacity: flipped ? 0 : 1,
          transition: 'transform 0.72s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s linear 0.24s',
          background: '#0d0d0b', border: '1px solid #1c1c1a',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px rgba(245,244,240,0.025)',
        }}>
          <img
            src={m.img} alt={m.title}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', opacity: 0.74, display: 'block',
              transform: flipped ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.72s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
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
          transform: flipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
          opacity: flipped ? 1 : 0,
          transition: 'transform 0.72s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s linear 0.24s',
          background: 'radial-gradient(circle at 80% 10%, rgba(200,184,154,0.055), transparent 38%), #0d0d0b',
          border: '1px solid #2a2a28',
          borderLeft: '3px solid #c8b89a',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-start', padding: '20px 18px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: '#c8b89a', letterSpacing: '0.12em', marginBottom: 8 }}>
                TECHNICAL DETAIL
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: '#f0efe8', fontWeight: 400 }}>
                {m.title}
              </div>
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 8, color: '#5a5a56', letterSpacing: '0.08em',
              border: '1px solid #2a2a28', padding: '3px 7px', whiteSpace: 'nowrap',
            }}>
              {m.status}
            </div>
          </div>
          <div style={{ width: '100%', height: 1, background: '#252522', marginBottom: 13 }} />
          <p style={{
            fontFamily: SANS, fontSize: 10, color: '#9a9a92',
            lineHeight: 1.58, margin: '0 0 12px',
          }}>
            {m.desc}
          </p>
          <div style={{ display: 'grid', gap: 7 }}>
            {m.details?.map(([label, text]) => (
              <div key={label} style={{
                borderTop: '1px solid rgba(245,244,240,0.055)',
                paddingTop: 6,
              }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: '#c8b89a', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 9.5, color: '#7f7f78', lineHeight: 1.48 }}>
                  {text}
                </div>
              </div>
            ))}
          </div>
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
  const [selectedTechId, setSelectedTechId] = useState(null)
  const [epilogueState,  setEpilogueState]  = useState('idle')
  const [epilogue,       setEpilogue]       = useState('')

  useEffect(() => {
    setMatches({})
    setFeedbackMap({})
    setSelectedTechId(null)
    setEpilogue('')
    setEpilogueState('idle')
  }, [debrisSet])

  const allMatched   = debrisSet.length > 0 && debrisSet.every(d => !!matches[d.id])
  const correctCount = debrisSet.filter(d => matches[d.id]?.isCorrect).length
  const accuracy     = debrisSet.length ? correctCount / debrisSet.length : 0
  const canContinue  = allMatched && (epilogueState === 'done' || epilogueState === 'error')
  const selectedTech = DRAG_TECHNOLOGIES.find(t => t.id === selectedTechId)
  const matchedCount = Object.keys(matches).length

  async function handleDrop(debrisId, techId) {
    if (loadingId) return
    const debris = debrisSet.find(d => d.id === debrisId)
    const tech   = DRAG_TECHNOLOGIES.find(t => t.id === techId)
    if (!debris || !tech) return

    const isCorrect = debris.ideal === techId
    setMatches(prev => ({ ...prev, [debrisId]: { technologyId: techId, isCorrect } }))
    setSelectedTechId(null)
    setLoadingId(debrisId)
    try {
      const res = await generateCleanupFeedback({
        debris: debris.name,
        debrisDetail: debris.detail,
        debrisSource: debris.source,
        debrisContext: debris.context,
        technology: tech.title,
        isCorrect,
      })
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
  function onDragEnd()               { setSelectedTechId(null) }
  function onDragOver(e, debrisId)   { e.preventDefault(); setDragOverId(debrisId) }
  function onDragLeave()             { setDragOverId(null) }
  function onDropDebris(e, debrisId) {
    e.preventDefault(); setDragOverId(null)
    handleDrop(debrisId, e.dataTransfer.getData('text/plain'))
  }
  function handleTechSelect(techId) {
    if (loadingId) return
    setSelectedTechId(prev => prev === techId ? null : techId)
  }
  function handleTargetClick(debrisId) {
    if (!selectedTechId || loadingId) return
    handleDrop(debrisId, selectedTechId)
  }

  function handleContinue() {
    if (!canContinue) return
    setStoryChapter('m6', epilogue)
    onComplete()
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#f5f4f0', padding: '80px 24px' }}>
      <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: '#5a5a56', marginBottom: 12 }}>
            MODULE 06 · CLEANUP
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, color: '#f5f4f0', margin: '0 0 14px' }}>
            怎么清理太空垃圾
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: 0, lineHeight: 1.75, maxWidth: 760 }}>
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
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#6a6a64', margin: '0 0 20px', lineHeight: 1.75, maxWidth: 760 }}>
            三类主要路径：激光微推、物理捕获、离轨增阻。每种方案针对特定碎片尺度与轨道条件，
            实际任务中通常需要组合使用。
          </p>
          <div style={{
            width: '100%',
            borderTop: '1px solid #151513',
            borderBottom: '1px solid #151513',
            padding: '18px 0 20px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              margin: '0 0 14px',
            }}>
              <div style={{ height: 1, background: '#1c1c1a', flex: 1 }} />
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: '#3a3a38', whiteSpace: 'nowrap' }}>
                HOVER TO REVEAL METHOD DETAILS
              </div>
              <div style={{ height: 1, background: '#1c1c1a', flex: 1 }} />
            </div>

            <div style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '2px 2px 14px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#2a2a28 transparent',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 190px)',
                gap: 12,
                width: 'max-content',
              }}>
                {ALL_METHODS.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                    style={{ minWidth: 0 }}
                  >
                    <MethodCard m={m} index={i} />
                  </motion.div>
                ))}
              </div>
            </div>
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
            右侧目标会根据你在 M1 选择的卫星材料，以及 M4 游戏结局中产生的垃圾描述生成。把左侧技术卡拖到目标上，每次匹配会返回即时分析。
          </p>

          <div style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.006))',
            border: '1px solid #181816',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 16,
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: '1px solid #181816',
              background: 'rgba(13,13,11,0.62)',
            }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#c8b89a', marginBottom: 6 }}>
                  CLEANUP MATCHING CONSOLE
                </div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: '#5a5a56', lineHeight: 1.6 }}>
                  {selectedTech
                    ? `已锁定技术：${selectedTech.title}。点击右侧目标完成匹配，或继续拖拽。`
                    : '选择左侧技术后点击目标，或直接拖拽到右侧目标区。'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {debrisSet.map(d => {
                  const r = matches[d.id]
                  return (
                    <div key={d.id} style={{
                      width: 9, height: 9, borderRadius: '50%',
                      background: r ? (r.isCorrect ? '#78c88c' : '#e07030') : '#242420',
                      boxShadow: r ? `0 0 10px ${r.isCorrect ? 'rgba(120,200,140,0.45)' : 'rgba(224,112,48,0.42)'}` : 'none',
                      transition: 'all 0.25s',
                    }} />
                  )
                })}
                <span style={{ fontFamily: MONO, fontSize: 10, color: '#5a5a56', marginLeft: 6 }}>
                  {matchedCount}/{debrisSet.length}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0 }}>
            {/* ── Left: tech drag cards ── */}
            <div style={{ borderRight: '1px solid #181816', padding: 14, background: 'rgba(10,10,10,0.35)' }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: '#3a3a38', marginBottom: 10 }}>
                可用技术 · 拖拽
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DRAG_TECHNOLOGIES.map((tech, idx) => {
                  const isSelected = selectedTechId === tech.id
                  const disabled = !!loadingId
                  return (
                  <motion.div
                    key={tech.id}
                    draggable
                    onClick={() => handleTechSelect(tech.id)}
                    onDragStart={e => { setSelectedTechId(tech.id); onDragStart(e, tech.id) }}
                    onDragEnd={onDragEnd}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: idx * 0.05, ease: EASE }}
                    whileHover={disabled ? {} : { x: 4 }}
                    whileTap={disabled ? {} : { scale: 0.985 }}
                    style={{
                      position: 'relative',
                      background: isSelected ? 'rgba(200,184,154,0.055)' : '#0d0d0b',
                      border: `1px solid ${isSelected ? 'rgba(200,184,154,0.48)' : '#222220'}`,
                      borderRadius: 4, overflow: 'hidden',
                      cursor: disabled ? 'not-allowed' : 'grab',
                      userSelect: 'none',
                      opacity: disabled && !isSelected ? 0.52 : 1,
                      boxShadow: isSelected ? '0 0 28px rgba(200,184,154,0.08)' : 'none',
                    }}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="selected-tech-rail"
                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#c8b89a', zIndex: 2 }}
                      />
                    )}
                    <div style={{ position: 'relative', height: 82, overflow: 'hidden' }}>
                      <img
                        src={tech.img} alt={tech.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isSelected ? 0.7 : 0.52, display: 'block', pointerEvents: 'none' }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #0d0d0b 100%)' }} />
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        fontFamily: MONO, fontSize: 8, color: isSelected ? '#0a0a0a' : '#5a5a56',
                        background: isSelected ? '#c8b89a' : 'rgba(10,10,10,0.72)',
                        border: '1px solid rgba(200,184,154,0.20)',
                        padding: '2px 6px',
                      }}>
                        {isSelected ? 'LOCKED' : 'SELECT'}
                      </div>
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
                  </motion.div>
                  )
                })}
              </div>
            </div>

            {/* ── Right: debris drop zones ── */}
            <div style={{ padding: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: '#3a3a38', marginBottom: 10 }}>
                目标碎片 · 放置区
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {debrisSet.map(debris => {
                  const result    = matches[debris.id]
                  const pickedTech = DRAG_TECHNOLOGIES.find(t => t.id === result?.technologyId)
                  const isOver    = dragOverId === debris.id
                  const isLoading = loadingId === debris.id

                  const canClickTarget = !!selectedTechId && !isLoading
                  const isLockedTarget = canClickTarget && !result

                  return (
                    <motion.div
                      key={debris.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      onDragOver={e => onDragOver(e, debris.id)}
                      onDragLeave={onDragLeave}
                      onDrop={e => onDropDebris(e, debris.id)}
                      onClick={() => handleTargetClick(debris.id)}
                      whileHover={{ y: -2 }}
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        background: isOver || isLockedTarget ? 'rgba(200,184,154,0.035)' : '#0d0d0b',
                        border: `1px solid ${
                          isOver    ? 'rgba(200,184,154,0.35)' :
                          result?.isCorrect === true  ? '#2a4a2a' :
                          result?.isCorrect === false ? '#4a2a1a' :
                          isLockedTarget ? 'rgba(200,184,154,0.28)' :
                          '#1c1c1a'
                        }`,
                        borderRadius: 4, padding: '18px 18px', minHeight: 132,
                        transition: 'border-color 0.15s, background 0.15s',
                        cursor: canClickTarget ? 'crosshair' : 'default',
                        boxShadow: result
                          ? `0 0 26px ${result.isCorrect ? 'rgba(120,200,140,0.055)' : 'rgba(224,112,48,0.05)'}`
                          : 'none',
                      }}
                    >
                      {(isOver || isLockedTarget || isLoading) && (
                        <motion.div
                          initial={{ x: '-110%' }}
                          animate={{ x: '110%' }}
                          transition={{ duration: 1.25, repeat: Infinity, ease: 'linear' }}
                          style={{
                            position: 'absolute', top: 0, bottom: 0, width: '36%',
                            background: 'linear-gradient(90deg, transparent, rgba(200,184,154,0.08), transparent)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                        background: result
                          ? (result.isCorrect ? '#78c88c' : '#e07030')
                          : isLockedTarget ? '#c8b89a' : '#242420',
                        opacity: result || isLockedTarget ? 0.85 : 0.35,
                      }} />
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
                      <div style={{ fontFamily: MONO, fontSize: 9, color: '#3a3a38', marginBottom: 5, lineHeight: 1.55 }}>
                        来源 · {debris.source}
                      </div>
                      {debris.context && (
                        <div style={{
                          fontFamily: MONO, fontSize: 9, color: '#5a5a56',
                          borderLeft: '2px solid rgba(200,184,154,0.25)',
                          paddingLeft: 8, marginBottom: 8, lineHeight: 1.55,
                        }}>
                          个性化依据 · {debris.context}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
                          color: '#c8b89a', border: '1px solid rgba(200,184,154,0.18)',
                          padding: '2px 6px',
                        }}>
                          来自 M1 材料
                        </span>
                        <span style={{
                          fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
                          color: '#7a7a72', border: '1px solid #242420',
                          padding: '2px 6px',
                        }}>
                          关联 M4 事件
                        </span>
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
                          style={{
                            fontFamily: MONO, fontSize: 9, color: '#c8b89a', letterSpacing: '0.1em',
                            border: '1px solid rgba(200,184,154,0.18)',
                            display: 'inline-block', padding: '4px 8px',
                          }}
                        >
                          ANALYZING MATCH VECTOR...
                        </motion.div>
                      )}

                      {feedbackMap[debris.id] && (
                        <p style={{ fontFamily: SANS, fontSize: 11, color: '#8a8a82', margin: '6px 0 0', lineHeight: 1.7 }}>
                          {feedbackMap[debris.id]}
                        </p>
                      )}

                      {!result && !isLoading && (
                        <motion.div
                          animate={isLockedTarget ? { opacity: [0.45, 0.95, 0.45] } : { opacity: 1 }}
                          transition={{ duration: 1.1, repeat: isLockedTarget ? Infinity : 0 }}
                          style={{
                          fontFamily: MONO, fontSize: 9, color: '#2a2a28', letterSpacing: '0.08em',
                          border: `1px dashed ${isLockedTarget ? 'rgba(200,184,154,0.42)' : '#2a2a28'}`,
                          padding: '6px 10px',
                          display: 'inline-block', marginTop: 4,
                        }}>
                          {selectedTech ? `点击部署 ${selectedTech.title}` : '拖拽或先选择技术'}
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
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
