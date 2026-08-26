import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import useI18n from '../../i18n/useI18n'
import {
  LEGAL_DOSSIERS,
  LEGAL_SECTIONS,
  LEGAL_SOURCE_INDEX,
  LEGAL_SUMMARY,
} from './legalDossiers.js'
import './index.css'

const EASE = [0.16, 1, 0.3, 1]
const ROW_GAP = 18
const STACK_BASE = 80
const STACK_STEP = 5
const ACTIVE_PULL_BACK_Y = -48
const ACTIVE_PULL_FRONT_Y = -520
const DRAG_START_THRESHOLD = 4
const DRAG_OPEN_THRESHOLD = -42
const DRAG_OPEN_VELOCITY = -360
const RESET_AFTER_RETURN_MS = 1700
const FOLDER_TWEEN_TRANSITION = { duration: 0.58, ease: EASE }
const FOLDER_OPEN_TRANSITION = {
  ...FOLDER_TWEEN_TRANSITION,
  y: { duration: 0 },
}
const FOLDER_RETURN_TRANSITION = { duration: 0.64, ease: EASE }
const FOLDER_RETURN_SETTLE_TRANSITION = { duration: 0 }

const TAB_LAYOUTS = [
  { x: 3, width: 28 },
  { x: 37, width: 30 },
  { x: 66, width: 28 },
  { x: 12, width: 28 },
  { x: 45, width: 28 },
  { x: 70, width: 25 },
]

function buildRoundedTabPath(topInsetPercent, bottomInsetPercent) {
  const bottomInset = Math.min(14, Math.max(1.5, bottomInsetPercent))
  const topInset = Math.min(28, Math.max(bottomInset + 7, topInsetPercent))
  const radius = Math.min(5.8, Math.max(3.8, (topInset - bottomInset) * 0.5))
  const slantOffset = Math.max(1.2, radius * 0.45)

  return [
    `M ${topInset + radius} 0`,
    `L ${100 - topInset - radius} 0`,
    `Q ${100 - topInset} 0 ${100 - topInset + slantOffset} ${radius}`,
    `L ${100 - bottomInset} 42`,
    `L ${100 - bottomInset} 46`,
    `L ${bottomInset} 46`,
    `L ${bottomInset} 42`,
    `L ${topInset - slantOffset} ${radius}`,
    `Q ${topInset} 0 ${topInset + radius} 0`,
    'Z',
  ].join(' ')
}

function buildRoundedTabOutlinePath(topInsetPercent, bottomInsetPercent) {
  const bottomInset = Math.min(14, Math.max(1.5, bottomInsetPercent))
  const topInset = Math.min(28, Math.max(bottomInset + 7, topInsetPercent))
  const radius = Math.min(5.8, Math.max(3.8, (topInset - bottomInset) * 0.5))
  const slantOffset = Math.max(1.2, radius * 0.45)

  return [
    `M ${bottomInset} 42`,
    `L ${topInset - slantOffset} ${radius}`,
    `Q ${topInset} 0 ${topInset + radius} 0`,
    `L ${100 - topInset - radius} 0`,
    `Q ${100 - topInset} 0 ${100 - topInset + slantOffset} ${radius}`,
    `L ${100 - bottomInset} 42`,
  ].join(' ')
}

function estimateTabWidth(title) {
  const titleWidth = Array.from(title).reduce((total, char) => {
    if (/[a-z0-9]/i.test(char)) return total + 7.2
    if (char === ' ' || char === '·' || char === ':' || char === '：') return total + 5.6
    return total + 13.4
  }, 0)

  return Math.ceil(titleWidth + 134)
}

