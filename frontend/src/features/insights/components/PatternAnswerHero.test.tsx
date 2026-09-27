// ============================================================
// Mezo · PatternAnswerHero teszt (mezo-rstt7) — a válasz a heading, a kérdés halk, a döntés
// gombjai a `decisionPlan` szerint gombolnak, a lezárt/megerősített minta csak visszavon.
// ============================================================
import { fireEvent, render, screen } from '@testing-library/react'
import { PatternAnswerHero } from '@/features/insights/components/PatternAnswerHero'
import { readPattern } from '@/features/insights/logic/patternReading'
import type { Pattern, PatternMonitorPair } from '@/data/types'

const pair = {
  key: 'k', title: 'Ébredés ideje ↔ energia-szint', lagDays: 0, questionHu: 'Több energiád van, ha korábban kelsz?',
  metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour', metricADomain: 'sleep',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number', metricBDomain: 'mind',
  expectedDirection: 'negative', verdict: 'live', alignedDays: 9, missingDays: null, r: -0.312, n: 9, p: 0.41,
  groupZeroDays: null, groupOneDays: null, requiredPerGroup: null, bottleneckMetricKey: null, status: null,
} as unknown as PatternMonitorPair
const pattern = { id: 'p1', status: 'proposed', evidenceHits: 0, evidenceMisses: 0 } as Pattern
const days = [[6.2, 6], [6.3, 6], [6.4, 5], [6.5, 6], [6.6, 5], [6.9, 5], [7.0, 4], [7.1, 5], [7.2, 4]]
  .map(([a, b], i) => ({ date: `2026-09-${10 + i}`, a, b }))

test('the answer is the heading, the question is quiet, the recommended action is lit', () => {
  const onDecide = vi.fn()
  const reading = readPattern({ pair, pattern, days, events: [] }, 8)
  render(<PatternAnswerHero pair={pair} pattern={pattern} reading={reading} days={days} events={[]} onDecide={onDecide} />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Halvány jel')
  expect(screen.getByText('Több energiád van, ha korábban kelsz?')).toBeInTheDocument()
  const watch = screen.getByRole('button', { name: /Figyeljük még/ })
  expect(watch).toHaveClass('is-rec')
  expect(screen.queryByRole('button', { name: /Megerősítem/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Elvetem/ }))
  expect(onDecide).toHaveBeenCalledWith('reject')
})

test('a confirmed, holding pattern only offers a quiet revoke', () => {
  const strong = { ...pair, r: -0.9, n: 20 } as PatternMonitorPair
  const confirmed = { ...pattern, status: 'confirmed' } as Pattern
  const reading = readPattern({ pair: strong, pattern: confirmed, days, events: [] }, 8)
  render(<PatternAnswerHero pair={strong} pattern={confirmed} reading={reading} days={days} events={[]} onDecide={vi.fn()} />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tartja magát')
  expect(screen.getByText('Bekerült a Tudástárba, Mezo számol vele.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mégsem igaz rám — visszavonom' })).toBeInTheDocument()
})
