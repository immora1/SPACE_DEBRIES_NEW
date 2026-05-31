const STAGES = [
  { id: 'm1', label: '太空垃圾是什么' },
  { id: 'm3', label: '重大历史事件' },
  { id: 'm2', label: '轨道是什么' },
  { id: 'm4', label: '卫星生存任务游戏' },
  { id: 'm5', label: '太空垃圾落地球' },
  { id: 'm6', label: '怎么清理太空垃圾' },
  { id: 'm7', label: '科普视频' },
]

export default function StageNav({ completedModules, onStageClick }) {
  function handleStageClick(id) {
    console.log('点击导航:', id)
    onStageClick?.(id)
  }

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      right: 24,
      transform: 'translateY(-50%)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 20,
      pointerEvents: 'auto',
    }}>
      {/* 竖直导航点列表 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        {STAGES.map((stage, idx) => {
          const isCompleted = completedModules.includes(stage.id)

          return (
            <button
              key={stage.id}
              onClick={() => handleStageClick(stage.id)}
              title={stage.label}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid',
                background: isCompleted ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.2)',
                borderColor: isCompleted ? '#34d399' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                pointerEvents: 'auto',
                zIndex: 10001,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.3)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'
              }}
              onMouseLeave={e => {
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

      {/* 竖直标签 */}
      <div style={{
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        transform: 'rotate(180deg)',
        fontFamily: 'Space Mono, monospace',
        fontSize: 9,
        color: 'rgba(232,232,248,0.35)',
        letterSpacing: '0.1em',
        whiteSpace: 'nowrap',
        marginTop: 8,
      }}>
        STAGE NAVIGATION
      </div>
    </div>
  )
}
