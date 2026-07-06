import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import './index.css'

const EASE = [0.22, 1, 0.36, 1]
const MOVE_EASE = [0.25, 1, 0.5, 1]

const LEGAL_FILES = [
  {
    id: 'framework',
    index: '01',
    code: 'FRAMEWORK / 3 LAYERS',
    marker: '总体结构',
    title: '规则已经出现，治理仍然松散。',
    summary: '现有体系由国际条约、软法与技术标准、国内许可三层构成，但尚未形成统一且可强制执行的全球制度。',
    position: { left: '13%', top: '24%', rotate: -5, drift: 11, duration: 7.4 },
    sections: [
      {
        title: '核心结论',
        body: '太空垃圾治理并非法律空白。国际条约负责国家责任、赔偿和登记；联合国、IADC、ISO 提供减缓准则和技术标准；各国再通过许可制度落实。真正缺失的是专门、统一、强制执行的全球清理机制。',
      },
      {
        title: '三层规则',
        items: [
          '国际硬法：建立国家责任、损害赔偿、登记识别等底层关系。',
          '国际软法与标准：把避免碰撞、减少解体、任务后处置转化为工程原则。',
          '国内监管：通过发射、频谱、运营许可和任务审查形成实际约束。',
        ],
      },
      {
        title: '结构性问题',
        body: '三层规则之间没有形成统一执法链条：硬法原则宽泛，软法依赖自愿转化，各国标准与管辖力度又不一致。',
      },
    ],
    sources: [
      ['UNOOSA · Space Law Treaties and Principles', 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties.html'],
    ],
  },
  {
    id: 'hard-law',
    index: '02',
    code: 'INTERNATIONAL / HARD LAW',
    marker: '国际硬法',
    title: '责任被确认，清理义务仍然模糊。',
    summary: '联合国外空条约体系能回答谁负责、如何登记、何时赔偿，却没有规定每类碎片必须由谁清除。',
    position: { left: '39%', top: '16%', rotate: 4, drift: 9, duration: 8.2 },
    sections: [
      {
        title: '1967 · 外层空间条约',
        body: '国家对本国政府和非政府实体的外空活动承担国际责任，私人企业活动也需要国家授权与持续监督。它提供原则，却没有具体碎片减缓、离轨期限或清理义务。',
      },
      {
        title: '1972 · 空间物体责任公约',
        body: '发射国对地面损害通常承担绝对责任；外空损害则涉及过错判断。现实中，碎片来源、碰撞链条和过错证明都十分困难。',
      },
      {
        title: '1975 · 空间物体登记公约',
        body: '登记帮助确认卫星、火箭末级与相关碎片来源，但登记并不等于治理，也难覆盖小碎片、历史遗留物和复杂的多国发射关系。',
      },
    ],
    sources: [
      ['UNOOSA · 五大外空条约', 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties.html'],
    ],
  },
  {
    id: 'soft-law',
    index: '03',
    code: 'GUIDELINES / STANDARDS',
    marker: '软法与标准',
    title: '工程规则更具体，法律效力更有限。',
    summary: '直接针对碎片减缓的规则大多是指南与标准，只有被国家立法、许可、合同或机构政策吸收后，才会产生更强约束。',
    position: { left: '67%', top: '25%', rotate: -3, drift: 13, duration: 7.8 },
    sections: [
      {
        title: 'COPUOS 准则',
        body: '要求限制正常运行释放碎片、减少爆炸和碰撞风险，并在任务结束后处置低轨与地球同步轨道相关残留物；其本身属于自愿性准则。',
      },
      {
        title: 'LTS 与 IADC',
        body: '长期可持续性准则覆盖政策监管、运行安全、国际合作和能力建设；IADC 指南更贴近航天器与火箭末级的规划、设计、运行和处置。',
      },
      {
        title: 'ISO 24113:2023 与 ESA',
        body: 'ISO 将减缓目标转化为无人空间系统、火箭末级和任务释放物体的技术要求。ESA 以“2030 零碎片”为方向推动机构任务先行，但仍不能替代全球法律。',
      },
    ],
    sources: [
      ['COPUOS · Space Debris Mitigation Guidelines', 'https://www.unoosa.org/pdf/publications/st_space_49E.pdf'],
      ['ISO 24113:2023', 'https://www.iso.org/standard/83494.html'],
    ],
  },
  {
    id: 'national',
    index: '04',
    code: 'NATIONAL / LICENSING',
    marker: '国家监管',
    title: '许可制度正在成为最现实的入口。',
    summary: '各国把碎片减缓写入发射、频谱、运营和任务后处置审查，但期限、范围与执行力度尚未统一。',
    position: { left: '20%', top: '57%', rotate: 3, drift: 10, duration: 8.6 },
    sections: [
      {
        title: '美国与欧洲',
        items: [
          '美国 FCC 将部分低轨卫星任务结束后的离轨期限压缩到 5 年，但其管辖不能覆盖全部空间活动。',
          '欧盟提出 EU Space Act，试图围绕安全、韧性和可持续性建立统一框架；截至文档整理时仍处于立法程序。',
          '法国 FSOA 与 ESA 政策在授权、碰撞风险、再入和任务后处置方面形成较完整要求。',
        ],
      },
      {
        title: '英国、中国与日本',
        items: [
          '英国 CAA 通过空间活动许可监管发射、返回和轨道运营，并采用 IADC 与 LTS 原则。',
          '中国对 2000 km 以下微小卫星提出任务后驻留时间要求，并强调避免脱落、丢弃、抛洒和爆炸。',
          '日本在空间活动法许可框架下要求防止部件散逸、实施避碰控制，并规划低轨任务后离轨。',
        ],
      },
    ],
    sources: [
      ['FCC · 5-Year Deorbit Rule', 'https://www.fcc.gov/document/fcc-adopts-new-5-year-rule-deorbiting-satellites-0'],
      ['European Commission · EU Space Act', 'https://defence-industry-space.ec.europa.eu/eu-space-act_en'],
    ],
  },
  {
    id: 'gaps',
    index: '05',
    code: 'GOVERNANCE / 7 GAPS',
    marker: '治理缺口',
    title: '有责任框架，缺清理机制。',
    summary: '现有制度更擅长约束未来任务，却难以处理历史垃圾、主动清除、跨国追责和空间交通协同。',
    position: { left: '48%', top: '62%', rotate: -4, drift: 14, duration: 7.1 },
    sections: [
      {
        title: '七个未闭合的问题',
        items: [
          '缺少专门、统一、强制的全球太空垃圾公约。',
          '软法准则较多，但执行依赖各国自愿转化。',
          '5 年、25 年及宽泛表述并存，各国标准不一致。',
          '碎片高速、微小且来源复杂，归属与过错证明困难。',
          '几十年前形成的历史遗留碎片缺少清理机制。',
          '主动清除涉及原发射国或所有者的授权与同意。',
          '全球空间交通管理、数据共享与避碰协同仍然分散。',
        ],
      },
      {
        title: '真正的矛盾',
        body: '技术已经能够接近、捕获甚至改变部分目标的轨道，但法律还没有稳定回答：谁有权行动、谁为行动中的二次风险负责、清理成本应由谁承担。',
      },
    ],
    sources: [
      ['UNOOSA · Long-term Sustainability', 'https://www.unoosa.org/oosa/en/ourwork/topics/long-term-sustainability-of-outer-space-activities.html'],
    ],
  },
  {
    id: 'language',
    index: '06',
    code: 'EXHIBITION / LANGUAGE',
    marker: '项目表达',
    title: '法律能确认责任，却不一定能清理风险。',
    summary: '将复杂制度转译为展板、模型和交互中的清晰表达，让观众理解“不是无法可依，而是执行链条没有闭合”。',
    position: { left: '75%', top: '55%', rotate: 5, drift: 8, duration: 9 },
    sections: [
      {
        title: '展板主文案',
        body: '太空垃圾治理并非完全没有法律，而是现有法律停留在责任原则和自愿减缓层面，缺少统一、强制、可执行的全球清理机制。',
      },
      {
        title: '短句与问题',
        items: [
          '有规则，但没有真正能清理轨道的全球法律。',
          'Responsibility without Removal / 有责任框架，缺清理机制。',
          '当卫星退役、火箭残骸漂浮、碎片互相碰撞时，法律能确认责任，却不一定能及时清理风险。',
        ],
      },
      {
        title: '模型说明',
        body: '倾斜的法槌象征失衡的外空治理：法律已经落下阴影，却尚未形成足以约束所有轨道行为的力量。',
      },
    ],
    sources: [],
  },
]

function FileCard({ file, active, visible, reduceMotion, onOpen, buttonRef }) {
  const drift = file.position.drift
  const floating = visible && !active && !reduceMotion

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      layoutId={`legal-file-${file.id}`}
      className="law-file-card"
      style={{
        '--file-left': file.position.left,
        '--file-top': file.position.top,
        '--file-rotate': `${file.position.rotate}deg`,
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 20, rotate: file.position.rotate }}
      animate={active
        ? { opacity: 0.14, y: 150, rotate: 0, scale: 0.86 }
        : floating
          ? { opacity: 1, y: [-drift, drift, -drift], rotate: [file.position.rotate - 1, file.position.rotate + 1, file.position.rotate - 1], scale: 1 }
          : { opacity: 1, y: 0, rotate: file.position.rotate, scale: 1 }}
      transition={floating
        ? { y: { duration: file.position.duration, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: file.position.duration * 1.12, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.45, ease: EASE } }
        : { duration: 0.34, ease: MOVE_EASE }}
      whileHover={!active && !reduceMotion ? { scale: 1.018, y: -6 } : undefined}
      whileTap={!active ? { scale: 0.98 } : undefined}
      onClick={() => onOpen(file)}
      aria-label={`打开档案：${file.marker}，${file.title}`}
    >
      <span className="law-file-card-index">{file.index}</span>
      <span className="law-file-card-code">{file.code}</span>
      <strong>{file.marker}</strong>
      <p>{file.title}</p>
      <span className="law-file-card-action">OPEN FILE <b aria-hidden="true">↗</b></span>
    </motion.button>
  )
}

function DetailFile({ file, reduceMotion, onClose, onComplete, closeRef }) {
  return (
    <motion.article
      layoutId={`legal-file-${file.id}`}
      className="law-detail-file"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`legal-title-${file.id}`}
      transition={{ layout: { duration: reduceMotion ? 0.01 : 0.46, ease: MOVE_EASE } }}
    >
      <header className="law-detail-header">
        <div>
          <span>ARCHIVE {file.index} / {file.code}</span>
          <strong>{file.marker}</strong>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭详情">关闭 <i aria-hidden="true">×</i></button>
      </header>

      <div className="law-detail-layout">
        <div className="law-detail-lead">
          <span className="law-detail-number" aria-hidden="true">{file.index}</span>
          <p>{file.marker}</p>
          <h2 id={`legal-title-${file.id}`}>{file.title}</h2>
          <blockquote>{file.summary}</blockquote>
        </div>

        <div className="law-detail-content">
          {file.sections.map((section, index) => (
            <section key={section.title} className="law-detail-section">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{section.title}</h3>
                {section.body && <p>{section.body}</p>}
                {section.items && (
                  <ul>
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}

          {file.sources.length > 0 && (
            <div className="law-detail-sources">
              <span>OFFICIAL SOURCES</span>
              {file.sources.map(([label, href]) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="law-detail-footer">
        <p>材料整理日期：2026.07.05 · 本页用于设计研究与展示，不构成正式法律意见。</p>
        <button type="button" onClick={onComplete}>完成法律审阅 <span aria-hidden="true">→</span></button>
      </footer>
    </motion.article>
  )
}

export default function LegalTreaties({ onComplete = () => {} }) {
  const rootRef = useRef(null)
  const closeRef = useRef(null)
  const cardRefs = useRef(new Map())
  const reduceMotion = useReducedMotion()
  const { satellite, setStoryChapter } = useAppStore()
  const [activeFile, setActiveFile] = useState(null)
  const [visible, setVisible] = useState(false)
  const [viewed, setViewed] = useState(() => new Set())

  useEffect(() => {
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.08 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!activeFile) return undefined
    closeRef.current?.focus()
    const activeId = activeFile.id
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setActiveFile(null)
      window.setTimeout(() => cardRefs.current.get(activeId)?.focus(), reduceMotion ? 0 : 300)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeFile, reduceMotion])

  function openFile(file) {
    setViewed((current) => new Set(current).add(file.id))
    setActiveFile(file)
  }

  function closeFile() {
    const previousId = activeFile?.id
    setActiveFile(null)
    window.setTimeout(() => cardRefs.current.get(previousId)?.focus(), reduceMotion ? 0 : 300)
  }

  function handleComplete() {
    const satelliteName = satellite?.name || '这颗卫星'
    setStoryChapter('law', `${satelliteName}的任务已经结束，但它留下的归属、责任与清理权限仍在轨道上。`)
    onComplete()
  }

  return (
    <section ref={rootRef} className="law-section" data-module-scroll-target>
      <div className="law-archive-canvas" inert={activeFile ? true : undefined} aria-hidden={activeFile ? 'true' : undefined}>
        <header className="law-archive-header">
          <div>
            <span>05 · ORBITAL LAW ARCHIVE</span>
            <strong>太空垃圾法律档案</strong>
          </div>
          <div className="law-archive-counter">
            <span>已阅</span>
            <strong>{String(viewed.size).padStart(2, '0')} / {String(LEGAL_FILES.length).padStart(2, '0')}</strong>
          </div>
        </header>

        <div className="law-archive-intro">
          <p>RESPONSIBILITY WITHOUT REMOVAL</p>
          <h1>有规则，<em>但没有闭合的清理机制。</em></h1>
          <span>点击漂浮档案，查看条约、准则、国家监管与尚未解决的治理缺口。</span>
        </div>

        <div className="law-file-field" aria-label="六份太空垃圾法律档案">
          {LEGAL_FILES.map((file) => (
            activeFile?.id === file.id ? null : (
              <FileCard
                key={file.id}
                file={file}
                active={Boolean(activeFile)}
                visible={visible}
                reduceMotion={reduceMotion}
                onOpen={openFile}
                buttonRef={(node) => {
                  if (node) cardRefs.current.set(file.id, node)
                  else cardRefs.current.delete(file.id)
                }}
              />
            )
          ))}
        </div>

        <div className="law-archive-guide" aria-hidden="true">
          <span />
          SELECT A FILE · 点击任意档案展开
        </div>

        <button className="law-archive-complete" type="button" onClick={handleComplete}>
          <span>完成本章</span>
          返回地球 <i aria-hidden="true">→</i>
        </button>
      </div>

      <AnimatePresence>
        {activeFile && (
          <motion.div
            className="law-detail-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: EASE }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeFile()
            }}
          >
            <DetailFile
              file={activeFile}
              reduceMotion={reduceMotion}
              onClose={closeFile}
              onComplete={handleComplete}
              closeRef={closeRef}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
