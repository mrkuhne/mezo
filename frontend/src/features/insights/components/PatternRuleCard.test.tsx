// ============================================================
// Mezo · PatternRuleCard teszt (mezo-rstt7) — a szabály mondata félkövér darabokkal, a
// nap-mérleg, az eltolás és az ablak chip-je egy pillantásra igazolható.
// ============================================================
import { render, screen } from '@testing-library/react'
import { PatternRuleCard } from '@/features/insights/components/PatternRuleCard'
import type { Reading } from '@/features/insights/logic/patternReading'
import type { PatternMonitorPair, PatternTestPlan } from '@/data/types'

const pair = {
  key: 'wakeup-hour~checkin-energy', title: 'Ébredés ideje ↔ energia-szint', lagDays: 0,
  metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour', metricADomain: 'sleep',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number', metricBDomain: 'mind',
  expectedDirection: 'negative', verdict: 'live', alignedDays: 9, missingDays: null, r: -0.312, n: 9, p: 0.41,
  groupZeroDays: null, groupOneDays: null, requiredPerGroup: null, bottleneckMetricKey: null, status: null,
} as unknown as PatternMonitorPair
const plan: PatternTestPlan = {
  seriesA: 'wakeup-hour', seriesB: 'checkin-energy', seriesALabel: 'ébredés ideje', seriesBLabel: 'energia-szint',
  lagDays: 0, expectedDirection: 'negative', minN: 8, windowDays: 60,
}
const reading = { state: 'halvany', now: null, then: null, minN: 8, dayCount: 9, dir: -1 } as Reading

test('the rule sentence bolds its clauses, and the chips read the day-balance, lag and window', () => {
  render(<PatternRuleCard pair={pair} plan={plan} reading={reading} windowDays={60} />)
  expect(screen.getByText('az ébredés ideje', { selector: 'b' })).toBeInTheDocument()
  expect(screen.getByText('az energia-szint', { selector: 'b' })).toBeInTheDocument()
  expect(screen.getByText(/9 nap · elég \(8 kell\)/)).toBeInTheDocument()
  expect(screen.getByText(/aznap nézem a hatást/)).toBeInTheDocument()
  expect(screen.getByText(/az utolsó 60 napból/)).toBeInTheDocument()
})
