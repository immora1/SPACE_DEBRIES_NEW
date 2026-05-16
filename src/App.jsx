import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from './store/useAppStore'
import ProgressBar from './components/ProgressBar'
import ModuleWrapper from './components/ModuleWrapper'

const Entrance = lazy(() => import('./modules/Entrance'))
const M1 = lazy(() => import('./modules/M1'))
const M2 = lazy(() => import('./modules/M2'))
const M3 = lazy(() => import('./modules/M3'))
const M4 = lazy(() => import('./modules/M4'))
const M5 = lazy(() => import('./modules/M5'))
const M6 = lazy(() => import('./modules/M6'))
const M7 = lazy(() => import('./modules/M7'))
const M8 = lazy(() => import('./modules/M8'))

const EASE = [0.16, 1, 0.3, 1]

function ModuleLoader() {
  return <div style={{ height: 120 }} />
}

// ── 可选模块卡（M8）───────────────────────────────────────────────────────────
function OptionalModuleCard({ Component, isVisible }) {
  const [expanded, setExpanded] = useState(false)

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      style={{ margin: '0 auto', maxWidth: 1080, padding: '0 24px 80px' }}
    >
      {/* 渐变分割线 */}
      <div style={{
        height: 1,
        background: 'linear-gradient(to right, transparent, rgba(107,127,255,0.25), transparent)',
        marginBottom: 40,
      }} />

      {!expanded ? (
        /* 折叠态：小卡片 */
        <motion.div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: '24px 28px',
            background: 'rgba(8,8,26,0.72)',
            border: '1px solid #1a1a35',
            borderRadius: 6,
            backdropFilter: 'blur(14px)',
            cursor: 'pointer',
          }}
          whileHover={{
            borderColor: 'rgba(107,127,255,0.38)',
            boxShadow: '0 0 32px rgba(107,127,255,0.08)',
          }}
          onClick={() => setExpanded(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* 图标 */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              border: '1px solid rgba(107,127,255,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(107,127,255,0.08)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(107,127,255,0.8)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2" strokeDasharray="3 3" />
                <path d="M12 7v2M12 15v2M7 12H5M19 12h-2" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#484878', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>
                BONUS MODULE · 08 · OPTIONAL
              </div>
              <div style={{ fontFamily: 'Noto Serif SC, serif', fontSize: 17, color: '#e8e8f8', fontWeight: 300, marginBottom: 3 }}>
                观测教学与社区
              </div>
              <div style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: 12, color: '#484878', lineHeight: 1.6 }}>
                学会区分太空垃圾再入、流星与卫星，并提交你的目击报告。
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#484878', letterSpacing: '0.08em' }}>
              选读
            </span>
            <motion.div
              style={{
                padding: '9px 20px',
                border: '1px solid rgba(107,127,255,0.40)',
                borderRadius: 4,
                fontFamily: 'Space Mono, monospace',
                fontSize: 10,
                color: '#6b7fff',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
              whileHover={{ background: 'rgba(107,127,255,0.10)' }}
            >
              进入探索 →
            </motion.div>
          </div>
        </motion.div>
      ) : (
        /* 展开态：完整模块 */
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 0', marginBottom: 4,
          }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#484878', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              MODULE 08 · OBSERVATION & COMMUNITY
            </div>
            <motion.button
              onClick={() => setExpanded(false)}
              whileHover={{ color: '#e8e8f8' }}
              style={{
                background: 'none', border: '1px solid #1a1a35', borderRadius: 3,
                color: '#484878', fontFamily: 'Space Mono, monospace', fontSize: 9,
                letterSpacing: '0.08em', padding: '6px 12px', cursor: 'pointer',
              }}
            >
              收起 ↑
            </motion.button>
          </div>
          <Suspense fallback={<ModuleLoader />}>
            <Component onComplete={() => {}} />
          </Suspense>
        </div>
      )}
    </motion.div>
  )
}

// ── 模块顺序 + 衔接句 ───────────────────────────────────────────────────────
const MODULES = [
  { id: 'entrance', Component: Entrance, connector: null },
  { id: 'm1',       Component: M1,       connector: null },
  { id: 'm2',       Component: M2,       connector: '旅行总有终点，那些留下来的，我们总是忘了还有机会。' },
  { id: 'm3',       Component: M3,       connector: '不是没有人做过这个决定，是做了这个决定的人，已经不在了。' },
  { id: 'm4',       Component: M4,       connector: null },
  { id: 'm5',       Component: M5,       connector: '旅行结束了，那些留下来的，我们总是忘了还有机会处理。' },
  { id: 'm6',       Component: M6,       connector: '不要问还有没有人在乎，问你自己。' },
  { id: 'm7',       Component: M7,       connector: '最后，把这些碎片重新放回真实世界的信息里。' },
]

export default function App() {
  const {
    unlockedModules, unlockModule,
    markModuleComplete, completedModules,
    scrollLocked,
  } = useAppStore()

  const moduleRefs = useRef({})

  // Always start at top on mount
  useEffect(() => { window.scrollTo(0, 0) }, [])

  // M7 完成后显示 M8 可选卡片
  const showM8 = completedModules.includes('m7')

  useEffect(() => {
    document.body.style.overflow = scrollLocked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [scrollLocked])

  // 兼容新增模块：静默补解锁，不触发滚动
  useEffect(() => {
    MODULES.forEach((module, idx) => {
      const next = MODULES[idx + 1]
      if (next && completedModules.includes(module.id) && !unlockedModules.includes(next.id)) {
        unlockModule(next.id)
      }
    })
  }, [completedModules, unlockedModules, unlockModule])

  // 滚动逻辑只在用户主动完成模块时触发，避免刷新时 persist 加载触发误滚
  function handleComplete(currentId) {
    markModuleComplete(currentId)
    const idx = MODULES.findIndex((m) => m.id === currentId)
    if (idx !== -1 && idx < MODULES.length - 1) {
      const nextId = MODULES[idx + 1].id
      unlockModule(nextId)
      setTimeout(() => {
        moduleRefs.current[nextId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <ProgressBar completed={completedModules.length} total={MODULES.length} />

      {MODULES.map(({ id, Component, connector }) => (
        <Suspense key={id} fallback={<ModuleLoader />}>
          <ModuleWrapper
            isUnlocked={unlockedModules.includes(id)}
            connector={connector}
            noAnimation={id === 'm1'}
            ref={(el) => { moduleRefs.current[id] = el }}
          >
            <Component onComplete={() => handleComplete(id)} />
          </ModuleWrapper>
        </Suspense>
      ))}

      {/* ── M8：可选附加模块 ── */}
      <OptionalModuleCard Component={M8} isVisible={showM8} />
    </div>
  )
}
