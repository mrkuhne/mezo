import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutinesTab } from '@/features/me/components/RoutinesTab'
import { localDateString } from '@/shared/lib/dates'
import type { HabitChainInfo } from '@/data/types'

// RoutinesTab now navigates (the "Szerkesztés" entry button), so every render needs Router
// context — a probe route stands in for RoutineEditorPage (the "real navigation" idiom,
// GoalMiniCard.test.tsx's renderMini).
function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/me/growth']}>
      <Routes>
        <Route path="/me/growth" element={<RoutinesTab />} />
        <Route path="/me/routines/edit" element={<div data-testid="edit-probe" />} />
      </Routes>
    </MemoryRouter>,
  )
}

const habitsToday = [
  { key: 'wake_on_time', chain: 'MORNING', title: 'Ébredés időben', status: 'done', xp: 5 },
  { key: 'morning_sunlight', chain: 'MORNING', title: 'Reggeli napfény', status: 'pending', xp: 5 },
  { key: 'bed_on_time', chain: 'EVENING', title: 'Időben ágyban', status: 'missed', xp: 5 },
]

// The two seed chains (mezo-n5e9.2 — mirrors `mockHabitCatalog`): RoutinesTab's default map
// source, replacing the retired hardcoded `chainCard(..., 'MORNING'/'EVENING', ...)` calls.
const SEED_CHAINS: HabitChainInfo[] = [
  { id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true, defs: [] },
  { id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true, defs: [] },
]

// `vi.mock` is hoisted above module-scope consts, so the mock fns must be created via `vi.hoisted`
// — a bare `const fn = vi.fn()` referenced inside the factory throws "cannot access before init".
const { useHabitDay, useHabitSummary, useHabitCatalog } = vi.hoisted(() => ({
  useHabitDay: vi.fn(),
  useHabitSummary: vi.fn(),
  useHabitCatalog: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitDay: (d: string) => useHabitDay(d),
  useHabitSummary: () => useHabitSummary(),
  useHabitCatalog: () => useHabitCatalog(),
}))

beforeEach(() => {
  useHabitDay.mockReset()
  useHabitDay.mockReturnValue({ habits: habitsToday })
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({
    data: {
      perfectMorningDays30: 22,
      perfectEveningDays30: 18,
      habits: [{ key: 'wake_on_time', strengthPct: 71 }],
    },
  })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({ catalog: { chains: SEED_CHAINS }, isPending: false })
})

describe('RoutinesTab', () => {
  it('today: shows the 30-day perfect-day counters + per-habit strength bars', () => {
    const { container } = renderTab()
    expect(screen.getByText('Tökéletes reggelek')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
    // today keeps the strength rows (percentage + bar)
    expect(screen.getByText('71%')).toBeInTheDocument()
    expect(container.querySelector('.hab-sbar')).not.toBeNull()
  })

  it('navigating to a past day queries that date and shows the day-summary chip (no counters, no strength)', () => {
    const { container } = renderTab()
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    const yesterday = screen.getByRole('button', { name: /dátum kiválasztása/i })
    expect(useHabitDay).toHaveBeenCalledWith(expect.not.stringMatching(localDateString()))
    expect(screen.queryByText('Tökéletes reggelek')).not.toBeInTheDocument()
    expect(screen.getByText(/Reggel \d+\/\d+/)).toBeInTheDocument() // summary chip
    expect(yesterday).toBeInTheDocument()
    // status-only rows on a past day — no strength percentage / bar
    expect(container.querySelector('.hab-sbar')).toBeNull()
  })

  it('empty past day: shows the quiet ghost', () => {
    renderTab()
    useHabitDay.mockReturnValue({ habits: [] })
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(screen.getByText(/Nincs rutinadat erre a napra/i)).toBeInTheDocument()
  })
})

describe('RoutinesTab — catalog-driven chains (mezo-n5e9.2)', () => {
  it('the seed-only catalog renders exactly the previous two cards, titled from the catalog', () => {
    renderTab()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    // The retired hardcoded card labels are gone — the ONLY user-visible copy change.
    expect(screen.queryByText('Reggeli lánc')).not.toBeInTheDocument()
    expect(screen.queryByText('Esti lánc')).not.toBeInTheDocument()
  })

  it('a third (DAY) chain in the catalog renders its own card', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [
          ...SEED_CHAINS,
          {
            id: 'chain-day', chainKey: 'chain_daytest', title: 'Napközbeni rutin', daypart: 'DAY',
            position: 3, isActive: true, defs: [],
          },
        ],
      },
      isPending: false,
    })
    useHabitDay.mockReturnValue({
      habits: [...habitsToday, { key: 'stretch', chain: 'chain_daytest', title: 'Nyújtás', status: 'pending', xp: 5 }],
    })
    renderTab()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    expect(screen.getByText('Napközbeni rutin')).toBeInTheDocument()
    expect(screen.getByText('Nyújtás')).toBeInTheDocument()
  })

  it('an inactive chain does not render a card even with habits on it', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [
          ...SEED_CHAINS,
          {
            id: 'chain-retired', chainKey: 'chain_retired', title: 'Régi rutin', daypart: 'DAY',
            position: 3, isActive: false, defs: [],
          },
        ],
      },
      isPending: false,
    })
    renderTab()
    expect(screen.queryByText('Régi rutin')).not.toBeInTheDocument()
  })
})

describe('RoutinesTab — routine editor entry (mezo-n5e9.2 / mezo-n5e9.4)', () => {
  it('the today view offers a Szerkesztés button that navigates to the editor', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /szerkesztés/i }))
    expect(screen.getByTestId('edit-probe')).toBeInTheDocument()
  })

  it('a past-day view has no Szerkesztés entry (read-only-clean)', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(screen.queryByRole('button', { name: /szerkesztés/i })).not.toBeInTheDocument()
  })
})
