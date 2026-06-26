import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import './index.css'

const MotionArticle = motion.article
const MotionSection = motion.section
const EASE = [0.16, 1, 0.3, 1]

const TREATIES = [
  {
    id: 'outer-space',
    year: '1967',
    title: '外层空间条约',
    label: '管辖与所有权',
    body: '登记国对其空间物体保留管辖和控制。卫星失效、漂移或重返地球，并不会自动变成任何人都可以处置的无主物。',
    takeaway: '清理他国碎片之前，首先需要取得所有权国或登记国的授权。',
    source: 'UNOOSA / Outer Space Treaty',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/outerspacetreaty.html',
  },
  {
    id: 'liability',
    year: '1972',
    title: '空间物体责任公约',
    label: '损害与赔偿',
    body: '空间物体在地面或飞行中的航空器上造成损害时，发射国承担绝对责任；发生在外层空间的损害，则通常需要讨论过错。',
    takeaway: '主动清理任务如果产生碰撞或坠落风险，责任安排必须在任务开始前写清楚。',
    source: 'UNOOSA / Liability Convention',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/liability-convention.html',
  },
  {
    id: 'registration',
    year: '1975',
    title: '登记公约',
    label: '识别与追踪',
    body: '发射国应维护国家登记册，并向联合国提供空间物体的基本识别信息、发射资料、轨道参数和一般功能。',
    takeaway: '如果一块碎片无法被识别，就很难确认由谁授权、由谁承担风险。',
    source: 'UNOOSA / Registration Convention',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/registration-convention.html',
  },
  {
    id: 'national-rules',
    year: '2019+',
    title: '国家减缓规则',
    label: '许可与退轨',
    body: '国际指南通常通过各国的发射许可、频率许可和任务审查落地，要求控制任务中产生的碎片、钝化剩余能量并规划任务后处置。',
    takeaway: '国际规则确定共同底线，国家监管把底线变成可以执行的许可条件。',
    source: 'UNOOSA / National Space Law',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/nationalspacelaw/index.html',
  },
]

const NATIONAL_RULES = [
  ['授权', '清理器接触不属于自己的空间物体前，需要解决所有权、登记与操作授权。'],
  ['钝化', '任务结束后安全处置燃料、电池和高压气体，降低在轨爆炸与二次碎裂风险。'],
  ['退轨', '监管机构可把任务后处置期限、成功概率和再入风险写入许可证条件。'],
]

function RecordRow({ label, value }) {
  return (
    <div className="law-record-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default function LegalTreaties({ onComplete = () => {} }) {
  const {
    user,
    satellite,
    gameResult,
    storyChapters,
    setStoryChapter,
  } = useAppStore()
  const [activeId, setActiveId] = useState(TREATIES[0].id)

  const activeTreaty = TREATIES.find((item) => item.id === activeId) || TREATIES[0]
  const result = typeof gameResult === 'string' ? gameResult : gameResult?.result
  const resultLabel = result === 'success'
    ? '受控处置完成'
    : result === 'failure'
      ? '残骸风险未解除'
      : '任务记录已封存'
  const satelliteName = satellite?.name || '你的卫星'
  const personalEvent = user?.importantEvent || '返回地球的最后痕迹'
  const storyEnding = storyChapters?.m4
    || `${satelliteName}结束了任务。它留下的不只是残骸，还有关于归属、责任和处置权限的问题。`

  function handleContinue() {
    setStoryChapter(
      'law',
      `${satelliteName}的个人任务记录在此结束。接下来，碎片的归属、登记、授权和责任将由国家法律与国际条约继续回答。`,
    )
    onComplete()
  }

  return (
    <section className="law-section" data-module-scroll-target>
      <div className="law-route-line" aria-hidden="true" />
      <div className="law-ghost-index" aria-hidden="true">05</div>

      <header className="law-masthead">
        <div className="law-masthead-label">
          <span>POST-MISSION RECORD</span>
          <span>NATIONAL LAW / INTERNATIONAL TREATIES</span>
        </div>
        <div className="law-masthead-number">05</div>
      </header>

      <div className="law-layout">
        <MotionArticle
          className="law-story"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.78, ease: EASE }}
        >
          <div className="law-eyebrow">个人故事 / 最终记录</div>
          <h2>故事结束，<br />责任没有。</h2>
          <p className="law-story-lead">
            你已经看完卫星从关机、钝化到再入解体的完整过程。技术可以改变碎片的轨迹，
            但谁有权移动它、事故由谁负责，必须交给规则回答。
          </p>

          <blockquote>{storyEnding}</blockquote>

          <dl className="law-record">
            <RecordRow label="OBJECT" value={satelliteName} />
            <RecordRow label="OUTCOME" value={resultLabel} />
            <RecordRow label="LAST TRACE" value={personalEvent} />
          </dl>

          <div className="law-story-footnote">
            个人叙事到此封存。右侧内容从一颗卫星，转向所有国家共同面对的轨道责任。
          </div>
        </MotionArticle>

        <div className="law-axis" aria-hidden="true">
          <span />
        </div>

        <MotionSection
          className="law-knowledge"
          initial={{ opacity: 0, y: 44 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.82, delay: 0.08, ease: EASE }}
        >
          <div className="law-knowledge-intro">
            <div>
              <div className="law-eyebrow">规则框架 / 四份档案</div>
              <h3>谁拥有碎片，<br />谁承担责任。</h3>
            </div>
            <p>
              国际条约规定所有权、登记和赔偿的基本关系；国家监管再把这些原则写入许可、
              退轨期限和任务后处置要求。
            </p>
          </div>

          <div className="law-treaty-tabs" role="tablist" aria-label="法律与国际条约">
            {TREATIES.map((item, index) => {
              const isActive = item.id === activeId
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? 'is-active' : ''}
                  onClick={() => setActiveId(item.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')} / {item.year}</span>
                  <strong>{item.title}</strong>
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            <MotionArticle
              key={activeTreaty.id}
              className="law-document"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.38, ease: EASE }}
            >
              <div className="law-document-meta">
                <span>{activeTreaty.year}</span>
                <span>{activeTreaty.label}</span>
              </div>
              <h4>{activeTreaty.title}</h4>
              <p>{activeTreaty.body}</p>
              <div className="law-document-takeaway">{activeTreaty.takeaway}</div>
              <a href={activeTreaty.href} target="_blank" rel="noopener noreferrer">
                {activeTreaty.source} ↗
              </a>
            </MotionArticle>
          </AnimatePresence>

          <div className="law-principles" aria-label="国家规则如何落地">
            <div className="law-principles-heading">
              <span>国家规则如何落地</span>
              <strong>03</strong>
            </div>
            {NATIONAL_RULES.map(([label, description], index) => (
              <div className="law-principle" key={label}>
                <span>{String(index + 1).padStart(2, '0')} / {label}</span>
                <p>{description}</p>
              </div>
            ))}
          </div>

          <footer className="law-footer">
            <div>
              <span>ARCHIVE COMPLETE</span>
              <p>法律不能替代清理技术，但它决定清理行动能否被授权、识别和追责。</p>
            </div>
            <button type="button" onClick={handleContinue}>继续：返回地球 →</button>
          </footer>
        </MotionSection>
      </div>
    </section>
  )
}
