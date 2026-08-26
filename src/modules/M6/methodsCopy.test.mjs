import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const textSource = source.replace(/<[^>]*>/g, '')

test('M6 uses the six bilingual debris-removal methods and shared detail schema', () => {
  for (const text of [
    '模块 06 / 轨道清理',
    'MODULE 06 / ORBITAL DEBRIS REMOVAL',
    '太空垃圾清理方法',
    'Space Debris Removal Methods',
    '太空垃圾的尺寸、形状和运动状态各不相同。机械臂、柔性网和鱼叉可以捕获大型目标，激光可用于改变部分小型碎片的轨道，电动力绳索和阻力帆则可以帮助目标降低轨道。',
    'Space debris varies in size, shape, and motion. Robotic arms, nets, and harpoons can be used to capture large targets, lasers can alter the orbits of some smaller fragments, while electrodynamic tethers and drag sails can help lower an object’s orbit.',
    '激光烧蚀',
    'LASER ABLATION',
    '激光改变轨道',
    'Laser Orbit Modification',
    '机械臂抓取',
    'Robotic Arm Capture',
    '柔性网捕获',
    'Net Capture',
    '鱼叉固定',
    'Harpoon Capture',
    '电动力绳索降轨',
    'Electrodynamic Tether Deorbiting',
    '阻力帆降轨',
    'Drag-Sail Deorbiting',
    '工作原理',
    '适用场景',
    '技术边界',
    'HOW IT WORKS',
    'BEST FOR',
    'LIMITATIONS',
    '激光通过微量烧蚀改变碎片轨道，并不会直接把整块碎片烧掉。',
    'Laser ablation changes the debris orbit through a small reaction force; it does not simply vaporize the entire object.',
  ]) {
    assert.ok(textSource.includes(text), `missing M6 copy: ${text}`)
  }

  for (const id of ['laser', 'arm', 'net', 'harpoon', 'tether', 'sail']) {
    assert.match(source, new RegExp(`id: '${id}'`))
  }

  for (const oldTitle of [
    "title: '激光烧蚀'",
    "title: '柔性捕捉网'",
    "title: '飞行鱼叉'",
    "title: '电动力缆索'",
  ]) {
    assert.doesNotMatch(source, new RegExp(oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('M6 renders the three detail sections without changing the card interaction path', () => {
  assert.match(source, /activeMethod\.howItWorks/)
  assert.match(source, /activeMethod\.bestFor/)
  assert.match(source, /activeMethod\.limitations/)
  assert.match(source, /onActivate\(isActive \? null : method\.id\)/)
  assert.match(source, /METHODS\.map\(\(method\) => localizeMethod\(method, language\)\)/)
})

test('M6 uses PingFang for all text in Chinese mode only', () => {
  assert.match(styles, /\.m6:lang\(zh\),\s*\.m6:lang\(zh\) \*/)
  assert.match(styles, /font-family:"PingFang FC", "PingFang SC", "Microsoft YaHei", sans-serif/)
})

test('M6 matching lab presents scenario-based target evidence in both languages', () => {
  for (const text of [
    '观察每个目标的尺寸、运动状态和结构特点，再从左侧选择合适的清理方式，将卡片拖入对应目标。',
    'Examine each target’s size, motion, and structural characteristics, then choose a suitable removal method from the left and drag it onto the matching target.',
    '任务末期小卫星',
    'End-of-Life Small Satellite',
    '失效大型残骸',
    'Large Defunct Object',
    '厘米级碎片群',
    'Centimeter-Scale Debris Cluster',
    '姿态可控',
    'Controlled',
    '主体完整',
    'Intact body',
    '多个碎片',
    'Multiple fragments',
    '拖入合适的清理方式',
    'DRAG IN A SUITABLE REMOVAL METHOD',
  ]) {
    assert.ok(textSource.includes(text), `missing matching-lab copy: ${text}`)
  }

  assert.match(source, /ideal: 'laser'/)
  assert.match(source, /ideal: 'arm'/)
  assert.match(source, /ideal: 'sail'/)
  assert.match(source, /target\.thirdLabel/)
})

test('M6 matching lab stages editable answers until confirmation', () => {
  assert.match(source, /const \[draftMatches, setDraftMatches\]/)
  assert.match(source, /function confirmMatches\(\)/)
  assert.match(source, /确认选择/)
  assert.match(source, /CONFIRM SELECTION/)
  assert.match(source, /assignTarget\(target\.id, selectedMethodId\)/)
  assert.doesNotMatch(source, /void matchTarget\(target\.id, selectedMethodId\)/)
})
