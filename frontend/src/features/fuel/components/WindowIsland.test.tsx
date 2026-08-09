// ============================================================
// Mezo · WindowIsland tests (mezo-jgh9) — the window-island bigview +
// L1. See .superpowers/sdd/2026-08-08-fuel-window-river/task-4-brief.md.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WindowIsland } from '@/features/fuel/components/WindowIsland'
import type { WindowIslandVM } from '@/features/fuel/logic/windowIslands'

const nowVm: WindowIslandVM = {
  key: '12:30-Ebéd',
  state: 'now',
  emoji: '🥙',
  title: 'Ebéd',
  time: '12:30',
  essence: '12:30 · Csirkés bowl a tervben',
  count: '3 ›',
  subtitle: 'edzés 13:00-kor — egyél előtte',
  meal: { name: 'Csirkés quinoa bowl', kcal: 650, p: 42, fit: 94, fromPlan: true },
  facts: {
    proteinJump: { addG: 42, fromG: 62, toG: 104, pctOfTarget: 65 },
    dayScore: { avg: 92, aboveWeekly: true },
  },
  stackDoses: [{ name: 'Kreatin 5 g', note: 'étkezéssel · stack' }],
  l1Count: 1,
}

const base = {
  vm: nowVm,
  big: true,
  nowRing: true,
  open: false,
  onSelect: vi.fn(),
  onToggleOpen: vi.fn(),
  onLog: vi.fn(),
  onAiLog: vi.fn(),
  onSwap: vi.fn(),
  onStackDose: vi.fn(),
}

describe('WindowIsland — L0 bigview', () => {
  it('renders the window time as the hero number with the title as its unit', () => {
    render(<WindowIsland {...base} />)
    expect(screen.getByText('12:30')).toBeInTheDocument()
    // The collapsed capsule (aria-hidden, but still in the DOM under the shared shell) ALSO
    // carries the title — scope to the hero unit specifically.
    expect(screen.getByText('Ebéd', { selector: '.isl-hero-u' })).toBeInTheDocument()
  })

  it('renders a meal-chip with the name, kcal, protein and the illik-score badge', () => {
    render(<WindowIsland {...base} />)
    expect(screen.getByText('Csirkés quinoa bowl')).toBeInTheDocument()
    expect(screen.getByText(/650 kcal/)).toBeInTheDocument()
    expect(screen.getByText(/42 g P/)).toBeInTheDocument()
    expect(screen.getByText('illik: 94')).toBeInTheDocument()
  })

  it('renders both fact cells when proteinJump and dayScore are present', () => {
    render(<WindowIsland {...base} />)
    expect(screen.getByText('Fehérje-ugrás')).toBeInTheDocument()
    expect(screen.getByText('62 → 104 · a céled 65%-a')).toBeInTheDocument()
    expect(screen.getByText('Nap-score eddig')).toBeInTheDocument()
    expect(screen.getByText('a heti átlagod felett')).toBeInTheDocument()
  })

  it('facts.dayScore null → renders only the protein-jump cell, never a "—" placeholder', () => {
    const vm: WindowIslandVM = { ...nowVm, facts: { ...nowVm.facts, dayScore: null } }
    render(<WindowIsland {...base} vm={vm} />)
    expect(screen.getByText('Fehérje-ugrás')).toBeInTheDocument()
    expect(screen.queryByText('Nap-score eddig')).toBeNull()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('both facts null → no fact strip at all', () => {
    const vm: WindowIslandVM = { ...nowVm, facts: { proteinJump: null, dayScore: null } }
    render(<WindowIsland {...base} vm={vm} />)
    expect(screen.queryByText('Fehérje-ugrás')).toBeNull()
    expect(screen.queryByText('Nap-score eddig')).toBeNull()
  })

  it('renders the Logold / AI / még N action row wired to onLog / onAiLog / onToggleOpen', async () => {
    const onLog = vi.fn()
    const onAiLog = vi.fn()
    const onToggleOpen = vi.fn()
    render(<WindowIsland {...base} onLog={onLog} onAiLog={onAiLog} onToggleOpen={onToggleOpen} />)

    await userEvent.click(screen.getByRole('button', { name: 'Logold' }))
    expect(onLog).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '✨ AI' }))
    expect(onAiLog).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: `még ${nowVm.l1Count} ›` }))
    expect(onToggleOpen).toHaveBeenCalled()
  })

  it('meal: null → renders the "＋ tervezz ide" ghost instead of a meal-chip', () => {
    const vm: WindowIslandVM = { ...nowVm, meal: null }
    render(<WindowIsland {...base} vm={vm} />)
    expect(screen.getByText('＋ tervezz ide')).toBeInTheDocument()
    expect(screen.queryByText('Csirkés quinoa bowl')).toBeNull()
  })

  it('a budget-only fallback meal (fromPlan false, name === title) also renders the ghost', () => {
    const vm: WindowIslandVM = {
      ...nowVm,
      title: 'Uzsonna',
      meal: { name: 'Uzsonna', kcal: null, p: null, fit: null, fromPlan: false },
    }
    render(<WindowIsland {...base} vm={vm} />)
    expect(screen.getByText('＋ tervezz ide')).toBeInTheDocument()
  })

  it('state: missed → the CTA copy reads "Pótold" but still fires onLog', async () => {
    const onLog = vi.fn()
    const vm: WindowIslandVM = { ...nowVm, state: 'missed' }
    render(<WindowIsland {...base} vm={vm} onLog={onLog} />)
    const cta = screen.getByRole('button', { name: 'Pótold' })
    await userEvent.click(cta)
    expect(onLog).toHaveBeenCalled()
  })

  it('the collapsed capsule shows the essence and count straight from the vm', () => {
    render(<WindowIsland {...base} big={false} />)
    expect(screen.getByText(nowVm.essence)).toBeInTheDocument()
    expect(screen.getByText(nowVm.count)).toBeInTheDocument()
  })
})

