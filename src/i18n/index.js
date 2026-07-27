export const DEFAULT_LANGUAGE = 'zh'
export const SUPPORTED_LANGUAGES = ['zh', 'en']

export const messages = {
  'language.zh': { zh: '中文', en: '中文' },
  'language.en': { zh: 'EN', en: 'EN' },
  'language.switchToZh': { zh: '切换为中文', en: 'Switch to Chinese' },
  'language.switchToEn': { zh: '切换为英文', en: 'Switch to English' },
  'nav.home': { zh: '返回首页', en: 'Back to home' },
  'nav.stages': { zh: '页面阶段导航', en: 'Page stage navigation' },
  'nav.m1': { zh: '太空垃圾', en: 'Space Debris' },
  'nav.m2': { zh: '历史事件', en: 'History' },
  'nav.m3': { zh: '轨道环境', en: 'Orbit' },
  'nav.m4': { zh: '生存任务', en: 'Mission' },
  'nav.m5': { zh: '法律边界', en: 'Law' },
  'nav.m6': { zh: '清理方法', en: 'Cleanup' },
  'nav.m7': { zh: '科普总结', en: 'Summary' },
}

export function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE
}

export function localize(language, zhValue, enValue) {
  const normalized = normalizeLanguage(language)
  if (normalized === 'en') return enValue || zhValue || ''
  return zhValue || enValue || ''
}

function interpolate(template, params) {
  if (!params) return template
  return String(template).replace(/\{([^{}]+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  ))
}

export function createTranslator(language, catalog = messages) {
  const normalized = normalizeLanguage(language)
  return (key, params) => {
    const entry = catalog[key]
    if (!entry) return key
    return interpolate(localize(normalized, entry.zh, entry.en), params)
  }
}
