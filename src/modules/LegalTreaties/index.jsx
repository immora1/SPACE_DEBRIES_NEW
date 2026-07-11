import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import './index.css'

const EASE = [0.16, 1, 0.3, 1]
const ROW_GAP = 18
const STACK_BASE = 80
const STACK_STEP = 5
const ACTIVE_PULL_BACK_Y = -48
const ACTIVE_PULL_FRONT_Y = -520
const DRAG_START_THRESHOLD = 4
const DRAG_OPEN_THRESHOLD = -42
const DRAG_OPEN_VELOCITY = -360
const RESET_AFTER_RETURN_MS = 1700
const FOLDER_TWEEN_TRANSITION = { duration: 0.58, ease: EASE }
const FOLDER_OPEN_TRANSITION = {
  ...FOLDER_TWEEN_TRANSITION,
  y: { duration: 0 },
}
const FOLDER_RETURN_TRANSITION = {
  type: 'spring',
  stiffness: 54,
  damping: 19,
  mass: 1.14,
  restDelta: 0.08,
  restSpeed: 1.6,
}
const FOLDER_RETURN_SETTLE_TRANSITION = { duration: 0 }

const TAB_LAYOUTS = [
  { x: 3, width: 28 },
  { x: 37, width: 30 },
  { x: 66, width: 28 },
  { x: 12, width: 28 },
  { x: 45, width: 28 },
  { x: 70, width: 25 },
]

function buildRoundedTabPath(topInsetPercent, bottomInsetPercent) {
  const bottomInset = Math.min(14, Math.max(1.5, bottomInsetPercent))
  const topInset = Math.min(28, Math.max(bottomInset + 7, topInsetPercent))
  const radius = Math.min(5.8, Math.max(3.8, (topInset - bottomInset) * 0.5))
  const slantOffset = Math.max(1.2, radius * 0.45)

  return [
    `M ${topInset + radius} 0`,
    `L ${100 - topInset - radius} 0`,
    `Q ${100 - topInset} 0 ${100 - topInset + slantOffset} ${radius}`,
    `L ${100 - bottomInset} 42`,
    `L ${100 - bottomInset} 46`,
    `L ${bottomInset} 46`,
    `L ${bottomInset} 42`,
    `L ${topInset - slantOffset} ${radius}`,
    `Q ${topInset} 0 ${topInset + radius} 0`,
    'Z',
  ].join(' ')
}

function buildRoundedTabOutlinePath(topInsetPercent, bottomInsetPercent) {
  const bottomInset = Math.min(14, Math.max(1.5, bottomInsetPercent))
  const topInset = Math.min(28, Math.max(bottomInset + 7, topInsetPercent))
  const radius = Math.min(5.8, Math.max(3.8, (topInset - bottomInset) * 0.5))
  const slantOffset = Math.max(1.2, radius * 0.45)

  return [
    `M ${bottomInset} 42`,
    `L ${topInset - slantOffset} ${radius}`,
    `Q ${topInset} 0 ${topInset + radius} 0`,
    `L ${100 - topInset - radius} 0`,
    `Q ${100 - topInset} 0 ${100 - topInset + slantOffset} ${radius}`,
    `L ${100 - bottomInset} 42`,
  ].join(' ')
}

function estimateTabWidth(title) {
  const titleWidth = Array.from(title).reduce((total, char) => {
    if (/[a-z0-9]/i.test(char)) return total + 7.2
    if (char === ' ' || char === '·' || char === ':' || char === '：') return total + 5.6
    return total + 13.4
  }, 0)

  return Math.ceil(titleWidth + 134)
}

