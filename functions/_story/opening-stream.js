// Only the first top-level story_text string is eligible for public preview.
// Incomplete JSON escapes are held back until the next provider chunk arrives.
export function partialOpeningText(json) {
  const prefix = /^\s*\{\s*"story_text"\s*:\s*"/.exec(json)
  if (!prefix) return ''
  let end = prefix[0].length
  const start = end
  while (end < json.length) {
    const char = json[end]
    if (char === '"') break
    if (char === '\\') {
      const length = json[end + 1] === 'u' ? 6 : 2
      if (end + length > json.length) break
      end += length
    } else {
      end += 1
    }
  }
  try {
    return JSON.parse(`"${json.slice(start, end)}"`).replace(/[\uD800-\uDBFF]$/, '')
  } catch { return '' }
}
