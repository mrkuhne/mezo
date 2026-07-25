// ============================================================
// Mezo · PrepHero tests — mezo-bxpg mission-briefing hero.
// ============================================================
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PrepForecast, PrepStats } from '@/features/train/logic/prepBriefing'
import { PrepHero } from '@/features/train/components/PrepHero'

const stats: PrepStats = { workSets: 12, warmupSets: 2, repsEst: 96, durationEst: 52, muscleCount: 4 }
const forecast: PrepForecast = {
  totalXp: 140,
  muscles: [],
  skills: [
    { skillKey: 'strength_endurance', xpEst: 50, level: 2, progressPct: 88, willLevelUp: true },
    { skillKey: 'max_strength', xpEst: 90, level: 4, progressPct: 62, willLevelUp: false },
  ],
}

describe('PrepHero', () => {
  it('renders the XP ring total, the skill rows and the level-up micro-badge from a fixture forecast', () => {
    render(<PrepHero overline="Csütörtök · W2 · MAV hét" title="Leg Day" forecast={forecast} stats={stats} />)
    expect(screen.getByText('Csütörtök · W2 · MAV hét')).toBeInTheDocument()
    expect(screen.getByText('Leg Day')).toBeInTheDocument()
    expect(screen.getByText('+140')).toBeInTheDocument()
    expect(screen.getByText('VÁRHATÓ XP')).toBeInTheDocument()
    expect(screen.getByText('⚡ szintlépés-esély!')).toBeInTheDocument()
    // stats pill renders regardless of forecast
    expect(screen.getByText('12 szett · ~96 rep · ~52 perc · 4 izomcsoport')).toBeInTheDocument()
  })

  it('hides the ring and skill rows when forecast is null, but still shows the stats pill', () => {
    render(<PrepHero overline="Csütörtök · W2 · MAV hét" title="Leg Day" forecast={null} stats={stats} />)
    expect(screen.queryByText('VÁRHATÓ XP')).not.toBeInTheDocument()
    expect(screen.queryByText('⚡ szintlépés-esély!')).not.toBeInTheDocument()
    expect(screen.getByText('12 szett · ~96 rep · ~52 perc · 4 izomcsoport')).toBeInTheDocument()
  })

  it('omits the perc pill segment when the day has no duration estimate (mezo-vlr9)', () => {
    render(<PrepHero overline="X" title="Y" forecast={null} stats={{ ...stats, durationEst: 0 }} />)
    expect(screen.getByText('12 szett · ~96 rep · 4 izomcsoport')).toBeInTheDocument()
    expect(screen.queryByText(/perc/)).not.toBeInTheDocument()
  })

  it('renders the „Ma építed" muscle-XP chips when the forecast attributes volume (mezo-87d2)', () => {
    const withMuscles: PrepForecast = { ...forecast, muscles: [{ muscle: 'chest', xp: 34 }, { muscle: 'lats', xp: 42 }] }
    render(<PrepHero overline="X" title="Y" forecast={withMuscles} stats={stats} />)
    expect(screen.getByText('MA ÉPÍTED')).toBeInTheDocument()
    expect(screen.getByText('Mell +34 XP')).toBeInTheDocument()
    expect(screen.getByText('Lat +42 XP')).toBeInTheDocument()
  })

  it('hides the muscle-chip row entirely when no volume is attributable', () => {
    render(<PrepHero overline="X" title="Y" forecast={forecast} stats={stats} />)
    expect(screen.queryByText('MA ÉPÍTED')).not.toBeInTheDocument()
  })

  it('does not render the level-up micro-badge for a skill that is not about to level up', () => {
    const noLevelUp: PrepForecast = { totalXp: 90, muscles: [], skills: [{ skillKey: 'max_strength', xpEst: 90, level: 4, progressPct: 62, willLevelUp: false }] }
    render(<PrepHero overline="X" title="Y" forecast={noLevelUp} stats={stats} />)
    expect(screen.queryByText('⚡ szintlépés-esély!')).not.toBeInTheDocument()
  })

  it('renders the overload chip with both halves when weightUp and repUp are both nonzero', () => {
    render(<PrepHero overline="X" title="Y" forecast={null} stats={stats} overload={{ weightUp: 2, repUp: 1, hold: 0 }} />)
    expect(screen.getByText('⚡ Túlterhelés: 2× +súly · 1× +rep')).toBeInTheDocument()
  })

  it('hides the overload chip when overload is null', () => {
    render(<PrepHero overline="X" title="Y" forecast={null} stats={stats} overload={null} />)
    expect(screen.queryByText(/Túlterhelés/)).not.toBeInTheDocument()
  })

  it('hides the overload chip when overload is omitted', () => {
    render(<PrepHero overline="X" title="Y" forecast={null} stats={stats} />)
    expect(screen.queryByText(/Túlterhelés/)).not.toBeInTheDocument()
  })

  it('hides the overload chip when weightUp and repUp are both zero', () => {
    render(<PrepHero overline="X" title="Y" forecast={null} stats={stats} overload={{ weightUp: 0, repUp: 0, hold: 0 }} />)
    expect(screen.queryByText(/Túlterhelés/)).not.toBeInTheDocument()
  })

  it('omits the +rep half of the overload chip when only weightUp is nonzero', () => {
    render(<PrepHero overline="X" title="Y" forecast={null} stats={stats} overload={{ weightUp: 2, repUp: 0, hold: 0 }} />)
    expect(screen.getByText(/2× \+súly/)).toBeInTheDocument()
    expect(screen.queryByText(/\+rep/)).not.toBeInTheDocument()
  })
})