const LAW_DOCUMENTS = [
  {
    kind: 'divider',
    id: 'divider-hard-law',
    title: '国际层面的法律框架',
    shortTitle: '国际法框架',
    kicker: 'SECTION 01',
    summary: '联合国外空法体系提供底层责任框架，但不是专门的垃圾治理制度。',
  },
  {
    id: 'outer-space',
    year: '1967',
    title: '外层空间条约',
    tag: '国际硬法',
    summary: '国家对本国政府和非政府实体的外空活动承担国际责任；登记国对空间物体保留管辖和控制。',
    limit: '它提供所有权、授权和国家责任底座，但没有细化太空垃圾清理义务。',
    points: ['私人企业外空活动也需国家授权和持续监督。', '登记国对空间物体保留管辖和控制。', '未规定碎片减缓、离轨期限或清理义务。'],
    source: 'UNOOSA / Outer Space Treaty',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/outerspacetreaty.html',
  },
  {
    id: 'liability',
    year: '1972',
    title: '空间物体责任公约',
    tag: '损害赔偿',
    summary: '发射国对空间物体在地面或飞行中航空器造成的损害承担绝对责任；外空损害通常涉及过错判断。',
    limit: '碎片来源、过错程度和赔偿责任很难在高速碰撞后被清楚证明。',
    points: ['地面或飞行中航空器损害通常适用绝对责任。', '外空损害更常进入过错判断。', '赔偿机制不足以处理日常轨道拥堵。'],
    source: 'UNOOSA / Liability Convention',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/liability-convention.html',
  },
  {
    id: 'registration',
    year: '1975',
    title: '空间物体登记公约',
    tag: '识别追踪',
    summary: '发射国需要登记空间物体，登记信息有助于确认卫星、火箭末级和相关碎片的来源。',
    limit: '登记不等于治理；小碎片、历史遗留物和复杂多国任务仍难追溯。',
    points: ['建立国家登记册并向联合国提交基本信息。', '有助于识别卫星、火箭末级和相关碎片来源。', '对无法追踪的小碎片和复杂多国任务处理有限。'],
    source: 'UNOOSA / Registration Convention',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/registration-convention.html',
  },
  {
    id: 'other-treaties',
    year: '1968+',
    title: '其他外空条约与原则',
    tag: '间接关联',
    summary: '宇航员救援、外空和平利用、国际合作和避免有害干扰等规则共同构成外空治理背景。',
    limit: '这些条约与太空垃圾关联较间接，无法单独构成碎片治理体系。',
    points: ['强调外空和平利用和国际合作。', '处理救援、归还、有害干扰等基础议题。', '对碎片清理、离轨和处罚缺少直接规则。'],
    source: 'UNOOSA / Space Law Treaties',
    href: 'https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties.html',
  },
  {
    kind: 'divider',
    id: 'divider-soft-law',
    title: '软法与技术标准',
    shortTitle: '软法标准',
    kicker: 'SECTION 02',
    summary: '真正直接讨论太空垃圾减缓的，多是准则、指南和工程标准。',
  },
  {
    id: 'mitigation',
    year: '2007',
    title: 'COPUOS 空间碎片减缓准则',
    tag: '联合国自愿性准则',
    summary: '限制正常运行释放碎片，减少爆炸和碰撞风险，并要求任务结束后处理低轨和地球同步轨道相关残留物。',
    limit: '属于自愿性准则，影响力依赖各国主动采纳与转化。',
    points: ['限制任务中释放碎片。', '减少在轨爆炸和碰撞风险。', '要求任务后处置 LEO 与 GEO 相关残留物。'],
    source: 'COPUOS / Space Debris Mitigation Guidelines',
    href: 'https://www.unoosa.org/pdf/publications/st_space_49E.pdf',
  },
  {
    id: 'lts-guidelines',
    year: '2019',
    title: '外空活动长期可持续性准则',
    tag: 'LTS 准则',
    summary: '涵盖政策监管、空间运行安全、国际合作、能力建设、科学技术研发等长期可持续性议题。',
    limit: '强调可持续，但缺少硬约束和全球执法机制。',
    points: ['推动政策监管和空间运行安全。', '鼓励轨道数据共享与国际合作。', '依靠国家和机构自愿落实。'],
    source: 'UNOOSA / Long-term Sustainability',
    href: 'https://www.unoosa.org/oosa/en/ourwork/topics/long-term-sustainability-of-outer-space-activities.html',
  },
  {
    id: 'iadc-guidelines',
    year: 'IADC',
    title: '空间碎片减缓指南',
    tag: '机构技术指南',
    summary: '面向航天器和运载火箭末级，覆盖任务规划、设计、运行和处置。',
    limit: '工程上可操作，但本身法律效力有限。',
    points: ['针对航天器和运载火箭末级。', '将碎片减缓嵌入任务规划和设计。', '常通过机构政策、许可或合同间接生效。'],
    source: 'IADC / Space Debris Mitigation Guidelines',
    href: 'https://www.unoosa.org/res/oosadoc/data/documents/2025/aac_105c_12025crp/aac_105c_12025crp_9_0_html/AC105_C1_2025_CRP09E.pdf',
  },
  {
    id: 'iso-24113',
    year: '2023',
    title: 'ISO 24113:2023',
    tag: '国际技术标准',
    summary: '定义适用于无人空间系统、火箭末级、运行航天器和任务释放物体的主要碎片减缓要求。',
    limit: '标准通常通过合同、发射许可、机构政策或行业合规要求间接生效。',
    points: ['覆盖无人空间系统、火箭末级和运行航天器。', '把治理目标转化为设计、运行和处置要求。', '是技术门槛，不等同全球强制法律。'],
    source: 'ISO / 24113:2023',
    href: 'https://www.iso.org/standard/83494.html',
  },
  {
    id: 'esa-zero-debris',
    year: '2023 / 2030',
    title: 'ESA 空间碎片减缓政策',
    tag: '机构政策',
    summary: '以 2030 零碎片为目标，要求限制正常运行碎片、降低在轨解体风险、防止碰撞并执行任务后处置。',
    limit: '机构先行，但主要约束 ESA 及相关合作项目，不能替代全球法律。',
    points: ['任务初期即考虑减缓和安全措施。', '降低在轨解体与碰撞风险。', '朝 2030 年“零碎片”方向推进。'],
    source: 'ESA / Space Debris Mitigation Policy',
    href: 'https://technology.esa.int/upload/media/ESA-ADMIN-IPOL-2023-1-Space-Debris-Mitigation-Policy-Final.pdf',
  },
  {
    kind: 'divider',
    id: 'divider-national',
    title: '代表性国家与地区监管',
    shortTitle: '国家监管',
    kicker: 'SECTION 03',
    summary: '发射许可、频谱许可、轨道运营许可和任务后处置计划，是目前最实际的治理入口。',
  },
  {
    id: 'us-fcc',
    year: '2019+',
    title: '美国：FCC 与政府减缓实践',
    tag: '许可与频谱监管',
    summary: 'FCC 将低轨卫星任务结束后的离轨期限压缩到 5 年，美国政府也有轨道碎片减缓标准实践。',
    limit: 'FCC 管辖范围不能覆盖全部空间活动，火箭末级、非通信任务和国际运营仍需其他机制协调。',
    points: ['低轨卫星任务后离轨期限趋向 5 年。', '通过频谱和通信卫星许可施加约束。', '无法单独覆盖全部空间活动。'],
    source: 'FCC / 5-year deorbit rule',
    href: 'https://www.fcc.gov/document/fcc-adopts-new-5-year-rule-deorbiting-satellites-0',
  },
  {
    id: 'eu-space-act',
    year: '2025',
    title: '欧盟：EU Space Act',
    tag: '统一市场与空间安全',
    summary: '欧盟委员会提出围绕安全、韧性、可持续性建立统一框架，并包括空间物体跟踪和碎片减缓规则。',
    limit: '截至文档整理时间仍处于立法程序，尚未形成最终稳定文本。',
    points: ['试图建立欧盟层面的统一空间规则。', '关注空间物体跟踪、碎片减缓和可持续性。', '仍需等待最终立法文本。'],
    source: 'European Commission / EU Space Act',
    href: 'https://defence-industry-space.ec.europa.eu/eu-space-act_en',
  },
  {
    id: 'france-fsoa',
    year: 'FSOA',
    title: '法国：空间操作授权',
    tag: '技术法规',
    summary: '法国 FSOA 技术法规要求运营方满足授权条件，覆盖运行中碎片限制、碰撞风险管理、空间可持续性和再入风险。',
    limit: '体系较完整，但仍只在法国管辖范围内有效。',
    points: ['以空间操作授权为监管入口。', '覆盖碰撞风险、再入风险和运行碎片限制。', '国家规则无法直接替代全球制度。'],
    source: 'CNES / FSOA technical regulations',
    href: 'https://spacecare.cnes.fr/en/the-fsoa-orbital-systems-office/technical-regulations/',
  },
  {
    id: 'uk-caa',
    year: 'CAA',
    title: '英国：空间活动许可',
    tag: '发射与轨道运营监管',
    summary: '英国 CAA 通过空间活动许可监管发射、返回和轨道运营，并声明遵循 IADC 减缓指南和 LTS 准则。',
    limit: '依赖许可审查和运营者提交材料，国际一致性仍有限。',
    points: ['监管发射、返回和轨道运营。', '将 IADC 和 LTS 准则纳入许可审查语境。', '执行效果取决于许可材料和监管能力。'],
    source: 'UK CAA / Spaceflight regulation',
    href: 'https://www.caa.co.uk/space/about-the-space-team/legislation/',
  },
  {
    id: 'china-standards',
    year: '2025',
    title: '中国：发射许可、登记与安全管理',
    tag: '技术标准与管理要求',
    summary: '相关规定要求低于或等于 2000 km 的微小卫星任务结束后轨道驻留时间小于 25 年；高于 2000 km 的进入坟墓轨道或非常用轨道。',
    limit: '仍在提高相关法规层级、量化标准和责任主体清晰度。',
    points: ['强调避免脱落、丢弃、抛洒和爆炸。', 'LEO 微小卫星任务后驻留时间小于 25 年。', '高轨任务进入坟墓轨道或非常用轨道。'],
    source: 'CNSA / UNOOSA technical presentation',
    href: 'https://www.unoosa.org/documents/pdf/copuos/stsc/2025/ListOfTechnicalPresentations/3_%20Wednesday5th%20/3a_-_NEW_CHINA_Space_debris_mitigation_regulations_and_technical_standards_of_China_Ms._Liu_Jing_China_1.pdf',
  },
  {
    id: 'japan-space-activities',
    year: '2023',
    title: '日本：空间活动法与许可',
    tag: '国家许可制度',
    summary: '日本在空间活动法框架下设置碎片减缓要求，包括防止部件散逸、避碰控制、低轨任务结束后 25 年以内离轨等。',
    limit: '重点仍是减缓新碎片，对历史碎片清除和国际协调依赖更大。',
    points: ['防止部件散逸。', '要求避碰控制。', '低轨任务结束后 25 年以内离轨。'],
    source: 'Japan / COPUOS LSC statement',
    href: 'https://www.unoosa.org/documents/pdf/copuos/lsc/2023/Statements/24_PM/11_Japan_24_Mar_PM.pdf',
  },
  {
    kind: 'divider',
    id: 'divider-gaps',
    title: '现有法律体系的主要不足',
    shortTitle: '制度缺口',
    kicker: 'SECTION 04',
    summary: '法律不是空白，但难以应对商业航天、巨型星座和历史遗留碎片带来的新问题。',
  },
  {
    id: 'overview',
    year: 'SUMMARY',
    title: '规则已经出现，治理仍然松散',
    tag: '一页总结',
    summary: '当前体系由国际条约、联合国准则、技术标准和国内许可制度共同构成，但尚未形成全球统一、强制执行、专门治理太空垃圾的国际法。',
    limit: '现有制度更像“责任框架 + 自愿减缓 + 各国监管”，对历史遗留碎片、主动清除义务、跨国执法和赔偿追责仍存在明显不足。',
    points: ['国际硬法确定责任、赔偿和登记底座。', '软法与标准更贴近工程实践，但依赖国家转化。', '国内监管最实际，却标准不一、管辖有限。'],
    source: 'Docx / 一页总结',
  },
  {
    id: 'gap-no-treaty',
    year: 'GAP 01',
    title: '缺少专门、统一、强制的全球公约',
    tag: '制度缺口',
    summary: '现有条约多为外空活动基础法，无法细致规定每类碎片的清理义务、技术标准和处罚方式。',
    limit: '有责任原则，但缺少真正指向轨道清理的全球硬法。',
    points: ['没有统一清理义务和处罚机制。', '离轨期限、风险阈值和技术要求仍分散。', '商业航天和巨型星座让旧框架承压。'],
    source: 'Docx / 主要不足',
  },
  {
    id: 'gap-soft-law',
    year: 'GAP 02',
    title: '软法准则多，执行依赖自愿',
    tag: '执行缺口',
    summary: 'COPUOS、IADC 和 ISO 的文件可以指导工程实践，却通常需要国家通过国内法、许可或合同转化后才具备约束力。',
    limit: '准则越多，不等于全球执行越强。',
    points: ['减缓规则常是建议性或技术性文件。', '执行依赖国家转化和运营方合规。', '缺少统一监督、处罚和补救路径。'],
    source: 'Docx / 主要不足',
  },
  {
    id: 'gap-standards',
    year: 'GAP 03',
    title: '各国标准不一致',
    tag: '监管碎片化',
    summary: '美国 FCC、ESA 等已经倾向更严格的 5 年任务后处置要求，而许多制度仍使用 25 年规则或更宽泛表述。',
    limit: '同一条轨道上运行的卫星，背后可能适用不同国家和机构标准。',
    points: ['5 年规则、25 年规则并存。', '国家许可、机构政策和行业标准强度不同。', '跨国任务容易落入多套规则交叉地带。'],
    source: 'Docx / 主要不足',
  },
  {
    id: 'gap-liability',
    year: 'GAP 04',
    title: '责任追究困难',
    tag: '证据困境',
    summary: '碎片高速运动、体积微小、来源复杂，碰撞后很难证明具体碎片来源、过错程度和赔偿责任。',
    limit: '法律能提出责任问题，但未必能在轨道事故后快速给出答案。',
    points: ['碎片来源识别困难。', '外空损害常涉及过错证明。', '高速碰撞后证据链容易断裂。'],
    source: 'Docx / 主要不足',
  },
  {
    id: 'gap-legacy',
    year: 'GAP 05',
    title: '历史遗留碎片缺少清理机制',
    tag: '旧垃圾问题',
    summary: '很多废弃卫星、火箭末级和爆炸碎片来自几十年前，现有规则更擅长约束未来任务。',
    limit: '“旧垃圾谁来清”仍是现有制度最难处理的问题之一。',
    points: ['历史碎片数量大、来源时间跨度长。', '现行许可制度更容易约束新任务。', '清理成本和责任分摊尚不清晰。'],
    source: 'Docx / 主要不足',
  },
  {
    id: 'gap-consent',
    year: 'GAP 06',
    title: '主动清除存在所有权和同意难题',
    tag: '清理授权',
    summary: '即使技术上能够捕获旧卫星或火箭残体，也需要处理该物体仍属于原发射国或所有者的问题。',
    limit: '未经同意接触他国空间物体，可能引发新的法律争议。',
    points: ['登记国通常保留管辖和控制。', '清除他国物体需要授权或合作。', '主动清除技术越成熟，法律同意问题越突出。'],
    source: 'Docx / 主要不足',
  },
  {
    id: 'gap-traffic',
    year: 'GAP 07',
    title: '缺少全球空间交通管理机制',
    tag: '协同缺口',
    summary: '碎片预警、轨道数据共享、机动避碰和碰撞责任仍由多个国家、机构和企业分散处理。',
    limit: '透明度和协同效率不足，使轨道风险难以及时统一管理。',
    points: ['空间态势感知数据分散。', '避碰规则和优先级尚未全球统一。', '交通管理缺口会放大连锁碰撞风险。'],
    source: 'Docx / 主要不足',
  },
  {
    kind: 'divider',
    id: 'divider-expressions',
    title: '项目展示表达',
    shortTitle: '展示表达',
    kicker: 'SECTION 05',
    summary: '这些句子用于把法律困境转化为可被观众理解的展示语言。',
  },
  {
    id: 'display-main-copy',
    year: 'COPY',
    title: '主文案与短句',
    tag: '展板表达',
    summary: '太空垃圾治理并非完全没有法律，而是现有法律停留在责任原则和自愿减缓层面，缺少统一、强制、可执行的全球清理机制。',
    limit: '短句：有规则，但没有真正能清理轨道的全球法律。',
    points: ['不是无法可依，而是规则不够硬。', '不是没人负责，而是很难落到清理行动。', '不是一个国家的问题，而是轨道共同使用的问题。'],
    source: 'Docx / 项目展示表达',
  },
  {
    id: 'display-model-copy',
    year: 'MODEL',
    title: '法槌与化石地球说明',
    tag: '模型说明',
    summary: '倾斜的法槌象征失衡的外空治理：法律已经落下阴影，却尚未形成足以约束所有轨道行为的力量。',
    limit: '被碎片包裹的地球像一件未来化石，记录着人类将现代技术遗留为轨道遗迹的过程。',
    points: ['法槌代表责任和审判。', '化石地球代表长期遗留。', '碎片轨道代表人类活动留下的制度压力。'],
    source: 'Docx / 项目展示表达',
  },
  {
    id: 'display-interaction-copy',
    year: 'PROMPT',
    title: '问题导向与交互提示',
    tag: '交互说明',
    summary: '当卫星退役、火箭残骸漂浮、碎片互相碰撞时，法律能确认责任，却不一定能及时清理风险。',
    limit: '点击不同轨道碎片，查看它背后可能涉及的国家责任、登记制度和清理空白。',
    points: ['退役卫星对应任务后处置。', '火箭残骸对应登记和发射国责任。', '碰撞碎片对应证据、过错与赔偿难题。'],
    source: 'Docx / 项目展示表达',
  },
  {
    kind: 'divider',
    id: 'divider-sources',
    title: '参考来源',
    shortTitle: '参考来源',
    kicker: 'SECTION 06',
    summary: '官方来源和机构文件用于后续核对和引用。',
  },
  {
    id: 'source-index',
    year: 'SOURCE',
    title: '官方来源索引',
    tag: '来源清单',
    summary: '来源包括 UNOOSA 外空条约、COPUOS 准则、IADC 指南、ISO 24113、FCC 5 年离轨规则、EU Space Act、ESA 政策、法国 FSOA、英国 CAA、中国技术标准与日本 COPUOS 声明。',
    limit: '本项目展示材料不构成正式法律意见；正式出版或论文仍需核验条约文本、国内法原文和最新立法进展。',
    points: ['联合国文件用于国际法底座。', 'IADC、ISO、ESA 文件用于技术减缓标准。', '各国监管材料用于展示许可制度差异。'],
    source: 'Docx / 参考来源',
  },
]

