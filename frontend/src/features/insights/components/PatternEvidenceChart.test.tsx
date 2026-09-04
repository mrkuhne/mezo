import { render, screen } from '@testing-library/react'
import { PatternEvidenceChart } from '@/features/insights/components/PatternEvidenceChart'
import type { AlignedDay, PatternMonitorPair } from '@/data/types'

const pair: PatternMonitorPair = {
  key: 'weekend~late-meal-hour', title: 'Hétvége ↔ késői étkezés',
  category: 'trigger', categoryLabel: 'Trigger', lagDays: 0,
  metricAKey: 'weekend', metricALabel: 'hétvége', metricAValueKind: 'binary',
  metricBKey: 'late-meal-hour', metricBLabel: 'utolsó étkezés ideje', metricBValueKind: 'clock_hour',
  mechanismHu: 'm', questionHu: 'q', expectedDirection: 'positive',
  whenPositiveHu: 'pozitív', whenNegativeHu: 'negatív',
  metricADomain: 'other', metricBDomain: 'fuel', verdict: 'imbalanced_groups',
  alignedDays: 9, missingDays: null, bottleneckMetricKey: null,
  groupZeroDays: 8, groupOneDays: 1, requiredPerGroup: 3,
  r: null, n: null, p: null, status: null,
}

const binaryDays: AlignedDay[] = [
  { date: '2026-09-01', a: 0, b: 12 },
  { date: '2026-09-02', a: 0, b: 18 },
  { date: '2026-09-03', a: 0, b: 23.7167 },
  { date: '2026-09-04', a: 1, b: 14.5833 },
]

test('binary value kind renders a two-group clock plot without a trendline', () => {
  render(<PatternEvidenceChart days={binaryDays} pair={pair} />)
  expect(screen.getByText('Hétköznap')).toBeInTheDocument()
  expect(screen.getByText('Hétvége')).toBeInTheDocument()
  expect(screen.getByText('24:00')).toBeInTheDocument()
  expect(screen.getByText('18:00')).toBeInTheDocument()
  expect(screen.getByText('12:00')).toBeInTheDocument()
  expect(screen.getByLabelText(/legutóbbi nap/i)).toBeInTheDocument()
  expect(screen.queryByLabelText('trendvonal')).not.toBeInTheDocument()
})

test('numeric value kind renders real axis values and a trendline only while live', () => {
  const numeric = {
    ...pair,
    metricAKey: 'sleep-quality', metricALabel: 'alvásminőség', metricAValueKind: 'number' as const,
    metricBKey: 'training-rpe', metricBLabel: 'edzés-RPE', metricBValueKind: 'number' as const,
    verdict: 'live' as const,
  }
  const { rerender } = render(<PatternEvidenceChart days={[
    { date: '2026-09-01', a: 4, b: 8 },
    { date: '2026-09-02', a: 6, b: 6 },
    { date: '2026-09-03', a: 8, b: 4 },
  ]} pair={numeric} />)
  expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1)
  expect(screen.getByLabelText('trendvonal')).toBeInTheDocument()

  rerender(<PatternEvidenceChart days={[
    { date: '2026-09-01', a: 4, b: 8 },
    { date: '2026-09-02', a: 6, b: 6 },
  ]} pair={{ ...numeric, verdict: 'few_days' }} />)
  expect(screen.queryByLabelText('trendvonal')).not.toBeInTheDocument()
})
