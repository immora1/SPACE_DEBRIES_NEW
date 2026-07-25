export const EARTH_RADIUS = 6.5
export const CLOUD_GEOMETRY_MAX_RADIUS = 0.62

export const FALL_TRACE_VARIANTS = [
  { arcSpan: 1.55, bandWidth: 0.2, wave: 0.055, skew: -0.08, phase: 0.2 },
  { arcSpan: 1.78, bandWidth: 0.24, wave: 0.08, skew: 0.05, phase: 1.1 },
  { arcSpan: 2.05, bandWidth: 0.18, wave: 0.045, skew: -0.03, phase: 2.3 },
  { arcSpan: 2.28, bandWidth: 0.27, wave: 0.095, skew: 0.09, phase: 0.7 },
  { arcSpan: 2.48, bandWidth: 0.22, wave: 0.065, skew: -0.1, phase: 1.8 },
  { arcSpan: 2.68, bandWidth: 0.3, wave: 0.105, skew: 0.03, phase: 2.8 },
  { arcSpan: 1.92, bandWidth: 0.16, wave: 0.04, skew: 0.11, phase: 3.5 },
  { arcSpan: 2.82, bandWidth: 0.25, wave: 0.075, skew: -0.06, phase: 4.2 },
]

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const DISTRIBUTION_PHASE = Math.PI * 0.21

function hash01(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

export function createFallEventHover(event, pointer) {
  if (!event || !pointer) return null
  return { event, x: pointer.x, y: pointer.y }
}

export function createFallEventPlacements(events, earthRadius = EARTH_RADIUS) {
  const count = events.length

  return events.map((event, index) => {
    const y = 1 - (2 * (index + 0.5)) / count
    const horizontalRadius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = index * GOLDEN_ANGLE + DISTRIBUTION_PHASE
    const normal = [
      Math.cos(theta) * horizontalRadius,
      y,
      Math.sin(theta) * horizontalRadius,
    ]
    const embeddedDepth = 0.035 + hash01(index, 1) * 0.02
    const centerRadius = earthRadius - embeddedDepth
    const scale = [
      0.72 + hash01(index, 2) * 0.18,
      0.55 + hash01(index, 3) * 0.18,
      0.12 + hash01(index, 4) * 0.04,
    ]

    return {
      eventId: event['事件编号'],
      normal,
      position: normal.map((axis) => axis * centerRadius),
      roll: (hash01(index, 5) - 0.5) * Math.PI,
      scale,
      variant: index % FALL_TRACE_VARIANTS.length,
    }
  })
}
