export default function ProgressBar({ completed, total }) {
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      height: 2, background: 'rgba(26,26,53,0.6)',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: 'linear-gradient(to right, #4e5df0, #8b6cf8)',
        transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 0 8px rgba(107,127,255,0.6)',
      }} />
    </div>
  )
}
