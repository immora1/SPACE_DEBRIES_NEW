import { INTERACTIVE_NODE_IDS, StoryError } from '../constants.js'
import { StoryOptionSchema } from '../schemas.js'

export const CONSEQUENCE_CATALOG = Object.freeze({
  core_item_secured: Object.freeze({
    consequence_id: 'core_item_secured',
    description: '核心物件或不可替代部分已得到优先保护，后续不得无故变回完全暴露状态。',
  }),
  time_window_compressed: Object.freeze({
    consequence_id: 'time_window_compressed',
    description: '可用时间窗口已经收紧，后续行动必须体现准备余量减少。',
  }),
  coordination_strain: Object.freeze({
    consequence_id: 'coordination_strain',
    description: '人物之间的分工出现摩擦，后续配合不得无故恢复。',
  }),
  unclear_signal: Object.freeze({
    consequence_id: 'unclear_signal',
    description: '关键提示或环境信号仍不清楚，后续判断需要保留信息缺口。',
  }),
  shared_plan: Object.freeze({
    consequence_id: 'shared_plan',
    description: '人物已经形成共同计划，后续行动应体现明确分工与相互确认。',
  }),
  visible_irreplaceable_loss: Object.freeze({
    consequence_id: 'visible_irreplaceable_loss',
    description: '不可替代部分已经出现可见且无法在结局前完全修复的缺口。',
  }),
})

function option(
  optionId,
  label,
  effectSummary,
  stateDelta,
  {
    add = [],
    resolve = [],
    keyOutcome = '',
  } = {},
) {
  return Object.freeze({
    option_id: optionId,
    label,
    effect_summary: effectSummary,
    state_delta: Object.freeze(stateDelta),
    add_consequence_ids: Object.freeze(add),
    resolve_consequence_ids: Object.freeze(resolve),
    key_outcome: keyOutcome,
  })
}

