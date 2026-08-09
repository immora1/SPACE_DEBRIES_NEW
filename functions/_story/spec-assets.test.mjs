import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  KNOWLEDGE_REVEAL_PROMPT_TEMPLATE,
  STORY_CONTINUE_PROMPT_TEMPLATE,
  STORY_ENDING_PROMPT_TEMPLATE,
  STORY_OPENING_PROMPT_TEMPLATE,
  STORY_OPENING_SPEC_VERSION,
  STORY_OUTLINE_PROMPT_TEMPLATE,
  STORY_SPEC_VERSION,
  buildStoryPrompt,
  continueSchemaEnvelope,
  endingSchemaEnvelope,
  knowledgeSchemaEnvelope,
  openingSchemaEnvelope,
  outlineSchemaEnvelope,
  stableStringify,
} from './spec-assets.js'

const packageRoot = resolve('docs/space_debris_outline_opening_v0.4')
const numericRoot = resolve('docs/story_prompts_backend_bundle_v2_numeric_state')
const userInputFixture = JSON.parse(
  await readFile(resolve(packageRoot, 'fixtures/story_user_input.valid.json'), 'utf8'),
)

async function promptFromMarkdown(relativePath) {
  const markdown = await readFile(resolve(packageRoot, relativePath), 'utf8')
  const match = markdown.match(/```text\r?\n([\s\S]*?)\r?\n```/)
  assert.ok(match, `${relativePath} should contain a text code block`)
  return match[1].replace(/\r\n/g, '\n')
}

test('本地 Prompt 继续使用单一生成源并固定为五节点故事蓝图', async () => {
  assert.equal(STORY_SPEC_VERSION, '4.0-five-stage-v1')
  assert.equal(STORY_OPENING_SPEC_VERSION, '0.4')
  assert.equal(
    STORY_OPENING_PROMPT_TEMPLATE,
    await promptFromMarkdown('prompts/story_opening_prompt.md'),
  )
  assert.equal(
    STORY_CONTINUE_PROMPT_TEMPLATE,
    (await readFile(resolve(numericRoot, '01_story_continue.prompt.txt'), 'utf8'))
      .replace(/\r\n/g, '\n'),
  )
  assert.equal(
    STORY_ENDING_PROMPT_TEMPLATE,
    (await readFile(resolve(numericRoot, '02_story_ending.prompt.txt'), 'utf8'))
      .replace(/\r\n/g, '\n'),
  )
  assert.equal(
    KNOWLEDGE_REVEAL_PROMPT_TEMPLATE,
    (await readFile(resolve(numericRoot, '03_knowledge_reveal.prompt.txt'), 'utf8'))
      .replace(/\r\n/g, '\n'),
  )
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /后端可直接执行的 `state_rule`/)
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /不得生成 `POSITIVE`、`PARTIAL`、`NEGATIVE`/)
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /隐藏事实不得进入 Opening 或普通故事正文/)
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /每个故事必须且只能存在一个 `fallback = true`/)
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /node_01 = STORY_OPENING/)
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /node_05 = STORY_ENDING/)
  assert.doesNotMatch(STORY_OUTLINE_PROMPT_TEMPLATE, /SITE_GROUP_SINGLE/)
  assert.doesNotMatch(STORY_OUTLINE_PROMPT_TEMPLATE, /"option_id":"weather"/)
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /后续所有数值变化由后端/)
  assert.match(STORY_OUTLINE_PROMPT_TEMPLATE, /只规划一个故事阶段/)
  assert.match(STORY_CONTINUE_PROMPT_TEMPLATE, /current_node/)
  assert.match(STORY_CONTINUE_PROMPT_TEMPLATE, /generation_source/)
  assert.ok(outlineSchemaEnvelope.schema.properties.story_nodes)
  assert.equal(outlineSchemaEnvelope.schema.properties.story_stages, undefined)
  assert.match(STORY_OPENING_PROMPT_TEMPLATE, /\{\{opening_context\}\}/)
  assert.doesNotMatch(STORY_OPENING_PROMPT_TEMPLATE, /\{\{story_outline\}\}/)
})

test('Opening Schema 未改变，v2 输出 Schema 直接读取增量包', async () => {
  const opening = JSON.parse(
    await readFile(resolve(packageRoot, 'schemas/story_opening.schema.json'), 'utf8'),
  )
  assert.deepEqual(openingSchemaEnvelope, opening)
  assert.deepEqual(
    continueSchemaEnvelope,
    JSON.parse(await readFile(resolve(numericRoot, '01_story_continue.schema.json'), 'utf8')),
  )
  assert.deepEqual(
    endingSchemaEnvelope,
    JSON.parse(await readFile(resolve(numericRoot, '02_story_ending.schema.json'), 'utf8')),
  )
  assert.deepEqual(
    knowledgeSchemaEnvelope,
    JSON.parse(await readFile(resolve(numericRoot, '03_knowledge_reveal.schema.json'), 'utf8')),
  )
  const endingItem = outlineSchemaEnvelope.schema.properties.reachable_endings.items
  assert.equal(endingItem.properties.ending_type, undefined)
  assert.ok(endingItem.properties.state_rule)
  assert.deepEqual(
    endingItem.required,
    ['ending_id', 'outcome', 'state_rule'],
  )
})

test('Prompt 变量使用稳定 JSON 序列化且只替换指定占位符', () => {
  const prompt = buildStoryPrompt('STORY_OUTLINE', userInputFixture)
  assert.equal(prompt.includes('{{story_user_input}}'), false)
  assert.ok(prompt.includes(stableStringify(userInputFixture)))

  const first = stableStringify({ z: 1, a: { y: 2, b: 3 } })
  const second = stableStringify({ a: { b: 3, y: 2 }, z: 1 })
  assert.equal(first, second)
})

test('校验重试只追加简洁反馈，不修改冻结 Prompt 主体', () => {
  const base = buildStoryPrompt('STORY_OPENING', { task_type: 'STORY_OUTLINE' })
  const retry = buildStoryPrompt(
    'STORY_OPENING',
    { task_type: 'STORY_OUTLINE' },
    'OPENING_SCHEMA_INVALID: unexpected field',
  )
  assert.ok(retry.startsWith(base))
  assert.match(retry, /后端校验反馈：/)
  assert.match(retry, /OPENING_SCHEMA_INVALID/)
})

test('Outline 可达性定向重试保留完整后端规则，不被普通反馈长度截断', () => {
  const marker = 'ending_04_complete_rule_marker'
  const reason = `OUTLINE_ENDING_UNREACHABLE:${'x'.repeat(600)}${marker}`
  const prompt = buildStoryPrompt('STORY_OUTLINE', userInputFixture, reason)

  assert.match(prompt, new RegExp(marker))
})
