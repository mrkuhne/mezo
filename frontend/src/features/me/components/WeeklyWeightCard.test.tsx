import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { WeeklyWeightCard } from './WeeklyWeightCard'
import type { WeekAggregate, DayRow } from './weightStats'

const week: WeekAggregate = {
  startIso: '2026-05-18', endIso: '2026-05-24', entries: [], avg: 78.9, low: 78.6, count: 4,
  delta: -0.5, direction: 'down', sparkPoints: [79.4, 78.9, 78.8, 78.6],
}
const rows: DayRow[] = [
  { iso: '2026-05-22', value: 78.6, dod: -0.2 },
  { iso: '2026-05-19', value: 79.4, dod: 0.4 },
]

test('collapsed shows range, avg, delta, direction; toggle fires', () => {
  const onToggle = vi.fn()
  render(<WeeklyWeightCard week={week} dayRows={[]} expanded={false} onToggle={onToggle} goalKind="cut" />)
  expect(screen.getByText('Máj 18–24')).toBeInTheDocument()
  expect(screen.getByText('78.9')).toBeInTheDocument()
  expect(screen.getByText('−0.5 kg')).toBeInTheDocument()
  expect(screen.getByText(/lefelé/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Máj 18–24/ }))
  expect(onToggle).toHaveBeenCalledOnce()
})

test('expanded shows per-day rows', () => {
  render(<WeeklyWeightCard week={week} dayRows={rows} expanded onToggle={() => {}} goalKind="cut" />)
  expect(screen.getByText('Máj 22 · Pén')).toBeInTheDocument()
  expect(screen.getByText('−0.2')).toBeInTheDocument()
})
