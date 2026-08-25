import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MuscleBudgetRow, SessionCapWarning } from '@/features/train/logic/setBudget'
import { SetBudgetCard } from '@/features/train/components/SetBudgetCard'
import { muscleColor } from '@/features/train/logic/muscleColors'

// Recomputed against the tier-target model (mezo-3m5m, spec GD5): budget = workingSets / target,
// target sourced from GROUP_LANDMARKS (chest {mev:8,mav:14,mrv:20}) via the row's own tier.
// `over`: Grow (default) target = mav 14; 16 > 14 -> over, budget 16/14 (114%).
const over: MuscleBudgetRow = { group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', failureSets: 8, volumeSets: 8, workingSets: 16, exemptSets: 0, tier: 'grow', target: 14, budget: 16 / 14, level: 'over', mev: 8, zoneStart: 8 / 14, setsToZone: 0, suggestedDay: null }
// `ok`: quad landmark {mev:8,mav:12,mrv:18}; Grow target = mav 12; 8/12 = 67%, 8 not < mev(8) -> ok.
const ok: MuscleBudgetRow = { group: 'quad', label: 'Comb', colorMuscle: 'quad', failureSets: 0, volumeSets: 8, workingSets: 8, exemptSets: 0, tier: 'grow', target: 12, budget: 8 / 12, level: 'ok', mev: 8, zoneStart: 8 / 12, setsToZone: 0, suggestedDay: null }
const cap: SessionCapWarning = { day: 'H', group: 'shoulder', label: 'Váll', sets: 13 }

describe('SetBudgetCard', () => {
  it('collapsed by default: pills with percentages, no warning text', () => {
    render(<SetBudgetCard budgets={[over, ok]} capWarnings={[cap]} />)
    expect(screen.getByText(/Mell 114%/)).toBeInTheDocument()
    expect(screen.queryByText(/heti keret/)).not.toBeInTheDocument()
  })
  it('expanded: renders budget rows, over-budget and session-cap warning lines', () => {
    render(<SetBudgetCard budgets={[over, ok]} capWarnings={[cap]} defaultOpen />)
    expect(screen.getByText(/8🔥\+8🌿/)).toBeInTheDocument()
    expect(screen.getByText(/Mell: 16 szett — Grow plafon 14 \(MAV\)/)).toBeInTheDocument()
    expect(screen.getByText(/Váll: 13 szett egy edzésen/)).toBeInTheDocument()
  })
  it('caret toggles open state', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /szet-büdzsé/i }))
    expect(screen.getByText(/0🔥\+8🌿|8🌿/)).toBeInTheDocument()
  })
  it('expanded: a row with exemptSets shows the "+n kiegészítő" suffix', () => {
    const withExempt: MuscleBudgetRow = { ...ok, exemptSets: 10 }
    render(<SetBudgetCard budgets={[withExempt]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/\+10 kiegészítő/)).toBeInTheDocument()
  })
  it('expanded: shows the direct-only counting footnote (ADR 0021)', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/Csak a fő izom szettjei számítanak/)).toBeInTheDocument()
  })
  it('collapsed: footnote hidden', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} />)
    expect(screen.queryByText(/Csak a fő izom/)).not.toBeInTheDocument()
  })
})

