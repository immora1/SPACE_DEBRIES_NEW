export default function ProgressBar({ completed, total }) {
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      height: 3, background: 'rgba(42,42,40,0.6)',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: '#c8b89a',
        transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />
    </div>
  )
}
