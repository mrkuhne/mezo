// ============================================================
// Mezo · KeretBelt tests (mezo-jgh9) — the always-visible budget belt +
// its kibontott (expanded) "keret felépülése" bigview. See
// .superpowers/sdd/2026-08-08-fuel-window-river/task-3-brief.md.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KeretBelt } from '@/features/fuel/components/KeretBelt'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'

const budget: DayBudget = {
  kcal: 2400,
  p: 160,
  c: 250,
  f: 75,
  energy: { base: 1890, activity: 910, balance: -400, target: 2400 },
}
const consumed = { kcal: 1240, p: 62, c: 130, f: 38 }

const base = {
  budget,
  consumed,
  water: { currentMl: 1200, targetMl: 2500, onAdd250: vi.fn() },
  activityLabel: 'Pull A + lépések',
  onSelect: vi.fn(),
  onAdHocLog: vi.fn(),
}

describe('KeretBelt — öv (big=false)', () => {
  it('renders the remaining kcal with HU space-thousands formatting', () => {
    render(<KeretBelt {...base} big={false} />)
    // budget.kcal(2400) - consumed.kcal(1240) = 1160 → "1 160" (space thousands, not narrow-space)
    expect(screen.getAllByText(/1 160/).length).toBeGreaterThan(0)
  })

  it('renders 3 macro mini-bars with an aria label each', () => {
    render(<KeretBelt {...base} big={false} />)
    expect(screen.getByRole('progressbar', { name: 'Fehérje 62/160 g' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Szénhidrát 130/250 g' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Zsír 38/75 g' })).toBeInTheDocument()
  })

  it('fires onSelect when the belt capsule is tapped, with the spoken aria-label', async () => {
    const onSelect = vi.fn()
    render(<KeretBelt {...base} big={false} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: 'Napi keret megnyitása · 1 160 kcal maradt' }))
    expect(onSelect).toHaveBeenCalled()
  })
})

describe('KeretBelt — kibontott felépülés-nézet (big=true)', () => {
  it('renders the energy breakdown rows: Alapanyagcsere / Mozgás / Cél-deficit / Mai keret', () => {
    render(<KeretBelt {...base} big />)
    expect(screen.getByText('Alapanyagcsere')).toBeInTheDocument()
    expect(screen.getByText('1 890')).toBeInTheDocument()

    expect(screen.getByText(/Mozgás ma/)).toBeInTheDocument()
    expect(screen.getByText(/Pull A \+ lépések/)).toBeInTheDocument()
    expect(screen.getByText('+ 910')).toBeInTheDocument()

    expect(screen.getByText('Cél-deficit')).toBeInTheDocument()
    expect(screen.getByText('− 400')).toBeInTheDocument()

    expect(screen.getByText('Mai keret')).toBeInTheDocument()
    expect(screen.getByText('2 400 kcal')).toBeInTheDocument()
  })

  it('renders full macro rows with "még N g a C-hoz" copy', () => {
    render(<KeretBelt {...base} big />)
    expect(screen.getByText('még 98 g a 160-hoz')).toBeInTheDocument()
    expect(screen.getByText('még 120 g a 250-hoz')).toBeInTheDocument()
    expect(screen.getByText('még 37 g a 75-hoz')).toBeInTheDocument()
  })

  it('renders a water row with a +250 ml action wired to onAdd250', async () => {
    const onAdd250 = vi.fn()
    render(<KeretBelt {...base} big water={{ currentMl: 1200, targetMl: 2500, onAdd250 }} />)
    await userEvent.click(screen.getByRole('button', { name: '+250 ml' }))
    expect(onAdd250).toHaveBeenCalled()
  })

  it('water: null → no water row', () => {
    render(<KeretBelt {...base} big water={null} />)
    expect(screen.queryByRole('button', { name: '+250 ml' })).toBeNull()
    expect(screen.queryByText('Víz')).toBeNull()
  })

  it('renders the ad-hoc log row wired to onAdHocLog', async () => {
    const onAdHocLog = vi.fn()
    render(<KeretBelt {...base} big onAdHocLog={onAdHocLog} />)
    await userEvent.click(screen.getByRole('button', { name: /Log bármikor/ }))
    expect(onAdHocLog).toHaveBeenCalled()
  })
})