function buildArchiveItems(documents) {
  let section = '一页总结'
  let sectionIndex = 0
  let rowIndex = 0
  let documentIndex = 0
  const documentRows = documents.filter((document) => document.kind !== 'divider').length
  const dividerRows = documents.filter((document) => document.kind === 'divider').length
  const totalRows = documentRows + dividerRows

  function createArchiveItem(document, row, currentSection, currentSectionIndex) {
    const tab = TAB_LAYOUTS[row % TAB_LAYOUTS.length]
    const frontRatio = totalRows <= 1 ? 1 : row / (totalRows - 1)
    const rowY = row * ROW_GAP
    const pullY = ACTIVE_PULL_BACK_Y + (ACTIVE_PULL_FRONT_Y - ACTIVE_PULL_BACK_Y) * frontRatio

    const rowWidth = 700 + frontRatio * 210
    const rowInset = 1.8 + frontRatio * 10.2
    const tabDepthRatio = 1 - frontRatio
    const tabBottomInsetPercent = 2.2 + tabDepthRatio * 8.4
    const tabTopInsetPercent = tabBottomInsetPercent + 10.5 + tabDepthRatio * 2.2
    const tabLabelForWidth = document.kind === 'section-barrier'
      ? `${document.displayLabel ?? ''} ${document.title}`.trim()
      : document.title
    const minTabWidth = document.kind === 'section-barrier' ? 340 : 210
    const tabWidthPx = Math.min(rowWidth * 0.62, Math.max(minTabWidth, estimateTabWidth(tabLabelForWidth)))
    const tabWidthPercent = (tabWidthPx / rowWidth) * 100
    const tabInsetPx = tabWidthPx * (tabTopInsetPercent / 100)
    const tabBottomInsetPx = tabWidthPx * (tabBottomInsetPercent / 100)
    const tabX = Math.max(2, Math.min(tab.x, 98 - tabWidthPercent))

    return {
      ...document,
      section: currentSection,
      sectionIndex: currentSectionIndex,
      rowIndex: row,
      frontRatio,
      rowY,
      pullY,
      rowScale: 0.72 + frontRatio * 0.24,
      rowWidth,
      rowInset,
      tabInset: tabInsetPx,
      tabBottomInset: tabBottomInsetPx,
      tabPath: buildRoundedTabPath(tabTopInsetPercent, tabBottomInsetPercent),
      tabOutlinePath: buildRoundedTabOutlinePath(tabTopInsetPercent, tabBottomInsetPercent),
      tabX,
      tabWidth: tabWidthPx,
    }
  }

  return documents.flatMap((document) => {
    if (document.kind === 'divider') {
      sectionIndex += 1
      section = document.shortTitle ?? document.title

      const barrier = createArchiveItem({
        ...document,
        title: document.shortTitle ?? document.title,
        id: `section-barrier-${document.id}`,
        kind: 'section-barrier',
        displayLabel: document.kicker ?? `SECTION ${String(sectionIndex).padStart(2, '0')}`,
        year: document.kicker ?? `SECTION ${String(sectionIndex).padStart(2, '0')}`,
        tag: '板块挡板',
        source: '板块分隔',
        points: [],
        limit: document.summary,
      }, rowIndex, section, sectionIndex)

      rowIndex += 1
      return [barrier]
    }

    documentIndex += 1

    const item = createArchiveItem({
      ...document,
      displayLabel: String(documentIndex).padStart(2, '0'),
    }, rowIndex, section, sectionIndex)
    rowIndex += 1
    return [item]
  })
}

