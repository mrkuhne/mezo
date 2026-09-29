import { fireEvent, render, screen } from '@testing-library/react'
import { PatternZoneChart } from '@/features/insights/components/PatternZoneChart'
import type { PatternMonitorPair } from '@/data/types'

const pair = { metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number' } as PatternMonitorPair
const days = [[6.2, 6], [6.3, 6], [6.4, 5], [6.5, 6], [6.6, 5], [6.9, 5], [7.0, 4], [7.1, 5], [7.2, 4]]
  .map(([a, b], i) => ({ date: `2026-09-${10 + i}`, a, b }))

test('zone averages sit on top, the x metric is named once', () => {
  render(<PatternZoneChart days={days} pair={pair} showAverages tone="lav" />)
  // 9 distinct A values: the cut nearest n/2 = 4.5 is a tie (k=4 / k=5) → the lower k, 4 | 5 days
  expect(screen.getByText('5,8')).toBeInTheDocument()
  expect(screen.getByText('4,6')).toBeInTheDocument()
  expect(screen.getByText('ébredés ideje →')).toBeInTheDocument()
  expect(screen.queryByText(/napok$/)).toBeNull() // no per-zone x-metric captions any more
})

test('the dots sit in an accessible group, not a flattened image', () => {
  render(<PatternZoneChart days={days} pair={pair} showAverages tone="lav" />)
  const group = screen.getByRole('group', { name: /ébredés ideje/ })
  const dot = screen.getAllByRole('button', { name: /energia-szint/ })[0]
  expect(group).toContainElement(dot)
})

test('tapping a dot shows its day and value without leaving the chart', () => {
  render(<PatternZoneChart days={days} pair={pair} showAverages tone="lav" />)
  const dot = screen.getAllByRole('button', { name: /energia-szint/ })[0]
  fireEvent.click(dot)
  expect(dot).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('energia-szint: 6')).toBeInTheDocument()
  fireEvent.click(dot)
  expect(screen.queryByText('energia-szint: 6')).toBeNull()
})

test('numbers read with a decimal comma and dots are named by a human date', () => {
  const frac = days.map((d, i) => ({ ...d, b: d.b + (i === 0 ? 0.5 : 0) }))
  render(<PatternZoneChart days={frac} pair={pair} showAverages tone="lav" />)
  const dot = screen.getByRole('button', { name: 'Szep 10: ébredés ideje 06:12, energia-szint 6,5' })
  fireEvent.click(dot)
  expect(screen.getByText('energia-szint: 6,5')).toBeInTheDocument()
  expect(screen.queryByText(/6\.5/)).toBeNull()
})

test('without averages only the day counts show', () => {
  render(<PatternZoneChart days={days.slice(0, 5)} pair={pair} showAverages={false} tone="lav" />)
  expect(screen.queryByText(/átlag/)).toBeNull()
})

test('binary pairs name the two groups under the zones', () => {
  const bin = { ...pair, metricAKey: 'weekend', metricALabel: 'hétvége', metricAValueKind: 'binary' } as PatternMonitorPair
  render(<PatternZoneChart days={days.map((d, i) => ({ ...d, a: i % 3 === 0 ? 1 : 0 }))} pair={bin} showAverages tone="sky" />)
  expect(screen.getByText(/^Hétköznap/)).toBeInTheDocument()
})

test('clock values follow the wire value kind, not a hard-coded key list', () => {
  // a reflection series key the hour catalog has never heard of, flagged clock by the wire
  const refl = { ...pair, metricAKey: 'reflection:koffein', metricALabel: 'utolsó kávé', metricAValueKind: 'number',
    metricBKey: 'reflection:lefekves', metricBLabel: 'lefekvés', metricBValueKind: 'clock_hour' } as PatternMonitorPair
  const d = [[1, 25.5], [2, 23], [3, 24], [4, 25]].map(([a, b], i) => ({ date: `2026-09-${10 + i}`, a, b }))
  render(<PatternZoneChart days={d} pair={refl} showAverages tone="lav" />)
  const dot = screen.getByRole('button', { name: 'Szep 10: utolsó kávé 1, lefekvés 01:30' })
  fireEvent.click(dot)
  expect(screen.getByText('lefekvés: 01:30')).toBeInTheDocument()
  // zone averages: (23 + 25.5) / 2 = 24.25 → 00:15, (24 + 25) / 2 = 24.5 → 00:30
  expect(screen.getByText('00:15')).toBeInTheDocument()
  expect(screen.getByText('00:30')).toBeInTheDocument()
  // the days table reads the same clock
  expect(screen.getAllByText('01:30').some((el) => el.closest('table'))).toBe(true)
  // no raw decimal hour leaks anywhere (ticks, tooltip, table)
  expect(document.body.textContent).not.toMatch(/25[.,]5/)
})

test('all-equal A values keep one zone across the chart, with no second average and no NaN', () => {
  const flat = days.map((d) => ({ ...d, a: 7 }))
  const { container } = render(<PatternZoneChart days={flat} pair={pair} showAverages tone="lav" />)
  expect(screen.getAllByText(/átlag · \d+ nap/)).toHaveLength(1)
  expect(container.querySelectorAll('.pmx-avg')).toHaveLength(1)
  expect(container.innerHTML).not.toContain('NaN')
})
