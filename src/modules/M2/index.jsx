import { useState, useRef, useMemo, useCallback, Suspense, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { motion, AnimatePresence, useSpring } from 'framer-motion'
import { Orbit, X } from 'lucide-react'
import * as THREE from 'three'
import { Tooltip } from '../../components/ui/tooltip-card'
import { calculateTooltipPosition } from '../../components/ui/tooltip-card-position'
import useAppStore from '../../store/useAppStore'
import useI18n from '../../i18n/useI18n'
import { generateEventNarrative } from '../../services/ai'
import M4EarthModel, { M4EarthLighting } from '../M1/M4EarthModel'
import M2InteractionGuide from './M2InteractionGuide.jsx'
import fallEventData from './fall-events.json'
import {
  createFallEventHover,
  createFallEventPlacements,
  EARTH_RADIUS,
  FALL_TRACE_VARIANTS,
} from './fallEventPlacement.js'
import { isM2GuideDismissAction } from './interactionGuide.js'
import './index.css'

const EASE = [0.16, 1, 0.3, 1]
const FALL_EVENTS = fallEventData['事件']
const CLOUD_AXIS = new THREE.Vector3(0, 0, 1)

// ── Event data ──────────────────────────────────────────────────────────────
const ALL_EVENTS = [
  // ERA 1
  { id:'sputnik1',    era:1, year:1957, type:'explore',  imp:3, name:'Sputnik 1 入轨',                nameEn:'SPUTNIK 1',         debris:'—',        desc:'人类首颗人造卫星入轨，开启太空时代。也是轨道碎片历史的零点——此后每次发射都在轨道留下残骸。' },
  { id:'sputnik2',    era:1, year:1957, type:'explore',  imp:1, name:'Sputnik 2 携犬入轨',             nameEn:'SPUTNIK 2',         debris:'—',        desc:'小狗莱卡随 Sputnik 2 入轨，首个携带生物的航天器，也是轨道上第一个"太空墓碑"。' },
  { id:'explorer1',   era:1, year:1958, type:'explore',  imp:2, name:'Explorer 1 入轨',                nameEn:'EXPLORER 1',        debris:'—',        desc:'美国首颗卫星，发现范艾伦辐射带，标志着美国正式进入太空竞赛。' },
  { id:'nasa',        era:1, year:1958, type:'explore',  imp:1, name:'NASA 正式成立',                  nameEn:'NASA FOUNDED',      debris:'—',        desc:'美国国家航空航天局建立，统一管理民用航天项目。' },
  { id:'luna1',       era:1, year:1959, type:'explore',  imp:1, name:'Luna 1 飞越月球',                nameEn:'LUNA 1',            debris:'—',        desc:'首个飞越月球的探测器，发现太阳风，成为首个绕太阳运行的人造天体。' },
  { id:'tiros1',      era:1, year:1960, type:'explore',  imp:1, name:'TIROS-1 气象卫星',               nameEn:'TIROS-1',           debris:'—',        desc:'首颗气象卫星，开创卫星对地观测历史，也是早期在轨遗留物的典型代表。' },
  { id:'gagarin',     era:1, year:1961, type:'explore',  imp:3, name:'加加林首次入轨',                 nameEn:'VOSTOK 1',          debris:'—',        desc:'尤里·加加林完成人类首次太空飞行，绕地球一圈后安全返回，历时 108 分钟。' },
  { id:'shepard',     era:1, year:1961, type:'explore',  imp:2, name:'谢泼德首次亚轨道',               nameEn:'FREEDOM 7',         debris:'—',        desc:'艾伦·谢泼德成为美国首位宇航员，完成 15 分钟亚轨道飞行。' },
  { id:'ablestar',    era:1, year:1961, type:'debris',   imp:2, name:'首次在轨解体',                   nameEn:'FIRST BREAKUP',     debris:'~300',     desc:'Ablestar 上面级在轨爆炸解体，产生有记录的第一批人工轨道碎片约 300 件，证明轨道碎片问题真实存在。' },
  { id:'telstar1',    era:1, year:1962, type:'explore',  imp:1, name:'Telstar 1 通信卫星',             nameEn:'TELSTAR 1',         debris:'—',        desc:'首颗有源通信卫星，实现跨大西洋实时电视转播，开启卫星通信时代。' },
  { id:'tereshkova',  era:1, year:1963, type:'explore',  imp:2, name:'首位女性宇航员入轨',             nameEn:'VOSTOK 6',          debris:'—',        desc:'捷列什科娃独自驾驶 Vostok 6 绕地飞行 48 圈，成为第一位进入太空的女性。' },
  { id:'leonov',      era:1, year:1965, type:'explore',  imp:2, name:'列昂诺夫太空行走',               nameEn:'FIRST EVA',         debris:'—',        desc:'阿列克谢·列昂诺夫完成人类首次太空行走，在舱外停留约 12 分钟。' },
  { id:'mariner4',    era:1, year:1965, type:'science',  imp:1, name:'Mariner 4 飞越火星',             nameEn:'MARINER 4',         debris:'—',        desc:'首次实现火星近距离飞越，拍摄 21 张照片，揭示火星是布满陨击坑的荒凉世界。' },
  { id:'luna9',       era:1, year:1966, type:'explore',  imp:2, name:'Luna 9 月面软着陆',              nameEn:'LUNA 9',            debris:'—',        desc:'首次实现月球软着陆，证明月面可以承受着陆器重量，为载人登月铺路。' },
  { id:'apollo1',     era:1, year:1967, type:'disaster', imp:2, name:'阿波罗 1 号火灾',                nameEn:'APOLLO 1',          debris:'—',        desc:'地面测试中座舱起火，三名宇航员遇难。NASA 彻底重新设计载人飞船，停飞 21 个月。' },
  { id:'soyuz1',      era:1, year:1967, type:'disaster', imp:1, name:'Soyuz 1 首飞失事',               nameEn:'SOYUZ 1',           debris:'—',        desc:'联盟号飞船首飞，降落伞故障导致科马洛夫遇难，成为首位在执行太空任务中牺牲的宇航员。' },
  { id:'apollo8',     era:1, year:1968, type:'explore',  imp:2, name:'阿波罗 8 号绕月',                nameEn:'APOLLO 8',          debris:'—',        desc:'人类首次飞离地球轨道绕月飞行，"地出"照片成为环保运动标志性图像。' },
  { id:'apollo11',    era:1, year:1969, type:'explore',  imp:3, name:'阿波罗 11 号登月',               nameEn:'APOLLO 11',         debris:'—',        desc:'尼尔·阿姆斯特朗踏上月球，全球 6 亿人电视直播。登月舱下降级至今仍在月球表面。' },
  // ERA 2
  { id:'apollo13',    era:2, year:1970, type:'disaster', imp:2, name:'阿波罗 13 号险情',               nameEn:'APOLLO 13',         debris:'—',        desc:'氧气罐爆炸，宇航员绕月借力返回，成为航天史上最著名的成功救援。' },
  { id:'dongfanghong',era:2, year:1970, type:'explore',  imp:2, name:'东方红一号入轨',                 nameEn:'DONGFANGHONG 1',    debris:'—',        desc:'中国首颗人造卫星入轨，成为第五个独立研制并发射卫星的国家。该卫星至今仍在轨道中。' },
  { id:'salyut1',     era:2, year:1971, type:'explore',  imp:1, name:'礼炮 1 号空间站',                nameEn:'SALYUT 1',          debris:'—',        desc:'人类第一个空间站，Soyuz 11 乘组工作 23 天后于返回途中遇难。礼炮 1 号受控离轨。' },
  { id:'apollo17',    era:2, year:1972, type:'explore',  imp:2, name:'阿波罗 17 末次登月',             nameEn:'APOLLO 17',         debris:'—',        desc:'人类最后一次登月，宇航员在月球表面停留约 75 小时。此后半个世纪再无人类踏上月球。' },
  { id:'skylab',      era:2, year:1973, type:'explore',  imp:1, name:'天空实验室入轨',                 nameEn:'SKYLAB',            debris:'—',        desc:'美国首个空间站，1979 年失控坠落澳大利亚，敲响大型飞行器非受控再入的警钟。' },
  { id:'astp',        era:2, year:1975, type:'explore',  imp:1, name:'阿波罗-联盟联合任务',            nameEn:'APOLLO-SOYUZ',      debris:'—',        desc:'美苏首次联合载人航天任务，象征冷战太空竞赛开始走向合作。' },
  { id:'voyager1',    era:2, year:1977, type:'explore',  imp:2, name:'旅行者 1 号发射',                nameEn:'VOYAGER 1',         debris:'—',        desc:'旅行者 1 号发射，开始超过 40 年的太阳系勘探旅程。2012 年正式飞越星际空间。' },
  { id:'kessler',     era:2, year:1978, type:'debris',   imp:3, name:'Kessler 级联效应理论',           nameEn:'KESSLER THEORY',    debris:'理论预警', desc:'NASA 科学家凯斯勒发表论文，预言轨道碎片密度超过临界点后将引发自持续级联碰撞，最终使低轨道不可用。太空碎片研究史上最重要的理论基石。' },
  { id:'kosmos954',   era:2, year:1978, type:'debris',   imp:2, name:'Kosmos 954 核泄漏坠落',          nameEn:'KOSMOS 954',        debris:'~50',      desc:'苏联核动力卫星失控再入，放射性碎片散落加拿大西北超过 600 km。首次核动力卫星非受控再入，引发国际法律讨论。' },
  { id:'columbia1',   era:2, year:1981, type:'explore',  imp:1, name:'哥伦比亚号首飞',                 nameEn:'STS-1',             debris:'—',        desc:'世界首架可重复使用航天飞机首次飞行，开创航天飞机时代。' },
  { id:'pioneer10',   era:2, year:1983, type:'science',  imp:1, name:'先驱者 10 号飞越海王星轨道',     nameEn:'PIONEER 10',        debris:'—',        desc:'首个飞越海王星轨道的人造天体，开始进入太阳系外围区域。' },
  { id:'challenger',  era:2, year:1986, type:'disaster', imp:3, name:'挑战者号解体',                   nameEn:'CHALLENGER',        debris:'—',        desc:'升空 73 秒后 O 形环失效解体，7 名宇航员遇难，NASA 停飞 32 个月。' },
  { id:'mir',         era:2, year:1986, type:'explore',  imp:2, name:'和平号空间站启建',               nameEn:'MIR',               debris:'—',        desc:'苏联和平号空间站开始建设，最终在轨运行 15 年，2001 年受控离轨入南太平洋。' },
  { id:'voyager2np',  era:2, year:1989, type:'science',  imp:1, name:'旅行者 2 号飞越海王星',          nameEn:'VOYAGER 2',         debris:'—',        desc:'旅行者 2 号飞越海王星，成为唯一近距离探访全部太阳系外行星的探测器。' },
  // ERA 3
  { id:'hubble',      era:3, year:1990, type:'explore',  imp:2, name:'哈勃望远镜入轨',                 nameEn:'HUBBLE',            debris:'—',        desc:'哈勃太空望远镜发射入轨，1993 年首次维修后成为人类最伟大的科学仪器之一，在轨运行至今。' },
  { id:'kosmos1934',  era:3, year:1991, type:'debris',   imp:2, name:'Kosmos-1934 碎片碰撞',           nameEn:'KOSMOS-1934',       debris:'少量',     desc:'苏联卫星 Kosmos-1934 被 Cosmos-955 碎片击中，首次有记录的在轨碎片碰撞，直接验证了 Kessler 理论。' },
  { id:'hubblefix',   era:3, year:1993, type:'explore',  imp:1, name:'哈勃首次维修成功',               nameEn:'HUBBLE REPAIR',     debris:'—',        desc:'宇航员成功修复哈勃镜面像差，成为最具代表性的在轨维修任务。' },
  { id:'cerise',      era:3, year:1996, type:'debris',   imp:2, name:'Cerise 首次碎片碰撞',            nameEn:'CERISE COLLISION',  debris:'~5',       desc:'法国 Cerise 卫星被 1986 年阿里亚娜残骸击中，稳定杆被切断。史上首次有完整记录的在轨碎片碰撞。' },
  { id:'lottie',      era:3, year:1997, type:'debris',   imp:1, name:'Lottie Williams 被碎片击中',     nameEn:'LOTTIE WILLIAMS',   debris:'140g',     desc:'美国女性晨跑时被 Delta II 火箭碎片击中肩部，成为史上唯一有记录被太空垃圾击中的人类。' },
  { id:'issbuild',    era:3, year:1998, type:'explore',  imp:2, name:'ISS 国际空间站启建',             nameEn:'ISS BEGIN',         debris:'—',        desc:'国际空间站首个舱段扎里亚入轨，人类最大在轨建设项目启动，耗时 13 年建成。' },
  { id:'mirdeorbit',  era:3, year:2001, type:'explore',  imp:1, name:'和平号受控离轨',                 nameEn:'MIR DEORBIT',       debris:'—',        desc:'和平号在轨 15 年后受控离轨，碎片落入南太平洋，迄今最大在轨结构受控再入案例。' },
  { id:'columbia2',   era:3, year:2003, type:'disaster', imp:3, name:'哥伦比亚号大气层解体',           nameEn:'COLUMBIA',          debris:'—',        desc:'哥伦比亚号返回时因隔热板损伤解体，7 名宇航员遇难，航天飞机再次停飞 29 个月。' },
  { id:'fy1c',        era:3, year:2007, type:'debris',   imp:3, name:'风云一号 C 反卫测试',            nameEn:'FY-1C ASAT TEST',   debris:'3,500+',   desc:'中国用动能拦截弹摧毁自有气象卫星，产生超过 3,500 件可追踪碎片，迄今单次制造碎片最多的事件。' },
  { id:'esapolicy',   era:3, year:2008, type:'debris',   imp:2, name:'ESA 碎片预防政策强制化',         nameEn:'ESA DEBRIS POLICY', debris:'政策节点', desc:'欧洲航天局正式要求新任务遵循"25 年离轨规定"，成为首个将碎片预防纳入任务强制要求的大型航天机构。' },
  { id:'iridium',     era:3, year:2009, type:'debris',   imp:3, name:'铱星-33 / Cosmos-2251 碰撞',     nameEn:'IRIDIUM × COSMOS',  debris:'2,000+',   desc:'首次大型运营卫星高速碰撞，产生约 2,000 件碎片，相对碰撞速度约 11.7 km/s，凯斯勒效应进入公众视野。' },
  { id:'newhorizons', era:3, year:2006, type:'science',  imp:1, name:'新视野号飞往冥王星',             nameEn:'NEW HORIZONS',      debris:'—',        desc:'NASA 新视野号探测器发射，2015 年飞越冥王星，发回首张清晰图像。' },
  // ERA 4
  { id:'falcon9_1st', era:4, year:2010, type:'explore',  imp:2, name:'Falcon 9 首飞成功',              nameEn:'FALCON 9',          debris:'—',        desc:'SpaceX Falcon 9 首飞成功，开创可重复使用火箭新纪元。' },
  { id:'shuttle_ret', era:4, year:2011, type:'explore',  imp:2, name:'航天飞机正式退役',               nameEn:'SHUTTLE RETIRED',   debris:'—',        desc:'亚特兰蒂斯号完成最后一次任务，航天飞机计划正式结束。' },
  { id:'dragon_iss',  era:4, year:2012, type:'explore',  imp:2, name:'Dragon 首次对接 ISS',            nameEn:'DRAGON ISS',        debris:'—',        desc:'SpaceX Dragon 成为首艘与国际空间站对接的私人飞船，开创商业货运新时代。' },
  { id:'curiosity',   era:4, year:2012, type:'science',  imp:2, name:'好奇号火星着陆',                 nameEn:'CURIOSITY',         debris:'—',        desc:'好奇号在盖尔撞击坑内部着陆，用空中吊车完成史上最复杂的着陆机动。' },
  { id:'chelyabinsk', era:4, year:2013, type:'science',  imp:2, name:'车里雅宾斯克陨石',               nameEn:'CHELYABINSK',       debris:'—',        desc:'约 20 米小行星在俄罗斯上空爆炸，冲击波造成 1,500 人受伤。' },
  { id:'clearspace13',era:4, year:2013, type:'debris',   imp:2, name:'ESA 宣布 ClearSpace-1 计划',     nameEn:'CLEARSPACE PLAN',   debris:'计划节点', desc:'欧洲航天局启动首个专门用于主动清除轨道碎片的任务研究，轨道碎片治理走向主动清除。' },
  { id:'falcon9land', era:4, year:2015, type:'explore',  imp:2, name:'Falcon 9 一级火箭首次着陆回收',  nameEn:'FALCON 9 LAND',     debris:'—',        desc:'SpaceX 首次成功垂直回收 Falcon 9 一级火箭，可重复使用航天器进入实用化时代。' },
  { id:'ligo',        era:4, year:2016, type:'science',  imp:2, name:'LIGO 首次探测引力波',            nameEn:'LIGO',              debris:'—',        desc:'人类首次直接探测到引力波，证实爱因斯坦百年预言，开启引力波天文学新窗口。' },
  { id:'change4l',    era:4, year:2019, type:'explore',  imp:2, name:'嫦娥 4 号月背着陆',              nameEn:"CHANGE 4 LAND",     debris:'—',        desc:'嫦娥 4 号成功着陆月球背面，人类探测器首次踏足月背，开创深空探测新里程。' },
  { id:'india_asat',  era:4, year:2019, type:'debris',   imp:2, name:'印度 ASAT 测试 Mission Shakti',  nameEn:'INDIA ASAT',        debris:'400+',     desc:'印度击毁自有卫星，产生超过 400 件可追踪碎片，NASA 局长称之为"可怕的事情"。' },
  { id:'starlink1',   era:4, year:2019, type:'debris',   imp:3, name:'Starlink 巨型星座部署开始',      nameEn:'STARLINK BEGIN',    debris:'持续累积', desc:'首批 60 颗 Starlink 卫星发射，截至 2025 年在轨超过 6,000 颗，引发轨道资源争议和碎片风险担忧。' },
  { id:'nhpluto',     era:4, year:2015, type:'science',  imp:1, name:'新视野号飞越冥王星',             nameEn:'NH PLUTO',          debris:'—',        desc:'新视野号发回冥王星高清图像，揭示冰冻平原和山脉，颠覆对外太阳系的认知。' },
  // ERA 5
  { id:'demo2',       era:5, year:2020, type:'explore',  imp:2, name:'Crew Dragon 首次载人飞行',       nameEn:'CREW DRAGON',       debris:'—',        desc:'SpaceX Crew Dragon 搭载两名宇航员飞往 ISS，美国时隔 9 年重获载人发射能力。' },
  { id:'change5',     era:5, year:2020, type:'explore',  imp:2, name:'嫦娥 5 号月壤采样返回',          nameEn:"CHANGE 5",          debris:'—',        desc:'嫦娥 5 号带回 1.731 千克月壤，人类 44 年来首次月球采样任务。' },
  { id:'ingenuity',   era:5, year:2021, type:'science',  imp:2, name:'机智号火星飞行',                 nameEn:'INGENUITY',         debris:'—',        desc:'机智号无人直升机在火星完成首次动力飞行，成为首个在地球以外天体实现动力飞行的飞行器。' },
  { id:'cz5b_deb',    era:5, year:2021, type:'debris',   imp:2, name:'长征 5B 残骸失控再入',           nameEn:'CZ-5B DEBRIS',      debris:'残骸',     desc:'中国长征 5B 运载火箭约 22 吨残骸失控再入大气层，部分碎片落入印度洋，多国批评中国未主动离轨处置。' },
  { id:'cosmos1408',  era:5, year:2021, type:'debris',   imp:3, name:'俄罗斯 ASAT 摧毁 Cosmos 1408',   nameEn:'COSMOS 1408 ASAT',  debris:'1,500+',   desc:'俄罗斯导弹击毁自有失效卫星，产生超过 1,500 件可追踪碎片，迫使 ISS 宇航员紧急躲入联盟号。' },
  { id:'jwst',        era:5, year:2021, type:'science',  imp:3, name:'詹姆斯·韦伯太空望远镜发射',     nameEn:'JWST',              debris:'—',        desc:'韦伯望远镜发射，成为人类有史以来最强大的太空望远镜，揭示宇宙诞生后数亿年的第一批星系图像。' },
  { id:'dart',        era:5, year:2022, type:'science',  imp:2, name:'DART 首次改变小行星轨道',        nameEn:'DART',              debris:'—',        desc:'NASA DART 探测器撞击 Dimorphos，成功将其轨道周期改变约 33 分钟，首次验证行星防御技术可行性。' },
  { id:'artemis1',    era:5, year:2022, type:'explore',  imp:2, name:'Artemis I 无人绕月飞行',         nameEn:'ARTEMIS I',         debris:'—',        desc:'NASA SLS 火箭首次飞行，Orion 飞船无人绕月，为载人重返月球任务铺路。' },
  { id:'tiangong',    era:5, year:2022, type:'explore',  imp:2, name:'天宫空间站建成',                 nameEn:'TIANGONG CSS',      debris:'—',        desc:'中国天宫空间站三舱构型正式建成，成为全球唯一由单一国家独立运营的在轨空间站。' },
  { id:'esa_zero',    era:5, year:2023, type:'debris',   imp:2, name:'ESA"零碎片宪章"',               nameEn:'ESA ZERO DEBRIS',   debris:'政策节点', desc:'欧洲航天局宣布到 2030 年实现自身任务"零碎片"目标，轨道碎片治理话语权升级为主动承诺。' },
  { id:'cz6a_deb',    era:5, year:2024, type:'debris',   imp:2, name:'长征 6A 上面级解体',             nameEn:'CZ-6A DEBRIS',      debris:'200+',     desc:'中国长征 6A 运载火箭上面级在轨发生解体，产生超过 200 件可追踪碎片。' },
  { id:'issbattery',  era:5, year:2024, type:'debris',   imp:2, name:'ISS 电池托盘穿透民宅',          nameEn:'ISS BATTERY',       debris:'~7',       desc:'国际空间站废弃电池托盘碎片穿透佛罗里达民宅屋顶，法律归责至今悬而未决。' },
  { id:'starship5',   era:5, year:2024, type:'explore',  imp:2, name:'Starship 5 号"筷子夹"回收',     nameEn:'STARSHIP 5',        debris:'—',        desc:'SpaceX Starship 5 号测试中，超重型推进器首次被发射台机械臂成功夹回，开创运载火箭回收新形式。' },
  { id:'clearspace1', era:5, year:2026, type:'debris',   imp:3, name:'ClearSpace-1 首次主动清除碎片',  nameEn:'CLEARSPACE-1',      debris:'首次主动移除', desc:'ESA 委托 ClearSpace 公司执行，目标用机械臂捕获并脱轨 Vespa 上面级残骸（112 千克，664 公里轨道）。若成功，将是人类历史上首次主动从轨道移除碎片的行动。' },
]

const KEY_IDS = new Set(['ablestar', 'kessler', 'kosmos954', 'cerise', 'fy1c', 'iridium', 'issbattery'])

const ERA_META = [
  { id: 1, range: '1957–1969', name: '轨道遗留开始出现', nameEn: 'Orbital leftovers begin to appear', desc: '第一批卫星和火箭进入太空，任务结束后的火箭级、失效航天器和零部件也开始留在轨道中。', descEn: 'The first satellites and rockets entered space, while spent rocket stages, inactive spacecraft, and other hardware began to remain in orbit after missions ended.' },
  { id: 2, range: '1970–1989', name: '废弃物持续累积', nameEn: 'Debris continues to accumulate', desc: '发射活动越来越频繁，更多废弃卫星和火箭级长期留在轨道中，爆炸和解体也不断产生新的碎片。', descEn: 'As launches became more frequent, more inactive satellites and spent rocket stages remained in orbit, while explosions and breakups created additional fragments.' },
  { id: 3, range: '1990–2009', name: '大规模碎裂成为警报', nameEn: 'Major fragmentation events raise alarm', desc: '爆炸、反卫星试验和卫星碰撞开始一次产生大量碎片，轨道碎片带来的风险变得越来越明显。', descEn: 'Explosions, anti-satellite tests, and satellite collisions began producing large numbers of fragments at once, making orbital debris risks increasingly visible.' },
  { id: 4, range: '2010–2019', name: '碰撞规避成为日常', nameEn: 'Collision avoidance becomes routine', desc: '轨道上的卫星和碎片越来越多，监测、预警和碰撞规避逐渐成为航天器日常运行的一部分。', descEn: 'As more satellites and debris occupied orbit, tracking, warning systems, and collision avoidance became part of routine spacecraft operations.' },
  { id: 5, range: '2020–2026', name: '轨道进入高密度时代', nameEn: 'Orbit enters a high-density era', desc: '大规模卫星部署进一步提高轨道密度，减少新碎片、及时离轨和主动清除开始成为轨道长期使用的重要任务。', descEn: 'Large-scale satellite deployment further increased orbital density, making debris prevention, timely deorbiting, and active removal increasingly important for long-term orbital use.' },
]

const EVENT_TYPE_COPY = {
  explore: 'an exploration milestone that expanded access to space and added new hardware to the orbital environment',
  debris: 'a debris milestone that exposed how launches, breakups, and collisions can create persistent orbital risk',
  science: 'a scientific milestone that extended what spacecraft could observe and accomplish',
  disaster: 'a mission failure that changed safety practice and the way later spacecraft were designed or operated',
}

function eventName(event, language) {
  return language === 'en' ? event.nameEn : event.name
}

function eventDescription(event, language) {
  if (language !== 'en') return event.desc
  const detail = EVENT_TYPE_COPY[event.type] || EVENT_TYPE_COPY.explore
  const debris = event.debris && event.debris !== '—' ? ` The record notes ${event.debris} debris or related impact.` : ''
  return `${event.nameEn} was ${detail} in ${event.year}.${debris}`
}

function fallEventEnglishTitle(event) {
  const matches = String(event['事件名称'] || '').match(/[A-Za-z][A-Za-z0-9 .+/()–—-]+/g)
  const title = matches?.map((item) => item.trim()).sort((a, b) => b.length - a.length)[0]
  return title || `RE-ENTRY EVENT ${String(event['事件编号']).padStart(2, '0')}`
}

const EVENTS_BY_ERA = ERA_META.map((era) => ALL_EVENTS.filter((event) => event.era === era.id))

const RING_CONFIG = [
  { id: 1, radius: 8.0,  speed: 0.048, opacity: 0.34, satTypes: ['sputnik', 'dongfanghong'], size: 0.84 },
  { id: 2, radius: 9.0,  speed: 0.036, opacity: 0.4, satTypes: ['early_box', 'cylinder_ant', 'sphere_wing'], size: 0.9 },
  { id: 3, radius: 10.0, speed: 0.026, opacity: 0.48, satTypes: ['comm', 'obs', 'nav'], size: 1.05 },
  { id: 4, radius: 11.0, speed: 0.018, opacity: 0.56, satTypes: ['platform', 'comms_large', 'multi_module'], size: 1.2 },
  { id: 5, radius: 12.0, speed: 0.013, opacity: 0.64, satTypes: ['iss', 'tiangong'], size: 1.4 },
]

const ORBIT_ARC_START = Math.PI * 0.5
const ORBIT_ARC_END = Math.PI * 1.5

// ── 3D Components ──────────────────────────────────────────────────────────

const getSceneMetrics = (width, height) => {
  const viewportWidth = typeof window === 'undefined' ? width : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? height : window.innerHeight
  const referenceHeight = viewportWidth > 960
    ? Math.max(980, viewportHeight * 1.12)
    : height
  const zoom = Math.max(width / 33, referenceHeight / 14.8)
  const extension = Math.max(0, height - referenceHeight)
  const verticalOffset = -extension / (2 * zoom)

  return { zoom, verticalOffset }
}

// Keep the Earth diameter legible while allowing the outer rings to crop into the stage.
function CameraSetup() {
  const { camera, size } = useThree()
  useEffect(() => {
    camera.zoom = getSceneMetrics(size.width, size.height).zoom
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function createFallTraceGeometry(variant, variantIndex) {
  const shape = new THREE.Shape()
  const outer = []
  const inner = []
  const segments = 36
  const startAngle = -variant.arcSpan / 2

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments
    const angle = startAngle + progress * variant.arcSpan
    const envelope = Math.sin(progress * Math.PI)
    const primaryWave = Math.sin(progress * Math.PI * (2.2 + variantIndex * 0.13) + variant.phase)
    const secondaryWave = Math.sin(progress * Math.PI * 5.4 - variant.phase * 0.6)
    const radius = 1 + envelope * variant.wave * (primaryWave + secondaryWave * 0.32)
    outer.push(new THREE.Vector2(
      Math.cos(angle) * radius + variant.skew * (progress - 0.5),
      Math.sin(angle) * radius,
    ))

    const innerRadius = 1 - variant.bandWidth
      + envelope * variant.wave * 0.3 * Math.sin(progress * Math.PI * 3.6 + variant.phase)
    inner.push(new THREE.Vector2(
      Math.cos(angle) * innerRadius + variant.skew * (progress - 0.5) * 0.7,
      Math.sin(angle) * innerRadius,
    ))
  }

  shape.moveTo(outer[0].x, outer[0].y)
  outer.slice(1).forEach((point) => shape.lineTo(point.x, point.y))
  inner.slice().reverse().forEach((point) => shape.lineTo(point.x, point.y))
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.08,
    curveSegments: 8,
  })
  geometry.center()
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function useFallCloudAssets() {
  const geometries = useMemo(
    () => FALL_TRACE_VARIANTS.map((variant, index) => createFallTraceGeometry(variant, index)),
    [],
  )
  const edgeGeometries = useMemo(
    () => geometries.map((geometry) => new THREE.EdgesGeometry(geometry, 24)),
    [geometries],
  )
  const hitGeometry = useMemo(() => new THREE.CircleGeometry(1.06, 28), [])
  const materials = useMemo(() => ({
    major: new THREE.MeshStandardMaterial({
      color: '#cadbff',
      emissive: '#6f91f4',
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.16,
      roughness: 0.88,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    registry: new THREE.MeshStandardMaterial({
      color: '#f3f6ff',
      emissive: '#a9bfff',
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.1,
      roughness: 0.9,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    active: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#8aa8ff',
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.34,
      roughness: 0.78,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    lineMajor: new THREE.LineBasicMaterial({ color: '#dfe7ff', transparent: true, opacity: 0.44, depthWrite: false }),
    lineRegistry: new THREE.LineBasicMaterial({ color: '#f5f7ff', transparent: true, opacity: 0.28, depthWrite: false }),
    lineActive: new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
    hit: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    }),
  }), [])

  useEffect(() => () => {
    geometries.forEach((geometry) => geometry.dispose())
    edgeGeometries.forEach((geometry) => geometry.dispose())
    hitGeometry.dispose()
    Object.values(materials).forEach((material) => material.dispose())
  }, [edgeGeometries, geometries, hitGeometry, materials])

  return { geometries, edgeGeometries, hitGeometry, materials }
}

function FallEventTooltipCard({ event }) {
  const { language, pick } = useI18n()
  const source = event['来源']?.[0]

  return (
    <article className="m2-fall-event-card">
      <header>
        <span>FALL EVENT {String(event['事件编号']).padStart(2, '0')}</span>
        <span>{pick('悬停', 'HOVER')}</span>
      </header>
      <span className="m2-fall-event-category">{pick(event['类别'], 'RECORDED RE-ENTRY')}</span>
      <h3>{language === 'en' ? fallEventEnglishTitle(event) : event['事件名称']}</h3>
      <p>{pick(event['一句话事件介绍'], 'A documented space-object re-entry with consequences recorded at ground or atmospheric level.')}</p>
      <dl>
        <div>
          <dt>{pick('影响范围', 'IMPACT')}</dt>
          <dd>{pick(event['影响范围'], 'The affected area and consequences are documented in the linked source record.')}</dd>
        </div>
      </dl>
      {source && (
        <footer>
          <span>{source['来源名称']}</span>
        </footer>
      )}
    </article>
  )
}

function getFallCloudQuaternion(placement) {
  const normal = new THREE.Vector3(...placement.normal).normalize()
  const align = new THREE.Quaternion().setFromUnitVectors(CLOUD_AXIS, normal)
  const roll = new THREE.Quaternion().setFromAxisAngle(CLOUD_AXIS, placement.roll)
  return align.multiply(roll)
}

function FallEventCloud({
  event,
  placement,
  geometries,
  edgeGeometries,
  hitGeometry,
  materials,
  isHovered,
  isGuideTarget,
  onHover,
  onMove,
  onLeave,
  onActivate,
}) {
  const orientation = useMemo(() => getFallCloudQuaternion(placement), [placement])
  const isActive = isHovered
  const isMajor = event['类别'].startsWith('重大')
  const fillMaterial = isActive ? materials.active : isMajor ? materials.major : materials.registry
  const lineMaterial = isActive ? materials.lineActive : isMajor ? materials.lineMajor : materials.lineRegistry

  return (
    <group position={placement.position} quaternion={orientation} scale={isActive ? 1.035 : 1}>
      <mesh
        geometry={geometries[placement.variant]}
        material={fillMaterial}
        scale={placement.scale}
      />
      <lineSegments
        geometry={edgeGeometries[placement.variant]}
        material={lineMaterial}
        scale={placement.scale}
      />
      {isGuideTarget && (
        <Html
          position={[0, 0, placement.scale[2] * 1.35 + 0.18]}
          center
          zIndexRange={[4, 1]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className="m2-guide-scene-anchor"
            data-m2-guide-target="trace"
            aria-hidden="true"
          />
        </Html>
      )}
      <mesh
        geometry={hitGeometry}
        material={materials.hit}
        position={[0, 0, 0.62]}
        scale={[placement.scale[0], placement.scale[1], 1]}
        onPointerOver={(pointerEvent) => {
          pointerEvent.stopPropagation()
          onHover(event, pointerEvent)
        }}
        onPointerMove={(pointerEvent) => {
          pointerEvent.stopPropagation()
          onMove(event, pointerEvent)
        }}
        onPointerOut={(pointerEvent) => {
          pointerEvent.stopPropagation()
          onLeave(event['事件编号'])
        }}
        onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
        onPointerUp={(pointerEvent) => pointerEvent.stopPropagation()}
        onClick={(pointerEvent) => {
          pointerEvent.stopPropagation()
          onActivate(event['事件编号'])
        }}
      />
    </group>
  )
}

function FallEventLayer({ hoveredId, onHover, onMove, onLeave, onActivate }) {
  const { geometries, edgeGeometries, hitGeometry, materials } = useFallCloudAssets()
  const placements = useMemo(
    () => createFallEventPlacements(FALL_EVENTS).map((placement, index) => ({
      ...placement,
      event: FALL_EVENTS[index],
    })),
    [],
  )
  return (
    <>
      {placements.map((placement) => {
        const { event } = placement
        const eventId = event['事件编号']
        return (
          <FallEventCloud
            key={eventId}
            event={event}
            placement={placement}
            geometries={geometries}
            edgeGeometries={edgeGeometries}
            hitGeometry={hitGeometry}
            materials={materials}
            isHovered={hoveredId === eventId}
            isGuideTarget={eventId === 6}
            onHover={onHover}
            onMove={onMove}
            onLeave={onLeave}
            onActivate={onActivate}
          />
        )
      })}
    </>
  )
}

function InteractiveEarth({ onGuideAction, onFallHover, onFallMove, onFallLeave, visitKey }) {
  const rotationRef = useRef()
  const dragRef = useRef({ pointerId: null, x: 0, y: 0, moved: false })
  const [hoveredEventId, setHoveredEventId] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const { gl } = useThree()
  const isPaused = isDragging || hoveredEventId !== null

  useFrame((_, delta) => {
    if (rotationRef.current && !isPaused) rotationRef.current.rotation.y -= delta * 0.02
  })

  useEffect(() => {
    const canvas = gl.domElement
    canvas.classList.toggle('is-earth-dragging', isDragging)
    return () => canvas.classList.remove('is-earth-dragging')
  }, [gl, isDragging])

  useEffect(() => {
    dragRef.current = { pointerId: null, x: 0, y: 0, moved: false }
    setHoveredEventId(null)
    setIsDragging(false)
    onFallLeave()
  }, [onFallLeave, visitKey])

  const getTooltipPoint = useCallback((pointerEvent) => {
    const canvasRect = gl.domElement.getBoundingClientRect()
    const nativeEvent = pointerEvent.nativeEvent ?? pointerEvent
    const mouseX = nativeEvent.clientX - canvasRect.left
    const mouseY = nativeEvent.clientY - canvasRect.top

    return calculateTooltipPosition({
      mouseX,
      mouseY,
      containerRect: canvasRect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      tooltipWidth: Math.min(300, Math.max(240, canvasRect.width - 28)),
      tooltipHeight: Math.min(250, canvasRect.height * 0.52),
      offset: 16,
    })
  }, [gl])

  const onCloudHover = useCallback((event, pointerEvent) => {
    setHoveredEventId(event['事件编号'])
    onFallHover(event, getTooltipPoint(pointerEvent))
  }, [getTooltipPoint, onFallHover])

  const onCloudMove = useCallback((event, pointerEvent) => {
    onFallMove(event, getTooltipPoint(pointerEvent))
  }, [getTooltipPoint, onFallMove])

  const onCloudLeave = useCallback((eventId) => {
    setHoveredEventId((current) => current === eventId ? null : current)
    onFallLeave(eventId)
  }, [onFallLeave])

  const endDrag = useCallback((pointerEvent, shouldClearHover) => {
    if (dragRef.current.pointerId !== pointerEvent.pointerId) return
    const didMove = dragRef.current.moved
    dragRef.current.pointerId = null
    if (pointerEvent.target.hasPointerCapture?.(pointerEvent.pointerId)) {
      pointerEvent.target.releasePointerCapture(pointerEvent.pointerId)
    }
    setIsDragging(false)
    if (shouldClearHover && !didMove) onFallLeave()
  }, [onFallLeave])

  return (
    <group rotation={[-Math.PI / 2, 0, Math.PI]}>
      <group ref={rotationRef}>
        <M4EarthModel radius={EARTH_RADIUS} />
        <FallEventLayer
          hoveredId={hoveredEventId}
          onHover={onCloudHover}
          onMove={onCloudMove}
          onLeave={onCloudLeave}
          onActivate={() => {
            onGuideAction?.('trace')
          }}
        />
        <mesh
          onPointerDown={(pointerEvent) => {
            if (pointerEvent.button !== 0) return
            pointerEvent.stopPropagation()
            pointerEvent.target.setPointerCapture?.(pointerEvent.pointerId)
            dragRef.current = {
              pointerId: pointerEvent.pointerId,
              x: pointerEvent.clientX,
              y: pointerEvent.clientY,
              moved: false,
            }
            setIsDragging(true)
            setHoveredEventId(null)
            onFallLeave()
          }}
          onPointerMove={(pointerEvent) => {
            if (dragRef.current.pointerId !== pointerEvent.pointerId || !rotationRef.current) return
            pointerEvent.stopPropagation()
            const deltaX = pointerEvent.clientX - dragRef.current.x
            const deltaY = pointerEvent.clientY - dragRef.current.y
            if (!dragRef.current.moved && Math.abs(deltaX) + Math.abs(deltaY) > 1) {
              dragRef.current.moved = true
              onGuideAction?.('drag')
            }
            dragRef.current.x = pointerEvent.clientX
            dragRef.current.y = pointerEvent.clientY
            rotationRef.current.rotation.y += deltaX * 0.0055
            rotationRef.current.rotation.x = THREE.MathUtils.clamp(
              rotationRef.current.rotation.x + deltaY * 0.0045,
              -0.78,
              0.78,
            )
          }}
          onPointerUp={(pointerEvent) => endDrag(pointerEvent, true)}
          onPointerCancel={(pointerEvent) => endDrag(pointerEvent, false)}
          onLostPointerCapture={(pointerEvent) => endDrag(pointerEvent, false)}
        >
          <sphereGeometry args={[EARTH_RADIUS + 0.025, 48, 32]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

// 10 satellite shapes across 5 complexity levels — body along X (tangential), panels along Y (radial)
function MiniSatellite({ type, bodyColor, panelColor, eInt, scale = 1 }) {
  const b = () => (
    <meshStandardMaterial
      color={bodyColor}
      emissive="#ffffff"
      emissiveIntensity={Math.min(eInt * 0.12, 0.42)}
      metalness={0.18}
      roughness={0.46}
    />
  )
  const p = () => (
    <meshStandardMaterial
      color={panelColor}
      emissive="#416fe5"
      emissiveIntensity={Math.min(0.08 + eInt * 0.17, 0.58)}
      metalness={0.08}
      roughness={0.52}
    />
  )

  // ── RING 1 ── simplest, 1957–1969 ──────────────────────────────────────────
  // Sputnik: sphere + 4 diagonal trailing antennas
  if (type === 'sputnik') return (
    <group scale={scale}>
      <mesh><sphereGeometry args={[0.07, 8, 6]} />{b()}</mesh>
      <mesh position={[ 0.10,  0.10, 0]} rotation={[0,0,-0.78]}><cylinderGeometry args={[0.007,0.003,0.15,6]} />{p()}</mesh>
      <mesh position={[-0.10,  0.10, 0]} rotation={[0,0, 0.78]}><cylinderGeometry args={[0.007,0.003,0.15,6]} />{p()}</mesh>
      <mesh position={[ 0.10, -0.10, 0]} rotation={[0,0, 0.78]}><cylinderGeometry args={[0.007,0.003,0.15,6]} />{p()}</mesh>
      <mesh position={[-0.10, -0.10, 0]} rotation={[0,0,-0.78]}><cylinderGeometry args={[0.007,0.003,0.15,6]} />{p()}</mesh>
    </group>
  )
  // 东方红: low-poly faceted sphere + 2 short whip stubs
  if (type === 'dongfanghong') return (
    <group scale={scale}>
      <mesh><sphereGeometry args={[0.08, 5, 4]} />{b()}</mesh>
      <mesh position={[0,  0.13, 0]}><cylinderGeometry args={[0.007,0.003,0.09,6]} />{p()}</mesh>
      <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[0.007,0.003,0.09,6]} />{p()}</mesh>
    </group>
  )

  // ── RING 2 ── early operational, 1970–1989 ─────────────────────────────────
  // Early box: small rectangular bus + 1 side solar panel
  if (type === 'early_box') return (
    <group scale={scale}>
      <mesh><boxGeometry args={[0.13, 0.08, 0.06]} />{b()}</mesh>
      <mesh position={[0, 0.069, 0]}><cylinderGeometry args={[0.006,0.006,0.058,6]} />{b()}</mesh>
      <mesh position={[0, 0.145, 0.012]}><boxGeometry args={[0.17, 0.095, 0.012]} />{p()}</mesh>
      <mesh position={[0.12, 0, 0]}><cylinderGeometry args={[0.007,0.003,0.10,6]} />{p()}</mesh>
    </group>
  )
  // Cylinder + single top antenna
  if (type === 'cylinder_ant') return (
    <group scale={scale}>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.04,0.04,0.18,8]} />{b()}</mesh>
      <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.007,0.003,0.13,6]} />{p()}</mesh>
    </group>
  )
  // Sphere + single small wing
  if (type === 'sphere_wing') return (
    <group scale={scale}>
      <mesh><sphereGeometry args={[0.07, 7, 5]} />{b()}</mesh>
      <mesh position={[0, 0.091, 0]}><cylinderGeometry args={[0.006,0.006,0.042,6]} />{b()}</mesh>
      <mesh position={[0, 0.155, 0.012]}><boxGeometry args={[0.15, 0.095, 0.012]} />{p()}</mesh>
    </group>
  )

  // ── RING 3 ── modern commercial, 1990–2009 ─────────────────────────────────
  // Comm sat: rectangular bus + 2 full solar wings
  if (type === 'comm') return (
    <group scale={scale * 0.66}>
      <mesh><boxGeometry args={[0.17, 0.07, 0.06]} />{b()}</mesh>
      <mesh position={[0,  0.068, 0]}><cylinderGeometry args={[0.006,0.006,0.066,6]} />{b()}</mesh>
      <mesh position={[0, -0.068, 0]}><cylinderGeometry args={[0.006,0.006,0.066,6]} />{b()}</mesh>
      <mesh position={[0,  0.155, 0.012]}><boxGeometry args={[0.24, 0.11, 0.012]} />{p()}</mesh>
      <mesh position={[0, -0.155, 0.012]}><boxGeometry args={[0.24, 0.11, 0.012]} />{p()}</mesh>
    </group>
  )
  // Observation sat: rect bus + wings + instrument boom
  if (type === 'obs') return (
    <group scale={scale * 0.66}>
      <mesh><boxGeometry args={[0.16, 0.07, 0.06]} />{b()}</mesh>
      <mesh position={[0,  0.067, 0]}><cylinderGeometry args={[0.006,0.006,0.064,6]} />{b()}</mesh>
      <mesh position={[0, -0.067, 0]}><cylinderGeometry args={[0.006,0.006,0.064,6]} />{b()}</mesh>
      <mesh position={[0,  0.15, 0.012]}><boxGeometry args={[0.22, 0.10, 0.012]} />{p()}</mesh>
      <mesh position={[0, -0.15, 0.012]}><boxGeometry args={[0.22, 0.10, 0.012]} />{p()}</mesh>
      <mesh position={[0.17, 0, 0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.004,0.004,0.14,4]} />{p()}</mesh>
    </group>
  )
  // Navigation sat: hexagonal body + 2 wings + dish stub
  if (type === 'nav') return (
    <group scale={scale * 0.66}>
      <mesh><cylinderGeometry args={[0.08,0.08,0.05,6]} />{b()}</mesh>
      <mesh position={[0,  0.104, 0]}><cylinderGeometry args={[0.006,0.006,0.048,6]} />{b()}</mesh>
      <mesh position={[0, -0.104, 0]}><cylinderGeometry args={[0.006,0.006,0.048,6]} />{b()}</mesh>
      <mesh position={[0,  0.17, 0.012]}><boxGeometry args={[0.19, 0.10, 0.012]} />{p()}</mesh>
      <mesh position={[0, -0.17, 0.012]}><boxGeometry args={[0.19, 0.10, 0.012]} />{p()}</mesh>
      <mesh position={[-0.12, 0, 0]}><cylinderGeometry args={[0.05,0.01,0.03,12]} />{p()}</mesh>
    </group>
  )

  // ── RING 4 ── advanced, 2010–2019 ─────────────────────────────────────────
  // Large platform: big bus + 2×2 solar wing array
  if (type === 'platform') return (
    <group scale={scale * 0.5}>
      <mesh><boxGeometry args={[0.18, 0.08, 0.07]} />{b()}</mesh>
      <mesh position={[-0.06,  0.17, 0]}><boxGeometry args={[0.14, 0.10, 0.005]} />{p()}</mesh>
      <mesh position={[-0.06, -0.17, 0]}><boxGeometry args={[0.14, 0.10, 0.005]} />{p()}</mesh>
      <mesh position={[ 0.14,  0.17, 0]}><boxGeometry args={[0.14, 0.10, 0.005]} />{p()}</mesh>
      <mesh position={[ 0.14, -0.17, 0]}><boxGeometry args={[0.14, 0.10, 0.005]} />{p()}</mesh>
    </group>
  )
  // Comms large: big bus + parabolic dish + wings
  if (type === 'comms_large') return (
    <group scale={scale * 0.6}>
      <mesh><boxGeometry args={[0.18, 0.08, 0.07]} />{b()}</mesh>
      <mesh position={[0,  0.16, 0]}><boxGeometry args={[0.22, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[0, -0.16, 0]}><boxGeometry args={[0.22, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[-0.19, 0, 0]}><cylinderGeometry args={[0.08,0.01,0.04,12]} />{p()}</mesh>
    </group>
  )
  // Multi-module: 2 connected modules + wings
  if (type === 'multi_module') return (
    <group scale={scale * 0.5}>
      <mesh position={[-0.07,0,0]}><boxGeometry args={[0.16, 0.08, 0.07]} />{b()}</mesh>
      <mesh position={[ 0.17,0,0]}><boxGeometry args={[0.10, 0.07, 0.06]} />{b()}</mesh>
      <mesh position={[ 0.09,0,0]}><boxGeometry args={[0.04, 0.03, 0.03]} />{b()}</mesh>
      <mesh position={[-0.07,  0.17, 0]}><boxGeometry args={[0.20, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[-0.07, -0.17, 0]}><boxGeometry args={[0.20, 0.09, 0.005]} />{p()}</mesh>
    </group>
  )

  // ── RING 5 ── space stations, 2020–2026 ────────────────────────────────────
  // ISS: long truss + 3 hab modules + 4 pairs of solar wings
  if (type === 'iss') return (
    <group scale={scale * 0.55}>
      <mesh><boxGeometry args={[0.56, 0.020, 0.020]} />{b()}</mesh>
      <mesh position={[0,0,0]}><boxGeometry args={[0.18, 0.09, 0.07]} />{b()}</mesh>
      <mesh position={[0.20,0,0]}><boxGeometry args={[0.10, 0.07, 0.06]} />{b()}</mesh>
      <mesh position={[-0.18,0,0]}><boxGeometry args={[0.08, 0.07, 0.06]} />{b()}</mesh>
      <mesh position={[-0.22,  0.17, 0]}><boxGeometry args={[0.13, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[-0.22, -0.17, 0]}><boxGeometry args={[0.13, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[ 0.22,  0.17, 0]}><boxGeometry args={[0.13, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[ 0.22, -0.17, 0]}><boxGeometry args={[0.13, 0.09, 0.005]} />{p()}</mesh>
    </group>
  )
  // 天宫: T-shape — core module + 2 side experiment modules + 4 solar wings
  return (
    <group scale={scale * 0.55}>
      <mesh><boxGeometry args={[0.26, 0.08, 0.07]} />{b()}</mesh>
      <mesh position={[0,  0.15, 0]}><boxGeometry args={[0.13, 0.08, 0.06]} />{b()}</mesh>
      <mesh position={[0, -0.15, 0]}><boxGeometry args={[0.13, 0.08, 0.06]} />{b()}</mesh>
      <mesh position={[-0.22,  0.14, 0]}><boxGeometry args={[0.14, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[-0.22, -0.14, 0]}><boxGeometry args={[0.14, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[ 0.22,  0.14, 0]}><boxGeometry args={[0.14, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[ 0.22, -0.14, 0]}><boxGeometry args={[0.14, 0.09, 0.005]} />{p()}</mesh>
    </group>
  )
}

function EventTooltipCard({ event, isDebris }) {
  const { language, pick } = useI18n()
  const era = ERA_META[event.era - 1]

  return (
    <article className="m2-event-tooltip-card">
      <div className="m2-event-tooltip-meta">
        <span>{event.year}</span>
        <span>ERA 0{event.era}</span>
      </div>
      <h3>{eventName(event, language)}</h3>
      <p>{eventDescription(event, language)}</p>
      <footer>
        <span>{event.nameEn}</span>
        <span>{isDebris ? `${pick('碎片', 'DEBRIS')} ${event.debris}` : pick(era?.name, era?.nameEn)}</span>
      </footer>
    </article>
  )
}

function EraRing({ config, events, launchYear, hoveredId, clickedIds, activeEra, onHover, onLeave, onClick, onGuideAction }) {
  const orbitRef = useRef()
  const orbitPaused = Boolean(hoveredId) && events.some((event) => event.id === hoveredId)
  const hasActiveEra = Boolean(activeEra)
  const isActiveEra = activeEra === config.id
  const orbitOpacity = hasActiveEra
    ? (isActiveEra ? 0.94 : config.opacity * 0.22)
    : config.opacity
  // Negative Z rotation = clockwise when viewed from front (+Z camera)
  useFrame((_, dt) => {
    if (orbitRef.current && !orbitPaused) orbitRef.current.rotation.z -= config.speed * dt
  })

  const dots = useMemo(() => events.map((ev, i) => {
    const angle = (2 * Math.PI * i) / events.length
    const satType = config.satTypes[i % config.satTypes.length]
    return { ev, angle, satType, x: config.radius * Math.cos(angle), y: config.radius * Math.sin(angle) }
  }), [events, config.radius, config.satTypes])

  // Draw the left semicircle so the rings extend into the viewport from the right-edge Earth.
  const arcGeo = useMemo(() => {
    const pts = []
    const segs = 96
    for (let i = 0; i <= segs; i++) {
      const θ = ORBIT_ARC_START + ((ORBIT_ARC_END - ORBIT_ARC_START) * i) / segs
      pts.push(new THREE.Vector3(config.radius * Math.cos(θ), config.radius * Math.sin(θ), 0))
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.01)
    return new THREE.TubeGeometry(curve, segs, 0.022, 5, false)
  }, [config.radius])

  return (
    <group>
      {/* Left-facing semicircle arc in XY plane */}
      <mesh geometry={arcGeo}>
        <meshStandardMaterial
          color="#f5f7ff"
          emissive="#f5f7ff"
          emissiveIntensity={isActiveEra ? 0.7 : 0.35}
          transparent
          opacity={orbitOpacity}
        />
      </mesh>

      {/* Orbiting satellites — rotate around Z axis (clockwise) */}
      <group ref={orbitRef}>
        {dots.map(({ ev, x, y, angle, satType }) => {
          const isKey    = KEY_IDS.has(ev.id)
          const isActive = ev.year >= launchYear
          const isHov    = hoveredId === ev.id
          const isClicked= clickedIds.has(ev.id)
          const scale = (isKey ? (isHov ? 2.0 : 1.4) : (isHov ? 1.2 : 0.9)) * config.size
          const eInt = isHov ? 4.0 : isClicked ? 3.0 : (isKey && isActive ? 2.5 : isActive ? 2.0 : 1.4)
          const bodyColor = '#f2f5fa'
          const panelColor = '#3f65cf'
          const isDebris = KEY_IDS.has(ev.id) && ev.year >= launchYear

          return (
            <group key={ev.id} position={[x, y, 0.12]} rotation={[0, 0, angle + Math.PI / 2]}>
              <MiniSatellite
                type={satType}
                bodyColor={bodyColor}
                panelColor={panelColor}
                eInt={eInt}
                scale={scale}
              />
              <Html position={[0, 0, 0.5]} center zIndexRange={[80, 10]}>
                <Tooltip
                  containerClassName="m2-tooltip-host"
                  content={<EventTooltipCard event={ev} isDebris={isDebris} />}
                >
                  <button
                    type="button"
                    className={`m2-satellite-anchor${isDebris ? ' is-debris' : ''}${isHov ? ' is-hovered' : ''}`}
                    aria-label={`${ev.year} ${ev.name}`}
                    data-m2-guide-target="satellite"
                    onPointerEnter={() => onHover(ev)}
                    onPointerLeave={onLeave}
                    onFocus={() => onHover(ev)}
                    onBlur={onLeave}
                    onClick={() => {
                      onGuideAction?.('satellite')
                      onClick(ev)
                    }}
                  >
                    <span>{ev.nameEn}</span>
                  </button>
                </Tooltip>
              </Html>
            </group>
          )
        })}
      </group>
    </group>
  )
}

// Static angles spread across the visible left semicircle.
const RAY_ANGLES = [
  Math.PI * 0.56,
  Math.PI * 0.78,
  Math.PI,
  Math.PI * 1.22,
  Math.PI * 1.44,
]

function EraRays({ activeEra }) {
  return (
    <>
      {RING_CONFIG.map((cfg, i) => {
        const angle  = RAY_ANGLES[i]
        const cos    = Math.cos(angle)
        const sin    = Math.sin(angle)
        const earthR = 7.1
        const ringR  = cfg.radius
        return (
          <group key={cfg.id}>
            <Line
              points={[[earthR * cos, earthR * sin, 0], [ringR * cos, ringR * sin, 0]]}
              color="#f5f7ff"
              lineWidth={0.75}
              transparent
              opacity={activeEra ? (activeEra === cfg.id ? 0.9 : 0.12) : 0.42 + i * 0.06}
            />
          </group>
        )
      })}
    </>
  )
}

function Scene({
  launchYear,
  hoveredId,
  clickedIds,
  activeEra,
  onHover,
  onLeave,
  onClick,
  onGuideAction,
  onFallHover,
  onFallMove,
  onFallLeave,
  visitKey,
}) {
  const { size } = useThree()
  const { zoom, verticalOffset } = getSceneMetrics(size.width, size.height)
  const rightEdge = size.width / (zoom * 2)

  return (
    <>
      <CameraSetup />
      <M4EarthLighting />

      <group position={[rightEdge + 0.18, 0.12 + verticalOffset, 0]}>
        <InteractiveEarth
          onGuideAction={onGuideAction}
          onFallHover={onFallHover}
          onFallMove={onFallMove}
          onFallLeave={onFallLeave}
          visitKey={visitKey}
        />
        <EraRays activeEra={activeEra} />
        {RING_CONFIG.map((cfg, i) => (
          <EraRing
            key={cfg.id}
            config={cfg}
            events={EVENTS_BY_ERA[i]}
            launchYear={launchYear}
            hoveredId={hoveredId}
            clickedIds={clickedIds}
            activeEra={activeEra}
            onHover={onHover}
            onLeave={onLeave}
            onClick={onClick}
            onGuideAction={onGuideAction}
          />
        ))}
      </group>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────

function Spinner() {
  return <motion.span className="m2-spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
}

export default function M2({ onComplete }) {
  const { language, pick } = useI18n()
  const satellite               = useAppStore(s => s.satellite)
  const user                    = useAppStore(s => s.user)
  const storyOutline            = useAppStore(s => s.storyOutline)
  const setDamageLevel          = useAppStore(s => s.setDamageLevel)
  const setClickedHistoryEvents = useAppStore(s => s.setClickedHistoryEvents)

  const [hoveredEv,  setHoveredEv]  = useState(null)
  const [selectedEv, setSelectedEv] = useState(null)
  const [hoveredEra, setHoveredEra] = useState(null)
  const [pinnedEra, setPinnedEra] = useState(null)
  const [clickedIds, setClickedIds] = useState(new Set())
  const [narratives, setNarratives] = useState({})
  const [loadingId,  setLoadingId]  = useState(null)
  const [guideInView, setGuideInView] = useState(false)
  const [guideVisitKey, setGuideVisitKey] = useState(0)
  const [guideDismissed, setGuideDismissed] = useState(false)
  const [hoveredFallEvent, setHoveredFallEvent] = useState(null)
  const guideVisualRef = useRef(null)
  const guideVisitActiveRef = useRef(false)
  const hoveredFallEventIdRef = useRef(null)
  const fallHoverX = useSpring(0, { stiffness: 520, damping: 40, mass: 0.34 })
  const fallHoverY = useSpring(0, { stiffness: 520, damping: 40, mass: 0.34 })

  const launchYear = satellite?.launchYear ?? 9999

  const onHover  = useCallback(ev => setHoveredEv(ev), [])
  const onLeave  = useCallback(() => setHoveredEv(null), [])
  const onGuideAction = useCallback((action) => {
    if (isM2GuideDismissAction(action)) setGuideDismissed(true)
  }, [])

  const onFallHover = useCallback((event, pointer) => {
    const hover = createFallEventHover(event, pointer)
    if (!hover) return

    hoveredFallEventIdRef.current = event['事件编号']
    fallHoverX.jump(hover.x)
    fallHoverY.jump(hover.y)
    setHoveredFallEvent(hover.event)
  }, [fallHoverX, fallHoverY])

  const onFallMove = useCallback((event, pointer) => {
    const hover = createFallEventHover(event, pointer)
    if (!hover) return

    if (hoveredFallEventIdRef.current !== event['事件编号']) {
      onFallHover(event, pointer)
      return
    }

    fallHoverX.set(hover.x)
    fallHoverY.set(hover.y)
  }, [fallHoverX, fallHoverY, onFallHover])

  const onFallLeave = useCallback((eventId) => {
    if (eventId != null && hoveredFallEventIdRef.current !== eventId) return
    hoveredFallEventIdRef.current = null
    setHoveredFallEvent(null)
  }, [])

  useEffect(() => { onComplete?.({ autoScroll: false }) }, [onComplete])

  const onClick = useCallback(ev => {
    setSelectedEv(ev)
    if (KEY_IDS.has(ev.id) && ev.year >= launchYear && !clickedIds.has(ev.id) && !loadingId) {
      setLoadingId(ev.id)
      generateEventNarrative({ event: ev, satellite, user, storyOutline })
        .then(res => {
          const narrative = res.narrative ?? ''
          const next = new Set(clickedIds); next.add(ev.id)
          const dmg = ALL_EVENTS
            .filter(e => KEY_IDS.has(e.id) && e.year >= launchYear && next.has(e.id))
            .reduce((s, e) => s + e.imp, 0)
          setNarratives(p => ({ ...p, [ev.id]: narrative }))
          setClickedIds(next)
          setDamageLevel(dmg)
          setClickedHistoryEvents([...next])
        })
        .catch(() => {})
        .finally(() => setLoadingId(null))
    }
  }, [clickedIds, loadingId, launchYear, satellite, user, storyOutline, setDamageLevel, setClickedHistoryEvents])

  const [globeInView, setGlobeInView] = useState(false)
  const globeWrapRef = useRef(null)

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setGlobeInView(true)
      return undefined
    }
    const io = new IntersectionObserver(([entry]) => setGlobeInView(entry.isIntersecting), { rootMargin: '120px' })
    if (globeWrapRef.current) io.observe(globeWrapRef.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const visual = guideVisualRef.current
    if (!visual || !('IntersectionObserver' in window)) {
      guideVisitActiveRef.current = true
      setGuideInView(true)
      setGuideVisitKey((current) => current + 1)
      return undefined
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !guideVisitActiveRef.current) {
        guideVisitActiveRef.current = true
        setGuideDismissed(false)
        setGuideVisitKey((current) => current + 1)
        setGuideInView(true)
        return
      }

      if (!entry.isIntersecting && guideVisitActiveRef.current) {
        guideVisitActiveRef.current = false
        setGuideInView(false)
        setGuideDismissed(false)
        setHoveredEv(null)
        setSelectedEv(null)
        onFallLeave()
      }
    }, { rootMargin: '-18% 0px -18% 0px' })

    observer.observe(visual)
    return () => observer.disconnect()
  }, [onFallLeave])

  const activeEra = hoveredEv?.era ?? hoveredEra ?? selectedEv?.era ?? pinnedEra

  return (
    <section className="m2">
      <div ref={globeWrapRef} className="m2-layout">
        <div className="m2-copy">
          <header className="m2-header">
            <span>03 / ORBITAL HISTORY</span>
            <h2>{pick('轨道，记得每一次碰撞。', 'Orbit remembers every collision.')}</h2>
            <p>{pick('从第一颗人造卫星升空开始，轨道上的遗留物就一直在增加。五个阶段，记录太空垃圾如何从少量残骸，逐渐成为今天必须面对的轨道问题。', "Since the first artificial satellite was launched, objects left in orbit have continued to accumulate. These five stages show how space debris grew from a small amount of leftover hardware into a major challenge for today's orbital environment.")}</p>
            <div className="m2-summary" aria-label={pick(`${ALL_EVENTS.length} 个历史事件，${FALL_EVENTS.length} 个坠落事件，5 个轨道阶段`, `${ALL_EVENTS.length} historical events, ${FALL_EVENTS.length} re-entry records, 5 orbital eras`)}>
              <span><strong>{ALL_EVENTS.length}</strong> ARCHIVED EVENTS</span>
              <span><strong>{FALL_EVENTS.length}</strong> FALL RECORDS</span>
              <span><strong>05</strong> ORBITAL ERAS</span>
            </div>
          </header>

          <nav className="m2-era-nav" aria-label={pick('历史阶段', 'Historical eras')}>
            {ERA_META.map((era, index) => {
              const isActive = activeEra === era.id
              const isPinned = pinnedEra === era.id

              return (
                <button
                  key={era.id}
                  type="button"
                  className={`${isActive ? 'is-active' : ''}${isPinned ? ' is-pinned' : ''}`}
                  aria-pressed={isPinned}
                  onPointerEnter={() => setHoveredEra(era.id)}
                  onPointerLeave={() => setHoveredEra(null)}
                  onFocus={() => setHoveredEra(era.id)}
                  onBlur={() => setHoveredEra(null)}
                  onClick={() => setPinnedEra((current) => current === era.id ? null : era.id)}
                >
                  <span className="m2-era-index">ERA 0{era.id}</span>
                  <span className="m2-era-range">{era.range}</span>
                  <span className="m2-era-symbol" aria-hidden="true">
                    <Orbit size={17} strokeWidth={1.35} />
                  </span>
                  <strong>{pick(era.name, era.nameEn)}</strong>
                  <p>{pick(era.desc, era.descEn)}</p>
                  <span className="m2-era-foot">
                    <span>{String(EVENTS_BY_ERA[index].length).padStart(2, '0')} EVENTS</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        <div ref={guideVisualRef} className="m2-visual">
          <div className="m2-canvas" onPointerLeave={() => onFallLeave()}>
          {globeInView && (
            <Canvas
              orthographic
              frameloop="always"
              camera={{ position: [0, 0, 100] }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: true }}
            >
              <Suspense fallback={null}>
                <Scene
                  launchYear={launchYear}
                  hoveredId={hoveredEv?.id ?? null}
                  clickedIds={clickedIds}
                  activeEra={activeEra}
                  onHover={onHover}
                  onLeave={onLeave}
                  onClick={onClick}
                  onGuideAction={onGuideAction}
                  onFallHover={onFallHover}
                  onFallMove={onFallMove}
                  onFallLeave={onFallLeave}
                  visitKey={guideVisitKey}
                />
              </Suspense>
            </Canvas>
          )}
          </div>

          <AnimatePresence>
            {hoveredFallEvent && (
              <motion.div
                key={hoveredFallEvent['事件编号']}
                className="m2-fall-hover-card"
                style={{ x: fallHoverX, y: fallHoverY }}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.16, ease: EASE }}
              >
                <FallEventTooltipCard event={hoveredFallEvent} />
              </motion.div>
            )}
          </AnimatePresence>

          <M2InteractionGuide
            active={guideInView && !guideDismissed && !selectedEv}
            visitKey={guideVisitKey}
            visualRef={guideVisualRef}
            language={language}
          />

          <AnimatePresence>
            {selectedEv && (
              <motion.aside
                key={selectedEv.id + '-panel'}
                className="m2-event-panel"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                transition={{ duration: 0.3, ease: EASE }}
                aria-live="polite"
              >
                <div className="m2-event-panel-head">
                  <div><span>{selectedEv.year}</span><small>ERA 0{selectedEv.era}</small></div>
                  <button type="button" onClick={() => setSelectedEv(null)} aria-label={pick('关闭事件详情', 'Close event details')}><X size={17} strokeWidth={1.6} /></button>
                </div>
                <span className="m2-event-panel-code">{selectedEv.nameEn}</span>
                <h3>{eventName(selectedEv, language)}</h3>
                <p>{eventDescription(selectedEv, language)}</p>

                {KEY_IDS.has(selectedEv.id) && (
                  <div className="m2-event-debris"><span>DEBRIS EVENT</span><strong>{selectedEv.debris}</strong></div>
                )}

                {loadingId === selectedEv.id && (
                  <div className="m2-event-loading"><Spinner /><span>SATELLITE LOG...</span></div>
                )}

                {narratives[selectedEv.id] && (
                  <motion.div className="m2-event-narrative" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <span>SATELLITE LOG</span>
                    <p>{narratives[selectedEv.id]}</p>
                  </motion.div>
                )}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
