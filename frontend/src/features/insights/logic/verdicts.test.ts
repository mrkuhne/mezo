import type { PatternMonitorPair } from '@/data/types'
import { groupBalanceSentence, verdictSentence } from '@/features/insights/logic/verdicts'

const pair: PatternMonitorPair = {
  key: 'weekend~late-meal-hour',
  title: 'Hétvége ↔ utolsó étkezés ideje',
  category: 'trigger',
  categoryLabel: 'Kiváltó',
  lagDays: 0,
  metricAKey: 'weekend',
  metricALabel: 'hétvége',
  metricAValueKind: 'binary',
  metricBKey: 'late-meal-hour',
  metricBLabel: 'utolsó étkezés ideje',
  metricBValueKind: 'clock_hour',
  mechanismHu: 'A hétvégi ritmus eltolhatja az utolsó étkezés idejét.',
  questionHu: 'Hétvégén később eszel utoljára?',
  expectedDirection: 'positive',
  whenPositiveHu: 'hétvégén {erősség} később ettél utoljára',
  whenNegativeHu: 'hétvégén {erősség} korábban ettél utoljára',
  metricADomain: 'other',
  metricBDomain: 'fuel',
  verdict: 'imbalanced_groups',
  alignedDays: 9,
  missingDays: null,
  bottleneckMetricKey: null,
  groupZeroDays: 8,
  groupOneDays: 1,
  requiredPerGroup: 3,
  r: null,
  n: null,
  p: null,
  status: null,
}

test('turns the smaller binary group into a concrete next-data sentence', () => {
  expect(verdictSentence(pair, null)).toBe('Még 2 hétvégi nap kell.')
})

test('explains why one weekend cannot establish a direction', () => {
  expect(groupBalanceSentence(pair)).toBe(
    '8 hétköznapi nap mellett még csak 1 hétvégi nap van. Egyetlen hétvégi napból még nem mondunk irányt.',
  )
})

test('does not invent a count when the boundary fields are absent', () => {
  expect(verdictSentence({ ...pair, groupOneDays: null }, null)).toBe('Mindkét oldalról több nap kell.')
})