function buildLegalDocuments() {
  return LEGAL_SECTIONS.flatMap((section) => {
    const divider = {
      kind: 'divider',
      id: section.id,
      sectionId: section.id,
      titleZh: section.titleZh,
      titleEn: section.titleEn,
      summaryZh: section.summaryZh,
      summaryEn: section.summaryEn,
      tabTitleZh: section.titleZh,
      tabTitleEn: section.titleEn,
      kicker: `SECTION ${section.number}`,
    }

    if (section.id === 'conclusion') {
      return [divider, {
        ...LEGAL_SUMMARY,
        sectionId: section.id,
        detailKind: 'summary',
        displayLabelZh: LEGAL_SUMMARY.tabTitleZh,
        displayLabelEn: LEGAL_SUMMARY.tabTitleEn,
      }]
    }

    if (section.id === 'sources') {
      return [divider, {
        id: 'source-index',
        section: 'sources',
        sectionId: section.id,
        year: 'SOURCE INDEX',
        detailKind: 'sources',
        displayLabelZh: '官方来源',
        displayLabelEn: 'OFFICIAL SOURCES',
        typeLabelZh: '官方来源索引',
        typeLabelEn: 'OFFICIAL SOURCE INDEX',
        titleZh: '官方文件与资料来源',
        titleEn: 'Official Files and Sources',
        tabTitleZh: '官方来源',
        tabTitleEn: 'Official Sources',
        sourceIndex: LEGAL_SOURCE_INDEX,
      }]
    }

    return [
      divider,
      ...LEGAL_DOSSIERS
        .filter((dossier) => dossier.section === section.id)
        .map((dossier) => ({ ...dossier, detailKind: 'dossier' })),
    ]
  })
}

const LAW_DOCUMENTS = buildLegalDocuments()

function buildArchiveItems(documents) {
  let section = ''
  let sectionIndex = 0
  let rowIndex = 0
  const documentRows = documents.filter((document) => document.kind !== 'divider').length
  const dividerRows = documents.filter((document) => document.kind === 'divider').length
  const totalRows = documentRows + dividerRows

  function createArchiveItem(document, row, currentSection, currentSectionIndex) {
    const tab = TAB_LAYOUTS[row % TAB_LAYOUTS.length]
    const frontRatio = totalRows <= 1 ? 1 : row / (totalRows - 1)
    const rowY = row * ROW_GAP
    const pullY = ACTIVE_PULL_BACK_Y + (ACTIVE_PULL_FRONT_Y - ACTIVE_PULL_BACK_Y) * frontRatio

    const rowWidth = 700 + frontRatio * 210
    const rowInset = 1.8 + frontRatio * 10.2
    const tabDepthRatio = 1 - frontRatio
    const tabBottomInsetPercent = 2.2 + tabDepthRatio * 8.4
    const tabTopInsetPercent = tabBottomInsetPercent + 10.5 + tabDepthRatio * 2.2
    const titleForWidth = [document.tabTitleZh, document.tabTitleEn]
      .filter(Boolean)
      .sort((first, second) => estimateTabWidth(second) - estimateTabWidth(first))[0] ?? ''
    const tabLabelForWidth = document.kind === 'section-barrier'
      ? `${document.displayLabelZh ?? ''} ${titleForWidth}`.trim()
      : titleForWidth
    const minTabWidth = document.kind === 'section-barrier' ? 340 : 210
    const tabWidthPx = Math.min(rowWidth * 0.62, Math.max(minTabWidth, estimateTabWidth(tabLabelForWidth)))
    const tabWidthPercent = (tabWidthPx / rowWidth) * 100
    const tabInsetPx = tabWidthPx * (tabTopInsetPercent / 100)
    const tabBottomInsetPx = tabWidthPx * (tabBottomInsetPercent / 100)
    const tabX = Math.max(2, Math.min(tab.x, 98 - tabWidthPercent))

    return {
      ...document,
      sectionId: document.sectionId ?? document.section,
      section: currentSection,
      sectionIndex: currentSectionIndex,
      rowIndex: row,
      frontRatio,
      rowY,
      pullY,
      rowScale: 0.72 + frontRatio * 0.24,
      rowWidth,
      rowInset,
      tabInset: tabInsetPx,
      tabBottomInset: tabBottomInsetPx,
      tabPath: buildRoundedTabPath(tabTopInsetPercent, tabBottomInsetPercent),
      tabOutlinePath: buildRoundedTabOutlinePath(tabTopInsetPercent, tabBottomInsetPercent),
      tabX,
      tabWidth: tabWidthPx,
    }
  }

  return documents.flatMap((document) => {
    if (document.kind === 'divider') {
      sectionIndex += 1
      section = document.titleZh

      const barrier = createArchiveItem({
        ...document,
        id: `section-barrier-${document.id}`,
        kind: 'section-barrier',
        displayLabelZh: document.kicker ?? `SECTION ${String(sectionIndex).padStart(2, '0')}`,
        displayLabelEn: document.kicker ?? `SECTION ${String(sectionIndex).padStart(2, '0')}`,
        year: document.kicker ?? `SECTION ${String(sectionIndex).padStart(2, '0')}`,
      }, rowIndex, section, sectionIndex)

      rowIndex += 1
      return [barrier]
    }

    const item = createArchiveItem({
      ...document,
      displayLabelZh: document.displayLabelZh ?? document.number,
      displayLabelEn: document.displayLabelEn ?? document.number,
    }, rowIndex, section, sectionIndex)
    rowIndex += 1
    return [item]
  })
}

