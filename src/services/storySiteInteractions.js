export const M2_STORY_MODULE_ID = 'M2'
export const M2_MATERIAL_NODE_ID = 'node_02'
export const M3_STORY_MODULE_ID = 'M3'
export const M3_MISSION_NODE_ID = 'node_03'
export const M6_CLEANUP_MODULE_ID = 'M6_CLEANUP_MATCHING'
export const MISSION_CANDIDATE_SECTION_ID = 'mission_candidates'
export const M2_MATERIAL_SECTIONS = Object.freeze([
  'frame',
  'solar',
  'insulation',
  'propulsion',
])

export function materialControlId(sectionId, optionId) {
  return `m2-material-${sectionId}-${optionId}`
}

export function buildM2MaterialInteractions(materials) {
  return M2_MATERIAL_SECTIONS.map((sectionId) => {
    const optionId = materials?.[sectionId]
    if (!optionId) {
      throw new Error(`Missing material selection for ${sectionId}.`)
    }
    return {
      section_id: sectionId,
      control_id: materialControlId(sectionId, optionId),
      option_id: optionId,
    }
  })
}

export function missionControlId(taskId) {
  return `m3-mission-${taskId}`
}

export function buildM3MissionInteractions(taskId) {
  if (!taskId) throw new Error('A mission task must be selected before confirmation.')
  return [{
    section_id: MISSION_CANDIDATE_SECTION_ID,
    control_id: missionControlId(taskId),
    option_id: taskId,
  }]
}

export function getSiteInteractionProgress(interaction, siteState = {}) {
  if (!interaction?.interaction_mode?.startsWith('SITE_')) {
    return { completed: 0, total: 0 }
  }
  const requiredSections = interaction.required_sections || []
  const moduleSelections = interaction.module_id === M2_STORY_MODULE_ID
    ? siteState.materials
    : interaction.module_id === M3_STORY_MODULE_ID
      ? { [MISSION_CANDIDATE_SECTION_ID]: siteState.mission }
      : null
  if (interaction.module_id === M6_CLEANUP_MODULE_ID) {
    const targets = siteState.cleanupTargets || []
    const matches = siteState.cleanupMatches || []
    return {
      completed: targets.filter((target) => matches.some((match) => (
        match.cleanup_target_id === target.cleanup_target_id
        && match.is_allowed_match
      ))).length,
      total: targets.length,
    }
  }
  return {
    completed: requiredSections.filter(
      (sectionId) => Boolean(moduleSelections?.[sectionId]),
    ).length,
    total: requiredSections.length,
  }
}
