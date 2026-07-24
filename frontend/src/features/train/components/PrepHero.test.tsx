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

  it('does not render the level-up micro-badge for a skill that is not about to level up', () => {
    const noLevelUp: PrepForecast = { totalXp: 90, skills: [{ skillKey: 'max_strength', xpEst: 90, level: 4, progressPct: 62, willLevelUp: false }] }
    render(<PrepHero overline="X" title="Y" forecast={noLevelUp} stats={stats} />)
    expect(screen.queryByText('⚡ szintlépés-esély!')).not.toBeInTheDocument()
  })
})
