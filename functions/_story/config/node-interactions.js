import { CHECKPOINT, INTERACTIVE_NODE_IDS, StoryError } from '../constants.js'

export const STORY_INTERACTION_MODE = Object.freeze({
  SITE_SINGLE: 'SITE_SINGLE',
  SITE_GROUP_SINGLE: 'SITE_GROUP_SINGLE',
  SITE_COMPOSITE: 'SITE_COMPOSITE',
  SITE_GAME_RESULT: 'SITE_GAME_RESULT',
  SITE_MATCHING_GAME: 'SITE_MATCHING_GAME',
  LEGACY_STORY_OPTION: 'LEGACY_STORY_OPTION',
})

export const STORY_TRIGGER_MODE = Object.freeze({
  ON_CONTROL_CLICK: 'ON_CONTROL_CLICK',
  ON_GROUP_CONFIRM: 'ON_GROUP_CONFIRM',
  ON_STAGE_CONFIRM: 'ON_STAGE_CONFIRM',
  ON_GAME_COMPLETE: 'ON_GAME_COMPLETE',
})

export const SITE_STORY_MODULE = Object.freeze({
  M2: 'M2',
  M3: 'M3',
  M4: 'M4_ORBITAL_EVENTS',
  M6: 'M6_CLEANUP_MATCHING',
})

export const SITE_STORY_NODE = Object.freeze({
  M2_MATERIALS: 'node_02',
  M3_MISSION: 'node_03',
})

export const STORY_NODE_INTERACTIONS = Object.freeze({
  [SITE_STORY_NODE.M2_MATERIALS]: Object.freeze({
    node_id: SITE_STORY_NODE.M2_MATERIALS,
    interaction_mode: STORY_INTERACTION_MODE.SITE_COMPOSITE,
    module_id: SITE_STORY_MODULE.M2,
    required_sections: Object.freeze([
      'frame',
      'solar',
      'insulation',
      'propulsion',
    ]),
    trigger_mode: STORY_TRIGGER_MODE.ON_STAGE_CONFIRM,
    legacy_option_fallback: false,
    waiting_prompt: Object.freeze({
      zh: '请在页面的卫星材料区域完成四个部件选择，再使用原有“生成材料分析”按钮推进故事。',
      en: 'Complete all four material sections in the main page, then use the existing Analyze materials button to continue the story.',
    }),
    checkpoint: CHECKPOINT.MATERIALS,
    next_checkpoint: CHECKPOINT.MISSION,
  }),
  [SITE_STORY_NODE.M3_MISSION]: Object.freeze({
    node_id: SITE_STORY_NODE.M3_MISSION,
    interaction_mode: STORY_INTERACTION_MODE.SITE_GROUP_SINGLE,
    module_id: SITE_STORY_MODULE.M3,
    required_sections: Object.freeze(['mission_candidates']),
    trigger_mode: STORY_TRIGGER_MODE.ON_GROUP_CONFIRM,
    legacy_option_fallback: false,
    waiting_prompt: Object.freeze({
      zh: '请先在任务候选区域选择一项卫星任务，再使用原有确认按钮推进故事。',
      en: 'Select one satellite mission in the mission candidates area, then use the existing confirm button to continue the story.',
    }),
    checkpoint: CHECKPOINT.MISSION,
    next_checkpoint: CHECKPOINT.ORBITAL_EVENTS,
  }),
  node_04: Object.freeze({
    node_id: 'node_04',
    interaction_mode: STORY_INTERACTION_MODE.SITE_GAME_RESULT,
    module_id: SITE_STORY_MODULE.M4,
    required_sections: Object.freeze([]),
    trigger_mode: STORY_TRIGGER_MODE.ON_CONTROL_CLICK,
    legacy_option_fallback: false,
    waiting_prompt: Object.freeze({
      zh: '请在右侧轨道事件面板确认答案；故事将在后台按节点顺序生成，游戏无需等待。',
      en: 'Confirm the answer in the orbital-event panel. Story stages generate in order without blocking the game.',
    }),
    checkpoint: CHECKPOINT.ORBITAL_EVENTS,
    next_checkpoint: CHECKPOINT.CLEANUP,
  }),
  node_05: Object.freeze({
    node_id: 'node_05',
    interaction_mode: STORY_INTERACTION_MODE.SITE_MATCHING_GAME,
    module_id: SITE_STORY_MODULE.M6,
    required_sections: Object.freeze([]),
    trigger_mode: STORY_TRIGGER_MODE.ON_GAME_COMPLETE,
    legacy_option_fallback: false,
    waiting_prompt: Object.freeze({
      zh: '请在清理方式小测试中完成三组真实配对，再提交结果生成最终知识揭示。',
      en: 'Complete the three cleanup matches in the main page, then submit the result to generate the final knowledge reveal.',
    }),
    checkpoint: CHECKPOINT.CLEANUP,
    next_checkpoint: CHECKPOINT.COMPLETED,
  }),
})

export function resolveNodeInteractionConfig(nodeId) {
  const config = STORY_NODE_INTERACTIONS[nodeId]
  if (!config) {
    if (INTERACTIVE_NODE_IDS.includes(nodeId)) {
      throw new StoryError(
        'NODE_INTERACTION_CONFIG_MISSING',
        `No interaction configuration exists for ${nodeId}.`,
        500,
      )
    }
    return null
  }
  return structuredClone(config)
}

export function isLegacyStoryNode(nodeId) {
  return resolveNodeInteractionConfig(nodeId)?.interaction_mode
    === STORY_INTERACTION_MODE.LEGACY_STORY_OPTION
}
