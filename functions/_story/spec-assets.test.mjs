import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getStorySpec, buildStoryPrompt, stableStringify } from './spec-assets.js'

const source = await readFile(new URL('../../docs/SPACE_DEBRIS_Story_Prompts_and_Schemas.md', import.meta.url), 'utf8')
for (const task of ['STORY_OUTLINE', 'STORY_OPENING', 'STORY_CONTINUE', 'STORY_ENDING', 'KNOWLEDGE_REVEAL']) {
  test(`${task} uses the supplied prompt and schema verbatim`, () => {
    const section = source.split(new RegExp(`^# \\d+\\. ${task}\\r?$`, 'm'))[1].split(/^# \d+\. /m)[0]
    const prompt = section.match(/```text\r?\n([\s\S]*?)\r?\n```/)[1].replace(/\r\n/g, '\n')
    const envelope = JSON.parse(section.match(/```json\r?\n([\s\S]*?)\r?\n```/)[1])
    assert.equal(getStorySpec(task).promptTemplate, prompt)
    assert.deepEqual(getStorySpec(task).schemaEnvelope, envelope)
  })
}

test('outline renders both inputs once without interpreting user placeholders', () => {
  const input = { story_user_input: { important_event: '保留 {{matched_satellite}} 和 $&' }, matched_satellite: { name: 'TEST-SAT' } }
  const prompt = buildStoryPrompt('STORY_OUTLINE', input)
  assert.ok(prompt.includes(stableStringify(input.story_user_input)))
  assert.ok(prompt.includes(stableStringify(input.matched_satellite)))
  assert.equal(stableStringify({ z: 1, a: 2 }), stableStringify({ a: 2, z: 1 }))
  assert.throws(() => buildStoryPrompt('STORY_OUTLINE', { story_user_input: {} }), /matched_satellite/)
})

test('branch is not an active model task and retry preserves the prompt', () => {
  assert.equal(getStorySpec('STORY_BRANCH'), null)
  const base = buildStoryPrompt('STORY_OPENING', {})
  const retry = buildStoryPrompt('STORY_OPENING', {}, 'OPENING_SCHEMA_INVALID')
  assert.ok(retry.startsWith(base))
  assert.match(retry, /后端校验反馈/)
})
