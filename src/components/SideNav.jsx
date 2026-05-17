import { useState, useEffect } from 'react'
import useAppStore from '../store/useAppStore'

const MODULES = [
  { id: 'entrance', num: '00', label: 'ENTRANCE' },
  { id: 'm1',       num: '01', label: 'DEBRIS'   },
  { id: 'm2',       num: '02', label: 'ORBIT'    },
  { id: 'm3',       num: '03', label: 'HISTORY'  },
  { id: 'm4',       num: '04', label: 'GAME'     },
  { id: 'm5',       num: '05', label: 'REENTRY'  },
  { id: 'm6',       num: '06', label: 'CLEANUP'  },
  { id: 'm7',       num: '07', label: 'VIDEO'    },
]

const BAR_H = 300 // px，进度条轨道总高度

export default function SideNav() {
  const unlockedModules = useAppStore((s) => s.unlockedModules)
  const [activeIdx, setActiveIdx] = useState(0)

  // 滚动监听：找出当前最靠近视口顶部的已解锁模块
  useEffect(() => {
    let ticking = false

    function update() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const threshold = window.innerHeight * 0.45
        let current = 0
        MODULES.forEach((m, i) => {
          const el = document.querySelector(`[data-module="${m.id}"]`)
          if (!el) return
          const top = el.getBoundingClientRect().top
          // 只要模块顶部还在视口 45% 以内就更新为当前
          if (top <= threshold) current = i
        })
        setActiveIdx(current)
        ticking = false
      })
    }

    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  // 只显示已解锁的模块
  const visible = MODULES.filter((m) => unlockedModules.includes(m.id))
  if (visible.length <= 1) return null

  // 当前模块在 visible 中的索引
  const visibleActiveIdx = visible.findIndex((m) => m.id === MODULES[activeIdx]?.id)
  const safeActive = visibleActiveIdx < 0 ? 0 : visibleActiveIdx

  // 填充高度：当前模块在列表中的比例
  const fillPct = visible.length > 1 ? (safeActive / (visible.length - 1)) * 100 : 0

  const activeModule = visible[safeActive]

  return (
    <div style={{
      position: 'fixed',
      left: 20,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 150,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>

      {/* 轨道 + 填充 */}
      <div style={{
        position: 'relative',
        width: 2,
        height: BAR_H,
        background: 'rgba(26,26,53,0.6)',
        borderRadius: 1,
      }}>
        {/* 填充条 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${fillPct}%`,
          background: 'linear-gradient(to bottom, #6b7fff, #8b6cf8)',
          boxShadow: '0 0 10px rgba(107,127,255,0.55)',
          borderRadius: 1,
          transition: 'height 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />

        {/* 各模块节点（沿轨道排布） */}
        {visible.map((m, i) => {
          const pct = visible.length > 1 ? i / (visible.length - 1) : 0
          const isActive = i === safeActive
          const isPast   = i < safeActive
          return (
            <div
              key={m.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: `${pct * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: isActive ? 7 : 4,
                height: isActive ? 7 : 4,
                borderRadius: '50%',
                background: isActive
                  ? '#e8e8f8'
                  : isPast ? '#6b7fff' : 'rgba(26,26,53,0.9)',
                border: isActive ? '1px solid rgba(107,127,255,0.6)' : 'none',
                boxShadow: isActive ? '0 0 8px rgba(232,232,248,0.6)' : 'none',
                transition: 'all 0.4s ease',
              }}
            />
          )
        })}

        {/* 当前位置的亮点（在填充末端） */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: `${fillPct}%`,
          transform: 'translate(-50%, -50%)',
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: '#8b6cf8',
          boxShadow: '0 0 12px rgba(139,108,248,0.8)',
          transition: 'top 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>

      {/* 当前模块编号标签 */}
      <div style={{
        marginTop: 10,
        fontFamily: '"Space Mono", monospace',
        fontSize: 9,
        color: 'rgba(107,127,255,0.7)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        lineHeight: 1,
        transition: 'opacity 0.3s ease',
      }}>
        {activeModule?.num ?? '00'}
      </div>
    </div>
  )
}
