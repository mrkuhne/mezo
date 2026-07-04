import { render, screen } from '@testing-library/react'
import { WeekRhythmGrid } from '@/features/fuel/components/WeekRhythmGrid'
// Presentational prop tests — fed the Phase-1 seeds directly (useFuelWeek became a composed
// dual-mode hook in Fuel P4; the grid itself stays a pure component).
import { gymSchedule } from '@/data/fuel/fuelWeek'
import { volleyballSessions } from '@/data/today/today'

test('renders the legend with coffee cutoff + kitchen close', () => {
  render(<WeekRhythmGrid gymSchedule={gymSchedule} volleyball={volleyballSessions} />)
  expect(screen.getByText(/coffee cutoff 14:00/)).toBeInTheDocument()
  expect(screen.getByText(/kitchen close/)).toBeInTheDocument()
})

test('renders gym + volleyball legend swatches', () => {
  render(<WeekRhythmGrid gymSchedule={gymSchedule} volleyball={volleyballSessions} />)
  expect(screen.getByText('gym')).toBeInTheDocument()
  expect(screen.getByText('volleyball')).toBeInTheDocument()
})

test('marks today with a MA tag and renders rest-day rows for inactive days', () => {
  render(<WeekRhythmGrid gymSchedule={gymSchedule} volleyball={volleyballSessions} />)
  expect(screen.getByText('MA')).toBeInTheDocument()
  // Vasárnap has no gym + no volleyball → rest row
  expect(screen.getAllByText('rest · maintenance').length).toBeGreaterThan(0)
})
