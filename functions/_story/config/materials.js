const material = ({
  componentId,
  optionId,
  label,
  labelEn,
  fuelModifier,
  armorModifier,
  reentryProfile,
  massBurden,
  structuralResilience,
  feature,
  featureEn,
  storyTag,
}) => ({
  component_id: componentId,
  option_id: optionId,
  label,
  label_en: labelEn,
  technical_effect: {
    fuel_modifier: fuelModifier,
    armor_modifier: armorModifier,
    reentry_profile: reentryProfile,
    mass_burden: massBurden,
    structural_resilience: structuralResilience,
    feature,
    feature_en: featureEn,
  },
  narrative_effect: {
    add_confirmed_fact: `${label}被用于卫星的${componentId}部件。`,
    add_story_tag: storyTag,
  },
})

export const MATERIAL_OPTIONS = [
  material({
    componentId: 'frame', optionId: 'aluminum', label: '铝合金', labelEn: 'Aluminum Alloy 6061-T6',
    fuelModifier: 1, armorModifier: 1, reentryProfile: 'low', massBurden: 'low', structuralResilience: 'medium',
    feature: '轻量 · 应用成熟 · 性能均衡', featureEn: 'Lightweight · Mature application · Balanced performance', storyTag: 'frame_aluminum',
  }),
  material({
    componentId: 'frame', optionId: 'cfrp', label: '碳纤维复合材料', labelEn: 'Carbon Fiber Composite CFRP',
    fuelModifier: 3, armorModifier: 0, reentryProfile: 'medium', massBurden: 'very_low', structuralResilience: 'medium',
    feature: '很轻 · 高比强度 · 结构复杂', featureEn: 'Very light · High strength-to-weight ratio · Complex structure', storyTag: 'frame_cfrp',
  }),
  material({
    componentId: 'frame', optionId: 'titanium', label: '钛合金', labelEn: 'Titanium Alloy Ti-6Al-4V',
    fuelModifier: -2, armorModifier: 3, reentryProfile: 'high', massBurden: 'high', structuralResilience: 'high',
    feature: '高强度 · 耐高温 · 质量较大', featureEn: 'High strength · Heat resistant · Higher mass', storyTag: 'frame_titanium',
  }),
  material({
    componentId: 'solar', optionId: 'silicon', label: '硅基刚性电池板', labelEn: 'Rigid Silicon Solar Panel',
    fuelModifier: 0, armorModifier: 1, reentryProfile: 'medium', massBurden: 'medium', structuralResilience: 'medium',
    feature: '技术成熟 · 结构稳定 · 质量适中', featureEn: 'Mature technology · Stable structure · Moderate mass', storyTag: 'solar_silicon',
  }),
  material({
    componentId: 'solar', optionId: 'gaas', label: '砷化镓多结电池板', labelEn: 'GaAs Multi-Junction Solar Panel',
    fuelModifier: 1, armorModifier: 1, reentryProfile: 'medium', massBurden: 'medium', structuralResilience: 'medium',
    feature: '转换效率高 · 功率密度高 · 结构紧凑', featureEn: 'High conversion efficiency · High power density · Compact structure', storyTag: 'solar_gaas',
  }),
  material({
    componentId: 'solar', optionId: 'flexible', label: '柔性薄膜阵列', labelEn: 'Flexible Thin-Film Array',
    fuelModifier: 2, armorModifier: -1, reentryProfile: 'low', massBurden: 'low', structuralResilience: 'low',
    feature: '轻薄 · 可展开 · 结构柔性', featureEn: 'Light and thin · Deployable · Flexible structure', storyTag: 'solar_flexible',
  }),
  material({
    componentId: 'insulation', optionId: 'aluminized', label: '镀铝聚酯薄膜', labelEn: 'Aluminized Polyester Film',
    fuelModifier: 1, armorModifier: -1, reentryProfile: 'low', massBurden: 'low', structuralResilience: 'low',
    feature: '非常轻 · 基础隔热 · 结构简单', featureEn: 'Very light · Basic insulation · Simple structure', storyTag: 'insulation_aluminized',
  }),
  material({
    componentId: 'insulation', optionId: 'kapton', label: '镀铝聚酰亚胺薄膜', labelEn: 'Aluminized Polyimide Film',
    fuelModifier: 1, armorModifier: 1, reentryProfile: 'low', massBurden: 'low', structuralResilience: 'medium',
    feature: '轻量 · 耐热较好 · 应用广泛', featureEn: 'Lightweight · Good heat resistance · Widely used', storyTag: 'insulation_kapton',
  }),
  material({
    componentId: 'insulation', optionId: 'ceramic', label: '玻璃纤维外层材料', labelEn: 'Fiberglass Outer Layer',
    fuelModifier: -1, armorModifier: 2, reentryProfile: 'medium', massBurden: 'medium', structuralResilience: 'high',
    feature: '耐热 · 更坚韧 · 质量较高', featureEn: 'Heat resistant · More durable · Higher mass', storyTag: 'insulation_ceramic',
  }),
  material({
    componentId: 'propulsion', optionId: 'aluminum-tank', label: '铝合金贮箱', labelEn: 'Aluminum Propellant Tank',
    fuelModifier: 1, armorModifier: 1, reentryProfile: 'low', massBurden: 'low', structuralResilience: 'medium',
    feature: '轻量 · 技术成熟 · 性能均衡', featureEn: 'Lightweight · Mature technology · Balanced performance', storyTag: 'propulsion_aluminum',
  }),
  material({
    componentId: 'propulsion', optionId: 'composite-tank', label: '复合材料缠绕贮箱', labelEn: 'Composite Overwrapped Propellant Tank',
    fuelModifier: 2, armorModifier: 1, reentryProfile: 'medium', massBurden: 'very_low', structuralResilience: 'medium',
    feature: '很轻 · 高比强度 · 结构复杂', featureEn: 'Very light · High strength-to-weight ratio · Complex structure', storyTag: 'propulsion_composite',
  }),
  material({
    componentId: 'propulsion', optionId: 'titanium-tank', label: '钛合金贮箱', labelEn: 'Titanium Propellant Tank',
    fuelModifier: -2, armorModifier: 3, reentryProfile: 'high', massBurden: 'high', structuralResilience: 'high',
    feature: '高强度 · 耐高温 · 质量较大', featureEn: 'High strength · Heat resistant · Higher mass', storyTag: 'propulsion_titanium',
  }),
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

function clampMetric(value) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

function aggregateMaterialRisk(options) {
  const profiles = new Set(
    options.map((item) => item.technical_effect.reentry_profile),
  )
  return profiles.size === 1 ? [...profiles][0] : 'mixed'
}

export function calculateMaterialBuildMetrics(selections, baseMetrics) {
  const selected = MATERIAL_COMPONENTS.map((componentId) => {
    const option = getMaterialOption(componentId, selections?.[componentId])
    if (!option) throw new Error(`Invalid material for ${componentId}.`)
    return option
  })
  const fuelModifier = selected.reduce(
    (total, item) => total + item.technical_effect.fuel_modifier,
    0,
  )
  const armorModifier = selected.reduce(
    (total, item) => total + item.technical_effect.armor_modifier,
    0,
  )

  return {
    fuel: clampMetric(Number(baseMetrics?.fuel || 0) + fuelModifier),
    armor: clampMetric(Number(baseMetrics?.armor || 0) + armorModifier),
    reentry_risk: aggregateMaterialRisk(selected),
    reentry_profiles: Object.fromEntries(selected.map((item) => [
      item.component_id,
      item.technical_effect.reentry_profile,
    ])),
  }
}