const ARCHIVE_ITEMS = buildArchiveItems(LAW_DOCUMENTS)
const LAW_FLOW_LINES = [
  {
    id: 'upper-ledger-01',
    layerIndex: 1,
    fontSize: 16,
    duration: 42,
    offset: 0,
    opacity: 0.42,
    d: 'M -240 54 C 52 -30 284 142 540 62 C 802 -20 946 148 1170 66 C 1398 -18 1560 154 1818 64 C 2000 -2 2138 76 2250 46',
  },
  {
    id: 'upper-ledger-02',
    layerIndex: 4,
    fontSize: 17,
    duration: 45,
    offset: -140,
    opacity: 0.4,
    d: 'M -230 234 C 64 344 286 122 552 230 C 802 330 940 128 1174 224 C 1416 328 1568 122 1810 232 C 1994 318 2120 226 2240 260',
  },
  {
    id: 'standard-river-01',
    layerIndex: 8,
    fontSize: 18,
    duration: 44,
    offset: -280,
    opacity: 0.36,
    d: 'M -230 430 C 58 336 292 552 560 440 C 804 336 952 554 1190 434 C 1422 324 1584 550 1826 426 C 2008 342 2130 438 2248 408',
  },
  {
    id: 'standard-river-02',
    layerIndex: 12,
    fontSize: 18,
    duration: 47,
    offset: -430,
    opacity: 0.3,
    d: 'M -240 670 C 40 784 304 542 584 662 C 828 768 992 544 1220 654 C 1454 766 1608 544 1848 652 C 2026 730 2140 662 2250 694',
  },
  {
    id: 'liability-thread',
    layerIndex: 16,
    fontSize: 18,
    duration: 49,
    offset: -620,
    opacity: 0.23,
    d: 'M -250 950 C 48 830 304 1078 590 946 C 838 834 996 1072 1222 940 C 1458 806 1616 1066 1858 928 C 2040 824 2142 956 2260 908',
  },
  {
    id: 'source-stream',
    layerIndex: 22,
    fontSize: 17,
    duration: 52,
    offset: -820,
    opacity: 0.16,
    d: 'M -250 1270 C 58 1386 318 1116 602 1254 C 858 1378 1004 1118 1242 1240 C 1482 1366 1628 1118 1870 1232 C 2056 1320 2160 1216 2266 1268',
  },
  {
    id: 'fade-out-stream',
    layerIndex: 28,
    fontSize: 16,
    duration: 56,
    offset: -1040,
    opacity: 0.08,
    d: 'M -260 1620 C 56 1482 318 1768 616 1608 C 862 1476 1022 1750 1254 1596 C 1496 1444 1644 1742 1888 1578 C 2074 1466 2180 1610 2270 1544',
  },
  {
    id: 'rear-fade-01',
    layerIndex: 34,
    fontSize: 16,
    duration: 60,
    offset: -1260,
    opacity: 0.42,
    d: 'M -270 815 C 42 956 330 656 630 804 C 890 934 1030 644 1280 786 C 1518 922 1674 646 1910 780 C 2094 882 2196 774 2280 824',
  },
  {
    id: 'rear-fade-02',
    layerIndex: 40,
    fontSize: 15,
    duration: 64,
    offset: -1480,
    opacity: 0.34,
    d: 'M -280 1110 C 42 966 336 1276 646 1098 C 910 948 1064 1254 1310 1084 C 1550 918 1710 1248 1946 1070 C 2128 938 2226 1112 2290 1036',
  },
  {
    id: 'rear-fade-03',
    layerIndex: 46,
    fontSize: 15,
    duration: 68,
    offset: -1700,
    opacity: 0.26,
    d: 'M -290 1425 C 28 1581 350 1237 670 1409 C 944 1559 1088 1229 1340 1391 C 1586 1551 1734 1235 1982 1373 C 2162 1475 2248 1363 2300 1421',
  },
  {
    id: 'rear-fade-04',
    layerIndex: 52,
    fontSize: 15,
    duration: 72,
    offset: -1920,
    opacity: 0.22,
    d: 'M -300 1735 C 16 1584 352 1902 686 1714 C 960 1556 1118 1870 1378 1690 C 1634 1512 1788 1844 2026 1686 C 2192 1574 2276 1718 2320 1646',
  },
]

