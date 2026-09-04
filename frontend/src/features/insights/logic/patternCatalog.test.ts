import { describe, expect, test } from 'vitest'
import type { Pattern, PatternMonitorPair } from '@/data/types'
import type { LifecycleBucket, LifecycleEntry } from '@/features/insights/logic/lifecycle'
import {
  PATTERN_PAGE_SIZE,
  entryDomain,
  filterSortEntries,
  initialBucket,
  pageEntries,
} from '@/features/insights/logic/patternCatalog'

const pattern = (pairKey: string, title: string): Pattern => ({
  id: pairKey,
  pairKey,
  category: 'trigger',
  categoryLabel: 'Kiváltó',
  title,
  mechanism: 'Teszt mechanizmus.',
  evidence: [],
  status: 'confirmed',
  kind: 'ai_hypothesis',
})

const pair = (key: string, domain: PatternMonitorPair['metricBDomain'], title: string): PatternMonitorPair => ({
  key,
  title: key,
  category: 'trigger',
  categoryLabel: 'Kiváltó',
  lagDays: 0,
  metricAKey: 'weekend',
  metricALabel: 'hétvége',
  metricAValueKind: 'binary',
  metricBKey: 'late-meal-hour',
  metricBLabel: 'utolsó étkezés',
  metricBValueKind: 'clock_hour',
  mechanismHu: 'Teszt.',
  questionHu: title,
  expectedDirection: 'positive',
  whenPositiveHu: '{erősség}',
  whenNegativeHu: '{erősség}',
  metricADomain: 'other',
  metricBDomain: domain,
  verdict: 'live',
  alignedDays: 9,
  missingDays: null,
  bottleneckMetricKey: null,
  groupZeroDays: 6,
  groupOneDays: 3,
  requiredPerGroup: 3,
  r: 0.4,
  n: 9,
  p: 0.08,
  status: null,
})

const entry = (
  key: string,
  title: string,
  bucket: LifecycleBucket,
  domain?: PatternMonitorPair['metricBDomain'],
): LifecycleEntry => ({
  key,
  bucket,
  pattern: pattern(key, title),
  pair: domain ? pair(key, domain, title) : null,
})

const buckets = (values: Partial<Record<LifecycleBucket, LifecycleEntry[]>>) => new Map<LifecycleBucket, LifecycleEntry[]>([
  ['decide', values.decide ?? []],
  ['monitoring', values.monitoring ?? []],
  ['confirmed', values.confirmed ?? []],
  ['gathering', values.gathering ?? []],
  ['noRelationship', values.noRelationship ?? []],
  ['rejected', values.rejected ?? []],
])

describe('patternCatalog', () => {
  test('initialBucket prioritises decisions, then the first non-empty lifecycle bucket', () => {
    expect(initialBucket(buckets({ decide: [entry('d', 'Döntés', 'decide')], confirmed: [entry('c', 'Tudás', 'confirmed')] }))).toBe('decide')
    expect(initialBucket(buckets({ confirmed: [entry('c', 'Tudás', 'confirmed')] }))).toBe('confirmed')
    expect(initialBucket(buckets({}))).toBe('decide')
  })

  test('entryDomain uses the output metric domain and keeps unpaired patterns under other', () => {
    const sleep = entry('sleep', 'Alvás', 'confirmed', 'sleep')
    const hypothesis = entry('hyp', 'Hipotézis', 'confirmed')
    expect(entryDomain(sleep)).toBe('sleep')
    expect(entryDomain(hypothesis)).toBe('other')
    expect(filterSortEntries([sleep, hypothesis], null, 'progress')).toEqual([sleep, hypothesis])
    expect(filterSortEntries([sleep, hypothesis], 'other', 'progress')).toEqual([hypothesis])
  })

  test('domain sort follows domain order then Hungarian title order', () => {
    const values = [
      entry('other', 'Záró', 'confirmed'),
      entry('fuel-z', 'Zab', 'confirmed', 'fuel'),
      entry('sleep', 'Álom', 'confirmed', 'sleep'),
      entry('fuel-a', 'Alma', 'confirmed', 'fuel'),
    ]
    expect(filterSortEntries(values, null, 'domain').map((item) => item.key)).toEqual([
      'sleep', 'fuel-a', 'fuel-z', 'other',
    ])
  })

  test('pageEntries returns five rows and clamps an out-of-range page', () => {
    const values = Array.from({ length: 12 }, (_, index) => entry(`p${index}`, `Minta ${index}`, 'gathering'))
    expect(PATTERN_PAGE_SIZE).toBe(5)
    expect(pageEntries(values, 0)).toMatchObject({ page: 0, pageCount: 3 })
    expect(pageEntries(values, 0).items).toHaveLength(5)
    expect(pageEntries(values, 99)).toMatchObject({ page: 2, pageCount: 3 })
    expect(pageEntries(values, 99).items.map((item) => item.key)).toEqual(['p10', 'p11'])
  })
})
