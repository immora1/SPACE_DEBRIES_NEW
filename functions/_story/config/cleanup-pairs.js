export const CLEANUP_METHODS = Object.freeze({
  laser: {
    method_id: 'LASER_ABLATION',
    label: '激光烧蚀',
  },
  sail: {
    method_id: 'DRAG_SAIL',
    label: '阻力帆',
  },
  arm: {
    method_id: 'ROBOTIC_ARM_CAPTURE',
    label: '机械臂抓取',
  },
})

export const CLEANUP_TARGETS = Object.freeze({
  laser: {
    target_id: 'A31_MICRO_DEBRIS',
    label: '微小剥落物',
    accepted_ui_ids: ['paint-flakes', 'fragment-cloud', 'panel-splinters'],
  },
  sail: {
    target_id: 'C22_END_OF_LIFE_PLATFORM',
    label: '寿命末期平台',
    accepted_ui_ids: ['end-of-life', 'cubesat', 'leo-platform'],
  },
  arm: {
    target_id: 'B27_RING_STRUCTURE',
    label: '大型完整结构',
    accepted_ui_ids: ['adapter-ring', 'intact-body', 'rocket-stage'],
  },
})

export const CLEANUP_PAIRS = Object.freeze(
  Object.fromEntries(Object.keys(CLEANUP_METHODS).map((uiMethodId) => {
    const method = CLEANUP_METHODS[uiMethodId]
    const target = CLEANUP_TARGETS[uiMethodId]
    return [target.target_id, {
      ui_method_id: uiMethodId,
      method_id: method.method_id,
      method_label: method.label,
      target_id: target.target_id,
      target_label: target.label,
      accepted_ui_ids: target.accepted_ui_ids,
      technical_effect: { correct: true, cleanup_method: method.method_id },
      narrative_effect: {
        metrics_delta: { event_integrity: 2, relationship_connection: 1, uncertainty: -2 },
        consequence: `${method.label}与${target.label}完成匹配。`,
        story_tag: `cleanup_${uiMethodId}`,
      },
    }]
  })),
)

export function getCleanupPair(targetId, methodId, uiTargetId) {
  const pair = CLEANUP_PAIRS[targetId]
  if (!pair) return null
  const methodMatches = pair.method_id === methodId || pair.ui_method_id === methodId
  const targetMatches = !uiTargetId || pair.accepted_ui_ids.includes(uiTargetId)
  return methodMatches && targetMatches ? pair : null
}