function localizeLegalDocument(document, language) {
  const english = language === 'en'
  const section = LEGAL_SECTIONS.find((item) => item.id === (document.sectionId ?? document.section))
  const localizeLinks = (links = []) => links.map((link) => ({
    ...link,
    label: english ? link.labelEn : link.labelZh,
  }))
  const localizeSourceIndex = (entries = []) => entries.map((entry) => ({
    ...entry,
    title: english ? entry.titleEn : entry.titleZh,
    description: english ? entry.descriptionEn : entry.descriptionZh,
    links: localizeLinks(entry.links),
  }))

  return {
    ...document,
    title: english ? document.titleEn : document.titleZh,
    tabTitle: english ? document.tabTitleEn : document.tabTitleZh,
    displayLabel: english ? document.displayLabelEn : document.displayLabelZh,
    section: section ? (english ? section.titleEn : section.titleZh) : document.section,
    sectionSummary: section ? (english ? section.summaryEn : section.summaryZh) : '',
    typeLabel: english ? document.typeLabelEn : document.typeLabelZh,
    body: english ? document.bodyEn : document.bodyZh,
    highlight: english ? document.highlightEn : document.highlightZh,
    sourceLinks: localizeLinks(document.sourceLinks),
    establishedTitle: english ? document.establishedTitleEn : document.establishedTitleZh,
    established: english ? document.establishedEn : document.establishedZh,
    unresolvedTitle: english ? document.unresolvedTitleEn : document.unresolvedTitleZh,
    closing: english ? document.closingEn : document.closingZh,
    sourceIndex: localizeSourceIndex(document.sourceIndex),
  }
}

