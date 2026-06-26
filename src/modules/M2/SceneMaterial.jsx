import React from 'react'

export const PART_ACCENT = {
  frame: '#6b7fff',
  solar: '#38bdf8',
  insulation: '#fbbf24',
  propulsion: '#34d399',
}

export const PARTS = [
  {
    id: 'frame',
    label: '主框架结构',
    labelEn: 'PRIMARY STRUCTURE',
    desc: '卫星承力骨架，质量占比最高，决定碰撞后碎片的存活率。',
    options: [
      {
        id: 'aluminum',
        label: '铝合金',
        en: 'Aluminum Alloy 6061-T6',
        feature: '熔点约 660°C，再入时大多会在大气层烧蚀，地面存活率低，适合低轨任务。',
        shortFeature: '再入烧蚀充分，地面风险低',
        risk: 'low',
      },
      {
        id: 'titanium',
        label: '钛合金',
        en: 'Titanium Alloy Ti-6Al-4V',
        feature: '熔点高、强度高，较大部件更可能穿过再入热流到达地面。',
        shortFeature: '存活率高，地面风险高',
        risk: 'high',
      },
      {
        id: 'cfrp',
        label: '碳纤维复合材料',
        en: 'Carbon Fiber Composite CFRP',
        feature: '质量轻但分解过程复杂，可能形成纤维状残片，分布范围更广。',
        shortFeature: '轻量高强，残片分散',
        risk: 'medium',
      },
    ],
  },
  {
    id: 'solar',
    label: '太阳能电池板',
    labelEn: 'SOLAR ARRAY',
    desc: '面积最大的外露结构，也是微小碎片和再入残片的重要来源。',
    options: [
      {
        id: 'silicon',
        label: '硅基电池板',
        en: 'Silicon Cell + Glass Cover',
        feature: '玻璃盖片和硅片在再入中容易碎裂烧蚀，技术成熟、风险较低。',
        shortFeature: '成熟可靠，残留少',
        risk: 'low',
      },
      {
        id: 'gaas',
        label: '砷化镓电池板',
        en: 'GaAs Multi-Junction Cell',
        feature: '效率高但材料层复杂，高温下可能形成少量残留颗粒。',
        shortFeature: '效率高，残留中等',
        risk: 'medium',
      },
      {
        id: 'flexible',
        label: '柔性薄膜电池板',
        en: 'Flexible Thin-Film Array',
        feature: '薄膜结构质量低，碎裂后阻力大，通常更容易在再入中烧蚀。',
        shortFeature: '质量低，烧蚀快',
        risk: 'low',
      },
    ],
  },
  {
    id: 'insulation',
    label: '隔热防护层',
    labelEn: 'THERMAL INSULATION',
    desc: '热控材料会长期经历冷热循环，剥离后容易形成轻薄碎片。',
    options: [
      {
        id: 'kapton',
        label: '聚酰亚胺薄膜',
        en: 'Kapton MLI Film',
        feature: '常见多层隔热材料，轻薄、易卷曲，通常会在再入过程中迅速烧蚀。',
        shortFeature: '轻薄易烧蚀',
        risk: 'low',
      },
      {
        id: 'ceramic',
        label: '陶瓷隔热片',
        en: 'Ceramic Tile',
        feature: '耐高温能力强，小块陶瓷片可能在再入后仍保留部分结构。',
        shortFeature: '耐热强，残留风险高',
        risk: 'high',
      },
      {
        id: 'aluminized',
        label: '镀铝薄膜',
        en: 'Aluminized Film',
        feature: '反射性能好，质量低，碎片通常面积大但质量小。',
        shortFeature: '面积大，质量小',
        risk: 'medium',
      },
    ],
  },
  {
    id: 'propulsion',
    label: '推进系统',
    labelEn: 'PROPULSION SYSTEM',
    desc: '推进剂贮箱和阀体是历史上最常见的地面残骸类型之一。',
    options: [
      {
        id: 'aluminum-tank',
        label: '铝合金贮箱',
        en: 'Aluminum Propellant Tank',
        feature: '质量较轻，再入时较容易烧蚀或破裂，残留风险相对低。',
        shortFeature: '轻量，残留少',
        risk: 'low',
      },
      {
        id: 'titanium-tank',
        label: '钛合金贮箱',
        en: 'Titanium Pressure Vessel',
        feature: '耐压耐热，球形或厚壁部件容易存活，是高风险残骸。',
        shortFeature: '厚壁耐热，风险高',
        risk: 'high',
      },
      {
        id: 'composite-tank',
        label: '复合材料贮箱',
        en: 'Composite Overwrapped Pressure Vessel',
        feature: '外层复合材料会分解，金属内胆仍可能形成中等风险残留。',
        shortFeature: '分层烧蚀，风险中等',
        risk: 'medium',
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
