import {
  MATERIAL_COMPONENTS,
  MATERIAL_OPTIONS,
} from './materials.js'
import {
  SITE_STORY_MODULE,
  SITE_STORY_NODE,
  STORY_INTERACTION_MODE,
} from './node-interactions.js'

const UNCONFIRMED_MATERIAL_STORY_DELTA = Object.freeze({
  event_integrity: 0,
  relationship_connection: 0,
  uncertainty: 0,
})

const MATERIAL_SECTION_NAMES = Object.freeze({
  frame: '主框架结构',
  solar: '太阳能电池板',
  insulation: '隔热防护层',
  propulsion: '推进系统',
})

const DESIGN_TRADEOFFS = Object.freeze({
  low: ['更容易在再入热流中烧蚀，通常可降低完整残骸到达地面的可能性。'],
  medium: ['在结构或功能收益与再入残留之间保留折中，需要结合部件形态继续评估。'],
  high: ['耐热或结构保持能力更强，但较完整残骸存活到低空的风险也可能更高。'],
})

const DEBRIS_RELEVANCE = Object.freeze({
  frame: ['主框架质量占比较高，解体后的尺寸、形态与耐热性会显著影响再入残留。'],
  solar: ['太阳翼面积大且外露，碰撞时容易形成玻璃、薄片或柔性膜类碎片。'],
  insulation: ['热控层长期经历冷热循环，剥离后可能形成面积大、质量小的薄片碎片。'],
  propulsion: ['贮箱和压力容器的壁厚、材料与几何形态会影响其再入存活能力。'],
})

export function materialControlId(sectionId, optionId) {
  return `m2-material-${sectionId}-${optionId}`
}

function effectSummary(material) {
  return `${MATERIAL_SECTION_NAMES[material.component_id]}采用${material.label}；${material.technical_effect.feature}。这项已确认的工程取舍共同影响卫星任务条件与后续碎片风险。`
}

function materialBinding(material) {
  return Object.freeze({
    binding_id: `m2:${material.component_id}:${material.option_id}`,
    module_id: SITE_STORY_MODULE.M2,
    section_id: material.component_id,
    control_id: materialControlId(material.component_id, material.option_id),
    option_id: material.option_id,
    target_node_id: SITE_STORY_NODE.M2_MATERIALS,
    interaction_mode: STORY_INTERACTION_MODE.SITE_COMPOSITE,
    display_snapshot: Object.freeze({
      section_name: MATERIAL_SECTION_NAMES[material.component_id],
      option_name: material.label,
    }),
    effect_summary: effectSummary(material),
    // No approved narrative metric table exists for materials yet. Keep the
    // binding neutral instead of inferring story values from UI risk labels.
    state_delta: UNCONFIRMED_MATERIAL_STORY_DELTA,
    add_consequence_ids: Object.freeze([]),
    resolve_consequence_ids: Object.freeze([]),
    key_outcome: `${MATERIAL_SECTION_NAMES[material.component_id]}确认使用${material.label}。`,
    knowledge_profile: Object.freeze({
      keywords: Object.freeze([
        material.label,
        MATERIAL_SECTION_NAMES[material.component_id],
        material.technical_effect.reentry_risk,
      ]),
      safe_facts: Object.freeze([material.technical_effect.feature]),
      design_tradeoffs: Object.freeze(DESIGN_TRADEOFFS[material.technical_effect.reentry_risk]),
      debris_relevance: Object.freeze(DEBRIS_RELEVANCE[material.component_id]),
    }),
  })
}

export const MATERIAL_STORY_BINDINGS = Object.freeze(
  MATERIAL_OPTIONS.map(materialBinding),
)

const BINDING_BY_SECTION = Object.freeze(
  Object.fromEntries(MATERIAL_COMPONENTS.map((sectionId) => [
    sectionId,
    Object.fromEntries(
      MATERIAL_STORY_BINDINGS
        .filter((binding) => binding.section_id === sectionId)
        .map((binding) => [binding.option_id, binding]),
    ),
  ])),
)

export function resolveMaterialStoryBinding({
  moduleId,
  sectionId,
  controlId,
  optionId,
}) {
  if (moduleId !== SITE_STORY_MODULE.M2) return null
  const binding = BINDING_BY_SECTION[sectionId]?.[optionId]
  if (!binding || binding.control_id !== controlId) return null
  return structuredClone(binding)
}
