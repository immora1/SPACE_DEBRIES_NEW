import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const componentSource = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const dataSource = readFileSync(new URL('./legalDossiers.js', import.meta.url), 'utf8')

test('M5 keeps the stacked pull-out dossier interaction', () => {
  for (const contract of [
    'law-archive',
    'law-folder',
    'law-folder-tab',
    'handleFolderPointerDown',
    'DRAG_OPEN_THRESHOLD',
    'is-active',
    'is-returning',
  ]) {
    assert.match(componentSource, new RegExp(contract))
  }
})

test('official links open safely in a new tab', () => {
  assert.match(componentSource, /target="_blank"/)
  assert.match(componentSource, /rel="noopener noreferrer"/)
  assert.match(componentSource, /查看官方来源/)
  assert.match(componentSource, /OFFICIAL SOURCE/)
})

test('dossier and conclusion highlights use dedicated typography without alert colors', () => {
  assert.match(componentSource, /law-folder-highlight/)
  assert.match(componentSource, /law-summary-highlight/)
  assert.match(cssSource, /\.law-folder-highlight/)
  assert.match(cssSource, /\.law-summary-highlight/)
  assert.match(cssSource, /font-weight:\s*(600|650|700)/)
  assert.match(cssSource, /\.law-folder\.is-summary \.law-summary-highlight[\s\S]*opacity:\s*1/)
})

test('M5 renders structured conclusion and official source index inside dossiers', () => {
  assert.match(componentSource, /LEGAL_SUMMARY/)
  assert.match(componentSource, /LEGAL_SOURCE_INDEX/)
  assert.match(componentSource, /law-summary-frameworks/)
  assert.match(componentSource, /law-source-index/)
})

test('tabs use localized short titles while details retain full titles', () => {
  assert.match(componentSource, /tabTitle:/)
  assert.match(componentSource, /<strong>\{document\.tabTitle \?\? document\.title\}<\/strong>/)
  assert.match(dataSource, /tabTitleZh:/)
  assert.match(dataSource, /tabTitleEn:/)
})

test('section barriers carry bilingual localized labels', () => {
  assert.match(componentSource, /titleZh: section\.titleZh/)
  assert.match(componentSource, /titleEn: section\.titleEn/)
  assert.match(componentSource, /displayLabelEn: document\.kicker/)
})

test('v2 section labels are rendered in the archive', () => {
  assert.match(dataSource, /titleZh: '法律结论'/)
  assert.match(dataSource, /titleEn: 'LEGAL TAKEAWAYS'/)
  assert.match(dataSource, /titleEn: 'OFFICIAL SOURCES'/)
})

test('M5 opening copy uses the current bilingual responsibility wording and local highlight', () => {
  assert.match(componentSource, /太空垃圾责任与清理难题/)
  assert.match(componentSource, /Responsibility and the Challenge of Cleaning Up Space Debris/)
  assert.match(componentSource, /国际空间法已经规定了国家对航天活动的责任，也建立了空间物体登记和损害赔偿制度。联合国、IADC、ISO、ESA 以及各国监管机构，还制定了大量规则来减少新的空间碎片产生。/)
  assert.match(componentSource, /International space law already establishes state responsibility for space activities and provides frameworks for registering space objects and addressing damage\. The UN, IADC, ISO, ESA, and national regulators have also developed extensive rules aimed at reducing the creation of new orbital debris\./)
  assert.match(componentSource, /law-intro-highlight/)
  assert.match(componentSource, /谁必须清理、谁有权处理别国登记的失效卫星，以及如何跨国执行，目前仍缺少统一机制。/)
  assert.match(componentSource, /there is still no unified mechanism that fully resolves who must remove it, who is authorized to act on a foreign registered defunct spacecraft, and how cleanup obligations could be enforced across borders\./)
  assert.doesNotMatch(componentSource, /太空垃圾的法律框架与治理缺口/)
  assert.doesNotMatch(componentSource, /The Legal Framework and Governance Gaps of Space Debris/)
  assert.match(cssSource, /\.law-intro-highlight[\s\S]*font-weight:\s*(600|650|700)[\s\S]*opacity:\s*1/)
})
