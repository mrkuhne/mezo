import { fireEvent, render, screen } from '@testing-library/react'
import { PatternZoneChart } from '@/features/insights/components/PatternZoneChart'
import type { PatternMonitorPair } from '@/data/types'

const pair = { metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number' } as PatternMonitorPair
const days = [[6.2, 6], [6.3, 6], [6.4, 5], [6.5, 6], [6.6, 5], [6.9, 5], [7.0, 4], [7.1, 5], [7.2, 4]]
  .map(([a, b], i) => ({ date: `2026-09-${10 + i}`, a, b }))

test('zone averages sit on top, the x metric is named once', () => {
  render(<PatternZoneChart days={days} pair={pair} showAverages tone="lav" />)
  expect(screen.getByText('5,6')).toBeInTheDocument()
  expect(screen.getByText('4,5')).toBeInTheDocument()
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
