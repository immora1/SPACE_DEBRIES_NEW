import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORY_OPTION_SETS } from '../functions/_story/config/story-options.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const openingPackageRoot = resolve(root, 'docs/space_debris_outline_opening_v0.4')
const numericPackageRoot = resolve(root, 'docs/story_prompts_backend_bundle_v2_numeric_state')
const outputPath = resolve(root, 'functions/_story/spec-assets.generated.js')

async function extractMarkdownPrompt(packageRoot, relativePath) {
  const markdown = await readFile(resolve(packageRoot, relativePath), 'utf8')
  const match = markdown.match(/```text\r?\n([\s\S]*?)\r?\n```/)
  if (!match) throw new Error(`No text prompt block found in ${relativePath}`)
  return match[1].replace(/\r\n/g, '\n')
}

async function readJson(packageRoot, relativePath) {
  return JSON.parse(await readFile(resolve(packageRoot, relativePath), 'utf8'))
}

async function readText(packageRoot, relativePath) {
  return (await readFile(resolve(packageRoot, relativePath), 'utf8')).replace(/\r\n/g, '\n')
}

const CONSEQUENCE_IDS = Object.freeze([
  'core_item_secured',
  'time_window_compressed',
  'coordination_strain',
  'unclear_signal',
  'shared_plan',
  'visible_irreplaceable_loss',
])

const OUTLINE_OPTION_REACHABILITY_GUIDE = Object.fromEntries(
  Object.entries(STORY_OPTION_SETS).map(([nodeId, options]) => [
    nodeId,
    options.map((option) => ({
      option_id: option.option_id,
      delta: [
        option.state_delta.event_integrity,
        option.state_delta.relationship_connection,
        option.state_delta.uncertainty,
      ],
      add: option.add_consequence_ids,
      resolve: option.resolve_consequence_ids,
    })),
  ]),
)

function patchOutlinePrompt(prompt) {
  return prompt
    .replace(
      [
        '只规划各结局的内容方向，不生成程序判定条件。',
        '',
        '最终进入哪个结局，由后端根据累计状态、用户操作结果和持续后果决定。',
      ].join('\n'),
      [
        '为每个结局生成结构化 `state_rule`，仅使用 event_integrity、relationship_connection、uncertainty 与 consequence ID 作为条件。',
        '支持的比较操作符只有 gte、lte、gt、lt、eq。',
        `consequence ID 只能使用：${CONSEQUENCE_IDS.join('、')}；不需要 consequence 条件时使用空数组。`,
        '必须提供且只能提供一个 fallback 结局；fallback 的 conditions、required_consequence_ids 与 forbidden_consequence_ids 必须为空。',
        '每个非 fallback 规则都必须能被至少一条 node_02 至 node_08 的真实选择路径命中，且不能被更高优先级规则完全遮蔽；不要使用明显超出可达状态范围的阈值。',
        '以下只读 JSON 是后端真实选项配置。delta 数组依次为 event_integrity、relationship_connection、uncertainty；请结合你生成的 initial_story_state 模拟路径后再写 state_rule：',
        JSON.stringify(OUTLINE_OPTION_REACHABILITY_GUIDE),
        '不得生成自然语言程序判定条件，也不得生成旧 ending_type 字段。',
        '',
        '最终进入哪个结局，由后端执行这些结构化规则决定，模型不得在后续阶段重新选择。',
      ].join('\n'),
    )
    .replace(
      '- `uncertainty` 设置为5至15',
      '- `uncertainty` 必须为0至100整数；应按故事初始信息的不确定程度设置',
    )
    .replace(
      '`hidden_facts` 只记录后续连续性需要使用、但尚未向用户揭示的信息。',
      [
        '`hidden_facts` 只记录后续连续性需要使用、但尚未向用户揭示的信息。',
        '其中至少一条必须是与 `primary_anomaly` 直接相关的故事内因果事实；不得写入面向模型的禁令、写作说明或“知识揭示前不得公开”等元指令。',
      ].join('\n'),
    )
}

function patchOutlineSchema(envelope) {
  const patched = structuredClone(envelope)
  const endings = patched.schema.properties.reachable_endings
  const ending = endings.items
  delete ending.properties.ending_type
  ending.properties.state_rule = {
    type: 'object',
    description: '仅供后端执行的结构化结局选择规则。',
    properties: {
      priority: {
        type: 'integer',
        description: '非 fallback 结局的评估优先级，数值越高越优先。',
      },
      conditions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            metric: {
              type: 'string',
              enum: ['event_integrity', 'relationship_connection', 'uncertainty'],
            },
            operator: {
              type: 'string',
              enum: ['gte', 'lte', 'gt', 'lt', 'eq'],
            },
            value: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
            },
          },
          required: ['metric', 'operator', 'value'],
          additionalProperties: false,
        },
      },
      required_consequence_ids: {
        type: 'array',
        items: {
          type: 'string',
          enum: CONSEQUENCE_IDS,
        },
      },
      forbidden_consequence_ids: {
        type: 'array',
        items: {
          type: 'string',
          enum: CONSEQUENCE_IDS,
        },
      },
      fallback: {
        type: 'boolean',
      },
    },
    required: [
      'priority',
      'conditions',
      'required_consequence_ids',
      'forbidden_consequence_ids',
      'fallback',
    ],
    additionalProperties: false,
  }
  ending.required = ['ending_id', 'outcome', 'state_rule']
  endings.description = '可达结局及仅供后端执行的结构化状态规则。'

  const uncertainty = patched.schema.properties.initial_story_state.properties.uncertainty
  uncertainty.minimum = 0
  uncertainty.maximum = 100
  uncertainty.description = '进入开场前的信息与结果不确定性。'
  return patched
}