describe('WindowIsland — L1 (open)', () => {
  it('open → shows the four L1 groups and the összecsuk close handle', () => {
    render(<WindowIsland {...base} open />)
    // Group headings, scoped — "Csere a tervben" / "AI naplózás" also appear as their own
    // row titles, so an unscoped query would be ambiguous.
    expect(screen.getByText('Ablak étkezése', { selector: '.isl-grouph span' })).toBeInTheDocument()
    expect(screen.getByText('Csere a tervben', { selector: '.isl-grouph span' })).toBeInTheDocument()
    expect(screen.getByText('AI naplózás', { selector: '.isl-grouph span' })).toBeInTheDocument()
    expect(screen.getByText('Ehhez az ablakhoz kötve', { selector: '.isl-grouph span' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'összecsuk ↑' })).toBeInTheDocument()
  })

  it('the összecsuk handle fires onToggleOpen', async () => {
    const onToggleOpen = vi.fn()
    render(<WindowIsland {...base} open onToggleOpen={onToggleOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'összecsuk ↑' }))
    expect(onToggleOpen).toHaveBeenCalled()
  })

  it('the stack-dose row fires onStackDose with the dose name', async () => {
    const onStackDose = vi.fn()
    render(<WindowIsland {...base} open onStackDose={onStackDose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pipa ✓' }))
    expect(onStackDose).toHaveBeenCalledWith('Kreatin 5 g')
  })

  it('the swap row fires onSwap and the AI row fires onAiLog', async () => {
    const onSwap = vi.fn()
    const onAiLog = vi.fn()
    render(<WindowIsland {...base} open onSwap={onSwap} onAiLog={onAiLog} />)
    await userEvent.click(screen.getByRole('button', { name: 'Nézd ›' }))
    expect(onSwap).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '✨ AI' }))
    expect(onAiLog).toHaveBeenCalled()
  })

  it('no stack doses → the "Ehhez az ablakhoz kötve" group is omitted', () => {
    const vm: WindowIslandVM = { ...nowVm, stackDoses: [] }
    render(<WindowIsland {...base} vm={vm} open />)
    expect(screen.queryByText('Ehhez az ablakhoz kötve')).toBeNull()
  })
})