describe('pill format (AD1, mezo-3m5m)', () => {
  // back landmark {mev:10,mav:16,mrv:22}; Emphasize target = mrv 22; 14/22 = 64%.
  const emphasize: MuscleBudgetRow = { group: 'back', label: 'Hát', colorMuscle: 'back-mid', failureSets: 14, volumeSets: 0, workingSets: 14, exemptSets: 0, tier: 'emphasize', target: 22, budget: 14 / 22, level: 'ok', mev: 10, zoneStart: 10 / 22, setsToZone: 0, suggestedDay: null }
  // Target-less group (no GROUP_LANDMARKS entry) — set-count-only pill, no percentage.
  const traps: MuscleBudgetRow = { group: 'traps', label: 'Trapéz', colorMuscle: 'traps', failureSets: 3, volumeSets: 0, workingSets: 3, exemptSets: 0, tier: 'grow', target: null, budget: null, level: 'ok', mev: null, zoneStart: null, setsToZone: 0, suggestedDay: null }

  it('non-Grow pill names the tier with interpunct separators: `Hát · Emphasize · 64%`', () => {
    render(<SetBudgetCard budgets={[emphasize]} capWarnings={[]} />)
    expect(screen.getByText('Hát · Emphasize · 64%')).toBeInTheDocument()
  })
  it('Grow pill stays compact: `Comb 67%`', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} />)
    expect(screen.getByText('Comb 67%')).toBeInTheDocument()
  })

  // Fix round 2 (mezo-3m5m): Maintain's target IS the landmark mev — holding exactly at it is
  // the spec's own canonical "good" state (GD5: "Farizom · Maintain · 100%"), level 'ok', so the
  // pill must render with the NEUTRAL muscle-family colors, never the amber 'near' alarm.
  const maintainAtMev: MuscleBudgetRow = { group: 'glute', label: 'Farizom', colorMuscle: 'glute', failureSets: 8, volumeSets: 0, workingSets: 8, exemptSets: 0, tier: 'maintain', target: 8, budget: 1, level: 'ok', mev: 8, zoneStart: 1, setsToZone: 0, suggestedDay: null }
  it('Maintain at exactly MEV renders `Farizom · Maintain · 100%` with neutral family colors, not amber', () => {
    render(<SetBudgetCard budgets={[maintainAtMev]} capWarnings={[]} />)
    const pill = screen.getByText('Farizom · Maintain · 100%')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveStyle({ background: muscleColor('glute').wash })
    expect(pill).not.toHaveStyle({ background: 'var(--wash-amber)' })
  })
  it('target-less pill shows a plain set count: `Trapéz · 3 szett`', () => {
    render(<SetBudgetCard budgets={[traps]} capWarnings={[]} />)
    expect(screen.getByText('Trapéz · 3 szett')).toBeInTheDocument()
  })
})

// ham landmark {mev:6,mav:10,mrv:14}; Grow target = mav 10; 1/10 = 10%, 1 < mev(6) -> under.
const under: MuscleBudgetRow = { group: 'ham', label: 'Hamstring', colorMuscle: 'ham', failureSets: 0, volumeSets: 1, workingSets: 1, exemptSets: 0, tier: 'grow', target: 10, budget: 0.1, level: 'under', mev: 6, zoneStart: 0.6, setsToZone: 5, suggestedDay: 'Csü' }

describe('optimal zone (mezo-oyhy.1)', () => {
  it('collapsed: under pill carries the ↓ prefix', () => {
    render(<SetBudgetCard budgets={[under, ok]} capWarnings={[]} />)
    expect(screen.getByText(/Hamstring ↓10%/)).toBeInTheDocument()
    expect(screen.getByText(/Comb 67%/)).toBeInTheDocument()
  })
  it('expanded: renders the green zone underlay from zoneStart', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByTestId('zone-quad')).toHaveStyle({ left: '67%' })
  })
  it('expanded: under row shows the sets-to-zone hint, in-zone row the ✓', () => {
    render(<SetBudgetCard budgets={[under, ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/MEV alatt — még \+5 szett a zónáig/)).toBeInTheDocument()
    expect(screen.getByText(/optimális zónában/)).toBeInTheDocument()
  })
  it('expanded: under explanation row is soft copy with the suggested day', () => {
    render(<SetBudgetCard budgets={[under]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/Hamstring: 1 szett — a minimum-hatásos mennyiség \(MEV ≈ 6\) alatt/)).toBeInTheDocument()
    expect(screen.getByText(/pl\. Csü/)).toBeInTheDocument()
    expect(screen.queryByText(/heti keret/)).not.toBeInTheDocument() // no red warning for under
  })
  it('rows without a lower bound get neither zone nor hint', () => {
    const traps: MuscleBudgetRow = { ...ok, group: 'traps', label: 'Trapéz', colorMuscle: 'traps', mev: null, zoneStart: null }
    render(<SetBudgetCard budgets={[traps]} capWarnings={[]} defaultOpen />)
    expect(screen.queryByTestId('zone-traps')).not.toBeInTheDocument()
    expect(screen.queryByText(/optimális zónában/)).not.toBeInTheDocument()
  })
})
