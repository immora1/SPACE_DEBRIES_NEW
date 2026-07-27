export const ORBIT_START_THRESHOLD = 0.9

export function shouldStartOrbitMission(progress) {
  return Number.isFinite(progress) && progress >= ORBIT_START_THRESHOLD
}

export function commitOrbitDragProgress(progress, { onProgressChange, onComplete }) {
  onProgressChange(progress)
  if (shouldStartOrbitMission(progress)) onComplete?.(progress)
  return progress
}
