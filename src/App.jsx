import { lazy, Suspense, useEffect, useRef } from 'react'
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

function ModuleLoader() {
  return <div style={{ height: 120, background: '#0a0a0a' }} />
}

// 模块顺序 + 衔接句（解锁后出现在模块顶部）
const MODULES = [
  { id: 'entrance', Component: Entrance, connector: null },
  { id: 'm1',       Component: M1,       connector: '因为那件事，平行宇宙的你，也开始对太空垃圾感兴趣。' },
  { id: 'm2',       Component: M2,       connector: '旅行总有终点，那些留下来的，我们总是忘了还有机会。' },
  { id: 'm3',       Component: M3,       connector: '不是没有人做过这个决定，是做了这个决定的人，已经不在了。' },
  { id: 'm4',       Component: M4,       connector: null },
  { id: 'm5',       Component: M5,       connector: '旅行结束了，那些留下来的，我们总是忘了还有机会处理。' },
  { id: 'm6',       Component: M6,       connector: '不要问还有没有人在乎，问你自己。' },
  { id: 'm7',       Component: M7,       connector: '最后，把这些碎片重新放回真实世界的信息里。' },
  { id: 'm8',       Component: M8,       connector: '看见之后，下一步是让别人也能复核你看见了什么。', alwaysUnlocked: true },
]

export default function App() {
  const {
    unlockedModules, unlockModule,
    markModuleComplete, completedModules,
    scrollLocked,
  } = useAppStore()

  const moduleRefs = useRef({})
  const prevUnlockedLen = useRef(unlockedModules.length)

  // M4 游戏进行时锁定页面滚动
  useEffect(() => {
    document.body.style.overflow = scrollLocked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [scrollLocked])

  // 兼容新增模块：如果用户在旧版本已经完成某个模块，自动补解锁它后面的新模块。
  useEffect(() => {
    MODULES.forEach((module, idx) => {
      const next = MODULES[idx + 1]
      if (next && completedModules.includes(module.id) && !unlockedModules.includes(next.id)) {
        unlockModule(next.id)
      }
    })
  }, [completedModules, unlockedModules, unlockModule])

  // 新模块解锁后自动滚动到该模块
  useEffect(() => {
    if (unlockedModules.length > prevUnlockedLen.current) {
      const newId = unlockedModules[unlockedModules.length - 1]
      setTimeout(() => {
        moduleRefs.current[newId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
    prevUnlockedLen.current = unlockedModules.length
  }, [unlockedModules])

  function handleComplete(currentId) {
    markModuleComplete(currentId)
    const idx = MODULES.findIndex((m) => m.id === currentId)
    if (idx !== -1 && idx < MODULES.length - 1) {
      unlockModule(MODULES[idx + 1].id)
    }
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <ProgressBar completed={completedModules.length} total={MODULES.length} />

      {MODULES.map(({ id, Component, connector, alwaysUnlocked }) => (
        <Suspense key={id} fallback={<ModuleLoader />}>
          <ModuleWrapper
            isUnlocked={alwaysUnlocked || unlockedModules.includes(id)}
            connector={connector}
            ref={(el) => { moduleRefs.current[id] = el }}
          >
            <Component onComplete={() => handleComplete(id)} />
          </ModuleWrapper>
        </Suspense>
      ))}
    </div>
  )
}