// These values are explicit product configuration. They are intentionally
// independent from button sentiment and are never inferred by the model.
export const STORY_OPTION_SETS = Object.freeze({
  node_02: Object.freeze([
    option(
      'protect_irreplaceable_part',
      '先保护不可替代的部分',
      '你先把最无法补做的物件或动作移入可控范围，保留核心内容，同时压缩其余准备时间。',
      { event_integrity: 8, relationship_connection: 1, uncertainty: 3 },
      {
        add: ['core_item_secured', 'time_window_compressed'],
        keyOutcome: '不可替代部分被优先纳入保护。',
      },
    ),
    option(
      'coordinate_shared_plan',
      '先确认彼此分工',
      '你与核心人物逐项确认分工和先后顺序，让配合更清楚，也暂时放慢对物件的直接处理。',
      { event_integrity: 2, relationship_connection: 8, uncertainty: -3 },
      {
        add: ['shared_plan'],
        keyOutcome: '两人建立了明确的共同计划。',
      },
    ),
    option(
      'verify_uncertain_conditions',
      '先核实异常线索',
      '你停下当前准备，交叉核对现场反馈和已有提示，使风险更可判断，同时消耗一部分行动窗口。',
      { event_integrity: -2, relationship_connection: 2, uncertainty: -8 },
      {
        add: ['time_window_compressed'],
        keyOutcome: '关键异常线索经过了交叉核对。',
      },
    ),
  ]),
  node_03: Object.freeze([
    option(
      'continue_core_sequence',
      '按核心顺序继续',
      '你保持原定核心动作顺序，把有限余量集中到最重要的步骤上，其他准备暂时后移。',
      { event_integrity: 7, relationship_connection: 0, uncertainty: 2 },
      {
        add: ['time_window_compressed'],
        keyOutcome: '核心动作继续按原定顺序推进。',
      },
    ),
    option(
      'work_side_by_side',
      '并肩完成当前步骤',
      '你把当前步骤拆成可以并行完成的两部分，与核心人物保持可见、可确认的配合。',
      { event_integrity: 4, relationship_connection: 7, uncertainty: -2 },
      {
        add: ['shared_plan'],
        keyOutcome: '关键步骤由两人并肩完成。',
      },
    ),
    option(
      'pause_for_confirmation',
      '暂停并再次确认',
      '你暂停推进，要求把模糊信息逐项确认，降低误判，却让原定节奏进一步变紧。',
      { event_integrity: -3, relationship_connection: 2, uncertainty: -9 },
      {
        add: ['time_window_compressed'],
        keyOutcome: '一次可能影响后续的误判被提前排除。',
      },
    ),
    option(
      'prepare_reversible_backup',
      '准备可撤回的备选方案',
      '你保留原方案，同时准备一个能够随时撤回的替代步骤，让结果更有余地，却增加协调负担。',
      { event_integrity: 3, relationship_connection: -3, uncertainty: -4 },
      {
        add: ['coordination_strain'],
        keyOutcome: '现场保留了一套可撤回的备选方案。',
      },
    ),
  ]),
  node_04: Object.freeze([
    option(
      'commit_to_protection',
      '把保护放在第一位',
      '你把主要资源投入不可替代部分的保护，接受整体流程变慢，并让这一取舍成为后续不可忽略的事实。',
      { event_integrity: 10, relationship_connection: -2, uncertainty: 2 },
      {
        add: ['core_item_secured', 'time_window_compressed'],
        keyOutcome: '第一次关键取舍明确偏向保护不可替代部分。',
      },
    ),
    option(
      'commit_to_cooperation',
      '把共同完成放在第一位',
      '你优先维持两人共同参与的动作和确认，让关系与合作更完整，同时减少独自抢回进度的空间。',
      { event_integrity: 2, relationship_connection: 10, uncertainty: 1 },
      {
        add: ['shared_plan'],
        resolve: ['coordination_strain'],
        keyOutcome: '第一次关键取舍明确偏向共同完成。',
      },
    ),
    option(
      'commit_to_certainty',
      '把确认风险放在第一位',
      '你暂缓不可逆动作，先把异常影响范围确认清楚，使后续判断可靠，也损失一部分完成度。',
      { event_integrity: -6, relationship_connection: 1, uncertainty: -11 },
      {
        add: ['time_window_compressed'],
        keyOutcome: '第一次关键取舍明确偏向降低不确定性。',
      },
    ),
    option(
      'split_resources',
      '分开处理两个重点',
      '你把资源拆给两个重点并行推进，短时间保住更多可能性，同时让沟通与结果都更难完全确认。',
      { event_integrity: 5, relationship_connection: -5, uncertainty: 6 },
      {
        add: ['coordination_strain', 'unclear_signal'],
        keyOutcome: '第一次关键取舍采用了分散资源的方案。',
      },
    ),
  ]),
  node_05: Object.freeze([
    option(
      'repair_visible_gap',
      '修补已经出现的缺口',
      '你把注意力转向已经出现的具体缺口，恢复一部分核心完整度，也让剩余时间更紧。',
      { event_integrity: 8, relationship_connection: 0, uncertainty: 1 },
      {
        add: ['time_window_compressed'],
        keyOutcome: '一个已经可见的核心缺口得到修补。',
      },
    ),
    option(
      'restore_coordination',
      '先修复配合方式',
      '你停止互相抢夺步骤，重新确认谁先做什么，使配合恢复并减少重复动作。',
      { event_integrity: 2, relationship_connection: 8, uncertainty: -2 },
      {
        add: ['shared_plan'],
        resolve: ['coordination_strain'],
        keyOutcome: '人物之间重新建立了可执行的配合方式。',
      },
    ),
    option(
      'accept_limited_gap',
      '接受一个有限缺口',
      '你明确接受一个无法立即补齐的部分，把余量留给核心动作，使损失变得可见且持续。',
      { event_integrity: -7, relationship_connection: 3, uncertainty: -4 },
      {
        add: ['visible_irreplaceable_loss'],
        resolve: ['unclear_signal'],
        keyOutcome: '一个有限但不可逆的缺口被明确接受。',
      },
    ),
  ]),
  node_06: Object.freeze([
    option(
      'finish_core_action_now',
      '现在完成核心动作',
      '你立即执行最关键且不可替代的动作，用掉主要余量，避免它被后续变化完全打断。',
      { event_integrity: 11, relationship_connection: 1, uncertainty: 3 },
      {
        add: ['core_item_secured', 'time_window_compressed'],
        keyOutcome: '第二次关键取舍立即完成了核心动作。',
      },
    ),
    option(
      'wait_for_each_other',
      '等彼此准备好再行动',
      '你保持动作停顿，等两人都确认后再继续，使共同完成更完整，也让时间和环境变化更难控制。',
      { event_integrity: -2, relationship_connection: 10, uncertainty: 5 },
      {
        add: ['shared_plan', 'unclear_signal'],
        keyOutcome: '第二次关键取舍保留了共同完成的条件。',
      },
    ),
    option(
      'reduce_unknowns_again',
      '再次缩小未知范围',
      '你利用最后的确认机会排除一项关键未知，让结局依据更清楚，同时放弃部分现场进度。',
      { event_integrity: -5, relationship_connection: 1, uncertainty: -12 },
      {
        resolve: ['unclear_signal'],
        keyOutcome: '结局前最后一项关键未知得到确认。',
      },
    ),
    option(
      'make_irreversible_tradeoff',
      '做出不可撤回的取舍',
      '你放弃一个已经无法兼顾的部分，把剩余能力全部交给另一个核心目标，取舍立即产生可见后果。',
      { event_integrity: 4, relationship_connection: -7, uncertainty: -2 },
      {
        add: ['visible_irreplaceable_loss', 'coordination_strain'],
        keyOutcome: '第二次关键取舍留下了不可撤回的损失。',
      },
    ),
  ]),
  node_07: Object.freeze([
    option(
      'preserve_final_details',
      '保住最后的关键细节',
      '你把最后可调配的时间用于确认关键物件、动作和约定，使核心细节更接近完整。',
      { event_integrity: 9, relationship_connection: 1, uncertainty: -2 },
      {
        add: ['core_item_secured'],
        keyOutcome: '结局前的关键细节得到最后确认。',
      },
    ),
    option(
      'share_final_responsibility',
      '共同承担最后一步',
      '你邀请核心人物共同承担最后一步，让责任、目光和动作都落在两个人之间。',
      { event_integrity: 3, relationship_connection: 9, uncertainty: -1 },
      {
        add: ['shared_plan'],
        resolve: ['coordination_strain'],
        keyOutcome: '最后一步由两人共同承担。',
      },
    ),
    option(
      'leave_room_for_change',
      '给变化留出余地',
      '你不把最后一步锁死，保留根据现场反馈调整的空间，使损失可能减小，也让最终结果更难预先确认。',
      { event_integrity: 1, relationship_connection: 2, uncertainty: 8 },
      {
        add: ['unclear_signal'],
        keyOutcome: '最后一步保留了临场调整空间。',
      },
    ),
  ]),
  node_08: Object.freeze([
    option(
      'complete_as_planned',
      '按已确认的方式完成',
      '你按此前确认的顺序完成核心事件，让已经保护的物件、动作和约定进入最终结果。',
      { event_integrity: 8, relationship_connection: 3, uncertainty: -3 },
      {
        resolve: ['time_window_compressed', 'unclear_signal'],
        keyOutcome: '核心事件按已确认的方式进入最终完成。',
      },
    ),
    option(
      'complete_together',
      '把最后时刻留给彼此',
      '你把最后时刻交给两个人共同完成，即使部分细节无法补齐，也确保关系动作真实发生。',
      { event_integrity: 2, relationship_connection: 10, uncertainty: -2 },
      {
        resolve: ['coordination_strain'],
        keyOutcome: '核心事件的最后时刻由两人共同完成。',
      },
    ),
    option(
      'complete_with_known_gap',
      '带着已知缺口完成',
      '你不再掩饰无法修复的部分，在明确缺口的前提下完成仍可完成的核心动作。',
      { event_integrity: -6, relationship_connection: 4, uncertainty: -7 },
      {
        add: ['visible_irreplaceable_loss'],
        resolve: ['unclear_signal'],
        keyOutcome: '核心事件在一个明确且不可修复的缺口下完成。',
      },
    ),
  ]),
})

