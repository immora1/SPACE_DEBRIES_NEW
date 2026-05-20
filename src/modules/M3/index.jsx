import { useState, useRef, useMemo, useCallback, Suspense, useEffect } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import useAppStore from '../../store/useAppStore'
import { generateEventNarrative } from '../../services/ai'

const EASE = [0.16, 1, 0.3, 1]

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
  { id: 1, range: '1957–1969', name: '太空竞赛时代' },
  { id: 2, range: '1970–1989', name: '深空探索与空间站' },
  { id: 3, range: '1990–2009', name: '太空碎片危机浮现' },
  { id: 4, range: '2010–2019', name: '商业航天崛起' },
  { id: 5, range: '2020–2026', name: '新太空纪元' },
]

const RING_CONFIG = [
  { id: 1, radius: 8.0,  speed: 0.048, color: '#1e3a8a', satTypes: ['sputnik', 'dongfanghong'],              size: 0.75 },
  { id: 2, radius: 9.0,  speed: 0.036, color: '#163070', satTypes: ['early_box', 'cylinder_ant', 'sphere_wing'], size: 0.9 },
  { id: 3, radius: 10.0, speed: 0.026, color: '#1a3880', satTypes: ['comm', 'obs', 'nav'],                   size: 1.05 },
  { id: 4, radius: 11.0, speed: 0.018, color: '#1e4090', satTypes: ['platform', 'comms_large', 'multi_module'], size: 1.2 },
  { id: 5, radius: 12.0, speed: 0.013, color: '#162e78', satTypes: ['iss', 'tiangong'],                      size: 1.4 },
]

// ── 3D Components ──────────────────────────────────────────────────────────