function OfficialSourceLinks({ links, language }) {
  if (!links?.length) return null

  return (
    <div className="law-folder-sources">
      {links.map((link) => (
        <a
          key={`${link.url}-${link.label}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{link.label || (language === 'en' ? 'OFFICIAL SOURCE' : '查看官方来源')}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  )
}

function DossierDetail({ document, language }) {
  return (
    <>
      <div className="law-folder-detail-meta">
        <span>{document.typeLabel}</span>
        <span>{document.year} · {document.section}</span>
      </div>
      <h2>{document.title}</h2>
      <div className="law-folder-copy">
        {document.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <p className="law-folder-highlight">{document.highlight}</p>
      <OfficialSourceLinks links={document.sourceLinks} language={language} />
    </>
  )
}

function SummaryDetail({ document }) {
  return (
    <>
      <div className="law-folder-detail-meta">
        <span>{document.displayLabel}</span>
        <span>{document.section}</span>
      </div>
      <h2>{document.title}</h2>
      <div className="law-summary-frameworks">
        <h3>{document.establishedTitle}</h3>
        <div className="law-summary-framework-grid">
          {document.established?.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="law-summary-unresolved">
        <h3>{document.unresolvedTitle}</h3>
        <p className="law-summary-highlight">{document.highlight}</p>
        <p className="law-summary-closing">{document.closing}</p>
      </div>
    </>
  )
}

function SourceIndexDetail({ document, language }) {
  return (
    <>
      <div className="law-folder-detail-meta">
        <span>{document.typeLabel}</span>
        <span>{document.section}</span>
      </div>
      <h2>{document.title}</h2>
      <div className="law-source-index">
        {document.sourceIndex?.map((entry) => (
          <div className="law-source-index-item" key={entry.id}>
            <span>{entry.number}</span>
            <div>
              <strong>{entry.title}</strong>
              <p>{entry.description}</p>
              <OfficialSourceLinks links={entry.links} language={language} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

const stackVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      staggerDirection: -1,
    },
  },
}

const folderVariants = {
  hidden: (offset) => ({ opacity: 0, x: offset, y: 18 }),
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.72, ease: EASE },
  },
}

export default function LegalTreaties({ onComplete = () => {} }) {
  const { language, pick } = useI18n()
  const { satellite, gameResult, setStoryChapter } = useAppStore()
  const [activeIndex, setActiveIndex] = useState(null)
  const [activeDragY, setActiveDragY] = useState(null)
  const [closingIndex, setClosingIndex] = useState(null)
  const [returningFolder, setReturningFolder] = useState({
    index: null,
    y: 0,
    phase: 'idle',
    scale: null,
  })
  const [resetState, setResetState] = useState({ index: null, version: 0 })
  const [isDraggingFolder, setIsDraggingFolder] = useState(false)
  const draggingRef = useRef(false)
  const dragSessionRef = useRef(null)
  const completedRef = useRef(false)
  const resetTimerRef = useRef(null)
  const resetPendingIndexRef = useRef(null)
  const returnFrameRef = useRef(null)
  const returnDelayTimerRef = useRef(null)
  const closeActiveFolderRef = useRef(null)

  const satelliteName = satellite?.name || pick('这颗卫星', 'This satellite')
  const result = typeof gameResult === 'string' ? gameResult : gameResult?.result
  const resultLabel = result === 'success'
    ? pick('受控处置完成', 'controlled disposal completed')
    : result === 'failure'
      ? pick('残骸风险未解除', 'debris risk remains unresolved')
      : pick('任务记录已封存', 'mission record archived')
  const isFolderOpen = activeIndex !== null
  const isFlowPaused = isFolderOpen || isDraggingFolder
  const localizedDocuments = ARCHIVE_ITEMS.map((document) => localizeLegalDocument(document, language))
  const localizedFlowText = localizedDocuments
    .filter((item) => item.kind !== 'section-barrier')
    .map((item) => item.title)
    .join('  ·  ')
  const localizedFlowMarquee = `${localizedFlowText}  ·  ${localizedFlowText}  ·  `

  useEffect(() => () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    if (returnDelayTimerRef.current) window.clearTimeout(returnDelayTimerRef.current)
    if (returnFrameRef.current) window.cancelAnimationFrame(returnFrameRef.current)
    dragSessionRef.current?.cleanup?.()
  }, [])

  useEffect(() => {
    if (completedRef.current) return
    completedRef.current = true

    setStoryChapter(
      'm5',
      pick(
        `${satelliteName}的任务记录进入法律档案：${resultLabel}。现有制度能确认责任、登记和许可，却还没有形成统一、强制、可执行的全球清理机制。`,
        `${satelliteName}'s mission record enters the legal archive: ${resultLabel}. Existing systems address responsibility, registration, and licensing, but no unified and enforceable global cleanup mechanism exists.`,
      ),
    )
    onComplete({ autoScroll: false })
  }, [onComplete, pick, resultLabel, satelliteName, setStoryChapter])

  function finishPendingReset(index) {
    if (resetPendingIndexRef.current !== index) return

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }

    if (returnFrameRef.current) {
      window.cancelAnimationFrame(returnFrameRef.current)
      returnFrameRef.current = null
    }

    if (returnDelayTimerRef.current) {
      window.clearTimeout(returnDelayTimerRef.current)
      returnDelayTimerRef.current = null
    }

    resetPendingIndexRef.current = null
    setReturningFolder((current) => (
      current.index === index ? { index: null, y: 0, phase: 'idle', scale: null } : current
    ))
    setClosingIndex((current) => (current === index ? null : current))
    setResetState((current) => ({
      index,
      version: current.index === index ? current.version + 1 : 1,
    }))
  }

  function flushPendingReset() {
    const resetIndex = resetPendingIndexRef.current
    if (resetIndex === null) return

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }

    if (returnFrameRef.current) {
      window.cancelAnimationFrame(returnFrameRef.current)
      returnFrameRef.current = null
    }

    if (returnDelayTimerRef.current) {
      window.clearTimeout(returnDelayTimerRef.current)
      returnDelayTimerRef.current = null
    }

    resetPendingIndexRef.current = null
    setClosingIndex(null)
    setReturningFolder({ index: null, y: 0, phase: 'idle', scale: null })
  }

  function beginFolderReturn(folderIndex, returnY, returnScale) {
    if (resetPendingIndexRef.current === folderIndex) return

    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    if (returnFrameRef.current) window.cancelAnimationFrame(returnFrameRef.current)
    if (returnDelayTimerRef.current) window.clearTimeout(returnDelayTimerRef.current)

    setClosingIndex(folderIndex)
    setReturningFolder({
      index: folderIndex,
      y: returnY,
      phase: 'settle',
      scale: returnScale,
    })
    setIsDraggingFolder(false)
    resetPendingIndexRef.current = folderIndex

    returnFrameRef.current = null
    returnDelayTimerRef.current = window.setTimeout(() => {
      returnDelayTimerRef.current = null
      setReturningFolder((current) => (
        current.index === folderIndex && current.phase === 'settle'
          ? { ...current, phase: 'return' }
          : current
      ))
    }, 80)

    resetTimerRef.current = window.setTimeout(() => {
      finishPendingReset(folderIndex)
    }, RESET_AFTER_RETURN_MS)
  }

  function closeActiveFolder(returnYOverride) {
    const folderIndex = activeIndex
    if (folderIndex === null) return

    const document = ARCHIVE_ITEMS[folderIndex]
    const returnY = returnYOverride ?? activeDragY ?? document?.pullY ?? 0

    beginFolderReturn(folderIndex, returnY, 1.02)
    setActiveIndex(null)
    setActiveDragY(null)
  }

  closeActiveFolderRef.current = closeActiveFolder

  useEffect(() => {
    function handleDocumentPointerDown(event) {
      if (draggingRef.current || activeIndex === null) return
      if (event.target instanceof Element && event.target.closest('.law-folder')) return

      closeActiveFolderRef.current?.()
    }

    window.addEventListener('pointerdown', handleDocumentPointerDown, true)
    return () => window.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  }, [activeIndex])

  function handleFolderPointerDown(event, index, document, canDrag) {
    if (!canDrag || event.button !== 0) return

    dragSessionRef.current?.cleanup?.()
    event.preventDefault()

    const session = {
      pointerId: event.pointerId,
      index,
      element: event.currentTarget,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      currentY: 0,
      velocityY: 0,
      hasMoved: false,
      minY: Math.min(-260, document.pullY - 18),
      maxY: 28,
      cleanup: null,
    }

    function applyDirectY(nextY) {
      session.element.classList.add('is-direct-dragging')
      session.element.style.translate = `-50% ${nextY}px`
    }

    function clearDirectY() {
      session.element.classList.remove('is-direct-dragging')
      session.element.style.removeProperty('translate')
    }

    function releaseDirectY() {
      session.element.classList.remove('is-direct-dragging')
      session.element.style.removeProperty('translate')
    }

    function clearDraggingFlag() {
      window.setTimeout(() => {
        draggingRef.current = false
        setIsDraggingFolder(false)
      }, 0)
    }

    function cleanup() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }

    function handlePointerMove(moveEvent) {
      if (moveEvent.pointerId !== session.pointerId) return

      const deltaY = moveEvent.clientY - session.startY
      if (!session.hasMoved && Math.abs(deltaY) < DRAG_START_THRESHOLD) return

      const elapsed = Math.max(1, moveEvent.timeStamp - session.lastTime)
      session.velocityY = ((moveEvent.clientY - session.lastY) / elapsed) * 1000
      session.lastY = moveEvent.clientY
      session.lastTime = moveEvent.timeStamp
      session.hasMoved = true
      if (!draggingRef.current) {
        draggingRef.current = true
        setIsDraggingFolder(true)
      }

      session.currentY = Math.max(session.minY, Math.min(session.maxY, deltaY))
      applyDirectY(session.currentY)
      moveEvent.preventDefault()
    }

    function handlePointerEnd(endEvent) {
      if (endEvent.pointerId !== session.pointerId) return

      cleanup()
      dragSessionRef.current = null

      const finalY = session.currentY
      const shouldOpen = finalY < DRAG_OPEN_THRESHOLD || session.velocityY < DRAG_OPEN_VELOCITY

      if (session.hasMoved && shouldOpen) {
        flushSync(() => {
          flushPendingReset()
          setActiveDragY(finalY)
          setActiveIndex(index)
        })
        releaseDirectY()
      } else if (session.hasMoved) {
        flushSync(() => {
          beginFolderReturn(index, finalY, document.rowScale)
        })
        releaseDirectY()
      } else {
        clearDirectY()
      }

      clearDraggingFlag()
    }

    function handlePointerCancel(cancelEvent) {
      if (cancelEvent.pointerId !== session.pointerId) return

      cleanup()
      dragSessionRef.current = null

      if (session.hasMoved) {
        flushSync(() => {
          beginFolderReturn(index, session.currentY, document.rowScale)
        })
        releaseDirectY()
      } else {
        clearDirectY()
      }

      clearDraggingFlag()
    }

    session.cleanup = cleanup
    dragSessionRef.current = session
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerCancel)
  }

  function handleCardClick(event, index) {
    event.stopPropagation()

    if (draggingRef.current) return
    if (activeIndex !== null && activeIndex !== index) closeActiveFolder()
  }

  function handlePageClick() {
    if (draggingRef.current) return
    if (activeIndex !== null) closeActiveFolder()
  }

  return (
    <section
      className={['law-section', isFolderOpen ? 'is-folder-open' : ''].filter(Boolean).join(' ')}
      data-module-scroll-target
      aria-label={pick('太空垃圾法律法规档案', 'Space-debris legal archive')}
      onClick={handlePageClick}
    >
      <div className="law-grid" aria-hidden="true" />

      <div className="law-stage">
        <motion.div
          className="law-stage-label"
          initial={{ opacity: 0, y: -12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.58, ease: EASE }}
        >
          <span>M5</span>
          <span>{pick('法律边界', 'LEGAL BOUNDARIES')}</span>
        </motion.div>

        <motion.div
          className="law-corner-copy law-corner-copy--title"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.58, delay: 0.12, ease: EASE }}
        >
          <span>{pick('M5 / 法律边界', 'M5 / LEGAL BOUNDARIES')}</span>
          <h2 aria-label={pick('太空垃圾责任与清理难题', 'Responsibility and the Challenge of Cleaning Up Space Debris')}>
            <span className="law-title-line">
              {pick('太空垃圾责任与清理难题', 'Responsibility and the Challenge of Cleaning Up Space Debris')}
            </span>
          </h2>
          <p>
            <span className="law-intro-paragraph">
              {pick(
                '国际空间法已经规定了国家对航天活动的责任，也建立了空间物体登记和损害赔偿制度。联合国、IADC、ISO、ESA 以及各国监管机构，还制定了大量规则来减少新的空间碎片产生。',
                'International space law already establishes state responsibility for space activities and provides frameworks for registering space objects and addressing damage. The UN, IADC, ISO, ESA, and national regulators have also developed extensive rules aimed at reducing the creation of new orbital debris.',
              )}
            </span>
            <span className="law-intro-paragraph">
              {pick('真正棘手的是已经留在轨道上的旧碎片：', 'The harder problem is the debris already left in orbit:')}
              {language === 'en' ? ' ' : ''}
              <strong className="law-intro-highlight">
                {pick(
                  '谁必须清理、谁有权处理别国登记的失效卫星，以及如何跨国执行，目前仍缺少统一机制。',
                  'there is still no unified mechanism that fully resolves who must remove it, who is authorized to act on a foreign registered defunct spacecraft, and how cleanup obligations could be enforced across borders.',
                )}
              </strong>
            </span>
          </p>
        </motion.div>

        <motion.div
          className={[
            'law-archive',
            activeIndex !== null ? 'has-active-folder' : '',
            isFlowPaused ? 'is-flow-paused' : '',
          ].filter(Boolean).join(' ')}
          variants={stackVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          aria-label={pick('太空垃圾相关国际法律文件', 'International legal records related to space debris')}
        >
          {/*
          <svg
            className="law-archive-box-plane law-archive-box-plane--left law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="84.5,-0.1 100,13 47,112 -38,101" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--right law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="16,0 0,13 53,112 138,101" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--rear law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="0,0 636,0 629,100 37,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--rear"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="0,0 640,0 629,100 37,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--left"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="84,0 100,13 47,112 -35,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--right"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="16.5,0 13,13 53,112 134,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--front law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="2.75,65 97,65 82,150 18,150" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--front-top"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="3,65 97,65 97,70.7 2.75,71" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--front"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="3,65 97,65 82,150 18,150" />
          </svg>
          */}
          <div className="law-flow-field" aria-hidden="true">
            {LAW_FLOW_LINES.map((line) => (
              <svg
                key={line.id}
                className="law-flow-layer"
                viewBox="0 0 2000 840"
                preserveAspectRatio="none"
                style={{
                  '--flow-opacity': line.opacity,
                  '--flow-font-size': `${line.fontSize}px`,
                }}
                aria-hidden="true"
                focusable="false"
              >
                <path id={`law-flow-path-${line.id}`} d={line.d} fill="none" />
                <text className="law-flow-text">
                  <textPath
                    href={`#law-flow-path-${line.id}`}
                    startOffset={line.offset}
                  >
                    {localizedFlowMarquee}
                  </textPath>
                </text>
              </svg>
            ))}
          </div>

          {localizedDocuments.map((document, index) => {
            const isBarrier = document.kind === 'section-barrier'
            const isActive = activeIndex === index
            const isReturning = closingIndex === index
            const isOpen = isActive && !isReturning
            const isReturnSettling = returningFolder.index === index && returningFolder.phase === 'settle'
            const isMuted = activeIndex !== null && !isActive
            const canDrag = !isBarrier && activeIndex === null && closingIndex !== index
            const baseStackOrder = STACK_BASE + index * STACK_STEP
            const folderY = isReturning
              ? (isReturnSettling ? returningFolder.y : 0)
              : isOpen
                ? (activeDragY ?? document.pullY)
                : 0
            const folderScale = isReturning
              ? (isReturnSettling ? (returningFolder.scale ?? document.rowScale) : document.rowScale)
              : isOpen
                ? 1.02
                : document.rowScale

            return (
              <motion.article
                className={[
                  'law-folder',
                  isBarrier ? 'is-section-barrier' : '',
                  document.detailKind === 'summary' ? 'is-summary' : '',
                  document.detailKind === 'sources' ? 'is-source-index' : '',
                  isOpen ? 'is-active' : '',
                  isReturning ? 'is-returning' : '',
                  isMuted ? 'is-muted' : '',
                ].filter(Boolean).join(' ')}
                key={`${document.id}-${resetState.index === index ? resetState.version : 0}`}
                variants={folderVariants}
                initial={false}
                custom={-index * 5}
                animate={{
                  x: 0,
                  y: 0,
                  scale: folderScale,
                }}
                transition={isReturning
                  ? (isReturnSettling ? FOLDER_RETURN_SETTLE_TRANSITION : FOLDER_RETURN_TRANSITION)
                  : isOpen
                    ? FOLDER_OPEN_TRANSITION
                    : FOLDER_TWEEN_TRANSITION}
                style={{
                  '--row-y': `${document.rowY}px`,
                  '--row-width': `${isOpen ? 940 : document.rowWidth}px`,
                  '--row-inset': `${document.rowInset}%`,
                  '--front-ratio': document.frontRatio,
                  '--tab-inset': `${document.tabInset}px`,
                  '--tab-bottom-inset': `${document.tabBottomInset}px`,
                  '--tab-x': `${document.tabX}%`,
                  '--tab-width': `${document.tabWidth}px`,
                  '--folder-offset-y': `${folderY}px`,
                  '--stack-order': isOpen ? 1200 : baseStackOrder,
                  '--line-alpha': isOpen ? 0.96 : Math.max(0.36, 0.84 - index * 0.014),
                }}
                tabIndex={isBarrier ? -1 : 0}
                aria-expanded={isBarrier ? undefined : isOpen}
                onPointerDown={isBarrier ? undefined : (event) => handleFolderPointerDown(event, index, document, canDrag)}
                onClick={isBarrier ? undefined : (event) => handleCardClick(event, index)}
                onKeyDown={(event) => {
                  if (isBarrier) return
                  if (event.key === 'Escape') {
                    closeActiveFolder()
                  }
                }}
              >
                <div className="law-folder-tab">
                  <svg
                    className="law-folder-tab-shape"
                    viewBox="0 0 100 42"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path className="law-folder-tab-fill" d={document.tabPath} />
                    <path className="law-folder-tab-outline" d={document.tabOutlinePath} />
                  </svg>
                  <span>{document.displayLabel ?? String(index + 1).padStart(2, '0')}</span>
                  <strong>{document.tabTitle ?? document.title}</strong>
                </div>

                <div className="law-folder-strip">
                  <span>{document.year}</span>
                  <span>{document.section}</span>
                </div>

                {document.id === 'source-index' && (
                  <div className="law-folder-file-mark" aria-hidden="true">File</div>
                )}

                {!isBarrier && (
                  <div className="law-folder-detail" aria-hidden={!isActive}>
                    {document.detailKind === 'summary' ? (
                      <SummaryDetail document={document} />
                    ) : document.detailKind === 'sources' ? (
                      <SourceIndexDetail document={document} language={language} />
                    ) : (
                      <DossierDetail document={document} language={language} />
                    )}
                  </div>
                )}
              </motion.article>
            )
          })}

        </motion.div>

      </div>
    </section>
  )
}
