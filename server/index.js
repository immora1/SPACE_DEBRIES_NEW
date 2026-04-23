import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env') })

import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

const PROXY_URL = process.env.PROXY_URL || 'http://127.0.0.1:22307'
const agent = new HttpsProxyAgent(PROXY_URL)

// 所有外部请求共用此 fetch，强制走代理
const proxiedFetch = (url, init = {}) => fetch(url, { ...init, agent })

const app = express()
app.use(cors())
app.use(express.json())

// ── CelesTrak 测试端点 ──────────────────────────────────────────────────────
app.get('/api/test-celestrak', async (req, res) => {
  try {
    const url = 'https://celestrak.org/satcat/records.php?CATNR=25544&FORMAT=json'
    const response = await proxiedFetch(url)
    if (!response.ok) throw new Error(`CelesTrak responded ${response.status}`)

    const data = await response.json()
    const sat = Array.isArray(data) ? data[0] : data

    res.json({
      ok: true,
      name: sat.OBJECT_NAME?.trim(),
      intlDes: sat.OBJECT_ID,
      orbitCenter: sat.ORBIT_CENTER,
      period: sat.PERIOD,
      inclination: sat.INCLINATION,
      apogee: sat.APOGEE,
      perigee: sat.PERIGEE,
      raw: sat,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── GPT 测试端点（raw HTTP，代理注入）──────────────────────────────────────
app.post('/api/test-gpt', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'your_key_here') {
      throw new Error('OPENAI_API_KEY not set in server/.env')
    }

    const response = await proxiedFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 256,
        messages: [
          { role: 'user', content: '用一句话描述太空碎片问题，语气冷静克制，不超过50字。' },
        ],
      }),
    })

    const rawText = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${rawText}`)

    const data = JSON.parse(rawText)
    res.json({
      ok: true,
      model: data.model,
      content: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── 健康检查 ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, proxy: PROXY_URL })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  console.log(`[server] proxy: ${PROXY_URL}`)
  console.log(`[server] openai key: ${process.env.OPENAI_API_KEY ? '✓ loaded' : '✗ missing'}`)
})
