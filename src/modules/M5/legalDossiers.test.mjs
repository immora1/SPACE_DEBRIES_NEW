import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEGAL_DOSSIERS,
  LEGAL_SECTIONS,
  LEGAL_SOURCE_INDEX,
  LEGAL_SUMMARY,
} from './legalDossiers.js'

test('M5 exposes six sections and exactly eighteen numbered core dossiers', () => {
  assert.equal(LEGAL_SECTIONS.length, 6)
  assert.equal(LEGAL_DOSSIERS.length, 18)
  assert.deepEqual(
    LEGAL_DOSSIERS.map((dossier) => dossier.number),
    Array.from({ length: 18 }, (_, index) => String(index + 1).padStart(2, '0')),
  )
  assert.deepEqual(
    LEGAL_SECTIONS.map((section) => section.id),
    ['international-treaties', 'mitigation-rules', 'regulation', 'governance-gaps', 'conclusion', 'sources'],
  )
})

test('every dossier has bilingual legal status, content, highlight, and official sources', () => {
  for (const dossier of LEGAL_DOSSIERS) {
    assert.ok(dossier.typeLabelZh)
    assert.ok(dossier.typeLabelEn)
    assert.ok(dossier.titleZh)
    assert.ok(dossier.titleEn)
    assert.ok(Array.isArray(dossier.bodyZh) && dossier.bodyZh.length >= 1)
    assert.ok(Array.isArray(dossier.bodyEn) && dossier.bodyEn.length >= 1)
    assert.ok(dossier.highlightZh)
    assert.ok(dossier.highlightEn)
    assert.ok(Array.isArray(dossier.sourceLinks) && dossier.sourceLinks.length >= 1)
    for (const source of dossier.sourceLinks) {
      assert.match(source.url, /^https:\/\//)
      assert.ok(source.labelZh)
      assert.ok(source.labelEn)
    }
  }
})

test('every dossier has the v2 bilingual short tab title', () => {
  const expected = [
    ['国家与商业航天责任', 'State Responsibility'],
    ['报废卫星仍有归属', 'Defunct Ownership'],
    ['空间损害责任', 'Space Liability'],
    ['空间物体登记', 'Registration'],
    ['COPUOS 减缓准则', 'COPUOS Guidelines'],
    ['长期可持续性指南', 'LTS Guidelines'],
    ['IADC 减缓指南', 'IADC Guidelines'],
    ['ISO 24113 标准', 'ISO 24113'],
    ['ESA 减缓要求', 'ESA Requirements'],
    ['Zero Debris Charter', 'Zero Debris'],
    ['FCC 五年处置规则', 'FCC 5-Year Rule'],
    ['英国空间活动许可', 'UK Licensing'],
    ['EU Space Act 提案', 'EU Space Act'],
    ['全球监管差异', 'Regulatory Differences'],
    ['全球清理机制缺口', 'Global Cleanup Gap'],
    ['报废卫星清理授权', 'Removal Authority'],
    ['碰撞责任认定', 'Collision Liability'],
    ['新垃圾与旧垃圾治理', 'Prevention vs Removal'],
  ]

  assert.deepEqual(
    LEGAL_DOSSIERS.map((dossier) => [dossier.tabTitleZh, dossier.tabTitleEn]),
    expected,
  )
})

test('v2 section labels distinguish legal takeaways from official sources', () => {
  const byId = new Map(LEGAL_SECTIONS.map((section) => [section.id, section]))
  assert.deepEqual(
    [byId.get('conclusion').titleZh, byId.get('conclusion').titleEn],
    ['法律结论', 'LEGAL TAKEAWAYS'],
  )
  assert.deepEqual(
    [byId.get('sources').titleZh, byId.get('sources').titleEn],
    ['官方来源', 'OFFICIAL SOURCES'],
  )
})

test('source index uses the v2 summary title and FILE 13 preserves proposal emphasis text', () => {
  assert.equal(LEGAL_SOURCE_INDEX[0].titleEn, 'UNOOSA — Space Law Treaties')
  assert.match(LEGAL_DOSSIERS.find((dossier) => dossier.number === '13').bodyZh.join(''), /截至 2026 年 8 月/)
  assert.match(LEGAL_DOSSIERS.find((dossier) => dossier.number === '13').bodyEn.join(''), /As of August 2026/)
})

test('legal statuses preserve the required hierarchy and proposal state', () => {
  const byId = new Map(LEGAL_DOSSIERS.map((dossier) => [dossier.id, dossier]))

  assert.match(byId.get('copuos-mitigation').typeLabelZh, /非约束性/)
  assert.match(byId.get('iadc-guidelines').typeLabelEn, /NON-BINDING/)
  assert.match(byId.get('iso-24113').typeLabelZh, /国际技术标准/)
  assert.match(byId.get('fcc-five-year-rule').typeLabelEn, /NATIONAL REGULATION · ENFORCEABLE WITHIN SCOPE/)
  assert.match(byId.get('uk-spaceflight-licensing').typeLabelZh, /国内监管｜可依法执行/)
  assert.match(byId.get('zero-debris-charter').typeLabelEn, /VOLUNTARY INITIATIVE · NON-BINDING/)
  assert.match(byId.get('eu-space-act').typeLabelZh, /尚未生效/)
  assert.match(byId.get('eu-space-act').bodyZh.join(''), /仍处于欧洲议会和欧盟理事会的普通立法程序谈判阶段/)
})

test('the final legal answer appears in dossier 15 and the conclusion', () => {
  const gap = LEGAL_DOSSIERS.find((dossier) => dossier.number === '15')
  assert.match(gap.highlightZh, /全球统一、普遍适用且具有强制执行力/)
  assert.match(gap.highlightZh, /未经授权和协调/)
  assert.match(gap.highlightEn, /universally applicable and globally enforceable/)
  assert.match(LEGAL_SUMMARY.highlightZh, /全球统一、普遍适用且具有强制执行力/)
  assert.match(LEGAL_SUMMARY.highlightEn, /universally applicable and globally enforceable/)
})

test('official source index contains the eight requested authority entries', () => {
  assert.equal(LEGAL_SOURCE_INDEX.length, 8)
  assert.deepEqual(
    LEGAL_SOURCE_INDEX.map((source) => source.id),
    ['unoosa-treaties', 'copuos-mitigation', 'lts', 'compendium', 'iadc', 'iso-24113', 'esa-mitigation', 'national-regional'],
  )
})

test('removed design-internal dossier titles are absent from public M5 data', () => {
  const serialized = JSON.stringify({ LEGAL_DOSSIERS, LEGAL_SECTIONS, LEGAL_SUMMARY, LEGAL_SOURCE_INDEX })
  for (const obsolete of ['主文案与短句', '法槌与化石地球说明', '问题导向与交互提示']) {
    assert.doesNotMatch(serialized, new RegExp(obsolete))
  }
})
