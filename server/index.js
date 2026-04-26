import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

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

// ── 本地卫星数据库（启动时加载 satellites.json）────────────────────────────
let ALL_SATS = []
try {
  const raw = JSON.parse(readFileSync(join(__dirname, '../satellites.json'), 'utf-8'))
  ALL_SATS = (raw.satellites ?? []).filter(s => s.ORBIT_TYPE === 'LEO')
  console.log(`[server] loaded ${ALL_SATS.length} LEO satellites from satellites.json`)
} catch {
  console.warn('[server] satellites.json not found, using built-in fallback')
  ALL_SATS = [
    { OBJECT_NAME: 'FENGYUN 3D',  NORAD_CAT_ID: 43010, APOGEE: 851,  PERIGEE: 820, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH: '2017-11-15', ORBIT_TYPE: 'LEO' },
    { OBJECT_NAME: 'TERRA',       NORAD_CAT_ID: 25994, APOGEE: 705,  PERIGEE: 694, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH: '1999-12-18', ORBIT_TYPE: 'LEO' },
    { OBJECT_NAME: 'AQUA',        NORAD_CAT_ID: 27424, APOGEE: 710,  PERIGEE: 697, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH: '2002-05-04', ORBIT_TYPE: 'LEO' },
    { OBJECT_NAME: 'SENTINEL-2A', NORAD_CAT_ID: 40697, APOGEE: 790,  PERIGEE: 783, INCLINATION: 98.6, PERIOD: 100.6, LAUNCH: '2015-06-23', ORBIT_TYPE: 'LEO' },
    { OBJECT_NAME: 'LANDSAT 8',   NORAD_CAT_ID: 39084, APOGEE: 708,  PERIGEE: 703, INCLINATION: 98.2, PERIOD:  99.0, LAUNCH: '2013-02-11', ORBIT_TYPE: 'LEO' },
    { OBJECT_NAME: 'SUOMI NPP',   NORAD_CAT_ID: 37849, APOGEE: 833,  PERIGEE: 826, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH: '2011-10-28', ORBIT_TYPE: 'LEO' },
  ]
}

// ── 城市纬度表（用于按轨道倾角匹配卫星）────────────────────────────────────
const CITY_LAT = {
  '北京': 39.9, '上海': 31.2, '广州': 23.1, '深圳': 22.5, '成都': 30.6,
  '杭州': 30.3, '武汉': 30.6, '西安': 34.3, '南京': 32.1, '重庆': 29.6,
  '天津': 39.1, '沈阳': 41.8, '哈尔滨': 45.8, '长春': 43.9, '济南': 36.7,
  '郑州': 34.7, '长沙': 28.2, '昆明': 25.0, '贵阳': 26.6, '南宁': 22.8,
  '海口': 20.0, '乌鲁木齐': 43.8, '拉萨': 29.7, '呼和浩特': 40.8,
  '合肥': 31.9, '福州': 26.1, '南昌': 28.7, '石家庄': 38.0, '太原': 37.9,
  '兰州': 36.1, '西宁': 36.6, '银川': 38.5, '香港': 22.3, '澳门': 22.2,
  'beijing': 39.9, 'shanghai': 31.2, 'guangzhou': 23.1, 'shenzhen': 22.5,
  'chengdu': 30.6, 'hangzhou': 30.3, 'wuhan': 30.6, 'xian': 34.3,
  'nanjing': 32.1, 'chongqing': 29.6, 'tianjin': 39.1, 'harbin': 45.8,
  'new york': 40.7, 'los angeles': 34.1, 'london': 51.5, 'paris': 48.9,
  'tokyo': 35.7, 'sydney': -33.9, 'moscow': 55.8, 'berlin': 52.5,
  'seoul': 37.6, 'singapore': 1.4, 'dubai': 25.2, 'mumbai': 19.1,
  'new delhi': 28.6, 'bangkok': 13.8, 'jakarta': -6.2, 'toronto': 43.7,
}

function getCityLat(city) {
  const key = city.trim()
  return CITY_LAT[key] ?? CITY_LAT[key.toLowerCase()] ?? 35.0
}

// 确定性哈希，所有输入组合唯一决定同一颗卫星
function strHash(s) {
  return s.split('').reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 0)
}

// ── 卫星匹配：按城市纬度过滤倾角，哈希选定 ─────────────────────────────────
app.get('/api/satellite', (req, res) => {
  const { city = '', name = '', story = '' } = req.query

  const lat = getCityLat(city)
  const absLat = Math.abs(lat)

  // 轨道倾角 >= 城市纬度的卫星才能飞越该城市
  // Starlink 占总量 77%，每 10 颗只保留 1 颗（按 NORAD_CAT_ID 取模，保证确定性）
  const candidates = ALL_SATS.filter(s => {
    if (s.INCLINATION == null || Number(s.INCLINATION) < absLat) return false
    if (s.OBJECT_NAME?.toUpperCase().includes('STARLINK')) {
      return Number(s.NORAD_CAT_ID) % 10 === 0
    }
    return true
  })
  const pool = candidates.length >= 10 ? candidates : ALL_SATS

  const seed = strHash(city + name + story)
  const sat = pool[seed % pool.length]

  res.json({
    ok: true,
    satellite: { ...sat, LAUNCH_DATE: sat.LAUNCH },
    source: 'local',
    matched_lat: lat,
    pool_size: pool.length,
  })
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
