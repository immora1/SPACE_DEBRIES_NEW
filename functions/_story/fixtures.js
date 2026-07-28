import { AI_OUTPUT_SCHEMA_BY_TASK } from './schemas.js'
import { StoryError, TASK_TYPE } from './constants.js'

function emptyPatch(tag = '') {
  return {
    metrics_delta: {
      event_integrity: 0,
      relationship_connection: 0,
      uncertainty: 0,
    },
    add_confirmed_facts: [],
    add_known_to_user: tag ? [`用户已经看到${tag}带来的变化。`] : [],
    add_hidden_facts: [],
    resolve_open_threads: [],
    add_open_threads: [],
    add_active_consequences: [],
    add_story_tags: tag ? [`fixture_${tag}`] : [],
  }
}

export function createFixtureStageGenerator(options = {}) {
  let callIndex = 0

  const generate = async (taskType, contract) => {
    callIndex += 1
    if (
      options.failTask === taskType
      || options.failCallIndex === callIndex
      || generate.failTask === taskType
    ) {
      throw new StoryError('AI_REQUEST_FAILED', `Fixture failure for ${taskType}`, 502)
    }

    let value
    if (taskType === TASK_TYPE.OUTLINE) {
      value = {
        story_outline: {
          extracted_event: {
            people: ['你', '一位重要的人'],
            relationships: ['彼此信任'],
            time: '',
            place: '',
            core_event: contract.user_input.important_event,
            user_expectation: '让这件重要的事被完整保留',
            core_emotion: '期待与不安',
            irreplaceable_part: '在场的人与真实的交流',
          },
          narrative_rules: {
            hidden_cause: 'MESSAGE_DELAY',
            secondary_phenomenon: '时间显示偶尔不一致',
            perspective: 'SECOND_PERSON',
            tone: 'RESTRAINED_REALISTIC',
          },
          nodes: [
            { id: 'opening', label: '前夜', beat: '事情尚未开始，一切看似正常。' },
            { id: 'drift', label: '偏差', beat: '细微延迟开始影响安排。' },
            { id: 'choice', label: '选择', beat: '用户的操作改变联系与风险。' },
            { id: 'ending', label: '回声', beat: '累计选择决定最后结果。' },
          ],
          allowed_endings: [
            { id: 'preserved', label: '完整保留', condition_hint: '事件保留度较高' },
            { id: 'continued', label: '换一种方式延续', condition_hint: '联系仍然存在' },
            { id: 'changed', label: '部分改变', condition_hint: '不确定性持续累积' },
          ],
        },
        initial_story_state: {
          current_node_id: 'opening',
          metrics: {
            event_integrity: 70,
            relationship_connection: 70,
            uncertainty: 25,
          },
          confirmed_facts: [contract.user_input.important_event],
          known_to_user: ['这件重要的事即将发生。'],
          hidden_facts: ['消息延迟与轨道环境变化存在联系。'],
          open_threads: ['重要事件能否按计划发生'],
          active_consequences: [],
          story_tags: ['fixture_story'],
          last_user_action: null,
        },
      }
    } else {
      const label = contract.user_action?.label || taskType
      const textByTask = {
        [TASK_TYPE.OPENING]: `你确认任务后，${label}让故事从一个很小的时间误差开始。`,
        [TASK_TYPE.CONTINUE]: `你刚刚完成“${label}”。一个细节因此改变，后续余量也随之不同。`,
        [TASK_TYPE.ENDING]: `你回到那件最重要的事面前。此前的每次选择都留下了痕迹，最终结果不再与最初完全相同。`,
        [TASK_TYPE.KNOWLEDGE_REVEAL]: `你终于知道，先前的延迟来自轨道环境风险对卫星服务能力的影响；材料、机动和清理方式共同改变了风险。`,
      }
      value = {
        node_id: taskType === TASK_TYPE.ENDING ? 'ending' : taskType === TASK_TYPE.KNOWLEDGE_REVEAL ? 'reveal' : `stage-${callIndex}`,
        task_type: taskType,
        checkpoint: contract.next_checkpoint,
        display_content: {
          story_text: textByTask[taskType] || textByTask[TASK_TYPE.CONTINUE],
          choices: [],
        },
        story_state_patch: emptyPatch(taskType.toLowerCase()),
        stage_summary: `${taskType} fixture stage`,
        node_completed: true,
        next_node_id: null,
      }
    }

    if (options.invalidCheckpointTask === taskType) value.checkpoint = 'invalid'
    return AI_OUTPUT_SCHEMA_BY_TASK[taskType].parse(value)
  }

  generate.failTask = null
  generate.getCallCount = () => callIndex
  return generate
}
