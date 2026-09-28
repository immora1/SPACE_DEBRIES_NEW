const option = ([id, label, subtext, outcome, armorDelta, fuelDelta, missionDelta, techNote, en]) => ({
  id, label, subtext, outcome, en,
  technical_effect: { armor_delta: armorDelta, fuel_delta: fuelDelta, mission_progress_delta: missionDelta },
  narrative_effect: {
    metrics_delta: outcome === 'correct'
      ? { event_integrity: 6, relationship_connection: 2, uncertainty: -6 }
      : outcome === 'partial'
        ? { event_integrity: 0, relationship_connection: 0, uncertainty: 2 }
        : { event_integrity: -8, relationship_connection: -2, uncertainty: 8 },
    consequence: techNote,
    story_tag: `orbital_${outcome}`,
  },
})

// Timings and resource effects are fictional teaching scenarios, not flight predictions.
export const ORBITAL_EVENTS = [
  {
    "id": "debris_close",
    "type": "debris_approach",
    "title": "预警之后，何时改变轨道？",
    "description": "交会预警打断了本轮任务。两次独立定轨均显示，一块失效航天器碎片的预计交会风险超过本任务阈值。现在机动会中断采集并消耗燃料；等待新数据可能避免一次多余机动，却也可能错过地面站的指令窗口。",
    "realRef": "模拟态势｜距交会 6 小时；指令窗口还剩 40 分钟，下一轮定轨在 2 小时后。候选规避轨道已排查二次交会。资源扣分表示教学情境中的风险代价，不代表必然碰撞。",
    "en": {
      "title": "When should you change course?",
      "description": "Two independent orbit estimates put a fragment above this mission’s risk threshold. Maneuvering interrupts data collection and spends fuel. Waiting may avoid an unnecessary burn, but fresh tracking arrives after the command window closes.",
      "realRef": "SIMULATION | Conjunction in 6 hours; command window closes in 40 minutes; fresh tracking in 2 hours. The candidate orbit is screened for other conjunctions. Penalties represent scenario risk, not a predicted impact."
    },
    "options": [
      [
        "avoidance_burn",
        "趁窗口执行已验证的规避",
        "暂停采集，执行小幅机动并重新定轨；支付燃料成本，为后续任务保留可控的轨道环境。",
        "correct",
        0,
        -12,
        25,
        "你在通信窗口内完成规避，并确认新的运行轨道，代价是燃料和一次采集机会。本题关键是两次预警已达成一致，且候选轨道已排查新风险；不是每次预警都应立即点火。",
        [
          "Execute the screened maneuver",
          "Pause collection, spend fuel on avoidance, then verify the new orbit.",
          "You lose fuel and one collection window but preserve control. Independent tracking agreement and screening justify acting now; not every alert calls for an immediate burn."
        ]
      ],
      [
        "wait_tracking",
        "保持准备，等待下一轮定轨",
        "保留燃料并继续跟踪，接受当前指令窗口关闭；若风险仍高，再协调更晚的应急处置。",
        "partial",
        -8,
        -6,
        15,
        "新数据仍支持原来的预警。你保留了部分燃料，却错过从容执行的窗口，需要调整任务配合较晚的处置。等待并非总是错误；这里的问题是数据到达时间晚于可用窗口。",
        [
          "Wait with the maneuver ready",
          "Keep tracking and save some fuel, accepting that later intervention needs another contact.",
          "New tracking confirms the warning. Some fuel is saved, but the convenient window is lost. Waiting can be sensible; here the data arrives too late for the available command window."
        ]
      ],
      [
        "hold_course",
        "优先完成本轮数据采集",
        "维持原轨道，把当前数据完整性放在首位；依靠持续监测承担已被两次确认的交会风险。",
        "wrong",
        -32,
        0,
        15,
        "本轮数据得到保留，但继续监测并未消除已确认的交会风险。模拟将未处理的风险计入护甲损失，并带入下一题。保留燃料只是成本的一部分，还要考虑后续任务承担风险的能力。",
        [
          "Finish the current collection",
          "Stay on course and preserve the data set while accepting the confirmed risk.",
          "Data is retained, but monitoring alone does not remove the warning. Unresolved risk reduces armor in this simulation and carries forward. Fuel savings are only one part of preserving a mission."
        ]
      ]
    ]
  },
  {
    "id": "solar_flare",
    "type": "solar_storm",
    "title": "保住这一批数据，还是后面的任务？",
    "description": "上一轮的燃料与护甲状态继续保留。空间天气预警到来，载荷已出现可纠正的存储错误，地面用户却正等待这一批关键数据。姿控与基本通信仍正常：你需要决定暂停多久、保留哪些服务，以及恢复工作前检查什么。",
    "realRef": "模拟态势｜错误计数持续上升；已采数据仍可校验，完整采集尚未结束。安全模式保留基本通信，但不能消除辐射；降低负载也不等于排除了电子系统异常。",
    "en": {
      "title": "Protect this data set—or the missions after it?",
      "description": "Fuel and armor carry over. A space-weather warning coincides with rising correctable memory errors, while ground users need this data set. Attitude control and basic communications still work. Decide what to suspend and how to verify recovery.",
      "realRef": "SIMULATION | Errors are rising; stored data can still be checked, but collection is incomplete. Safe mode retains basic communications without eliminating radiation. Lower load alone does not remove electronic faults."
    },
    "options": [
      [
        "safe_mode",
        "先保护系统，再分阶段恢复",
        "暂停载荷，校验已存数据，保留基本通信；待错误计数稳定并完成自检后，补做可恢复的任务。",
        "correct",
        0,
        0,
        20,
        "你交付已校验的数据，留下本轮采集缺口，同时保住后续工作能力。本题奖励的是保护与恢复的完整流程，而非永久停机。安全模式有助于管理异常与故障扩散，并不能屏蔽所有辐射。",
        [
          "Protect systems, restore in stages",
          "Pause the payload, verify data and retain communications. Resume after errors stabilize and checks pass.",
          "Verified data is delivered with a coverage gap, preserving future service. The decision includes recovery, not indefinite shutdown. Safe mode helps manage faults; it does not block all radiation."
        ]
      ],
      [
        "reduced_load",
        "降载运行，只保留关键采集",
        "关闭非必要载荷，加强错误监测并设置中止条件；保留较多数据，也接受异常仍可能扩大的代价。",
        "partial",
        -10,
        -4,
        28,
        "你保留更多关键数据，但上升的错误计数触发中止条件，部分数据需要重传，设备余量也有所下降。这个折中确有任务收益；在已经出现异常时，它仍比先保护系统承担更多风险。",
        [
          "Reduce load, retain critical collection",
          "Disable nonessential payloads and set an abort condition, accepting continued exposure for more data.",
          "More data is retained, but rising errors trigger the abort. Retransmission and equipment degradation cost resources. The compromise has value but carries greater risk after faults have appeared."
        ]
      ],
      [
        "continue_payload",
        "完成整批采集后再处理异常",
        "继续满负荷运行，争取本轮最完整的数据；把自检与重启推迟到任务窗口结束。",
        "wrong",
        -35,
        -6,
        30,
        "采集量增加，但异常继续累积，模拟中出现重启与数据校验失败。任务进度上升，护甲却显著下降，这些损失不会在下一题自动恢复。完成一次采集不等于保住整颗卫星的服务能力。",
        [
          "Complete the batch before handling faults",
          "Keep the full payload running for maximum coverage and postpone checks until the window ends.",
          "More data is collected, but accumulated faults cause a restart and failed checks in this scenario. Progress rises while armor falls, carrying the damage into the next decision."
        ]
      ]
    ]
  },
  {
    "id": "end_of_life",
    "type": "orbital_decay",
    "title": "最后一段燃料，留给什么？",
    "description": "任务进入末期。地面希望再获取一批数据，团队则需要给末期处置留出燃料、通信与姿控余量。请结合左侧剩余资源做决定：之前积累的损伤不会清零，延长运行的收益也必须与可控退役的机会一起计算。",
    "realRef": "模拟态势｜处置方案已完成轨道评估，延寿预算尚未批准。低轨应评估降轨与再入，高轨需规划适合的处置轨道；停止工作和关闭载荷，并不等于已安全处置。",
    "en": {
      "title": "What should the remaining fuel be reserved for?",
      "description": "Ground users want another data set near retirement. Disposal also needs fuel, communications and attitude-control margin. Use the resources at left: damage persists, and extending service competes with controlled retirement.",
      "realRef": "SIMULATION | The orbit-specific disposal plan is assessed; the extension budget is not approved. LEO requires deorbit/reentry assessment; higher orbits need a suitable disposal trajectory. Switching off a payload is not completed disposal."
    },
    "options": [
      [
        "controlled_disposal",
        "锁定处置预算，启动退役交接",
        "结束新增采集，回传已存数据并确认轨道方案；为后续处置机动与钝化保留资源。",
        "correct",
        0,
        -18,
        25,
        "你把余量投入已评估的处置方案，完成数据交接。本题计入准备与机动成本，后续流程继续展示退役与处置；它不意味着所有轨道都能立即再入，也不意味着退役会抹掉已完成的任务。",
        [
          "Reserve disposal resources and hand over",
          "End new collection, downlink data and confirm the orbit-specific plan, reserving resources for disposal.",
          "Resources support the assessed plan and data handover. Preparation and maneuver costs are included; the following sequence explains retirement. Retirement neither erases completed work nor implies immediate reentry from every orbit."
        ]
      ],
      [
        "bounded_extension",
        "保留处置储备，复核短期延寿",
        "先锁定退役所需资源，只申请一段受限运行；重新评估损伤、燃料和地面支持，通过后才能延长任务。",
        "partial",
        0,
        -8,
        10,
        "你没有透支处置储备，但延寿尚未获批，本轮只能保持有限服务，模拟计入等待期间的维护成本。这是审慎的备选，却不能把“申请延寿”当成“已具备安全延寿条件”。",
        [
          "Reassess a bounded extension",
          "Protect the disposal reserve and request limited operation after reviewing damage, fuel and ground support.",
          "Reserves are protected but extension is not approved, so only limited service continues. Maintenance while waiting costs resources. A cautious request is not evidence that safe extension has been established."
        ]
      ],
      [
        "extend_mission",
        "先追加任务，处置留待以后",
        "按原负荷继续采集，把更多燃料用于维持服务；等收益下降时再重新考虑退役。",
        "wrong",
        -20,
        -28,
        20,
        "追加任务带来短期进度，却在延寿预算未获批准时消耗燃料和设备余量。你把处置问题推迟到资源更少的时刻，失控后还可能留下长期风险。结局会同时核算任务收益、设备状态和燃料。",
        [
          "Add another campaign and defer disposal",
          "Continue full service, spend fuel maintaining operations and revisit retirement when returns decline.",
          "Progress increases at the cost of fuel and equipment without an approved extension budget. Disposal is delayed until fewer resources remain. The ending weighs progress, hardware condition and fuel together."
        ]
      ]
    ]
  }
].map(event => ({ ...event, options: event.options.map(option) }))

export const ORBITAL_EVENT_BY_ID = Object.freeze(
  Object.fromEntries(ORBITAL_EVENTS.map(event => [
    event.id,
    { ...event, option_by_id: Object.fromEntries(event.options.map(item => [item.id, item])) },
  ])),
)

export function getOrbitalEventOption(eventId, optionId) {
  const event = ORBITAL_EVENT_BY_ID[eventId]
  const selected = event?.option_by_id?.[optionId]
  return event && selected ? { event, option: selected } : null
}
