import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeekZoneRow } from '@/features/train/logic/weekZone'
import { WeekZoneCard } from '@/features/train/components/WeekZoneCard'

const row = (over: Partial<WeekZoneRow>): WeekZoneRow => ({
  group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', mev: 4, zoneStart: 0.2,
  doneSets: 4, todaySets: 4, plannedSets: 10, doneBudget: 0.2, todayBudget: 0.2, planBudget: 0.5,
  remainingPlanSets: 2, setsToZone: 0, status: 'in', ...over,
})

describe('WeekZoneCard', () => {
  it('renders header counts and the row numerics', () => {
    render(<WeekZoneCard rows={[row({})]} doneWorkouts={2} planWorkouts={4} />)
    expect(screen.getByText('Heti zóna-kontextus')).toBeInTheDocument()
    expect(screen.getByText('kész 2/4 edzés')).toBeInTheDocument()
    expect(screen.getByText('kész 4 · ma +4 · terv 10')).toBeInTheDocument()
  })
  it('shows the status hint per variant', () => {
    render(<WeekZoneCard
      rows={[
        row({ group: 'chest', label: 'Mell', status: 'entering' }),
        row({ group: 'back', label: 'Hát', status: 'in' }),
        row({ group: 'biceps', label: 'Bicepsz', status: 'over' }),
        row({ group: 'ham', label: 'Hamstring', status: 'below', mev: 4, doneSets: 1, todaySets: 1, plannedSets: 2, remainingPlanSets: 0, setsToZone: 2 }),
      ]}
      doneWorkouts={1} planWorkouts={4}
    />)
    expect(screen.getByText('▲ a mai edzéssel zónába érsz')).toBeInTheDocument()
    expect(screen.getByText('✓ zónában')).toBeInTheDocument()
    expect(screen.getByText('⚠ a mai edzéssel túlmennél a kereten')).toBeInTheDocument()
    expect(screen.getByText('↓ a heti terv is a zóna alatt — még 2 szett kellene')).toBeInTheDocument()
  })
  // mezo-zr6p: mid-week "below" is only a shortfall when the WHOLE week's plan misses
  // MEV; otherwise the missing sets are simply still ahead in the plan (this is what
  // made the prep card look like it contradicted the planner's "✓ optimális zónában").
  it('reports the remaining planned sets instead of a shortfall when the week plan reaches the zone', () => {
    render(<WeekZoneCard
      rows={[row({ group: 'biceps', label: 'Bicepsz', status: 'below', mev: 8, doneSets: 0, todaySets: 4, plannedSets: 10, remainingPlanSets: 6, setsToZone: 0 })]}
      doneWorkouts={0} planWorkouts={5}
    />)
    expect(screen.getByText('→ a héten még +6 szett jön a terv szerint')).toBeInTheDocument()
    expect(screen.queryByText(/hiányzik/)).not.toBeInTheDocument()
  })
  it('renders nothing when there are no rows', () => {
    const { container } = render(<WeekZoneCard rows={[]} doneWorkouts={0} planWorkouts={4} />)
    expect(container).toBeEmptyDOMElement()
  })
})