function clone(value) {
  return structuredClone(value)
}

export function consequenceIds() {
  return Object.keys(CONSEQUENCE_CATALOG)
}

export function describeConsequences(ids) {
  return ids.map((consequenceId) => {
    const consequence = CONSEQUENCE_CATALOG[consequenceId]
    if (!consequence) {
      throw new StoryError(
        'CONSEQUENCE_CONFIG_INVALID',
        `Unknown consequence ID: ${consequenceId}.`,
        500,
      )
    }
    return clone(consequence)
  })
}

export function validateNodeOptions(nodeId, options) {
  if (options.length !== 3 && options.length !== 4) {
    throw new StoryError(
      'OPTION_COUNT_INVALID',
      `${nodeId} must have exactly 3 or 4 options; received ${options.length}.`,
      500,
    )
  }
  const parsed = options.map((rawOption, index) => {
    const result = StoryOptionSchema.safeParse(rawOption)
    if (!result.success) {
      throw new StoryError(
        'OPTION_CONFIG_INVALID',
        `${nodeId}.options[${index}] failed validation.`,
        500,
        result.error.issues,
      )
    }
    return result.data
  })
  const optionIds = parsed.map((item) => item.option_id)
  if (new Set(optionIds).size !== optionIds.length) {
    throw new StoryError(
      'OPTION_ID_DUPLICATE',
      `${nodeId} contains duplicate option IDs.`,
      500,
    )
  }
  const knownConsequences = new Set(consequenceIds())
  parsed.forEach((item) => {
    const add = new Set(item.add_consequence_ids)
    const resolve = new Set(item.resolve_consequence_ids)
    if (
      item.state_delta.event_integrity === 0
      && item.state_delta.relationship_connection === 0
      && item.state_delta.uncertainty === 0
    ) {
      throw new StoryError(
        'OPTION_NEUTRAL_DELTA_INVALID',
        `${nodeId}/${item.option_id} has an unapproved neutral delta.`,
        500,
      )
    }
    if (
      add.size !== item.add_consequence_ids.length
      || resolve.size !== item.resolve_consequence_ids.length
      || [...add].some((consequenceId) => resolve.has(consequenceId))
      || [...add, ...resolve].some(
        (consequenceId) => !knownConsequences.has(consequenceId),
      )
    ) {
      throw new StoryError(
        'OPTION_CONSEQUENCE_INVALID',
        `${nodeId}/${item.option_id} contains invalid consequence references.`,
        500,
      )
    }
  })
  return clone(parsed)
}

export function resolveOptionsForNode(_story, nodeId) {
  const options = STORY_OPTION_SETS[nodeId]
  if (!options) {
    if (INTERACTIVE_NODE_IDS.includes(nodeId)) {
      throw new StoryError(
        'OPTION_SET_MISSING',
        `No option set is configured for ${nodeId}.`,
        500,
      )
    }
    return []
  }
  return validateNodeOptions(nodeId, options)
}
