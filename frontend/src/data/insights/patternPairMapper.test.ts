import type { components } from '@/data/_client/api.gen'
import { toPatternMonitorPair } from '@/data/insights/patternPairMapper'

type PairWire = components['schemas']['PatternMonitorPair']

const wire: PairWire = {
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
  groupZeroDays: 8,
  groupOneDays: 1,
  requiredPerGroup: 3,
}

test('maps value kinds, group balance and normalizes omitted optional fields', () => {
  expect(toPatternMonitorPair(wire)).toEqual({
    ...wire,
    missingDays: null,
    bottleneckMetricKey: null,
    r: null,
    n: null,
    p: null,
    status: null,
  })
})
