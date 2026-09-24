import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { WeightHero } from '@/features/me/components/WeightHero'
import type { WeightEntry, WeightTrends, Goal } from '@/data/types'

const log: WeightEntry[] = [{ date: '2026-04-22', value: 81.4 }, { date: '2026-05-22', value: 78.6 }]
const trends: WeightTrends = { last7d: { avg: 78.96, weeklyRate: -0.5 }, last4w: { weeklyRate: -0.7 } }
const goal = { startWeight: 81.4, currentWeight: 78.6, targetWeight: 73.0, kind: 'cut' } as Goal

test('renders the page title, the goal-delta big number, the start→latest sub, and the progress pill', () => {
  const { container } = render(<WeightHero log={log} weightTrends={trends} goal={goal} />)
  expect(screen.getByText('Napi súly')).toBeInTheDocument()
  expect(screen.getByText('−2.8')).toBeInTheDocument()
  expect(screen.getByText(/indulás óta · 81.4 → 78.6 · cél 73 kg/)).toBeInTheDocument()
  // Üveg (mezo-me75u.6): the „✓" glyph is a t-tick sprite icon inside the lit goal pill
  const pill = screen.getByText('33% a célig').closest('.wt-goalpill')
  expect(pill).not.toBeNull()
  expect(pill!.querySelector('use')?.getAttribute('href')).toBe('#t-tick')
  expect(pill!.textContent).not.toContain('✓')
  // the hero is the üveg halo hero with the t-weight art
  expect(container.querySelector('.uv-hero use')?.getAttribute('href')).toBe('#t-weight')
  expect(screen.getByText(/4-hét tempó/)).toBeInTheDocument()
})

test('no-goal fallback: no progress pill, honest dash never shown when log has data', () => {
  render(<WeightHero log={log} weightTrends={trends} goal={null} />)
  expect(screen.queryByText(/a célig/)).not.toBeInTheDocument()
  expect(screen.getByText(/indulás óta · 81.4 → 78.6/)).toBeInTheDocument()
})

test('honest state: no log entries at all → dash, no sub line', () => {
  render(<WeightHero log={[]} weightTrends={trends} goal={null} />)
  expect(screen.getByText('—')).toBeInTheDocument()
})
