// ============================================================
// Mezo · KeretBelt tests (mezo-jgh9) — the always-visible budget belt +
// its kibontott (expanded) "keret felépülése" bigview. See
// .superpowers/sdd/2026-08-08-fuel-window-river/task-3-brief.md.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { huDative, KeretBelt } from '@/features/fuel/components/KeretBelt'
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

  it('renders full macro rows with vowel-harmony-correct "még N g a C-hoz/-hez/-höz" copy', () => {
    render(<KeretBelt {...base} big />)
    // p target 160 ("száz-hatvan" → hatvan → -hoz), c target 250 ("kétszáz-ötven" → ötven → -hez),
    // f target 75 ("hetven-öt" → öt → -höz) — matches the design mockup's own examples verbatim.
    expect(screen.getByText('még 98 g a 160-hoz')).toBeInTheDocument()
    expect(screen.getByText('még 120 g a 250-hez')).toBeInTheDocument()
    expect(screen.getByText('még 37 g a 75-höz')).toBeInTheDocument()
  })

  it('remaining kcal uses the Unicode minus (not an ASCII hyphen) when over budget', () => {
    const overBudget = { kcal: 2600, p: 62, c: 130, f: 38 } // consumed > budget.kcal(2400) → remaining -200
    render(<KeretBelt {...base} big consumed={overBudget} />)
    expect(screen.getAllByText(/−\s?200/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/-200/)).toBeNull() // no ASCII-hyphen sibling rendering
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

  it('renders an optional quiet footer note (Fraunces meta-voice) at the bottom', () => {
    const { rerender } = render(<KeretBelt {...base} big />)
    expect(screen.queryByText(/Konyha zár/)).toBeNull()
    rerender(<KeretBelt {...base} big note="Konyha zár · 21:45 · kávé cutoff 14:00" />)
    const note = screen.getByText('Konyha zár · 21:45 · kávé cutoff 14:00')
    expect(note).toHaveClass('text-meta-sm')
  })

  it('no onEditSettings → no szerkeszt button, even with a note', () => {
    render(<KeretBelt {...base} big note="Konyha zár · 21:45 · kávé cutoff 14:00" />)
    expect(screen.queryByRole('button', { name: /szerkeszt/ })).toBeNull()
  })

  it('onEditSettings provided + note present → szerkeszt renders beside the note and fires the callback', async () => {
    const onEditSettings = vi.fn()
    render(
      <KeretBelt
        {...base} big
        note="Konyha zár · 21:45 · kávé cutoff 14:00"
        onEditSettings={onEditSettings}
      />,
    )
    expect(screen.getByText('Konyha zár · 21:45 · kávé cutoff 14:00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'szerkeszt ›' }))
    expect(onEditSettings).toHaveBeenCalled()
  })

  it('onEditSettings provided + note ABSENT → szerkeszt still renders alone (settings stay reachable)', async () => {
    const onEditSettings = vi.fn()
    render(<KeretBelt {...base} big onEditSettings={onEditSettings} />)
    const btn = screen.getByRole('button', { name: 'szerkeszt ›' })
    expect(btn).toBeInTheDocument()
    await userEvent.click(btn)
    expect(onEditSettings).toHaveBeenCalled()
  })
})

describe('huDative — HU dative suffix (-hoz/-hez/-höz) by vowel harmony', () => {
  // Harmony follows the number's LAST SPOKEN word (Hungarian numbers are read as a word chain),
  // not a fixed digit→suffix table — hence exercising both bare units/tens AND combined numbers
  // where a lower-magnitude nonzero digit overrides a higher one (46 → hat, not negyven; 160 →
  // hatvan, not száz; 250 → ötven, not száz).
  it.each([
    [0, 'hoz'], // nullához
    [5, 'höz'], // öt
    [6, 'hoz'], // hat
    [10, 'hez'], // tíz
    [20, 'hoz'], // húsz
    [46, 'hoz'], // negyvenhat → hat wins
    [75, 'höz'], // hetvenöt → öt wins
    [100, 'hoz'], // száz
    [160, 'hoz'], // százhatvan → hatvan wins
    [250, 'hez'], // kétszázötven → ötven wins
    [1000, 'hez'], // ezer
  ] as const)('huDative(%i) === %s', (n, expected) => {
    expect(huDative(n)).toBe(expected)
  })
})
