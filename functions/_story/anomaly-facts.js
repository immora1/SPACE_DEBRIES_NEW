const ANOMALY_TERMS = Object.freeze({
  NAVIGATION_OFFSET: Object.freeze([
    '导航', '定位', '位置', '坐标', '路径', '路线', '偏移', 'gnss',
  ]),
  MESSAGE_DELAY: Object.freeze([
    '消息', '通知', '短信', '验证码', '发送', '送达', '延迟', '滞后',
  ]),
  COMMUNICATION_INTERRUPTION: Object.freeze([
    '通信', '通讯', '联络', '连接', '网络', '信号', '中断', '掉线',
  ]),
  TIME_SYNC_ERROR: Object.freeze([
    '时间', '时钟', '授时', '同步', '计时', '时间戳', '误差',
  ]),
  WEATHER_UPDATE_DELAY: Object.freeze([
    '天气', '气象', '预报', '降雨', '雨点', '风', '温度', '湿度', '更新', '观测',
  ]),
  TRAVEL_INFO_DEVIATION: Object.freeze([
    '交通', '行程', '航班', '车次', '列车', '到达', '抵达', '路线', '时刻', '延误',
  ]),
})

const META_FACT_PATTERN = /(?:知识揭示前|不得|不要|禁止|模型|提示词|写作|内部规则|隐藏事实|不可公开)/u

function normalized(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN')
}

function unique(values) {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const fact = String(value || '').trim()
    const key = fact.normalize('NFKC').toLocaleLowerCase('zh-CN')
    if (!fact || seen.has(key)) continue
    seen.add(key)
    result.push(fact)
  }
  return result
}

export function isAnomalyRelevantFact(value, primaryAnomaly) {
  const fact = normalized(value)
  if (!fact || META_FACT_PATTERN.test(fact)) return false
  const terms = ANOMALY_TERMS[primaryAnomaly] || []
  return terms.some((term) => fact.includes(term))
}

export function relevantHiddenFacts(hiddenFacts, primaryAnomaly) {
  return unique(
    (hiddenFacts || []).filter((fact) => (
      isAnomalyRelevantFact(fact, primaryAnomaly)
    )),
  )
}

export function storyAnomalyEffects({
  nextNodeContext,
  stages,
  primaryAnomaly,
}) {
  const recentRelevantFacts = [...(stages || [])]
    .reverse()
    .flatMap((stage) => [...(stage.known_to_user_additions || [])].reverse())
    .filter((fact) => isAnomalyRelevantFact(fact, primaryAnomaly))

  return unique([
    nextNodeContext,
    ...recentRelevantFacts,
  ]).slice(0, 4)
}