function patchOutlineFixture(fixture) {
  const patched = structuredClone(fixture)
  const rules = [
    {
      priority: 50,
      conditions: [
        { metric: 'event_integrity', operator: 'gte', value: 75 },
        { metric: 'relationship_connection', operator: 'gte', value: 65 },
        { metric: 'uncertainty', operator: 'lte', value: 35 },
      ],
      required_consequence_ids: [],
      forbidden_consequence_ids: ['visible_irreplaceable_loss'],
      fallback: false,
    },
    {
      priority: 40,
      conditions: [
        { metric: 'relationship_connection', operator: 'gte', value: 65 },
        { metric: 'uncertainty', operator: 'lte', value: 55 },
      ],
      required_consequence_ids: [],
      forbidden_consequence_ids: [],
      fallback: false,
    },
    {
      priority: 30,
      conditions: [
        { metric: 'event_integrity', operator: 'lte', value: 80 },
        { metric: 'uncertainty', operator: 'lt', value: 25 },
      ],
      required_consequence_ids: [],
      forbidden_consequence_ids: [],
      fallback: false,
    },
    {
      priority: 20,
      conditions: [
        { metric: 'uncertainty', operator: 'gte', value: 25 },
      ],
      required_consequence_ids: [],
      forbidden_consequence_ids: [],
      fallback: false,
    },
    {
      priority: 0,
      conditions: [],
      required_consequence_ids: [],
      forbidden_consequence_ids: [],
      fallback: true,
    },
  ]
  patched.reachable_endings = patched.reachable_endings.map((ending, index) => {
    const { ending_type: _legacyEndingType, ...current } = ending
    return { ...current, state_rule: rules[index] }
  })
  return patched
}

const [
  baseOutlinePrompt,
  openingPrompt,
  baseOutlineSchema,
  openingSchema,
  validationRules,
  baseOutlineFixture,
  openingFixture,
  continuePrompt,
  continueSchema,
  endingPrompt,
  endingSchema,
  knowledgePrompt,
  knowledgeSchema,
  backendContracts,
  contextExamples,
] = await Promise.all([
  extractMarkdownPrompt(openingPackageRoot, 'prompts/story_outline_prompt.md'),
  extractMarkdownPrompt(openingPackageRoot, 'prompts/story_opening_prompt.md'),
  readJson(openingPackageRoot, 'schemas/story_outline.schema.json'),
  readJson(openingPackageRoot, 'schemas/story_opening.schema.json'),
  readJson(openingPackageRoot, 'contracts/backend_validation_rules.json'),
  readJson(openingPackageRoot, 'fixtures/story_outline.valid.json'),
  readJson(openingPackageRoot, 'fixtures/story_opening.valid.json'),
  readText(numericPackageRoot, '01_story_continue.prompt.txt'),
  readJson(numericPackageRoot, '01_story_continue.schema.json'),
  readText(numericPackageRoot, '02_story_ending.prompt.txt'),
  readJson(numericPackageRoot, '02_story_ending.schema.json'),
  readText(numericPackageRoot, '03_knowledge_reveal.prompt.txt'),
  readJson(numericPackageRoot, '03_knowledge_reveal.schema.json'),
  readJson(numericPackageRoot, '04_backend_contracts.schema.json'),
  readJson(numericPackageRoot, '05_context_examples.json'),
])

const outlinePrompt = patchOutlinePrompt(baseOutlinePrompt)
const outlineSchema = patchOutlineSchema(baseOutlineSchema)
const outlineFixture = patchOutlineFixture(baseOutlineFixture)

const source = `// Generated from the v0.4 Outline/Opening package plus the v2 numeric-state bundle.
// Do not edit by hand. Run: npm run story:sync-spec

export const STORY_SPEC_VERSION = '2.0-numeric-state'
export const STORY_OPENING_SPEC_VERSION = '0.4'
export const STORY_OUTLINE_PROMPT_TEMPLATE = ${JSON.stringify(outlinePrompt)}
export const STORY_OPENING_PROMPT_TEMPLATE = ${JSON.stringify(openingPrompt)}
export const STORY_CONTINUE_PROMPT_TEMPLATE = ${JSON.stringify(continuePrompt)}
export const STORY_ENDING_PROMPT_TEMPLATE = ${JSON.stringify(endingPrompt)}
export const KNOWLEDGE_REVEAL_PROMPT_TEMPLATE = ${JSON.stringify(knowledgePrompt)}
export const STORY_OUTLINE_SCHEMA_ENVELOPE = ${JSON.stringify(outlineSchema)}
export const STORY_OPENING_SCHEMA_ENVELOPE = ${JSON.stringify(openingSchema)}
export const STORY_CONTINUE_SCHEMA_ENVELOPE = ${JSON.stringify(continueSchema)}
export const STORY_ENDING_SCHEMA_ENVELOPE = ${JSON.stringify(endingSchema)}
export const KNOWLEDGE_REVEAL_SCHEMA_ENVELOPE = ${JSON.stringify(knowledgeSchema)}
export const STORY_BACKEND_CONTRACTS = ${JSON.stringify(backendContracts)}
export const STORY_CONTEXT_EXAMPLES = ${JSON.stringify(contextExamples)}
export const STORY_CONSEQUENCE_IDS = ${JSON.stringify(CONSEQUENCE_IDS)}
export const STORY_VALIDATION_RULES = ${JSON.stringify(validationRules)}
export const VALID_OUTLINE_FIXTURE = ${JSON.stringify(outlineFixture)}
export const VALID_OPENING_FIXTURE = ${JSON.stringify(openingFixture)}
`

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, source, 'utf8')
console.log('Synced v2 numeric-state story specification assets.')
