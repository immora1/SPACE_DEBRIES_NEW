import { useState } from 'react'

const STATUS = { idle: 'idle', loading: 'loading', ok: 'ok', error: 'error' }

function ResultBox({ status, data }) {
  if (status === STATUS.idle) return null

  const borderColor = {
    loading: 'border-zinc-600',
    ok: 'border-emerald-600',
    error: 'border-red-600',
  }[status]

  const label = {
    loading: '请求中…',
    ok: '成功',
    error: '失败',
  }[status]

  return (
    <div className={`mt-4 rounded border ${borderColor} bg-zinc-900 p-4`}>
      <div className="mb-2 flex items-center gap-2">
        {status === 'loading' && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
        )}
        <span
          className={`font-mono text-xs ${
            status === 'ok' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-zinc-400'
          }`}
        >
          {label}
        </span>
      </div>
      {data && (
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

function TestCard({ title, description, onRun, status, data }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="mb-1 font-mono text-sm font-bold text-zinc-100">{title}</h2>
      <p className="mb-4 text-xs text-zinc-500">{description}</p>
      <button
        onClick={onRun}
        disabled={status === STATUS.loading}
        className="rounded bg-zinc-700 px-4 py-2 font-mono text-xs text-zinc-100 transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === STATUS.loading ? '请求中…' : '运行测试'}
      </button>
      <ResultBox status={status} data={data} />
    </div>
  )
}

export default function ApiTest() {
  const [celestrak, setCelestrak] = useState({ status: STATUS.idle, data: null })
  const [gpt, setGpt] = useState({ status: STATUS.idle, data: null })

  async function testCelestrak() {
    setCelestrak({ status: STATUS.loading, data: null })
    try {
      const res = await fetch('/api/test-celestrak')
      const data = await res.json()
      setCelestrak({ status: data.ok ? STATUS.ok : STATUS.error, data })
    } catch (err) {
      setCelestrak({ status: STATUS.error, data: { error: err.message } })
    }
  }

  async function testGpt() {
    setGpt({ status: STATUS.loading, data: null })
    try {
      const res = await fetch('/api/test-gpt', { method: 'POST' })
      const data = await res.json()
      setGpt({ status: data.ok ? STATUS.ok : STATUS.error, data })
    } catch (err) {
      setGpt({ status: STATUS.error, data: { error: err.message } })
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="font-mono text-xs text-zinc-500">SPACE_DEBRIES · MVP</p>
          <h1 className="mt-1 font-mono text-lg font-bold">API 连通性验证</h1>
        </div>

        <div className="flex flex-col gap-4">
          <TestCard
            title="CelesTrak · 卫星数据"
            description="拉取 ISS（国际空间站）轨道目录数据，验证代理与网络连通"
            onRun={testCelestrak}
            status={celestrak.status}
            data={celestrak.data}
          />

          <TestCard
            title="GPT API · AI 生成"
            description="发送测试 prompt，验证 OPENAI_API_KEY 与代理注入是否生效"
            onRun={testGpt}
            status={gpt.status}
            data={gpt.data}
          />
        </div>

        <p className="mt-8 font-mono text-xs text-zinc-700">
          后端 → http://localhost:3001 · 代理 → http://127.0.0.1:22307
        </p>
      </div>
    </div>
  )
}
