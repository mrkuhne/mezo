import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { GrowthSummaryCard } from '@/features/me/components/GrowthSummaryCard'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from '@/data/progression/progressionMock'
import type { ProgressionProfileResponse } from '@/data/progression/progressionApi'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderCard(profile: ProgressionProfileResponse) {
  return render(
    <MemoryRouter initialEntries={['/me']}>
      <GrowthSummaryCard profile={profile} />
      <LocationDisplay />
    </MemoryRouter>,
  )
}

describe('GrowthSummaryCard', () => {
  it('renders the total-XP chip, the top-3 skills (highest level first) and the stats line', () => {
    renderCard(progressionProfileMock)
    // total XP chip = Σ cumulativeXp across athletic + muscle + life (7500 + 8550 + 1085)
    expect(screen.getByText(/17 135 XP/)).toBeInTheDocument()
    // top-3 by (level, cumulativeXp): max_strength Lv7 → aerobic_capacity Lv6 → back-mid Lv6
    expect(screen.getByText('Maximális erő')).toBeInTheDocument()
    expect(screen.getByText('Aerob kapacitás')).toBeInTheDocument()
    expect(screen.getByText('Hát (közép)')).toBeInTheDocument()
    expect(screen.getByText('Lv 7')).toBeInTheDocument() // the top skill's level
    // stats line: athlete level, streak, discipline
    expect(screen.getByText('4.3')).toBeInTheDocument()
    expect(screen.getByText('5 hét')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    // 30-day savings row (bar-less, hu-HU grouped Ft)
    expect(screen.getByText('Megtakarítás (30 nap)')).toBeInTheDocument()
    expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
  })

  it('navigates to /me/growth when the whole card is tapped', async () => {
    renderCard(progressionProfileMock)
    expect(screen.getByTestId('location')).toHaveTextContent('/me')
    await userEvent.click(screen.getByRole('button', { name: 'Growth oldal megnyitása' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/me/growth')
  })

  it('renders the ghost prompt (still a button to /me/growth) when there is no XP', async () => {
    renderCard(GHOST_PROGRESSION_PROFILE)
    expect(screen.getByText('Az élet is edzés.')).toBeInTheDocument()
    expect(screen.queryByText(/XP →/)).not.toBeInTheDocument() // no populated chip
    await userEvent.click(screen.getByRole('button', { name: 'Growth oldal megnyitása' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/me/growth')
  })

  it('hides the savings row when savingsHuf30d is 0', () => {
    renderCard({ ...progressionProfileMock, savingsHuf30d: 0 })
    expect(screen.queryByText('Megtakarítás (30 nap)')).not.toBeInTheDocument()
  })
})
