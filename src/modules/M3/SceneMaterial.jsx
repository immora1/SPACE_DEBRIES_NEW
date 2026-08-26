import React from 'react'

export const PART_ACCENT = {
  frame: '#7da7e8',
  solar: '#b8d6ff',
  insulation: '#9fc4ff',
  propulsion: '#cfe3ff',
}

export const PARTS = [
  {
    id: 'frame',
    label: '主体结构',
    labelEn: 'Main Structure',
    desc: '承担卫星主要载荷并连接各系统，材料选择会改变整体质量与结构耐受。',
    descEn: 'Carries the satellite’s main loads and connects its systems, so material choice changes mass and structural resilience.',
    options: [
      {
        id: 'aluminum',
        label: '铝合金',
        en: 'Aluminum Alloy 6061-T6',
        shortFeature: '轻量 · 应用成熟 · 性能均衡',
        shortFeatureEn: 'Lightweight · Mature application · Balanced performance',
        massBurden: 'low',
        resilience: 'medium',
      },
      {
        id: 'cfrp',
        label: '碳纤维复合材料',
        en: 'Carbon Fiber Composite CFRP',
        shortFeature: '很轻 · 高比强度 · 结构复杂',
        shortFeatureEn: 'Very light · High strength-to-weight ratio · Complex structure',
        massBurden: 'very_low',
        resilience: 'medium',
      },
      {
        id: 'titanium',
        label: '钛合金',
        en: 'Titanium Alloy Ti-6Al-4V',
        shortFeature: '高强度 · 耐高温 · 质量较大',
        shortFeatureEn: 'High strength · Heat resistant · Higher mass',
        massBurden: 'high',
        resilience: 'high',
      },
    ],
  },
  {
    id: 'solar',
    label: '太阳能阵列',
    labelEn: 'Solar Array',
    desc: '为卫星提供电力，材料和结构方案会影响阵列质量与受力表现。',
    descEn: 'Supplies electrical power, while its materials and structure affect array mass and load tolerance.',
    options: [
      {
        id: 'silicon',
        label: '硅基刚性电池板',
        en: 'Rigid Silicon Solar Panel',
        shortFeature: '技术成熟 · 结构稳定 · 质量适中',
        shortFeatureEn: 'Mature technology · Stable structure · Moderate mass',
        massBurden: 'medium',
        resilience: 'medium',
      },
      {
        id: 'gaas',
        label: '砷化镓多结电池板',
        en: 'GaAs Multi-Junction Solar Panel',
        shortFeature: '转换效率高 · 功率密度高 · 结构紧凑',
        shortFeatureEn: 'High conversion efficiency · High power density · Compact structure',
        massBurden: 'medium',
        resilience: 'medium',
      },
      {
        id: 'flexible',
        label: '柔性薄膜阵列',
        en: 'Flexible Thin-Film Array',
        shortFeature: '轻薄 · 可展开 · 结构柔性',
        shortFeatureEn: 'Light and thin · Deployable · Flexible structure',
        massBurden: 'low',
        resilience: 'low',
      },
    ],
  },
  {
    id: 'insulation',
    label: '外部隔热层',
    labelEn: 'External Thermal Layer',
    desc: '帮助卫星应对轨道冷热循环，材料方案会改变质量与耐热耐受。',
    descEn: 'Helps the satellite withstand orbital temperature cycles, with material choice affecting mass and thermal resilience.',
    options: [
      {
        id: 'aluminized',
        label: '镀铝聚酯薄膜',
        en: 'Aluminized Polyester Film',
        shortFeature: '非常轻 · 基础隔热 · 结构简单',
        shortFeatureEn: 'Very light · Basic insulation · Simple structure',
        massBurden: 'low',
        resilience: 'low',
      },
      {
        id: 'kapton',
        label: '镀铝聚酰亚胺薄膜',
        en: 'Aluminized Polyimide Film',
        shortFeature: '轻量 · 耐热较好 · 应用广泛',
        shortFeatureEn: 'Lightweight · Good heat resistance · Widely used',
        massBurden: 'low',
        resilience: 'medium',
      },
      {
        id: 'ceramic',
        label: '玻璃纤维外层材料',
        en: 'Fiberglass Outer Layer',
        shortFeature: '耐热 · 更坚韧 · 质量较高',
        shortFeatureEn: 'Heat resistant · More durable · Higher mass',
        massBurden: 'medium',
        resilience: 'high',
      },
    ],
  },
  {
    id: 'propulsion',
    label: '推进剂贮箱',
    labelEn: 'Propellant Tank',
    desc: '储存轨道机动所需推进剂，贮箱材料会影响系统质量与结构耐受。',
    descEn: 'Stores propellant for orbital maneuvers, with tank materials affecting system mass and structural resilience.',
    options: [
      {
        id: 'aluminum-tank',
        label: '铝合金贮箱',
        en: 'Aluminum Propellant Tank',
        shortFeature: '轻量 · 技术成熟 · 性能均衡',
        shortFeatureEn: 'Lightweight · Mature technology · Balanced performance',
        massBurden: 'low',
        resilience: 'medium',
      },
      {
        id: 'composite-tank',
        label: '复合材料缠绕贮箱',
        en: 'Composite Overwrapped Propellant Tank',
        shortFeature: '很轻 · 高比强度 · 结构复杂',
        shortFeatureEn: 'Very light · High strength-to-weight ratio · Complex structure',
        massBurden: 'very_low',
        resilience: 'medium',
      },
      {
        id: 'titanium-tank',
        label: '钛合金贮箱',
        en: 'Titanium Propellant Tank',
        shortFeature: '高强度 · 耐高温 · 质量较大',
        shortFeatureEn: 'High strength · Heat resistant · Higher mass',
        massBurden: 'high',
        resilience: 'high',
      },
    ],
  },
]

export class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}
