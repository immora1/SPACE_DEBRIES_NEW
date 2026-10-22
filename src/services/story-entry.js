export function hasIdentity(user, satellite) {
  return Boolean(satellite && ['name', 'city', 'importantEvent'].every(
    (key) => typeof user?.[key] === 'string' && user[key].trim(),
  ))
}

// Use committed local progress, not selections or a slow background story ID.
export function missingGamePreparation(state) {
  if (!state.storySessionReady || !hasIdentity(state.user, state.satellite)) return 'identity'
  const game = state.publicGameState
  const materials = game?.satellite_build?.materials
  if (!['frame', 'solar', 'insulation', 'propulsion'].every((key) => materials?.[key])
    || state.storyCheckpoint === 'materials') return 'materials'
  if (!game?.mission?.mission_id
    || !['orbital_events', 'cleanup', 'completed'].includes(state.storyCheckpoint)) return 'mission'
  return null
}
