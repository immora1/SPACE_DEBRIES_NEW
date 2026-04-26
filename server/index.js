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

// ── Space-Track 卫星数据 ──────────────────────────────────────────────────
const ST_BASE  = 'https://www.space-track.org'
const ST_USER  = process.env.SPACETRACK_USER
const ST_PASS  = process.env.SPACETRACK_PASS

// 离线兜底：Space-Track 不可用时使用
const FALLBACK_SATS = [
  { OBJECT_NAME: 'FENGYUN 3D',  NORAD_CAT_ID: 43010, APOGEE: 851, PERIGEE: 820, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH_DATE: '2017-11-15', COUNTRY: 'PRC' },
  { OBJECT_NAME: 'TERRA',       NORAD_CAT_ID: 25994, APOGEE: 705, PERIGEE: 694, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH_DATE: '1999-12-18', COUNTRY: 'US'  },
  { OBJECT_NAME: 'AQUA',        NORAD_CAT_ID: 27424, APOGEE: 710, PERIGEE: 697, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH_DATE: '2002-05-04', COUNTRY: 'US'  },
  { OBJECT_NAME: 'SENTINEL-2A', NORAD_CAT_ID: 40697, APOGEE: 790, PERIGEE: 783, INCLINATION: 98.6, PERIOD: 100.6, LAUNCH_DATE: '2015-06-23', COUNTRY: 'ESA' },
  { OBJECT_NAME: 'LANDSAT 8',   NORAD_CAT_ID: 39084, APOGEE: 708, PERIGEE: 703, INCLINATION: 98.2, PERIOD:  99.0, LAUNCH_DATE: '2013-02-11', COUNTRY: 'US'  },
  { OBJECT_NAME: 'SUOMI NPP',   NORAD_CAT_ID: 37849, APOGEE: 833, PERIGEE: 826, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH_DATE: '2011-10-28', COUNTRY: 'US'  },
]

// 内存缓存：24 小时有效，服务器整个生命周期只刷新一次
let satCache     = []
let satCacheTime = 0
const CACHE_TTL  = 24 * 60 * 60 * 1000

// 登录 Space-Track，返回 Cookie 字符串
async function spaceTrackLogin() {
  if (!ST_USER || ST_USER.includes('邮箱')) throw new Error('SPACETRACK_USER not configured')
  const res = await proxiedFetch(`${ST_BASE}/ajaxauth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `identity=${encodeURIComponent(ST_USER)}&password=${encodeURIComponent(ST_PASS)}`,
  })
  if (!res.ok) throw new Error(`Space-Track login HTTP ${res.status}`)
  // 拼接所有 Set-Cookie 值（只取 name=value 部分，丢弃 path/expires 等）
  const raw = res.headers.raw()['set-cookie'] ?? []
  const cookie = raw.map(c => c.split(';')[0]).join('; ')
  if (!cookie) throw new Error('Space-Track login returned no cookie')
  return cookie
}

// 从 Space-Track 拉取 LEO 在轨卫星列表，返回标准化数组
async function fetchFromSpaceTrack() {
  const cookie = await spaceTrackLogin()

  // 简化查询：CURRENT=Y（在轨）+ PAY（有效载荷）+ 限 500 条
  // APOGEE 过滤放到 JS 侧做，避免 URL 编码问题
  const url = `${ST_BASE}/basicspacedata/query/class/satcat`
    + `/CURRENT/Y/OBJECT_TYPE/PAY`
    + `/FORMAT/JSON/orderby/LAUNCH%20desc/limit/500`

  const res = await proxiedFetch(url, { headers: { Cookie: cookie } })
  if (!res.ok) throw new Error(`Space-Track query HTTP ${res.status}`)

  const text = await res.text()
  console.log('[satellite] Space-Track raw response (first 200):', text.slice(0, 200))

  let raw
  try { raw = JSON.parse(text) } catch { throw new Error('Space-Track response is not JSON') }
  if (!Array.isArray(raw)) throw new Error(`Space-Track unexpected format: ${text.slice(0, 100)}`)
  if (raw.length === 0) throw new Error('Space-Track returned 0 records')

  // 只保留 LEO（远地点 < 2000 km），在 JS 侧过滤
  const leo = raw.filter(s => Number(s.APOGEE) < 2000 && Number(s.APOGEE) > 0)
  console.log(`[satellite] total=${raw.length}, LEO=${leo.length}`)

  return leo
    .filter(s => (s.OBJECT_NAME || s.SATNAME || '').trim())
    .map(s => ({
      OBJECT_NAME:  (s.OBJECT_NAME || s.SATNAME || '').trim(),
      NORAD_CAT_ID: s.NORAD_CAT_ID,
      APOGEE:       Number(s.APOGEE),
      PERIGEE:      Number(s.PERIGEE),
      INCLINATION:  Number(s.INCLINATION),
      PERIOD:       Number(s.PERIOD),
      LAUNCH_DATE:  s.LAUNCH,
      COUNTRY:      s.COUNTRY,
      LAUNCH_YEAR:  s.LAUNCH_YEAR,
      SITE:         s.SITE,
      RCS_SIZE:     s.RCS_SIZE,
    }))
}

// 获取缓存，过期或为空时自动刷新
async function getSatList() {
  if (satCache.length > 0 && Date.now() - satCacheTime < CACHE_TTL) return satCache
  try {
    console.log('[satellite] fetching from Space-Track...')
    satCache = await fetchFromSpaceTrack()
    satCacheTime = Date.now()
    console.log(`[satellite] cached ${satCache.length} LEO satellites from Space-Track`)
  } catch (err) {
    console.warn('[satellite] Space-Track unavailable, using fallback:', err.message)
    if (satCache.length === 0) satCache = FALLBACK_SATS
  }
  return satCache
}

// 城市名哈希 → 固定选一颗卫星
function cityHash(city) {
  return city.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

// 服务启动时预热缓存（异步，不阻塞启动）
getSatList().catch(() => {})

// ── 卫星查询端点 ──────────────────────────────────────────────────────────
app.get('/api/satellite', async (req, res) => {
  const { city = '' } = req.query
  const sats = await getSatList()
  const hash = cityHash(city)
  const sat  = sats[hash % sats.length] ?? sats[0]
  const source = sats === FALLBACK_SATS ? 'fallback' : 'spacetrack'
  res.json({ ok: true, satellite: sat, source })
})

// ── Space-Track 连通性测试端点 ────────────────────────────────────────────
app.get('/api/test-spacetrack', async (req, res) => {
  try {
    const cookie = await spaceTrackLogin()
    // 只查一颗（ISS）验证查询是否通
    const url = `${ST_BASE}/basicspacedata/query/class/satcat/NORAD_CAT_ID/25544/FORMAT/JSON`
    const r   = await proxiedFetch(url, { headers: { Cookie: cookie } })
    if (!r.ok) throw new Error(`query HTTP ${r.status}`)
    const data = await r.json()
    res.json({ ok: true, sample: data[0] ?? null, cacheSize: satCache.length })
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
