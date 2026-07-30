import { StoryError, TASK_TYPE } from './constants.js'
import {
  VALID_OPENING_FIXTURE,
  VALID_OUTLINE_FIXTURE,
} from './spec-assets.generated.js'

function clone(value) {
  return structuredClone(value)
}

const CONTINUE_PARAGRAPHS = [
  '你把手边最容易受影响的物件移到灯架内侧，再沿着外婆刚才确认的顺序检查接口。潮湿的风从天井边缘压下来，纸面上的墨迹没有继续扩散，木框接合处却比几分钟前更难推进。你没有回头复述刚才的判断，只把还能完成的步骤逐一排开，让眼前的变化成为下一步行动的依据。灯芯旁的影子被风拉长，你记下了这一处新的现场反馈。',
  '外婆抬手托住灯片下缘，你顺着她的动作压紧固定片。两个人的呼吸隔着灯架交替响起，原先含混的分工在这一次配合里变得清楚。院门外传来来访者收伞的声音，可用时间继续缩短，你们把能够并行的动作拆开，各自守住一处不能出错的细节。她向你点了一下头，示意这套分工可以继续执行。',
  '最后一枚固定片落进卡槽时，灯架轻轻转过半圈，又在修补过的边缘停住。你伸手护住灯片，外婆没有立刻松开支架，她用指尖指向那道仍看不清的缝。核心步骤已经向前推进，新的缺口也变得可以确认，你们停在下一次动作开始之前。廊下的脚步声越来越近，那道缝仍需要一次明确处理。',
].join('\n\n')

const ENDING_PARAGRAPHS = [
  '你按住灯架底座，等外婆把最后一枚固定片推到位。木框发出一声短促的轻响，修好的灯片沿着轨道缓慢转动，潮气在纸面留下暗色边缘，中心那行灯诗依旧清楚。你数着每一次经过眼前的图案，把此前保住的部分逐一看见。',
  '院门被推开时，外婆把点灯的长杆交到你手里。她的手指停在竹柄上，没有马上松开，你便把自己的手向前挪了半寸。两个人一起压下开关，暖光从灯片背后亮起，缺口投在墙上，像一小块无法补回的空白。',
  '来访者围到廊下，你没有遮住那道空白。外婆对他们念出你写好的最后一句灯诗，声音在最后一个字上慢下来。你听见她换了一次呼吸，又把那句话完整地念了一遍；你们约定要完成的动作已经发生，留下的损失也没有被一句安慰抹去。',
  '灯架继续转过一圈，你和外婆并肩看着修补处再次经过灯芯。她抬起手，在你肩上轻拍两下，随后指向墙面上重新接合的图案。你告诉她自己记得童年打破灯片时的声音，也会记得今晚两个人共同点亮它时竹柄上传来的温度。',
  '最后一圈结束后，你们一起关掉灯芯，把灯片连同那道可见缺口收进木盒。外婆把写有灯诗的纸折好交给你，指尖在折痕上停了一瞬。天井里的水声还没有完全停下，约定已经有了明确结果，你安静抱着木盒站在她身边。',
].join('\n\n')

const DEFAULT_CONTINUE_OUTPUT = {
  story_text: CONTINUE_PARAGRAPHS,
  known_to_user_additions: [],
  continuity_handoff: {
    current_situation: '你与外婆已把核心步骤推进到下一次动作前，修补边缘仍有一道需要确认的缝。',
    unresolved_threads: [
      '修补边缘的缝是否会影响最后点灯',
      '剩余时间能否容纳共同完成的最后动作',
    ],
  },
}

function defaultEndingOutput(endingId) {
  return {
    task_type: 'STORY_ENDING',
    node_id: 'node_09',
    selected_ending_id: endingId,
    story_text: ENDING_PARAGRAPHS,
    ending_summary: '走马灯在一个可见缺口下完成点亮，灯诗和共同动作得以保留。你与外婆共同看完灯片转过一圈，关系停在明确而真实的共同记忆上。',
    next_node_context: '现场天气变化早于信息提示，压缩了准备窗口并影响修补结果。异常为何造成这段短暂的信息偏差仍未解释。',
    next_node_id: 'node_10',
  }
}

