const material = (
  componentId,
  optionId,
  label,
  labelEn,
  risk,
  feature,
  storyTag,
) => ({
  component_id: componentId,
  option_id: optionId,
  label,
  label_en: labelEn,
  technical_effect: { reentry_risk: risk, feature },
  narrative_effect: {
    add_confirmed_fact: `${label}被用于卫星的${componentId}部件。`,
    add_story_tag: storyTag,
  },
})

export const MATERIAL_OPTIONS = [
  material('frame', 'aluminum', '铝合金', 'Aluminum Alloy 6061-T6', 'low', '再入烧蚀充分，地面风险低', 'frame_aluminum'),
  material('frame', 'titanium', '钛合金', 'Titanium Alloy Ti-6Al-4V', 'high', '存活率高，地面风险高', 'frame_titanium'),
  material('frame', 'cfrp', '碳纤维复合材料', 'Carbon Fiber Composite CFRP', 'medium', '轻量高强，残片分散', 'frame_cfrp'),
  material('solar', 'silicon', '硅基电池板', 'Silicon Cell + Glass Cover', 'low', '成熟可靠，残留少', 'solar_silicon'),
  material('solar', 'gaas', '砷化镓电池板', 'GaAs Multi-Junction Cell', 'medium', '效率高，残留中等', 'solar_gaas'),
  material('solar', 'flexible', '柔性薄膜电池板', 'Flexible Thin-Film Array', 'low', '质量低，烧蚀快', 'solar_flexible'),
  material('insulation', 'kapton', '聚酰亚胺薄膜', 'Kapton MLI Film', 'low', '轻薄易烧蚀', 'insulation_kapton'),
  material('insulation', 'ceramic', '陶瓷隔热片', 'Ceramic Tile', 'high', '耐热强，残留风险高', 'insulation_ceramic'),
  material('insulation', 'aluminized', '镀铝薄膜', 'Aluminized Film', 'medium', '面积大，质量小', 'insulation_aluminized'),
  material('propulsion', 'aluminum-tank', '铝合金贮箱', 'Aluminum Propellant Tank', 'low', '轻量，残留少', 'propulsion_aluminum'),
  material('propulsion', 'titanium-tank', '钛合金贮箱', 'Titanium Pressure Vessel', 'high', '厚壁耐热，风险高', 'propulsion_titanium'),
  material('propulsion', 'composite-tank', '复合材料贮箱', 'Composite Overwrapped Pressure Vessel', 'medium', '分层烧蚀，风险中等', 'propulsion_composite'),
]

export const MATERIAL_COMPONENTS = Object.freeze(['frame', 'solar', 'insulation', 'propulsion'])

export const MATERIAL_BY_COMPONENT = Object.freeze(
  Object.fromEntries(MATERIAL_COMPONENTS.map((componentId) => [
    componentId,
    Object.fromEntries(
      MATERIAL_OPTIONS
        .filter((item) => item.component_id === componentId)
        .map((item) => [item.option_id, item]),
    ),
  ])),
)

export function getMaterialOption(componentId, optionId) {
  return MATERIAL_BY_COMPONENT[componentId]?.[optionId] || null
}
