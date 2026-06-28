import { memo, useMemo } from 'react'

const STAGES = [
  { id: 'm1', label: '太空垃圾是什么？' },
  { id: 'm3', label: '重大历史事件' },
  { id: 'm2', label: '轨道是什么？' },
  { id: 'm4', label: '卫星生存任务游戏' },
  { id: 'law', label: '法律与国际条约' },
  { id: 'm6', label: '怎么清理太空垃圾' },
  { id: 'm7', label: '科普视频' },
]
function StageNav({ completedModules, availableModules = [], onStageClick }) {
  const completedSet = useMemo(() => new Set(completedModules), [completedModules])
  const availableSet = useMemo(() => new Set(availableModules), [availableModules])

  function handleStageClick(id) {
    if (!availableSet.has(id)) return
    onStageClick?.(id)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 28,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      pointerEvents: 'auto',
    }}>
      <div style={{
        fontFamily: 'Lexend, sans-serif',
        fontSize: 8,
        color: 'rgba(232,232,248,0.35)',
        letterSpacing: '0.16em',
        whiteSpace: 'nowrap',
      }}>
        STAGE NAVIGATION
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        {STAGES.map((stage) => {
          const isCompleted = completedSet.has(stage.id)
          const isAvailable = availableSet.has(stage.id)

          return (
            <button
              key={stage.id}
              type="button"
              disabled={!isAvailable}
              aria-disabled={!isAvailable}
              onClick={() => handleStageClick(stage.id)}
              title={stage.label}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid',
                background: isCompleted
                  ? 'rgba(52,211,153,0.6)'
                  : isAvailable
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(255,255,255,0.06)',
                borderColor: isCompleted
                  ? '#34d399'
                  : isAvailable
                    ? 'rgba(255,255,255,0.4)'
                    : 'rgba(255,255,255,0.18)',
                cursor: isAvailable ? 'pointer' : 'not-allowed',
                opacity: isAvailable ? 1 : 0.48,
                transition: 'transform 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                pointerEvents: 'auto',
                zIndex: 10001,
              }}
              onMouseEnter={e => {
                if (!isAvailable) return
                e.currentTarget.style.transform = 'scale(1.3)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'
              }}
              onMouseLeave={e => {
                if (!isAvailable) return
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.borderColor = isCompleted
                  ? '#34d399'
                  : 'rgba(255,255,255,0.4)'
              }}
            >
              {isCompleted && (
                <div style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#34d399',
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default memo(StageNav)
