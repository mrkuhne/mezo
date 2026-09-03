import { render, screen } from '@testing-library/react'
import { WeekRhythmGrid } from '@/features/fuel/components/WeekRhythmGrid'
// Presentational prop tests — fed the Phase-1 seeds directly (useFuelWeek became a composed
// dual-mode hook in Fuel P4; the grid itself stays a pure component). caffeineCutoff/kitchenClose
// are now CALLER-derived props (audit gap #16 fix) rather than hardcoded inside the component.
import { gymSchedule } from '@/data/fuel/fuelWeek'
import { volleyballSessions } from '@/data/today/today'

const renderGrid = (overrides: Partial<{ caffeineCutoff: string; kitchenClose: string }> = {}) =>
  render(
    <WeekRhythmGrid
      gymSchedule={gymSchedule}
      volleyball={volleyballSessions}
      caffeineCutoff="14:00"
      kitchenClose="21:00"
      title="Máj 18 – 24"
      {...overrides}
    />,
  )

test('renders the legend with the caller-supplied caffeine-cutoff + kitchen-close times', () => {
  renderGrid()
  expect(screen.getByText(/koffein-cutoff 14:00 — a beállításaidból/)).toBeInTheDocument()
  expect(screen.getByText(/konyhazárás 21:00/)).toBeInTheDocument()
})

test('a non-default cutoff/close (settings-derived) replaces the legend times — no hardcoded 14:00/21:00', () => {
  renderGrid({ caffeineCutoff: '16:30', kitchenClose: '22:15' })
  expect(screen.getByText(/koffein-cutoff 16:30 — a beállításaidból/)).toBeInTheDocument()
  expect(screen.getByText(/konyhazárás 22:15/)).toBeInTheDocument()
  expect(screen.queryByText(/14:00/)).not.toBeInTheDocument()
  expect(screen.queryByText(/21:00/)).not.toBeInTheDocument()
})

test('renders gym + röpi legend swatches and the week-label corner', () => {
  renderGrid()
  expect(screen.getByText('gym')).toBeInTheDocument()
  expect(screen.getByText('röpi')).toBeInTheDocument()
  expect(screen.getByText('Máj 18 – 24')).toBeInTheDocument()
})

test('marks today with a MA tag and renders honest rest rows for inactive days', () => {
  renderGrid()
  expect(screen.getByText('MA')).toBeInTheDocument()
  // Vasárnap has no gym + no volleyball → rest row
  expect(screen.getAllByText('pihenő').length).toBeGreaterThan(0)
})
