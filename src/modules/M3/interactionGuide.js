export const M3_GUIDE_ACTIONS = Object.freeze(['drag', 'trace', 'satellite'])
export const M3_GUIDE_ENTER_DELAY_SECONDS = 0.9
export const M3_GUIDE_REPEAT_DELAY_SECONDS = 1.4

const ACTION_SET = new Set(M3_GUIDE_ACTIONS)

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

export function isM3GuideDismissAction(action) {
  return ACTION_SET.has(action)
}

export function getRelativeGuidePoint(containerRect, targetRect, offset = {}) {
  return {
    x: targetRect.left - containerRect.left + targetRect.width / 2 + (offset.x ?? 0),
    y: targetRect.top - containerRect.top + targetRect.height / 2 + (offset.y ?? 0),
  }
}

export function clampGuideLabelPoint(point, bounds, labelSize, padding = 16) {
  return {
    x: clamp(point.x + 18, padding, bounds.width - labelSize.width - padding),
    y: clamp(point.y - labelSize.height - 8, padding, bounds.height - labelSize.height - padding),
  }
}
