import { groupedEvidence } from '@/features/insights/logic/patternEvidence'
import { formatMetricValue } from '@/features/insights/logic/metricFormat'
import type { AlignedDay } from '@/data/types'

const days: AlignedDay[] = [
  { date: '2026-08-24', a: 0, b: 23.6333 },
  { date: '2026-08-25', a: 0, b: 21.3333 },
  { date: '2026-08-26', a: 0, b: 23.7167 },
  { date: '2026-08-27', a: 0, b: 12.85 },
  { date: '2026-08-29', a: 1, b: 14.5833 },
  { date: '2026-08-31', a: 0, b: 17.9333 },
  { date: '2026-09-01', a: 0, b: 17.0333 },
  { date: '2026-09-02', a: 0, b: 22.2667 },
  { date: '2026-09-03', a: 0, b: 10.1167 },
]

test('summarizes the approved 8+1 evidence without inventing a one-day median', () => {
  const grouped = groupedEvidence(days, 3)
  expect(grouped.zero.count).toBe(8)
  expect(formatMetricValue('late-meal-hour', grouped.zero.median!)).toBe('19:38')
  expect(formatMetricValue('late-meal-hour', grouped.zero.min!)).toBe('10:07')
  expect(formatMetricValue('late-meal-hour', grouped.zero.max!)).toBe('23:43')
  expect(grouped.one).toMatchObject({ count: 1, median: null, min: 14.5833, max: 14.5833 })
  expect(grouped.latest).toEqual(days.at(-1))
  expect(grouped.latest?.a).toBe(0)
})

test('computes both medians once each group has three days', () => {
  const balanced = groupedEvidence([
    { date: '2026-09-01', a: 0, b: 10 },
    { date: '2026-09-02', a: 0, b: 12 },
    { date: '2026-09-03', a: 0, b: 14 },
    { date: '2026-09-04', a: 1, b: 18 },
    { date: '2026-09-05', a: 1, b: 20 },
    { date: '2026-09-06', a: 1, b: 22 },
  ], 3)
  expect(balanced.zero.median).toBe(12)
  expect(balanced.one.median).toBe(20)
})
