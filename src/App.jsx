import Entrance from './modules/Entrance'

export default function App() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100svh' }}>
      <Entrance onComplete={() => console.log('entrance complete')} />
    </div>
  )
}
