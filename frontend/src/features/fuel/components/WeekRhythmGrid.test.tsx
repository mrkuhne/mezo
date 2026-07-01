import { render, screen, renderHook } from '@testing-library/react'
import { WeekRhythmGrid } from '@/features/fuel/components/WeekRhythmGrid'
import { useFuelWeek } from '@/data/hooks'

test('renders the legend with coffee cutoff + kitchen close', () => {
  const { result } = renderHook(() => useFuelWeek())
  render(
    <WeekRhythmGrid
      gymSchedule={result.current.gymSchedule}
      volleyball={result.current.volleyball}
    />,
  )
  expect(screen.getByText(/coffee cutoff 14:00/)).toBeInTheDocument()
  expect(screen.getByText(/kitchen close/)).toBeInTheDocument()
})

test('renders gym + volleyball legend swatches', () => {
  const { result } = renderHook(() => useFuelWeek())
  render(
    <WeekRhythmGrid
      gymSchedule={result.current.gymSchedule}
      volleyball={result.current.volleyball}
    />,
  )
  expect(screen.getByText('gym')).toBeInTheDocument()
  expect(screen.getByText('volleyball')).toBeInTheDocument()
})

test('marks today with a MA tag and renders rest-day rows for inactive days', () => {
  const { result } = renderHook(() => useFuelWeek())
  render(
    <WeekRhythmGrid
      gymSchedule={result.current.gymSchedule}
      volleyball={result.current.volleyball}
    />,
  )
  expect(screen.getByText('MA')).toBeInTheDocument()
  // Vasárnap has no gym + no volleyball → rest row
  expect(screen.getAllByText('rest · maintenance').length).toBeGreaterThan(0)
})
