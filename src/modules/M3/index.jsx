import { useState, useRef, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { generateEventNarrative, generateHistoryStory } from '../../services/ai'

const EASE = [0.16, 1, 0.3, 1]

// ── Event data ──────────────────────────────────────────────────────────────
// type: 'debris' | 'explore' | 'disaster' | 'science'
// imp: 0-3 (controls sphere size + brightness)
// era: 1-5
const ALL_EVENTS = [
  // ERA 1 · 太空竞赛时代 1957-1969
  { id:'sputnik1',    era:1, year:1957.8, type:'explore',  imp:3, name:'Sputnik 1 入轨',          nameEn:'SPUTNIK 1',        debris:'—',      desc:'人类首颗人造卫星入轨，开启太空时代。也是轨道碎片历史的零点——此后每次发射都在轨道留下残骸。' },
  { id:'sputnik2',    era:1, year:1957.9, type:'explore',  imp:1, name:'Sputnik 2 携犬入轨',       nameEn:'SPUTNIK 2',        debris:'—',      desc:'小狗莱卡随 Sputnik 2 入轨，首个携带生物的航天器，也是轨道上第一个"太空墓碑"。' },
  { id:'explorer1',   era:1, year:1958.1, type:'explore',  imp:2, name:'Explorer 1 入轨',          nameEn:'EXPLORER 1',       debris:'—',      desc:'美国首颗卫星，发现范艾伦辐射带，标志着美国正式进入太空竞赛。' },
  { id:'nasa',        era:1, year:1958.8, type:'explore',  imp:1, name:'NASA 正式成立',            nameEn:'NASA FOUNDED',     debris:'—',      desc:'美国国家航空航天局建立，统一管理民用航天项目。' },
  { id:'luna1',       era:1, year:1959.1, type:'explore',  imp:1, name:'Luna 1 飞越月球',          nameEn:'LUNA 1',           debris:'—',      desc:'首个飞越月球的探测器，发现太阳风，成为首个绕太阳运行的人造天体。' },
  { id:'tiros1',      era:1, year:1960.3, type:'explore',  imp:1, name:'TIROS-1 气象卫星',         nameEn:'TIROS-1',          debris:'—',      desc:'首颗气象卫星，开创卫星对地观测历史，也是早期在轨遗留物的典型代表。' },
  { id:'gagarin',     era:1, year:1961.3, type:'explore',  imp:3, name:'加加林首次入轨',           nameEn:'VOSTOK 1',         debris:'—',      desc:'尤里·加加林完成人类首次太空飞行，绕地球一圈后安全返回，历时 108 分钟。' },
  { id:'shepard',     era:1, year:1961.4, type:'explore',  imp:2, name:'谢泼德首次亚轨道',          nameEn:'FREEDOM 7',        debris:'—',      desc:'艾伦·谢泼德成为美国首位宇航员，完成 15 分钟亚轨道飞行。' },
  { id:'ablestar',    era:1, year:1961.7, type:'debris',   imp:2, name:'首次在轨解体',             nameEn:'FIRST BREAKUP',    debris:'~300',   desc:'Ablestar 上面级在轨爆炸解体，产生有记录的第一批人工轨道碎片约 300 件，证明轨道碎片问题真实存在。' },
  { id:'telstar1',    era:1, year:1962.5, type:'explore',  imp:1, name:'Telstar 1 通信卫星',       nameEn:'TELSTAR 1',        debris:'—',      desc:'首颗有源通信卫星，实现跨大西洋实时电视转播，开启卫星通信时代。' },
  { id:'tereshkova',  era:1, year:1963.5, type:'explore',  imp:2, name:'首位女性宇航员入轨',        nameEn:'VOSTOK 6',         debris:'—',      desc:'捷列什科娃独自驾驶 Vostok 6 绕地飞行 48 圈，成为第一位进入太空的女性。' },
  { id:'leonov',      era:1, year:1965.2, type:'explore',  imp:2, name:'列昂诺夫太空行走',          nameEn:'FIRST EVA',        debris:'—',      desc:'阿列克谢·列昂诺夫完成人类首次太空行走，在舱外停留约 12 分钟。' },
  { id:'mariner4',    era:1, year:1965.5, type:'science',  imp:1, name:'Mariner 4 飞越火星',       nameEn:'MARINER 4',        debris:'—',      desc:'首次实现火星近距离飞越，拍摄 21 张照片，揭示火星是布满陨击坑的荒凉世界。' },
  { id:'luna9',       era:1, year:1966.1, type:'explore',  imp:2, name:'Luna 9 月面软着陆',        nameEn:'LUNA 9',           debris:'—',      desc:'首次实现月球软着陆，证明月面可以承受着陆器重量，为载人登月铺路。' },
  { id:'apollo1',     era:1, year:1967.1, type:'disaster', imp:2, name:'阿波罗 1 号火灾',          nameEn:'APOLLO 1',         debris:'—',      desc:'地面测试中座舱起火，三名宇航员遇难。NASA 彻底重新设计载人飞船，停飞 21 个月。' },
  { id:'soyuz1',      era:1, year:1967.3, type:'disaster', imp:1, name:'Soyuz 1 首飞失事',         nameEn:'SOYUZ 1',          debris:'—',      desc:'联盟号飞船首飞，降落伞故障导致科马洛夫遇难，成为首位在执行太空任务中牺牲的宇航员。' },
  { id:'soyuz7',      era:1, year:1967.9, type:'explore',  imp:0, name:'联盟 7 号首飞',            nameEn:'SOYUZ 7',          debris:'—',      desc:'联盟号系列持续飞行，苏联载人航天项目重新建立。' },
  { id:'apollo8',     era:1, year:1968.9, type:'explore',  imp:2, name:'阿波罗 8 号绕月',          nameEn:'APOLLO 8',         debris:'—',      desc:'人类首次飞离地球轨道绕月飞行，"地出"照片成为环保运动标志性图像。' },
  { id:'apollo11',    era:1, year:1969.5, type:'explore',  imp:3, name:'阿波罗 11 号登月',         nameEn:'APOLLO 11',        debris:'—',      desc:'尼尔·阿姆斯特朗踏上月球，全球 6 亿人电视直播。登月舱下降级至今仍在月球表面。' },

  // ERA 2 · 深空探索与空间站建设 1970-1989
  { id:'apollo13',    era:2, year:1970.3, type:'disaster', imp:2, name:'阿波罗 13 号险情',         nameEn:'APOLLO 13',        debris:'—',      desc:'氧气罐爆炸，宇航员绕月借力返回，成为航天史上最著名的成功救援。' },
  { id:'dongfanghong',era:2, year:1970.4, type:'explore',  imp:2, name:'东方红一号入轨',           nameEn:'DONGFANGHONG 1',   debris:'—',      desc:'中国首颗人造卫星入轨，成为第五个独立研制并发射卫星的国家。该卫星至今仍在轨道中。' },
  { id:'salyut1',     era:2, year:1971.3, type:'explore',  imp:1, name:'礼炮 1 号空间站',          nameEn:'SALYUT 1',         debris:'—',      desc:'人类第一个空间站，Soyuz 11 乘组工作 23 天后于返回途中遇难。礼炮 1 号受控离轨。' },
  { id:'apollo17',    era:2, year:1972.9, type:'explore',  imp:2, name:'阿波罗 17 末次登月',       nameEn:'APOLLO 17',        debris:'—',      desc:'人类最后一次登月，宇航员在月球表面停留约 75 小时。此后半个世纪再无人类踏上月球。' },
  { id:'skylab',      era:2, year:1973.4, type:'explore',  imp:1, name:'天空实验室入轨',           nameEn:'SKYLAB',           debris:'—',      desc:'美国首个空间站，1979 年失控坠落澳大利亚，敲响大型飞行器非受控再入的警钟。' },
  { id:'astp',        era:2, year:1975.5, type:'explore',  imp:1, name:'阿波罗-联盟联合任务',      nameEn:'APOLLO-SOYUZ',     debris:'—',      desc:'美苏首次联合载人航天任务，象征冷战太空竞赛开始走向合作。' },
  { id:'voyager1',    era:2, year:1977.7, type:'explore',  imp:2, name:'旅行者 1 号发射',          nameEn:'VOYAGER 1',        debris:'—',      desc:'旅行者 1 号发射，开始超过 40 年的太阳系勘探旅程。2012 年正式飞越星际空间。' },
  { id:'kessler',     era:2, year:1978.0, type:'debris',   imp:3, name:'Kessler 级联效应理论',     nameEn:'KESSLER THEORY',   debris:'理论预警', desc:'NASA 科学家凯斯勒发表论文，预言轨道碎片密度超过临界点后将引发自持续级联碰撞，最终使低轨道不可用。太空碎片研究史上最重要的理论基石。' },
  { id:'kosmos954',   era:2, year:1978.1, type:'debris',   imp:2, name:'Kosmos 954 核泄漏坠落',    nameEn:'KOSMOS 954',       debris:'~50',    desc:'苏联核动力卫星失控再入，放射性碎片散落加拿大西北超过 600 km。首次核动力卫星非受控再入，引发国际法律讨论。' },
  { id:'columbia1',   era:2, year:1981.3, type:'explore',  imp:1, name:'哥伦比亚号首飞',           nameEn:'STS-1',            debris:'—',      desc:'世界首架可重复使用航天飞机首次飞行，开创航天飞机时代。' },
  { id:'pioneer10',   era:2, year:1983.5, type:'science',  imp:1, name:'先驱者 10 号飞越海王星轨道', nameEn:'PIONEER 10',       debris:'—',      desc:'首个飞越海王星轨道的人造天体，开始进入太阳系外围区域。' },
  { id:'firstrepair', era:2, year:1984.0, type:'explore',  imp:1, name:'首次在轨卫星维修',          nameEn:'FIRST SAT REPAIR', debris:'—',      desc:'航天飞机宇航员首次在轨捕获、维修并重新部署卫星，证明在轨维修技术可行。' },
  { id:'challenger',  era:2, year:1986.1, type:'disaster', imp:3, name:'挑战者号解体',             nameEn:'CHALLENGER',       debris:'—',      desc:'升空 73 秒后 O 形环失效解体，7 名宇航员遇难，NASA 停飞 32 个月。' },
  { id:'mir',         era:2, year:1986.2, type:'explore',  imp:2, name:'和平号空间站启建',          nameEn:'MIR',              debris:'—',      desc:'苏联和平号空间站开始建设，最终在轨运行 15 年，2001 年受控离轨入南太平洋。' },
  { id:'voyager2np',  era:2, year:1989.6, type:'science',  imp:1, name:'旅行者 2 号飞越海王星',     nameEn:'VOYAGER 2',        debris:'—',      desc:'旅行者 2 号飞越海王星，成为唯一近距离探访全部太阳系外行星的探测器。' },

  // ERA 3 · 太空碎片危机浮现 1990-2009
  { id:'hubble',      era:3, year:1990.3, type:'explore',  imp:2, name:'哈勃望远镜入轨',           nameEn:'HUBBLE',           debris:'—',      desc:'哈勃太空望远镜发射入轨，1993 年首次维修后成为人类最伟大的科学仪器之一，在轨运行至今。' },
  { id:'kosmos1934',  era:3, year:1991.0, type:'debris',   imp:2, name:'Kosmos-1934 碎片碰撞',     nameEn:'KOSMOS-1934',      debris:'少量',   desc:'苏联卫星 Kosmos-1934 被 Cosmos-955 碎片击中，首次有记录的在轨碎片碰撞，直接验证了 Kessler 理论。' },
  { id:'hubblefix',   era:3, year:1993.9, type:'explore',  imp:1, name:'哈勃首次维修成功',          nameEn:'HUBBLE REPAIR',    debris:'—',      desc:'宇航员成功修复哈勃镜面像差，揭示宇宙深空壮观图像，成为最具代表性的在轨维修任务。' },
  { id:'clementine',  era:3, year:1994.1, type:'science',  imp:1, name:'Clementine 月极水冰',      nameEn:'CLEMENTINE',       debris:'—',      desc:'首次探测到月球极地可能存在水冰的迹象，为未来月球基地建设提供关键依据。' },
  { id:'cerise',      era:3, year:1996.6, type:'debris',   imp:2, name:'Cerise 首次碎片碰撞',      nameEn:'CERISE COLLISION', debris:'~5',     desc:'法国 Cerise 卫星被 1986 年阿里亚娜残骸击中，稳定杆被切断。史上首次有完整记录的在轨碎片碰撞。' },
  { id:'lottie',      era:3, year:1997.1, type:'debris',   imp:1, name:'Lottie Williams 被碎片击中', nameEn:'LOTTIE WILLIAMS',  debris:'140g',  desc:'美国女性晨跑时被 Delta II 火箭燃料箱碎片击中肩部，无大碍，成为史上唯一有记录被太空垃圾击中的人类。' },
  { id:'issbuild',    era:3, year:1998.9, type:'explore',  imp:2, name:'ISS 国际空间站启建',        nameEn:'ISS BEGIN',        debris:'—',      desc:'国际空间站首个舱段扎里亚入轨，人类最大在轨建设项目启动，耗时 13 年建成。' },
  { id:'stardust',    era:3, year:1999.2, type:'science',  imp:0, name:'Stardust 彗星采样',        nameEn:'STARDUST',         debris:'—',      desc:'NASA 星尘号探测器发射，2006 年将彗星尘埃样本带回地球，首个彗星物质采样任务。' },
  { id:'mirdeorbit',  era:3, year:2001.2, type:'explore',  imp:1, name:'和平号受控离轨',           nameEn:'MIR DEORBIT',      debris:'—',      desc:'和平号在轨 15 年后受控离轨，碎片落入南太平洋，迄今最大在轨结构受控再入案例。' },
  { id:'columbia2',   era:3, year:2003.1, type:'disaster', imp:3, name:'哥伦比亚号大气层解体',      nameEn:'COLUMBIA',         debris:'—',      desc:'哥伦比亚号返回时因隔热板损伤解体，7 名宇航员遇难，航天飞机再次停飞 29 个月。' },
  { id:'spaceone',    era:3, year:2004.5, type:'explore',  imp:1, name:'SpaceShipOne 亚轨道',      nameEn:'SPACESHIPONE',     debris:'—',      desc:'首次私人资助的载人亚轨道飞行成功，赢得 Ansari X Prize，开启商业太空时代。' },
  { id:'newhorizons', era:3, year:2006.1, type:'explore',  imp:1, name:'新视野号飞往冥王星',        nameEn:'NEW HORIZONS',     debris:'—',      desc:'NASA 新视野号探测器发射，2015 年飞越冥王星，发回首张清晰图像。' },
  { id:'fy1c',        era:3, year:2007.0, type:'debris',   imp:3, name:'风云一号 C 反卫测试',       nameEn:'FY-1C ASAT TEST',  debris:'3,500+', desc:'中国用动能拦截弹摧毁自有气象卫星，产生超过 3,500 件可追踪碎片，迄今单次制造碎片最多的事件。' },
  { id:'phoenix',     era:3, year:2008.4, type:'science',  imp:0, name:'凤凰号火星着陆',           nameEn:'PHOENIX LANDER',   debris:'—',      desc:'首次在火星极地着陆，确认存在水冰，开创高纬度探测先例。' },
  { id:'esapolicy',   era:3, year:2008.9, type:'debris',   imp:2, name:'ESA 碎片预防政策强制化',    nameEn:'ESA DEBRIS POLICY', debris:'政策节点', desc:'欧洲航天局正式要求新任务遵循"25 年离轨规定"，成为首个将碎片预防纳入任务强制要求的大型航天机构。' },
  { id:'iridium',     era:3, year:2009.1, type:'debris',   imp:3, name:'铱星-33 / Cosmos-2251 碰撞', nameEn:'IRIDIUM × COSMOS', debris:'2,000+', desc:'首次大型运营卫星高速碰撞，产生约 2,000 件碎片，相对碰撞速度约 11.7 km/s，凯斯勒效应进入公众视野。' },

  // ERA 4 · 商业航天崛起 2010-2019
  { id:'falcon9_1st', era:4, year:2010.4, type:'explore',  imp:2, name:'Falcon 9 首飞成功',         nameEn:'FALCON 9',         debris:'—',      desc:'SpaceX Falcon 9 首飞成功，开创可重复使用火箭新纪元。' },
  { id:'shuttle_ret', era:4, year:2011.5, type:'explore',  imp:2, name:'航天飞机正式退役',           nameEn:'SHUTTLE RETIRED',  debris:'—',      desc:'亚特兰蒂斯号完成最后一次任务，航天飞机计划正式结束，美国载人航天依赖俄罗斯联盟号。' },
  { id:'dragon_iss',  era:4, year:2012.4, type:'explore',  imp:2, name:'Dragon 首次对接 ISS',       nameEn:'DRAGON ISS',       debris:'—',      desc:'SpaceX Dragon 成为首艘与国际空间站对接的私人飞船，开创商业货运新时代。' },
  { id:'curiosity',   era:4, year:2012.6, type:'science',  imp:2, name:'好奇号火星着陆',            nameEn:'CURIOSITY',        debris:'—',      desc:'好奇号在盖尔撞击坑内部着陆，用空中吊车完成史上最复杂的着陆机动，开始长期火星科学考察。' },
  { id:'voyager1_is', era:4, year:2012.7, type:'science',  imp:2, name:'旅行者 1 号进入星际空间',    nameEn:'V1 INTERSTELLAR',  debris:'—',      desc:'旅行者 1 号正式飞越太阳风层顶，成为首个进入星际空间的人造天体。' },
  { id:'chelyabinsk', era:4, year:2013.1, type:'science',  imp:2, name:'车里雅宾斯克陨石',          nameEn:'CHELYABINSK',      debris:'—',      desc:'约 20 米小行星在俄罗斯上空爆炸，冲击波造成 1,500 人受伤，自然天体警示与人造碎片风险形成对比。' },
  { id:'clearspace13',era:4, year:2013.5, type:'debris',   imp:2, name:'ESA 宣布 ClearSpace-1 计划', nameEn:'CLEARSPACE PLAN',  debris:'计划节点', desc:'欧洲航天局启动首个专门用于主动清除轨道碎片的任务研究，轨道碎片治理从被动预防走向主动清除。' },
  { id:'nhpluto',     era:4, year:2015.5, type:'science',  imp:1, name:'新视野号飞越冥王星',         nameEn:'NEW HORIZONS PLUTO', debris:'—',    desc:'新视野号发回冥王星高清图像，揭示冰冻平原和山脉，颠覆对外太阳系的认知。' },
  { id:'falcon9land', era:4, year:2015.9, type:'explore',  imp:2, name:'Falcon 9 一级火箭首次着陆回收', nameEn:'FALCON 9 LAND',  debris:'—',      desc:'SpaceX 首次成功垂直回收 Falcon 9 一级火箭，可重复使用航天器进入实用化时代。' },
  { id:'ligo',        era:4, year:2016.1, type:'science',  imp:2, name:'LIGO 首次探测引力波',        nameEn:'LIGO',             debris:'—',      desc:'人类首次直接探测到引力波，证实爱因斯坦百年预言，开启引力波天文学新窗口。' },
  { id:'falconheavy', era:4, year:2018.1, type:'explore',  imp:1, name:'Falcon Heavy 首飞',         nameEn:'FALCON HEAVY',     debris:'—',      desc:'SpaceX Falcon Heavy 首飞成功，将马斯克的特斯拉跑车送入太空，成为现役运力最强火箭。' },
  { id:'change4o',    era:4, year:2018.9, type:'explore',  imp:1, name:'嫦娥 4 号绕月',             nameEn:"CHANGE 4 ORBIT",   debris:'—',      desc:'嫦娥 4 号进入绕月轨道，为人类首次月球背面着陆任务做准备。' },
  { id:'change4l',    era:4, year:2019.0, type:'explore',  imp:2, name:'嫦娥 4 号月背着陆',         nameEn:"CHANGE 4 LAND",    debris:'—',      desc:'嫦娥 4 号成功着陆月球背面，人类探测器首次踏足月背，开创深空探测新里程。' },
  { id:'india_asat',  era:4, year:2019.2, type:'debris',   imp:2, name:'印度 ASAT 测试 Mission Shakti', nameEn:'INDIA ASAT',     debris:'400+',   desc:'印度击毁自有卫星，产生超过 400 件可追踪碎片，部分碎片进入更高轨道，NASA 局长称之为"可怕的事情"。' },
  { id:'starlink1',   era:4, year:2019.4, type:'debris',   imp:3, name:'Starlink 巨型星座部署开始',  nameEn:'STARLINK BEGIN',   debris:'持续累积', desc:'首批 60 颗 Starlink 卫星发射，开启人类历史上规模最大的单一星座部署。截至 2025 年在轨超过 6,000 颗，引发轨道资源争议和碎片风险担忧。' },

  // ERA 5 · 新太空纪元 2020-2026
  { id:'demo2',       era:5, year:2020.4, type:'explore',  imp:2, name:'Crew Dragon 首次载人飞行',   nameEn:'CREW DRAGON',      debris:'—',      desc:'SpaceX Crew Dragon 搭载两名宇航员飞往 ISS，美国时隔 9 年重获载人发射能力。' },
  { id:'change5',     era:5, year:2020.9, type:'explore',  imp:2, name:'嫦娥 5 号月壤采样返回',      nameEn:"CHANGE 5",         debris:'—',      desc:'嫦娥 5 号带回 1.731 千克月壤，人类 44 年来首次月球采样任务，验证中国深空返回能力。' },
  { id:'ingenuity',   era:5, year:2021.3, type:'science',  imp:2, name:'机智号火星飞行',            nameEn:'INGENUITY',        debris:'—',      desc:'机智号无人直升机在火星完成首次动力飞行，成为首个在地球以外天体实现动力飞行的飞行器。' },
  { id:'tourism',     era:5, year:2021.6, type:'explore',  imp:1, name:'太空旅游商业化元年',         nameEn:'SPACE TOURISM',    debris:'—',      desc:'维珍银河、蓝色起源在同年完成商业载人飞行，亿万富翁太空游成为现实，引发太空商业化伦理讨论。' },
  { id:'cz5b_deb',    era:5, year:2021.8, type:'debris',   imp:2, name:'长征 5B 残骸失控再入',       nameEn:'CZ-5B DEBRIS',     debris:'残骸',   desc:'中国长征 5B 运载火箭约 22 吨残骸失控再入大气层，部分碎片落入印度洋，多国批评中国未实施主动离轨处置。' },
  { id:'cosmos1408',  era:5, year:2021.9, type:'debris',   imp:3, name:'俄罗斯 ASAT 摧毁 Cosmos 1408', nameEn:'COSMOS 1408 ASAT', debris:'1,500+', desc:'俄罗斯导弹击毁自有失效卫星，产生超过 1,500 件可追踪碎片，迫使 ISS 宇航员紧急躲入联盟号，美国随后宣布单方面禁止破坏性 ASAT 测试。' },
  { id:'jwst',        era:5, year:2021.9, type:'science',  imp:3, name:'詹姆斯·韦伯太空望远镜发射',  nameEn:'JWST',             debris:'—',      desc:'韦伯望远镜发射，成为人类有史以来最强大的太空望远镜，揭示宇宙诞生后数亿年的第一批星系图像。' },
  { id:'dart',        era:5, year:2022.7, type:'science',  imp:2, name:'DART 首次改变小行星轨道',    nameEn:'DART',             debris:'—',      desc:'NASA DART 探测器撞击 Dimorphos，成功将其轨道周期改变约 33 分钟，首次验证行星防御技术可行性。' },
  { id:'artemis1',    era:5, year:2022.9, type:'explore',  imp:2, name:'Artemis I 无人绕月飞行',     nameEn:'ARTEMIS I',        debris:'—',      desc:'NASA SLS 火箭首次飞行，Orion 飞船无人绕月，为载人重返月球任务铺路。' },
  { id:'tiangong',    era:5, year:2022.9, type:'explore',  imp:2, name:'天宫空间站建成',            nameEn:'TIANGONG CSS',     debris:'—',      desc:'中国天宫空间站三舱构型正式建成，成为全球唯一由单一国家独立运营的在轨空间站。' },
  { id:'chandra3',    era:5, year:2023.6, type:'explore',  imp:2, name:'印度 Chandrayaan-3 月南极着陆', nameEn:'CHANDRAYAAN-3',    debris:'—',      desc:'印度成为继苏联、美国、中国之后第四个实现月球软着陆的国家，首次确认月球南极存在水冰。' },
  { id:'esa_zero',    era:5, year:2023.8, type:'debris',   imp:2, name:'ESA"零碎片宪章"',          nameEn:'ESA ZERO DEBRIS',  debris:'政策节点', desc:'欧洲航天局宣布到 2030 年实现自身任务"零碎片"目标，轨道碎片治理话语权从被动应对升级为主动承诺。' },
  { id:'cz6a_deb',    era:5, year:2024.0, type:'debris',   imp:2, name:'长征 6A 上面级解体',         nameEn:'CZ-6A DEBRIS',     debris:'200+',   desc:'中国长征 6A 运载火箭上面级在轨发生解体，产生超过 200 件可追踪碎片，进一步加剧低轨道碎片密度。' },
  { id:'starliner',   era:5, year:2024.4, type:'disaster', imp:2, name:'Boeing Starliner 推进系统故障', nameEn:'STARLINER',        debris:'—',      desc:'首次载人飞行出现推进系统故障，两名宇航员在 ISS 滞留超过 8 个月后乘坐 SpaceX 飞船返回。' },
  { id:'issbattery',  era:5, year:2024.5, type:'debris',   imp:2, name:'ISS 电池托盘穿透民宅',       nameEn:'ISS BATTERY',      debris:'~7',     desc:'国际空间站废弃电池托盘碎片穿透佛罗里达民宅屋顶，法律归责至今悬而未决，引发国际责任公约新讨论。' },
  { id:'starship5',   era:5, year:2024.8, type:'explore',  imp:2, name:'Starship 5 号"筷子夹"回收',  nameEn:'STARSHIP 5',       debris:'—',      desc:'SpaceX Starship 5 号测试中，超重型推进器首次被发射台机械臂成功夹回，开创运载火箭回收新形式。' },
  { id:'artemis2',    era:5, year:2025.3, type:'explore',  imp:3, name:'Artemis II 载人绕月',        nameEn:'ARTEMIS II',       debris:'—',      desc:'人类时隔 53 年再次飞往月球，Artemis II 载人绕月飞行，为阿尔忒弥斯登月计划验证核心系统。' },
  { id:'clearspace1', era:5, year:2026.0, type:'debris',   imp:3, name:'ClearSpace-1 首次主动清除碎片（计划）', nameEn:'CLEARSPACE-1',  debris:'首次主动移除', desc:'ESA 委托 ClearSpace 公司执行，目标用机械臂捕获并脱轨 Vespa 上面级残骸（112 千克，664 公里轨道）。若成功，将是人类历史上首次主动从轨道移除碎片的行动。' },
]

// Key events that trigger AI narrative
const KEY_IDS = new Set(['ablestar', 'kessler', 'kosmos954', 'cerise', 'fy1c', 'iridium', 'issbattery'])

// Era configuration — larger radii for breathing room
const ERAS = [
  { id: 1, label: '第一纪元', sub: '太空竞赛时代 1957–1969',       radius: 4.4,  incX:  0.09, incY: 0.0,  speed: 0.09,  ringOp: 0.95 },
  { id: 2, label: '第二纪元', sub: '深空探索与空间站 1970–1989',   radius: 6.4,  incX: -0.38, incY: 0.2,  speed: 0.07,  ringOp: 0.9 },
  { id: 3, label: '第三纪元', sub: '太空碎片危机浮现 1990–2009',   radius: 8.4,  incX:  0.24, incY: 0.3,  speed: 0.055, ringOp: 0.85 },
  { id: 4, label: '第四纪元', sub: '商业航天崛起 2010–2019',       radius: 10.4, incX: -0.52, incY: 0.15, speed: 0.04,  ringOp: 0.8 },
  { id: 5, label: '第五纪元', sub: '新太空纪元 2020–2026',         radius: 12.4, incX:  0.32, incY: 0.4,  speed: 0.03,  ringOp: 0.75 },
]

// Precompute event angles per era
const EVENTS_BY_ERA = ERAS.map(era => {
  const evs = ALL_EVENTS.filter(e => e.era === era.id)
  return evs.map((ev, i) => ({
    ...ev,
    angle: (2 * Math.PI * i / evs.length) + era.id * 0.7,
  }))
})

// Sphere size per importance
const IMP_SIZE = [0.055, 0.082, 0.115, 0.160]
// Emissive floor: 0.45 guarantees minimum visibility; scale up with importance
const IMP_EMISSIVE = [0.45, 0.68, 0.95, 1.35]

// ── 3D components ─────────────────────────────────────────────────────────

function Earth() {
  return (
    <group>
      {/* Core — pitch black */}
      <mesh>
        <sphereGeometry args={[1.4, 48, 48]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.9} metalness={0.0} emissive="#0a0a0a" emissiveIntensity={0.1} />
      </mesh>
      {/* Subtle warm rim glow */}
      <mesh>
        <sphereGeometry args={[1.45, 32, 32]} />
        <meshStandardMaterial color="#6567e0" emissive="#acb1eb" emissiveIntensity={0.18} transparent opacity={0.10} side={2} />
      </mesh>
    </group>
  )
}

function OrbitRing({ era }) {
  return (
    <group rotation={[era.incX, era.incY, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[era.radius, 0.007, 6, 180]} />
        <meshStandardMaterial
          color="#c8b880"
          emissive="#c8b880"
          emissiveIntensity={0.35}
          transparent
          opacity={0.28}
        />
      </mesh>
    </group>
  )
}

function EventSphere({ ev, era, launchYear, hoveredId, clickedIds, onHover, onLeave, onClick }) {
  const isHovered = hoveredId === ev.id
  const isActive  = ev.year >= launchYear
  const isClicked = clickedIds.has(ev.id)
  const isDebris  = ev.type === 'debris'

  // Monochromatic warm-grey — single tone, brightness only varies by imp
  // Debris: slightly warmer; rest: same pale base
  const baseColor = isDebris ? '#d4c898' : '#b8b098'
  const activeEmInt = isClicked ? IMP_EMISSIVE[ev.imp] * 1.25 : IMP_EMISSIVE[ev.imp]
  const emInt = isHovered ? IMP_EMISSIVE[ev.imp] * 2.2 : (isActive ? activeEmInt : 0.30)
  const opacity = isActive ? 1 : 0.50    // raise inactive floor — always legible
  const r = IMP_SIZE[ev.imp] * (isHovered ? 1.45 : 1)

  const px = era.radius * Math.cos(ev.angle)
  const pz = era.radius * Math.sin(ev.angle)

  return (
    <group position={[px, 0, pz]}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onHover(ev) }}
        onPointerOut={() => onLeave()}
        onClick={(e) => { e.stopPropagation(); onClick(ev) }}
      >
        <sphereGeometry args={[r, 12, 12]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={emInt}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Always-visible name label */}
      <Html
        position={[0, r + 0.18, 0]}
        center
        distanceFactor={14}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          fontFamily: 'monospace',
          fontSize: isHovered ? 9 : 7,
          color: isHovered ? '#e8dfc0' : (isActive ? '#a89868' : '#60584a'),
          opacity: isActive ? (isHovered ? 1 : 0.55) : 0.32,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          background: 'transparent',
          padding: '1px 3px',
          borderRadius: 2,
          transition: 'all 0.12s',
          border: isHovered ? '1px solid rgba(200,185,128,0.35)' : 'none',
        }}>
          {ev.name}
        </div>
      </Html>
    </group>
  )
}

