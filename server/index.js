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

// ── GPT 通用端点 ────────────────────────────────────────────────────────────
app.post('/api/gpt', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'your_key_here') throw new Error('OPENAI_API_KEY not set')

    const { systemPrompt, userPrompt, temperature = 0.7, maxTokens = 512 } = req.body

    const response = await proxiedFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    const rawText = await response.text()
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${rawText}`)

    const data = JSON.parse(rawText)
    res.json({
      ok: true,
      content: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── CelesTrak：按城市匹配卫星 ────────────────────────────────────────────
const FALLBACK_SATS = [
  { OBJECT_NAME: 'FENGYUN 3D',  NORAD_CAT_ID: 43010, APOGEE: 851, PERIGEE: 820, INCLINATION: 98.7,  PERIOD: 101.4, LAUNCH_DATE: '2017-11-15', OBJECT_TYPE: 'PAY' },
  { OBJECT_NAME: 'TERRA',       NORAD_CAT_ID: 25994, APOGEE: 705, PERIGEE: 694, INCLINATION: 98.2,  PERIOD:  98.9, LAUNCH_DATE: '1999-12-18', OBJECT_TYPE: 'PAY' },
  { OBJECT_NAME: 'AQUA',        NORAD_CAT_ID: 27424, APOGEE: 710, PERIGEE: 697, INCLINATION: 98.2,  PERIOD:  98.9, LAUNCH_DATE: '2002-05-04', OBJECT_TYPE: 'PAY' },
  { OBJECT_NAME: 'SENTINEL-2A', NORAD_CAT_ID: 40697, APOGEE: 790, PERIGEE: 783, INCLINATION: 98.6,  PERIOD: 100.6, LAUNCH_DATE: '2015-06-23', OBJECT_TYPE: 'PAY' },
  { OBJECT_NAME: 'LANDSAT 8',   NORAD_CAT_ID: 39084, APOGEE: 708, PERIGEE: 703, INCLINATION: 98.2,  PERIOD:  99.0, LAUNCH_DATE: '2013-02-11', OBJECT_TYPE: 'PAY' },
  { OBJECT_NAME: 'SUOMI NPP',   NORAD_CAT_ID: 37849, APOGEE: 833, PERIGEE: 826, INCLINATION: 98.7,  PERIOD: 101.4, LAUNCH_DATE: '2011-10-28', OBJECT_TYPE: 'PAY' },
]

app.get('/api/satellite', async (req, res) => {
  const { city = '' } = req.query
  try {
    // 尝试 CelesTrak satcat 获取活跃 LEO 卫星列表
    const url = 'https://celestrak.org/SPACETRACK/query/class/satcat/CURRENT/Y/OBJECT_TYPE/PAY/ORBIT_CENTER/EA/FORMAT/JSON/orderby/LAUNCH_DATE%20desc/limit/100'
    const response = await proxiedFetch(url)
    if (!response.ok) throw new Error(`CelesTrak ${response.status}`)
    const data = await response.json()
    // 用城市名哈希选一颗，保证同城市同卫星
    const hash = city.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const sat = data[hash % data.length] ?? data[0]
    res.json({ ok: true, satellite: sat, source: 'celestrak' })
  } catch {
    // CelesTrak 不可用时用离线备用卫星
    const hash = city.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const sat = FALLBACK_SATS[hash % FALLBACK_SATS.length]
    res.json({ ok: true, satellite: sat, source: 'fallback' })
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