// Orthographic camera: zoom = height/14 so Earth center (y=-7) sits exactly at viewport bottom
function CameraSetup() {
  const { camera, size } = useThree()
  useEffect(() => {
    // width/25 → Ring 5 (R=12) near screen edges; height/14 → Earth equator at viewport bottom
    camera.zoom = Math.max(size.width / 25, size.height / 14)
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function EarthMesh() {
  const spinRef = useRef()
  const texture = useLoader(THREE.TextureLoader, '/earth-m3.png?v=3')
  useFrame((_, dt) => { if (spinRef.current) spinRef.current.rotation.y -= dt * 0.02 })
  return (
    <group rotation={[-Math.PI / 2, 0, Math.PI]}>
      <group ref={spinRef}>
        <mesh>
          <sphereGeometry args={[6.5, 64, 64]} />
          <meshStandardMaterial map={texture} transparent roughness={0.65} metalness={0.05} emissive="#1a3a7a" emissiveIntensity={0.15} />
        </mesh>
        <mesh>
          <sphereGeometry args={[6.55, 28, 14]} />
          <meshStandardMaterial color="#2255aa" transparent opacity={0.02} wireframe />
        </mesh>
        <mesh>
          <sphereGeometry args={[6.82, 40, 40]} />
          <meshStandardMaterial color="#3366cc" emissive="#4488ff" emissiveIntensity={0.5} transparent opacity={0.06} side={2} />
        </mesh>
        <mesh>
          <sphereGeometry args={[7.28, 28, 28]} />
          <meshStandardMaterial color="#1a4080" emissive="#2255cc" emissiveIntensity={0.2} transparent opacity={0.03} side={2} />
        </mesh>
      </group>
    </group>
  )
}

// 10 satellite shapes across 5 complexity levels — body along X (tangential), panels along Y (radial)
function MiniSatellite({ type, bodyColor, panelColor, eInt, scale = 1 }) {
  const b = () => <meshStandardMaterial color={bodyColor}  emissive={bodyColor}  emissiveIntensity={eInt} />
  const p = () => <meshStandardMaterial color={panelColor} emissive={panelColor} emissiveIntensity={eInt * 1.5} />

  // ── RING 1 ── simplest, 1957–1969 ──────────────────────────────────────────
  // Sputnik: sphere + 4 diagonal trailing antennas
  if (type === 'sputnik') return (
    <group scale={scale}>
      <mesh><sphereGeometry args={[0.07, 8, 6]} />{b()}</mesh>
      <mesh position={[ 0.10,  0.10, 0]} rotation={[0,0,-0.78]}><cylinderGeometry args={[0.003,0.001,0.15,4]} />{p()}</mesh>
      <mesh position={[-0.10,  0.10, 0]} rotation={[0,0, 0.78]}><cylinderGeometry args={[0.003,0.001,0.15,4]} />{p()}</mesh>
      <mesh position={[ 0.10, -0.10, 0]} rotation={[0,0, 0.78]}><cylinderGeometry args={[0.003,0.001,0.15,4]} />{p()}</mesh>
      <mesh position={[-0.10, -0.10, 0]} rotation={[0,0,-0.78]}><cylinderGeometry args={[0.003,0.001,0.15,4]} />{p()}</mesh>
    </group>
  )
  // 东方红: low-poly faceted sphere + 2 short whip stubs
  if (type === 'dongfanghong') return (
    <group scale={scale}>
      <mesh><sphereGeometry args={[0.08, 5, 4]} />{b()}</mesh>
      <mesh position={[0,  0.13, 0]}><cylinderGeometry args={[0.005,0.002,0.09,4]} />{p()}</mesh>
      <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[0.005,0.002,0.09,4]} />{p()}</mesh>
    </group>
  )

  // ── RING 2 ── early operational, 1970–1989 ─────────────────────────────────
  // Early box: small rectangular bus + 1 side solar panel
  if (type === 'early_box') return (
    <group scale={scale}>
      <mesh><boxGeometry args={[0.13, 0.08, 0.06]} />{b()}</mesh>
      <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.15, 0.08, 0.005]} />{p()}</mesh>
      <mesh position={[0.12, 0, 0]}><cylinderGeometry args={[0.004,0.002,0.10,4]} />{p()}</mesh>
    </group>
  )
  // Cylinder + single top antenna
  if (type === 'cylinder_ant') return (
    <group scale={scale}>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.04,0.04,0.18,8]} />{b()}</mesh>
      <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.004,0.002,0.13,4]} />{p()}</mesh>
    </group>
  )
  // Sphere + single small wing
  if (type === 'sphere_wing') return (
    <group scale={scale}>
      <mesh><sphereGeometry args={[0.07, 7, 5]} />{b()}</mesh>
      <mesh position={[0, 0.13, 0]}><boxGeometry args={[0.12, 0.08, 0.005]} />{p()}</mesh>
    </group>
  )

  // ── RING 3 ── modern commercial, 1990–2009 ─────────────────────────────────
  // Comm sat: rectangular bus + 2 full solar wings
  if (type === 'comm') return (
    <group scale={scale * 0.6}>
      <mesh><boxGeometry args={[0.17, 0.07, 0.06]} />{b()}</mesh>
      <mesh position={[0,  0.14, 0]}><boxGeometry args={[0.22, 0.10, 0.005]} />{p()}</mesh>
      <mesh position={[0, -0.14, 0]}><boxGeometry args={[0.22, 0.10, 0.005]} />{p()}</mesh>
    </group>
  )
  // Observation sat: rect bus + wings + instrument boom
  if (type === 'obs') return (
    <group scale={scale * 0.6}>
      <mesh><boxGeometry args={[0.16, 0.07, 0.06]} />{b()}</mesh>
      <mesh position={[0,  0.14, 0]}><boxGeometry args={[0.20, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[0, -0.14, 0]}><boxGeometry args={[0.20, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[0.17, 0, 0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.004,0.004,0.14,4]} />{p()}</mesh>
    </group>
  )
  // Navigation sat: hexagonal body + 2 wings + dish stub
  if (type === 'nav') return (
    <group scale={scale * 0.6}>
      <mesh><cylinderGeometry args={[0.08,0.08,0.05,6]} />{b()}</mesh>
      <mesh position={[0,  0.16, 0]}><boxGeometry args={[0.16, 0.09, 0.005]} />{p()}</mesh>
      <mesh position={[0, -0.16, 0]}><boxGeometry args={[0.16, 0.09, 0.005]} />{p()}</mesh>
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

function EraRing({ config, events, launchYear, hoveredId, clickedIds, onHover, onLeave, onClick }) {
  const orbitRef = useRef()
  // Negative Z rotation = clockwise when viewed from front (+Z camera)
  useFrame((_, dt) => {
    if (orbitRef.current) orbitRef.current.rotation.z -= config.speed * dt
  })

  const dots = useMemo(() => events.map((ev, i) => {
    const angle = (2 * Math.PI * i) / events.length
    const satType = config.satTypes[i % config.satTypes.length]
    return { ev, angle, satType, x: config.radius * Math.cos(angle), y: config.radius * Math.sin(angle) }
  }), [events, config.radius, config.satTypes])

  // Upper semicircle only (θ: 0→π), avoids lower arc crossing at Earth horizon
  const arcGeo = useMemo(() => {
    const pts = []
    const segs = 96
    for (let i = 0; i <= segs; i++) {
      const θ = Math.PI * i / segs
      pts.push(new THREE.Vector3(config.radius * Math.cos(θ), config.radius * Math.sin(θ), 0))
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.01)
    return new THREE.TubeGeometry(curve, segs, 0.022, 5, false)
  }, [config.radius])

  return (
    <group>
      {/* Upper semicircle arc in XY plane */}
      <mesh geometry={arcGeo}>
        <meshStandardMaterial
          color={config.color}
          emissive={config.color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.6}
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
          // M1 palette: body = near-white #ebf2ff, panel = accent blue #6b7fff
          const bodyColor  = isKey && isActive ? '#f87171' : isActive ? '#ebf2ff' : '#8090c0'
          const panelColor = isKey && isActive ? '#f87171' : isActive ? '#6b7fff' : '#4a5a9a'

          return (
            <group key={ev.id} position={[x, y, 0.12]} rotation={[0, 0, angle + Math.PI / 2]}>
              {/* events on hit sphere only — prevents raytesting all visual child meshes */}
              <mesh
                onPointerOver={e => { e.stopPropagation(); onHover(ev) }}
                onPointerOut={() => onLeave()}
                onClick={e => { e.stopPropagation(); onClick(ev) }}
              >
                <sphereGeometry args={[0.35, 6, 4]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <MiniSatellite type={satType} bodyColor={bodyColor} panelColor={panelColor} eInt={eInt} scale={scale} />
              <Html position={[0, -0.5, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <div style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 5,
                  color: isKey && isActive ? '#f87171' : isActive ? '#6b7fff' : '#2a3060',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.04em',
                  opacity: isHov ? 1 : 0.75,
                }}>
                  {ev.nameEn}
                </div>
              </Html>
            </group>
          )
        })}
      </group>
    </group>
  )
}

// Static angles — spread nearly full upper semicircle (right-side to left-side)
const RAY_ANGLES = [
  Math.PI * 0.04,   // ERA 1: ~7°  far right
  Math.PI * 0.24,   // ERA 2: ~43° upper right
  Math.PI * 0.50,   // ERA 3: 90°  straight up
  Math.PI * 0.76,   // ERA 4: ~137° upper left
  Math.PI * 0.96,   // ERA 5: ~173° far left
]

function EraRays() {
  return (
    <>
      {RING_CONFIG.map((cfg, i) => {
        const angle  = RAY_ANGLES[i]
        const cos    = Math.cos(angle)
        const sin    = Math.sin(angle)
        const earthR = 7.1
        const ringR  = cfg.radius
        const midR   = (earthR + ringR) * 0.5
        const meta   = ERA_META[i]
        return (
          <group key={cfg.id}>
            <Line
              points={[[earthR * cos, earthR * sin, 0], [ringR * cos, ringR * sin, 0]]}
              color="#6b7fff"
              lineWidth={1.2}
              transparent
              opacity={0.75}
            />
            <Html position={[midR * cos, midR * sin, 0.5]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, color: '#6b7fff', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                  ERA 0{meta.id} · {meta.range}
                </div>
                <div style={{ fontFamily: "'Noto Sans SC', sans-serif", fontSize: 7, color: '#8888aa', whiteSpace: 'nowrap' }}>
                  {meta.name}
                </div>
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

function Scene({ launchYear, hoveredId, clickedIds, onHover, onLeave, onClick }) {
  const eventsByEra = ERA_META.map(era => ALL_EVENTS.filter(e => e.era === era.id))
  return (
    <>
      <CameraSetup />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 8]} intensity={1.4} color="#c8d8ff" />
      <pointLight position={[-10, 6, 6]} intensity={0.5} color="#4466cc" />
      <pointLight position={[8, -4, 4]} intensity={0.2} color="#3355aa" />

      <group position={[0, -7, 0]}>
        <EarthMesh />
        <EraRays />
        {RING_CONFIG.map((cfg, i) => (
          <EraRing
            key={cfg.id}
            config={cfg}
            events={eventsByEra[i]}
            launchYear={launchYear}
            hoveredId={hoveredId}
            clickedIds={clickedIds}
            onHover={onHover}
            onLeave={onLeave}
            onClick={onClick}
          />
        ))}
      </group>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{ display: 'inline-block', width: 10, height: 10, border: '1px solid #6b7fff', borderTopColor: 'transparent', borderRadius: '50%' }}
    />
  )
}

export default function M3({ onComplete }) {
  const satellite               = useAppStore(s => s.satellite)
  const user                    = useAppStore(s => s.user)
  const storyOutline            = useAppStore(s => s.storyOutline)
  const setDamageLevel          = useAppStore(s => s.setDamageLevel)
  const setClickedHistoryEvents = useAppStore(s => s.setClickedHistoryEvents)

  const [hoveredEv,  setHoveredEv]  = useState(null)
  const [selectedEv, setSelectedEv] = useState(null)
  const [clickedIds, setClickedIds] = useState(new Set())
  const [narratives, setNarratives] = useState({})
  const [loadingId,  setLoadingId]  = useState(null)

  const launchYear = satellite?.launchYear ?? 9999

  const onHover  = useCallback(ev => setHoveredEv(ev), [])
  const onLeave  = useCallback(() => setHoveredEv(null), [])

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

  return (
    <div style={{ color: '#e8e8f8' }}>
      <div style={{ position: 'relative', width: '100%', height: '100vh', minHeight: 500, overflow: 'hidden' }}>

        <Canvas
          orthographic
          camera={{ position: [0, 0, 100] }}
          style={{ position: 'absolute', inset: 0 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <Scene
              launchYear={launchYear}
              hoveredId={hoveredEv?.id ?? null}
              clickedIds={clickedIds}
              onHover={onHover}
              onLeave={onLeave}
              onClick={onClick}
            />
          </Suspense>
        </Canvas>

        {/* Title overlay */}
        <div style={{
          position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 3, textAlign: 'center', pointerEvents: 'none', width: '100%',
        }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#484878', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16 }}>
            03 · HISTORY
          </div>
          <h2 style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 'clamp(18px, 2.2vw, 28px)',
            fontWeight: 400, color: '#e8e8f8', lineHeight: 1.7, margin: '0 0 18px',
          }}>
            每一次碰撞都留下了痕迹，<br />每一片碎片都还在轨道上。
          </h2>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, color: '#6b7fff', letterSpacing: '0.06em', marginBottom: 6 }}>
            {ALL_EVENTS.length} 个历史事件
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, color: '#484878', letterSpacing: '0.16em' }}>
            CLICK ANY SATELLITE TO EXPLORE · DEBRIS EVENTS GLOW RED
          </div>
        </div>

        {/* ERA legend — left side */}
        <div style={{
          position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)',
          zIndex: 3, pointerEvents: 'none',
        }}>
          {ERA_META.map((era, i) => (
            <div key={era.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 22, height: 1.5, background: RING_CONFIG[i].color, opacity: 0.55 }} />
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, color: RING_CONFIG[i].color, opacity: 0.7, letterSpacing: '0.1em' }}>
                  ERA 0{era.id} · {era.range}
                </div>
                <div style={{ fontFamily: "'Noto Sans SC', sans-serif", fontSize: 9, color: '#484878' }}>
                  {era.name}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredEv && (
            <motion.div
              key={hoveredEv.id + '-tip'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, pointerEvents: 'none',
              }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '6px 16px',
                background: 'rgba(8,8,26,0.88)', border: '1px solid #1a1a35',
                backdropFilter: 'blur(10px)',
              }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: '#484878' }}>
                  {hoveredEv.year}
                </span>
                <span style={{ fontFamily: "'Noto Sans SC', sans-serif", fontSize: 12, color: '#e8e8f8' }}>
                  {hoveredEv.name}
                </span>
                {KEY_IDS.has(hoveredEv.id) && hoveredEv.year >= launchYear && (
                  <span style={{
                    fontFamily: "'Space Mono', monospace", fontSize: 6, color: '#f87171',
                    border: '1px solid rgba(248,113,113,0.35)', padding: '1px 5px',
                  }}>
                    DEBRIS
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected event panel — right side */}
        <AnimatePresence>
          {selectedEv && (
            <motion.div
              key={selectedEv.id + '-panel'}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{
                position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
                zIndex: 10, width: 300,
              }}
            >
              <div style={{
                padding: '18px 20px',
                background: 'rgba(8,8,26,0.92)', border: '1px solid #1a1a35',
                backdropFilter: 'blur(16px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: '#484878', letterSpacing: '0.1em' }}>
                    {selectedEv.year}
                  </span>
                  <button
                    onClick={() => setSelectedEv(null)}
                    style={{ background: 'none', border: 'none', color: '#484878', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 14, color: '#e8e8f8', lineHeight: 1.5, marginBottom: 10 }}>
                  {selectedEv.name}
                </div>
                {KEY_IDS.has(selectedEv.id) && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{
                      fontFamily: "'Space Mono', monospace", fontSize: 6, color: '#f87171',
                      border: '1px solid rgba(248,113,113,0.3)', padding: '2px 6px', letterSpacing: '0.08em',
                    }}>
                      DEBRIS EVENT · +{selectedEv.debris}
                    </span>
                  </div>
                )}
                <p style={{ fontFamily: "'Noto Sans SC', sans-serif", fontSize: 11, color: '#8888a8', lineHeight: 1.9, margin: '0 0 12px' }}>
                  {selectedEv.desc}
                </p>

                {loadingId === selectedEv.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Spinner />
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: '#484878', letterSpacing: '0.1em' }}>
                      SATELLITE LOG...
                    </span>
                  </div>
                )}

                {narratives[selectedEv.id] && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ paddingLeft: 10, borderLeft: '2px solid rgba(107,127,255,0.4)' }}
                  >
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, color: '#484878', letterSpacing: '0.14em', marginBottom: 8, textTransform: 'uppercase' }}>
                      Satellite Log
                    </div>
                    <p style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 11, color: '#b8b8d8', lineHeight: 2, margin: 0, fontStyle: 'italic' }}>
                      {narratives[selectedEv.id]}
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
          <button
            onClick={onComplete}
            style={{
              padding: '12px 32px', background: 'transparent',
              border: '1px solid rgba(107,127,255,0.5)', color: '#6b7fff',
              fontFamily: "'Space Mono', monospace", fontSize: 10,
              letterSpacing: '0.14em', cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            继续 →
          </button>
        </div>

        {/* Horizon gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          background: 'linear-gradient(to top, rgba(4,4,15,0.7), transparent)',
          zIndex: 2, pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}
