import { render, screen, renderHook } from '@testing-library/react'
import { PatternRow } from '@/features/fuel/components/PatternRow'
import { WeeklySupplementGrid } from '@/features/fuel/components/WeeklySupplementGrid'
import { useFuelWeek } from '@/data/hooks'

test('PatternRow shows title + detail with accent strip', () => {
  render(
    <PatternRow
      icon="sparkle"
      color="var(--brand-glow)"
      title="Heti minta"
      detail="részlet"
    />,
  )
  expect(screen.getByText('Heti minta')).toBeInTheDocument()
  expect(screen.getByText('részlet')).toBeInTheDocument()
})

test('WeeklySupplementGrid renders supplement rows + day headers', () => {
  const { result } = renderHook(() => useFuelWeek())
  render(<WeeklySupplementGrid rows={result.current.weeklySupplements} />)
  expect(screen.getByText('Kreatin')).toBeInTheDocument()
  expect(screen.getAllByText('H').length).toBeGreaterThan(0) // day initials
})

test('WeeklySupplementGrid renders the footer toolchips', () => {
  const { result } = renderHook(() => useFuelWeek())
  render(<WeeklySupplementGrid rows={result.current.weeklySupplements} />)
  expect(screen.getByText('get_supplements_stash()')).toBeInTheDocument()
  expect(screen.getByText('computeWeeklyTiming()')).toBeInTheDocument()
})