const DEFAULT_KNOWLEDGE_OUTPUT = {
  task_type: 'KNOWLEDGE_REVEAL',
  node_id: 'node_10',
  knowledge_title: '轨道风险与短暂信息延迟',
  story_connection: '故事中，现场天气已经变化，提示信息却没有及时更新，准备窗口因此被压缩，灯片修补也留下可见缺口。这种偏差只影响了当时依赖更新信息的具体判断。',
  causal_chain: [
    {
      point_title: '轨道环境风险',
      point_text: '在特定情况下，轨道碎片、辐射或规避操作可能影响航天器的正常工作条件，地面系统会先收到状态变化或保护指令。',
    },
    {
      point_title: '航天器调整',
      point_text: '航天器可能短暂切换工作模式、调整姿态或暂停部分载荷，以保护设备并重新确认链路，相关观测和转发任务会出现空档。',
    },
    {
      point_title: '服务更新延迟',
      point_text: '当新数据暂时无法连续产生或传回时，服务端可能继续显示上一批结果，直到后续数据完成校验，因此不同终端看到的更新时间也可能不一致。',
    },
    {
      point_title: '故事中的影响',
      point_text: '故事里的天气提示落后于现场变化，使你和外婆误判了可用时间。它没有决定所有结果，却让修补、分工和共同点灯承受了额外压力。',
    },
  ],
  reality_note: '现实中的影响通常局部、短暂且因系统冗余而不一致，并不等于整套服务完全失效。具体异常需要结合地面站、载荷和服务日志继续确认。',
  story_completed: true,
}

export function createFixtureStoryGenerator(options = {}) {
  const queues = {
    [TASK_TYPE.OUTLINE]: (options.outlineOutputs || [VALID_OUTLINE_FIXTURE]).map(clone),
    [TASK_TYPE.OPENING]: (options.openingOutputs || [VALID_OPENING_FIXTURE]).map(clone),
    [TASK_TYPE.CONTINUE]: options.continueOutputs?.map(clone) || null,
    [TASK_TYPE.BRANCH]: options.continueOutputs?.map(clone) || null,
    [TASK_TYPE.ENDING]: options.endingOutputs?.map(clone) || null,
    [TASK_TYPE.KNOWLEDGE_REVEAL]: options.knowledgeOutputs?.map(clone) || null,
  }
  let callCount = 0
  const calls = []

  const generate = async (taskType, input, context = {}) => {
    callCount += 1
    calls.push({ taskType, input: clone(input), context: clone(context) })
    if (
      options.failTask === taskType
      || options.failCallIndex === callCount
      || generate.failTask === taskType
    ) {
      throw new StoryError('AI_REQUEST_FAILED', `Fixture failure for ${taskType}`, 502)
    }
    const queue = queues[taskType]
    let value
    if (queue) {
      value = clone(queue.length > 1 ? queue.shift() : queue[0])
    } else if (taskType === TASK_TYPE.CONTINUE || taskType === TASK_TYPE.BRANCH) {
      value = clone(DEFAULT_CONTINUE_OUTPUT)
    } else if (taskType === TASK_TYPE.ENDING) {
      value = defaultEndingOutput(input.selected_ending.ending_id)
    } else if (taskType === TASK_TYPE.KNOWLEDGE_REVEAL) {
      value = clone(DEFAULT_KNOWLEDGE_OUTPUT)
    } else {
      throw new StoryError(
        'STORY_TASK_NOT_IMPLEMENTED',
        `Fixture task ${taskType} is not implemented.`,
        501,
      )
    }
    return value
  }

  generate.failTask = null
  generate.getCallCount = () => callCount
  generate.getCalls = () => clone(calls)
  return generate
}

export const createFixtureStageGenerator = createFixtureStoryGenerator
export {
  DEFAULT_CONTINUE_OUTPUT,
  DEFAULT_KNOWLEDGE_OUTPUT,
  ENDING_PARAGRAPHS,
  VALID_OPENING_FIXTURE,
  VALID_OUTLINE_FIXTURE,
}
