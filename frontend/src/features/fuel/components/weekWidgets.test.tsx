import { render, screen } from '@testing-library/react'
import { PatternRow } from '@/features/fuel/components/PatternRow'
import { WeeklySupplementGrid } from '@/features/fuel/components/WeeklySupplementGrid'
// Presentational prop tests — fed the Phase-1 seed directly (useFuelWeek became a composed
// dual-mode hook in Fuel P4; the grid itself stays a pure component).
import { weeklySupplements } from '@/data/fuel/fuelWeek'

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
  render(<WeeklySupplementGrid rows={weeklySupplements} />)
  expect(screen.getByText('Kreatin')).toBeInTheDocument()
  expect(screen.getAllByText('H').length).toBeGreaterThan(0) // day initials
})

test('WeeklySupplementGrid renders the footer toolchips', () => {
  render(<WeeklySupplementGrid rows={weeklySupplements} />)
  expect(screen.getByText('get_supplements_stash()')).toBeInTheDocument()
  expect(screen.getByText('computeWeeklyTiming()')).toBeInTheDocument()
})
