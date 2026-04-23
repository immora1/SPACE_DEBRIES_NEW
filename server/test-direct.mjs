import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env') })

import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

const PROXY_URL = process.env.PROXY_URL || 'http://127.0.0.1:22307'
const apiKey = process.env.OPENAI_API_KEY

console.log('proxy:', PROXY_URL)
console.log('key prefix:', apiKey?.slice(0, 16) ?? 'MISSING')

const agent = new HttpsProxyAgent(PROXY_URL)

try {
  console.log('\n[1] fetching api.openai.com ...')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    agent,
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 64,
      messages: [{ role: 'user', content: '用一句话描述太空碎片。' }],
    }),
  })

  console.log('[2] status:', res.status)
  const text = await res.text()
  console.log('[3] body:', text)
} catch (err) {
  console.error('[ERR]', err.message)
  console.error(err.stack)
}