const ARCHIVE_ITEMS = buildArchiveItems(LAW_DOCUMENTS)
const LAW_FLOW_TEXT = ARCHIVE_ITEMS
  .filter((item) => item.kind !== 'section-barrier')
  .map((item) => item.title)
  .join('  ·  ')
const LAW_FLOW_MARQUEE_TEXT = `${LAW_FLOW_TEXT}  ·  ${LAW_FLOW_TEXT}  ·  `
const LAW_FLOW_LINES = [
  {
    id: 'upper-ledger',
    layerIndex: 2,
    fontSize: 18,
    duration: 42,
    offset: 0,
    opacity: 0.42,
    d: 'M -220 128 C 82 32 292 244 548 142 C 804 40 940 254 1164 154 C 1394 50 1558 250 1816 144 C 1998 70 2128 146 2240 112',
  },
  {
    id: 'standard-river',
    layerIndex: 8,
    fontSize: 18,
    duration: 45,
    offset: -180,
    opacity: 0.46,
    d: 'M -220 330 C 46 454 288 184 556 316 C 780 426 944 182 1168 304 C 1414 438 1560 192 1806 310 C 1990 398 2118 306 2240 354',
  },
  {
    id: 'liability-thread',
    layerIndex: 16,
    fontSize: 18,
    duration: 44,
    offset: -320,
    opacity: 0.5,
    d: 'M -230 498 C 56 382 292 662 560 506 C 806 362 958 658 1192 502 C 1420 350 1586 642 1830 488 C 2006 378 2118 510 2240 456',
  },
  {
    id: 'source-stream',
    layerIndex: 24,
    fontSize: 18,
    duration: 47,
    offset: -560,
    opacity: 0.48,
    d: 'M -240 732 C 48 836 304 548 588 710 C 832 850 986 554 1216 700 C 1450 844 1602 566 1842 688 C 2028 784 2134 662 2250 706',
  },
]

const stackVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      staggerDirection: -1,
    },
  },
}

const folderVariants = {
  hidden: (offset) => ({ opacity: 0, x: offset, y: 18 }),
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.72, ease: EASE },
  },
}

export default function LegalTreaties({ onComplete = () => {} }) {
  const { satellite, gameResult, setStoryChapter } = useAppStore()
  const [activeIndex, setActiveIndex] = useState(null)
  const [activeDragY, setActiveDragY] = useState(null)
  const [closingIndex, setClosingIndex] = useState(null)
  const [returningFolder, setReturningFolder] = useState({
    index: null,
    y: 0,
    phase: 'idle',
    scale: null,
  })
  const [resetState, setResetState] = useState({ index: null, version: 0 })
  const [isDraggingFolder, setIsDraggingFolder] = useState(false)
  const draggingRef = useRef(false)
  const dragSessionRef = useRef(null)
  const completedRef = useRef(false)
  const resetTimerRef = useRef(null)
  const resetPendingIndexRef = useRef(null)
  const returnFrameRef = useRef(null)
  const returnDelayTimerRef = useRef(null)
  const closeActiveFolderRef = useRef(null)

  const satelliteName = satellite?.name || '这颗卫星'
  const result = typeof gameResult === 'string' ? gameResult : gameResult?.result
  const resultLabel = result === 'success'
    ? '受控处置完成'
    : result === 'failure'
      ? '残骸风险未解除'
      : '任务记录已封存'
  const isFolderOpen = activeIndex !== null
  const isFlowPaused = isFolderOpen || isDraggingFolder

  useEffect(() => () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    if (returnDelayTimerRef.current) window.clearTimeout(returnDelayTimerRef.current)
    if (returnFrameRef.current) window.cancelAnimationFrame(returnFrameRef.current)
    dragSessionRef.current?.cleanup?.()
  }, [])

  useEffect(() => {
    if (completedRef.current) return
    completedRef.current = true

    setStoryChapter(
      'law',
      `${satelliteName}的任务记录进入法律档案：${resultLabel}。现有制度能确认责任、登记和许可，却还没有形成统一、强制、可执行的全球清理机制。`,
    )
    onComplete({ autoScroll: false })
  }, [onComplete, resultLabel, satelliteName, setStoryChapter])

  function finishPendingReset(index) {
    if (resetPendingIndexRef.current !== index) return

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }

    if (returnFrameRef.current) {
      window.cancelAnimationFrame(returnFrameRef.current)
      returnFrameRef.current = null
    }

    if (returnDelayTimerRef.current) {
      window.clearTimeout(returnDelayTimerRef.current)
      returnDelayTimerRef.current = null
    }

    resetPendingIndexRef.current = null
    setReturningFolder((current) => (
      current.index === index ? { index: null, y: 0, phase: 'idle', scale: null } : current
    ))
    setClosingIndex((current) => (current === index ? null : current))
    setResetState((current) => ({
      index,
      version: current.index === index ? current.version + 1 : 1,
    }))
  }

  function flushPendingReset() {
    const resetIndex = resetPendingIndexRef.current
    if (resetIndex === null) return

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }

    if (returnFrameRef.current) {
      window.cancelAnimationFrame(returnFrameRef.current)
      returnFrameRef.current = null
    }

    if (returnDelayTimerRef.current) {
      window.clearTimeout(returnDelayTimerRef.current)
      returnDelayTimerRef.current = null
    }

    resetPendingIndexRef.current = null
    setClosingIndex(null)
    setReturningFolder({ index: null, y: 0, phase: 'idle', scale: null })
  }

  function beginFolderReturn(folderIndex, returnY, returnScale) {
    if (resetPendingIndexRef.current === folderIndex) return

    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    if (returnFrameRef.current) window.cancelAnimationFrame(returnFrameRef.current)
    if (returnDelayTimerRef.current) window.clearTimeout(returnDelayTimerRef.current)

    setClosingIndex(folderIndex)
    setReturningFolder({
      index: folderIndex,
      y: returnY,
      phase: 'settle',
      scale: returnScale,
    })
    setIsDraggingFolder(false)
    resetPendingIndexRef.current = folderIndex

    returnFrameRef.current = null
    returnDelayTimerRef.current = window.setTimeout(() => {
      returnDelayTimerRef.current = null
      setReturningFolder((current) => (
        current.index === folderIndex && current.phase === 'settle'
          ? { ...current, phase: 'return' }
          : current
      ))
    }, 80)

    resetTimerRef.current = window.setTimeout(() => {
      finishPendingReset(folderIndex)
    }, RESET_AFTER_RETURN_MS)
  }

  function closeActiveFolder(returnYOverride) {
    const folderIndex = activeIndex
    if (folderIndex === null) return

    const document = ARCHIVE_ITEMS[folderIndex]
    const returnY = returnYOverride ?? activeDragY ?? document?.pullY ?? 0

    beginFolderReturn(folderIndex, returnY, 1.02)
    setActiveIndex(null)
    setActiveDragY(null)
  }

  closeActiveFolderRef.current = closeActiveFolder

  useEffect(() => {
    function handleDocumentPointerDown(event) {
      if (draggingRef.current || activeIndex === null) return
      if (event.target instanceof Element && event.target.closest('.law-folder')) return

      closeActiveFolderRef.current?.()
    }

    window.addEventListener('pointerdown', handleDocumentPointerDown, true)
    return () => window.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  }, [activeIndex])

  function handleFolderPointerDown(event, index, document, canDrag) {
    if (!canDrag || event.button !== 0) return

    dragSessionRef.current?.cleanup?.()
    event.preventDefault()

    const session = {
      pointerId: event.pointerId,
      index,
      element: event.currentTarget,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      currentY: 0,
      velocityY: 0,
      hasMoved: false,
      minY: Math.min(-260, document.pullY - 18),
      maxY: 28,
      cleanup: null,
    }

    function applyDirectY(nextY) {
      session.element.classList.add('is-direct-dragging')
      session.element.style.setProperty('--folder-offset-y', `${nextY}px`)
    }

    function clearDirectY() {
      session.element.classList.remove('is-direct-dragging')
      session.element.style.removeProperty('--folder-offset-y')
    }

    function releaseDirectY() {
      session.element.classList.remove('is-direct-dragging')
    }

    function clearDraggingFlag() {
      window.setTimeout(() => {
        draggingRef.current = false
        setIsDraggingFolder(false)
      }, 0)
    }

    function cleanup() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }

    function handlePointerMove(moveEvent) {
      if (moveEvent.pointerId !== session.pointerId) return

      const deltaY = moveEvent.clientY - session.startY
      if (!session.hasMoved && Math.abs(deltaY) < DRAG_START_THRESHOLD) return

      const elapsed = Math.max(1, moveEvent.timeStamp - session.lastTime)
      session.velocityY = ((moveEvent.clientY - session.lastY) / elapsed) * 1000
      session.lastY = moveEvent.clientY
      session.lastTime = moveEvent.timeStamp
      session.hasMoved = true
      draggingRef.current = true
      setIsDraggingFolder(true)

      session.currentY = Math.max(session.minY, Math.min(session.maxY, deltaY))
      applyDirectY(session.currentY)
      moveEvent.preventDefault()
    }

    function handlePointerEnd(endEvent) {
      if (endEvent.pointerId !== session.pointerId) return

      cleanup()
      dragSessionRef.current = null

      const finalY = session.currentY
      const shouldOpen = finalY < DRAG_OPEN_THRESHOLD || session.velocityY < DRAG_OPEN_VELOCITY

      if (session.hasMoved && shouldOpen) {
        flushSync(() => {
          flushPendingReset()
          setActiveDragY(finalY)
          setActiveIndex(index)
        })
        releaseDirectY()
      } else if (session.hasMoved) {
        flushSync(() => {
          beginFolderReturn(index, finalY, document.rowScale)
        })
        releaseDirectY()
      } else {
        clearDirectY()
      }

      clearDraggingFlag()
    }

    function handlePointerCancel(cancelEvent) {
      if (cancelEvent.pointerId !== session.pointerId) return

      cleanup()
      dragSessionRef.current = null

      if (session.hasMoved) {
        flushSync(() => {
          beginFolderReturn(index, session.currentY, document.rowScale)
        })
        releaseDirectY()
      } else {
        clearDirectY()
      }

      clearDraggingFlag()
    }

    session.cleanup = cleanup
    dragSessionRef.current = session
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerCancel)
  }

  function handleCardClick(event, index) {
    event.stopPropagation()

    if (draggingRef.current) return
    if (activeIndex !== null && activeIndex !== index) closeActiveFolder()
  }

  function handlePageClick() {
    if (draggingRef.current) return
    if (activeIndex !== null) closeActiveFolder()
  }

  return (
    <section
      className={['law-section', isFolderOpen ? 'is-folder-open' : ''].filter(Boolean).join(' ')}
      data-module-scroll-target
      aria-label="太空垃圾法律法规档案"
      onClick={handlePageClick}
    >
      <div className="law-grid" aria-hidden="true" />

      <div className="law-stage">
        <motion.div
          className="law-stage-label"
          initial={{ opacity: 0, y: -12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.58, ease: EASE }}
        >
          <span>M5</span>
          <span>LEGAL DOSSIERS</span>
        </motion.div>

        <motion.div
          className="law-corner-copy law-corner-copy--title"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.58, delay: 0.12, ease: EASE }}
        >
          <span>M5 / LEGAL DOSSIERS</span>
          <h2 aria-label="责任失重｜太空垃圾的法律盲区">
            <span className="law-title-line">责任失重｜</span>
            <span className="law-title-line">太空垃圾的法律盲区</span>
          </h2>
          <p>
            现有国际空间法虽然规定了发射国的责任，但对于碎片追踪、责任认定、主动清理和惩罚机制仍不完善。太空垃圾因此成为一种“有归属却难追责”的全球性问题，也暴露出人类进入太空后尚未建立完整治理秩序的现实。
          </p>
        </motion.div>

        <motion.div
          className={[
            'law-archive',
            activeIndex !== null ? 'has-active-folder' : '',
            isFlowPaused ? 'is-flow-paused' : '',
          ].filter(Boolean).join(' ')}
          variants={stackVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          aria-label="太空垃圾相关国际法律文件"
        >
          {/*
          <svg
            className="law-archive-box-plane law-archive-box-plane--left law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="84.5,-0.1 100,13 47,112 -38,101" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--right law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="16,0 0,13 53,112 138,101" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--rear law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="0,0 636,0 629,100 37,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--rear"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="0,0 640,0 629,100 37,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--left"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="84,0 100,13 47,112 -35,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--right"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="16.5,0 13,13 53,112 134,100" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--front law-archive-box-plane--copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="2.75,65 97,65 82,150 18,150" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--front-top"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="3,65 97,65 97,70.7 2.75,71" />
          </svg>
          <svg
            className="law-archive-box-plane law-archive-box-plane--front"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon points="3,65 97,65 82,150 18,150" />
          </svg>
          */}
          <div className="law-flow-field" aria-hidden="true">
            {LAW_FLOW_LINES.map((line) => (
              <svg
                key={line.id}
                className="law-flow-layer"
                viewBox="0 0 2000 840"
                preserveAspectRatio="none"
                style={{
                  '--flow-opacity': line.opacity,
                  '--flow-font-size': `${line.fontSize}px`,
                }}
                aria-hidden="true"
                focusable="false"
              >
                <path id={`law-flow-path-${line.id}`} d={line.d} fill="none" />
                <text className="law-flow-text">
                  <textPath
                    href={`#law-flow-path-${line.id}`}
                    startOffset={line.offset}
                  >
                    {LAW_FLOW_MARQUEE_TEXT}
                    {!isFlowPaused && (
                      <animate
                        attributeName="startOffset"
                        values={`${line.offset - 1700};${line.offset}`}
                        dur={`${line.duration}s`}
                        repeatCount="indefinite"
                        calcMode="linear"
                      />
                    )}
                  </textPath>
                </text>
              </svg>
            ))}
          </div>

          {ARCHIVE_ITEMS.map((document, index) => {
            const isBarrier = document.kind === 'section-barrier'
            const isActive = activeIndex === index
            const isReturning = closingIndex === index
            const isOpen = isActive && !isReturning
            const isReturnSettling = returningFolder.index === index && returningFolder.phase === 'settle'
            const isMuted = activeIndex !== null && !isActive
            const canDrag = !isBarrier && activeIndex === null && closingIndex !== index
            const baseStackOrder = STACK_BASE + index * STACK_STEP
            const folderY = isReturning
              ? (isReturnSettling ? returningFolder.y : 0)
              : isOpen
                ? (activeDragY ?? document.pullY)
                : 0
            const folderScale = isReturning
              ? (isReturnSettling ? (returningFolder.scale ?? document.rowScale) : document.rowScale)
              : isOpen
                ? 1.02
                : document.rowScale

            return (
              <motion.article
                className={[
                  'law-folder',
                  isBarrier ? 'is-section-barrier' : '',
                  isOpen ? 'is-active' : '',
                  isReturning ? 'is-returning' : '',
                  isMuted ? 'is-muted' : '',
                ].filter(Boolean).join(' ')}
                key={`${document.id}-${resetState.index === index ? resetState.version : 0}`}
                variants={folderVariants}
                initial={false}
                custom={-index * 5}
                animate={{
                  x: 0,
                  y: 0,
                  scale: folderScale,
                }}
                transition={isReturning
                  ? (isReturnSettling ? FOLDER_RETURN_SETTLE_TRANSITION : FOLDER_RETURN_TRANSITION)
                  : isOpen
                    ? FOLDER_OPEN_TRANSITION
                    : FOLDER_TWEEN_TRANSITION}
                style={{
                  '--row-y': `${document.rowY}px`,
                  '--row-width': `${isOpen ? 940 : document.rowWidth}px`,
                  '--row-inset': `${document.rowInset}%`,
                  '--front-ratio': document.frontRatio,
                  '--tab-inset': `${document.tabInset}px`,
                  '--tab-bottom-inset': `${document.tabBottomInset}px`,
                  '--tab-x': `${document.tabX}%`,
                  '--tab-width': `${document.tabWidth}px`,
                  '--folder-offset-y': `${folderY}px`,
                  '--stack-order': isOpen ? 1200 : baseStackOrder,
                  '--line-alpha': isOpen ? 0.96 : Math.max(0.36, 0.84 - index * 0.014),
                }}
                tabIndex={isBarrier ? -1 : 0}
                aria-expanded={isBarrier ? undefined : isOpen}
                onPointerDown={isBarrier ? undefined : (event) => handleFolderPointerDown(event, index, document, canDrag)}
                onClick={isBarrier ? undefined : (event) => handleCardClick(event, index)}
                onKeyDown={(event) => {
                  if (isBarrier) return
                  if (event.key === 'Escape') {
                    closeActiveFolder()
                  }
                }}
              >
                <div className="law-folder-tab">
                  <svg
                    className="law-folder-tab-shape"
                    viewBox="0 0 100 42"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path className="law-folder-tab-fill" d={document.tabPath} />
                    <path className="law-folder-tab-outline" d={document.tabOutlinePath} />
                  </svg>
                  <span>{document.displayLabel ?? String(index + 1).padStart(2, '0')}</span>
                  <strong>{document.title}</strong>
                </div>

                <div className="law-folder-strip">
                  <span>{document.year}</span>
                  <span>{document.section}</span>
                </div>

                {document.id === 'source-index' && (
                  <div className="law-folder-file-mark" aria-hidden="true">File</div>
                )}

                {!isBarrier && (
                  <div className="law-folder-detail" aria-hidden={!isActive}>
                    <div className="law-folder-detail-meta">
                      <span>{document.tag}</span>
                      <span>{document.source}</span>
                    </div>
                    <h2>{document.title}</h2>
                    <p>{document.summary}</p>
                    {document.points?.length > 0 && (
                      <ul>
                        {document.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    )}
                    <p className="law-folder-limit">{document.limit}</p>
                  </div>
                )}
              </motion.article>
            )
          })}

        </motion.div>

      </div>
    </section>
  )
}