function EraGroup({ eraConfig, events, launchYear, hoveredId, clickedIds, onHover, onLeave, onClick }) {
  const rotRef = useRef()
  useFrame((_, delta) => {
    if (rotRef.current) rotRef.current.rotation.y += eraConfig.speed * delta
  })

  return (
    <group rotation={[eraConfig.incX, eraConfig.incY, 0]}>
      <group ref={rotRef}>
        {events.map(ev => (
          <EventSphere
            key={ev.id}
            ev={ev}
            era={eraConfig}
            launchYear={launchYear}
            hoveredId={hoveredId}
            clickedIds={clickedIds}
            onHover={onHover}
            onLeave={onLeave}
            onClick={onClick}
          />
        ))}
      </group>
    </group>
  )
}

function Scene({ launchYear, hoveredId, clickedIds, onHover, onLeave, onClick }) {
  return (
    <>
      <color attach="background" args={['#030303']} />
      <Stars radius={140} depth={60} count={2500} factor={3} fade speed={0.3} saturation={0} />
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#e8e0d0" />

      <Earth />

      {ERAS.map(era => (
        <OrbitRing key={era.id} era={era} />
      ))}

      {ERAS.map((era, i) => (
        <EraGroup
          key={era.id}
          eraConfig={era}
          events={EVENTS_BY_ERA[i]}
          launchYear={launchYear}
          hoveredId={hoveredId}
          clickedIds={clickedIds}
          onHover={onHover}
          onLeave={onLeave}
          onClick={onClick}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={40}
        autoRotate
        autoRotateSpeed={0.25}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

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
  const setStoryChapter         = useAppStore(s => s.setStoryChapter)

  const [hoveredId,  setHoveredId]  = useState(null)
  const [hoveredEv,  setHoveredEv]  = useState(null)
  const [clickedIds, setClickedIds] = useState(new Set())
  const [narratives, setNarratives] = useState({})
  const [loadingId,  setLoadingId]  = useState(null)
  const [storyState, setStoryState] = useState('idle')
  const [story,      setStory]      = useState('')

  const launchYear = satellite?.launchYear ?? 9999

  const onHover = useCallback((ev) => {
    setHoveredId(ev.id)
    setHoveredEv(ev)
  }, [])
  const onLeave = useCallback(() => {
    setHoveredId(null)
    setHoveredEv(null)
  }, [])

  function handleClick(ev) {
    if (!KEY_IDS.has(ev.id)) return
    if (ev.year < launchYear) return
    if (loadingId || clickedIds.has(ev.id)) return
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

  const activatedKeys = ALL_EVENTS.filter(e => KEY_IDS.has(e.id) && e.year >= launchYear)
  const allClicked    = activatedKeys.length === 0 || activatedKeys.every(e => clickedIds.has(e.id))
  const totalDamage   = ALL_EVENTS.filter(e => KEY_IDS.has(e.id) && e.year >= launchYear && clickedIds.has(e.id)).reduce((s, e) => s + e.imp, 0)

  async function handleGenerateStory() {
    if (storyState !== 'idle') return
    setStoryState('loading')
    try {
      const visited = activatedKeys.filter(e => clickedIds.has(e.id))
      const res = await generateHistoryStory({ visitedEvents: visited, satellite, user, damageLevel: totalDamage, storyOutline })
      const text = res.story ?? ''
      setStory(text)
      setStoryChapter('m3', text)
      setStoryState('done')
    } catch { setStoryState('error') }
  }

  const eraColors = { 1:'#4488cc', 2:'#44aacc', 3:'#cc8844', 4:'#cc4444', 5:'#f5c840' }

  return (
    <div style={{ background: '#050508', color: '#e8e8f8' }}>

      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #14141a' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#484878', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          SPACE_DEBRIES · M3 · 重大历史事件
        </span>
      </div>

      {/* Title */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px 28px' }}>
        <h2 style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 22, fontWeight: 400, color: '#e8e8f8', lineHeight: 1.6, marginBottom: 10 }}>
          每一次碰撞都留下了痕迹，<br />每一片碎片都还在轨道上。
        </h2>
        <p style={{ fontSize: 11, color: '#484878', lineHeight: 1.9, maxWidth: 500, margin: 0 }}>
          {ALL_EVENTS.length} 个历史事件分布在五条轨道上 · 拖拽旋转视角 · 滚轮缩放 ·{' '}
          {satellite && launchYear < 9999
            ? <span>你的卫星 <span style={{ color: '#f5c840' }}>{satellite.name}</span> 于 {launchYear} 年入轨，之后的金色事件与你同处一个时代</span>
            : '暗淡球体为卫星发射之前的历史'}
        </p>
      </div>

      {/* Era legend */}
      <div style={{ display: 'flex', gap: 6, padding: '0 32px 20px', flexWrap: 'wrap' }}>
        {ERAS.map(era => (
          <div key={era.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid #1e1e28', background: '#0a0a12' }}>
            <div style={{ width: 20, height: 1.5, background: '#f5c840', opacity: era.ringOp }} />
            <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#484878', letterSpacing: '0.08em' }}>{era.sub}</span>
          </div>
        ))}
      </div>

      {/* 3D Canvas */}
      <div style={{ position: 'relative', width: '100%', height: 680, background: '#050508' }}>
        <Canvas
          camera={{ position: [0, 14, 32], fov: 52 }}
          style={{ position: 'absolute', inset: 0 }}
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            <Scene
              launchYear={launchYear}
              hoveredId={hoveredId}
              clickedIds={clickedIds}
              onHover={onHover}
              onLeave={onLeave}
              onClick={handleClick}
            />
          </Suspense>
        </Canvas>

        {/* Hover detail panel */}
        <AnimatePresence>
          {hoveredEv && (
            <motion.div
              key={hoveredEv.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute', bottom: 24, left: 32,
                maxWidth: 340, padding: '14px 18px',
                background: 'rgba(8,8,12,0.92)',
                border: `1px solid ${hoveredEv.type === 'debris' ? 'rgba(245,200,64,0.35)' : 'rgba(255,255,255,0.1)'}`,
                backdropFilter: 'blur(8px)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#4a4848', letterSpacing: '0.1em' }}>{hoveredEv.nameEn}</span>
                  <span style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 14, color: hoveredEv.year >= launchYear ? '#e8ddd0' : '#555350' }}>{hoveredEv.name}</span>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#f5c840', flexShrink: 0 }}>{Math.floor(hoveredEv.year)}</span>
              </div>
              <p style={{ fontSize: 11, color: '#5a5856', lineHeight: 1.8, margin: 0 }}>{hoveredEv.desc}</p>
              {hoveredEv.debris !== '—' && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#8a6830', border: '1px solid rgba(245,200,64,0.2)', padding: '2px 6px', letterSpacing: '0.06em' }}>
                    碎片 {hoveredEv.debris}
                  </span>
                </div>
              )}
              {KEY_IDS.has(hoveredEv.id) && hoveredEv.year >= launchYear && !clickedIds.has(hoveredEv.id) && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(245,200,64,0.4)', letterSpacing: '0.08em' }}>
                    ↵ 点击获取卫星视角记录
                  </span>
                </div>
              )}
              {loadingId === hoveredEv.id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <Spinner />
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#8a6830', letterSpacing: '0.08em' }}>RETRIEVING SATELLITE LOG...</span>
                </div>
              )}
              {clickedIds.has(hoveredEv.id) && narratives[hoveredEv.id] && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ marginTop: 10, padding: '8px 10px', borderLeft: '1px solid rgba(245,200,64,0.25)', background: 'rgba(245,200,64,0.03)' }}
                >
                  <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 11, color: '#b0a090', lineHeight: 1.9, margin: 0, fontStyle: 'italic' }}>
                    {narratives[hoveredEv.id]}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color legend */}
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'none' }}>
          {[
            { color: '#d4c898', label: '太空碎片事件（更亮）' },
            { color: '#b8b098', label: '其他历史事件' },
            { color: '#888070', label: '发射之前（更暗）' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#484644', letterSpacing: '0.07em' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Story + Complete section */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 32px 80px' }}>

        {activatedKeys.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#484878', letterSpacing: '0.12em', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #1a1a18' }}>
              与你同处一个时代的关键碎片事件 — 点击轨道上的金色球体查看卫星视角
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activatedKeys.map(ev => (
                <div key={ev.id} style={{
                  padding: '4px 10px', border: `1px solid ${clickedIds.has(ev.id) ? 'rgba(245,200,64,0.5)' : '#1e1e1c'}`,
                  background: clickedIds.has(ev.id) ? 'rgba(245,200,64,0.06)' : 'transparent',
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 8, color: clickedIds.has(ev.id) ? '#c8b020' : '#4a4848', letterSpacing: '0.06em' }}>
                    {clickedIds.has(ev.id) ? '✓ ' : ''}{ev.nameEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Story */}
        <AnimatePresence>
          {story && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ marginBottom: 32, padding: '20px 24px', borderLeft: '2px solid rgba(245,200,64,0.3)', background: 'rgba(245,200,64,0.02)' }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#6b5a44', letterSpacing: '0.12em', marginBottom: 12 }}>CHAPTER III · SATELLITE LOG</div>
              <p style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 13, color: '#b0a090', lineHeight: 2, margin: 0, fontStyle: 'italic' }}>{story}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Story generation button */}
        {storyState === 'idle' && (
          <button
            onClick={handleGenerateStory}
            style={{
              marginBottom: 20, padding: '10px 20px',
              background: 'transparent', border: '1px solid rgba(245,200,64,0.3)',
              color: '#8a7050', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            生成卫星故事第三章 →
          </button>
        )}
        {storyState === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Spinner />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b5a44', letterSpacing: '0.1em' }}>GENERATING CHAPTER III...</span>
          </div>
        )}

        {/* Complete button */}
        {(storyState === 'done' || storyState === 'error' || allClicked) && (
          <button
            onClick={onComplete}
            style={{
              padding: '12px 28px', background: 'transparent',
              border: '1px solid rgba(245,200,64,0.5)', color: '#c8b020',
              fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.14em',
              cursor: 'pointer', textTransform: 'uppercase', display: 'block',
            }}
          >
            继续 →
          </button>
        )}
      </div>
    </div>
  )
}


