import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { GrowthRutinPage } from '@/features/me/pages/GrowthRutinPage'
import { localDateString } from '@/shared/lib/dates'
import type { HabitChainInfo } from '@/data/types'

// GrowthRutinPage navigates (the "Szerkesztés" entry button + ‹ Growth back), so every render
// needs Router context — a probe route stands in for RoutineEditorPage (RoutinesTab.test.tsx's
// renderTab idiom, itself borrowed from GoalMiniCard.test.tsx's renderMini).
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/me/growth/rutin']}>
      <Routes>
        <Route path="/me/growth/rutin" element={<GrowthRutinPage />} />
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

// The two seed chains (mezo-n5e9.2 — mirrors `mockHabitCatalog`): the page's default map
// source, replacing the retired hardcoded chain pair.
const SEED_CHAINS: HabitChainInfo[] = [
  { id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true, defs: [] },
  { id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true, defs: [] },
]

// Small, easy-to-count numbers (6 / 4) so the 30-cell counters' filled-count assertions read at
// a glance — the summary carries no daily bits, so these are pure counters, not a calendar map.
const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [{ key: 'wake_on_time', strengthPct: 71 }],
}

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
  useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({ catalog: { chains: SEED_CHAINS }, isPending: false })
})

describe('GrowthRutinPage', () => {
  test('today: hero 6 tökéletes reggel, two counter tiles with 30 cells each (6 / 4 filled), chains with strength %', () => {
    const { container } = renderPage()
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Growth')
    expect(screen.getByText('tökéletes reggel')).toBeInTheDocument()
    expect(container.querySelectorAll('#gr-cells-m i')).toHaveLength(30)
    expect(container.querySelectorAll('#gr-cells-m i.on')).toHaveLength(mockHabitSummary.perfectMorningDays30)
    expect(container.querySelectorAll('#gr-cells-e i.ev.on')).toHaveLength(mockHabitSummary.perfectEveningDays30)
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    expect(container.querySelectorAll('.gr-chain-pct').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Szerkesztés/ })).toBeInTheDocument()
  })

  test('past day: summary card `Reggel d/n · Este d/n · +xp XP`, no counters, no strength, no Szerkesztés', async () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(useHabitDay).toHaveBeenCalledWith(expect.not.stringMatching(localDateString()))
    // no today-only counter tiles
    expect(container.querySelectorAll('.gr-covgrid')).toHaveLength(0)
    // day-summary chip: `.gr-daysum`'s counts sit inside nested <b> tags, so match on the
    // container's full textContent (RTL's default getByText only concatenates direct text-node
    // children, which would miss text split across nested elements) — replaces the old single
    // flat `<span>Reggel n/n · Este n/n</span>` assertion, unavoidable once the counts moved
    // into `<b>` for weight.
    expect(container.querySelector('.gr-daysum')?.textContent).toMatch(/Reggel 1\/2 · Este 0\/1 · \+5 XP/)
    // status-only rows on a past day — no strength percentage
    expect(container.querySelectorAll('.gr-chain-pct')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /szerkesztés/i })).not.toBeInTheDocument()
  })

  test('past day with a zero chain shows the soft note (never "megszakadt")', async () => {
    // All MORNING habits pending, EVENING has a done item — the MORNING chain is the zero one.
    useHabitDay.mockReturnValue({
      habits: [
        { key: 'wake_on_time', chain: 'MORNING', title: 'Ébredés időben', status: 'pending', xp: 5 },
        { key: 'morning_sunlight', chain: 'MORNING', title: 'Reggeli napfény', status: 'pending', xp: 5 },
        { key: 'bed_on_time', chain: 'EVENING', title: 'Időben ágyban', status: 'done', xp: 5 },
      ],
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(screen.getByText(/Reggeli rutin kimaradt — a lánc másnap folytatódott\. A 30 napos erő ettől nem nullázódik\./)).toBeInTheDocument()
    expect(screen.queryByText(/megszakadt/)).not.toBeInTheDocument()
  })

  test('empty past day: quiet ghost', async () => {
    renderPage()
    useHabitDay.mockReturnValue({ habits: [] })
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(screen.getByText(/Nincs rutinadat erre a napra/i)).toBeInTheDocument()
  })

  test('catalog-driven chains: seed → two cards from catalog titles; a third DAY chain renders; inactive chain does not', () => {
    // the seed-only catalog renders exactly two cards, titled from the catalog
    const seed = renderPage()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    // The retired hardcoded card labels are gone — the ONLY user-visible copy change.
    expect(screen.queryByText('Reggeli lánc')).not.toBeInTheDocument()
    expect(screen.queryByText('Esti lánc')).not.toBeInTheDocument()
    seed.unmount()

    // a third (DAY) chain in the catalog renders its own card
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
    const withDay = renderPage()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    expect(screen.getByText('Napközbeni rutin')).toBeInTheDocument()
    expect(screen.getByText('Nyújtás')).toBeInTheDocument()
    withDay.unmount()

    // an inactive chain does not render a card even with habits on it
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
    useHabitDay.mockReturnValue({ habits: habitsToday })
    renderPage()
    expect(screen.queryByText('Régi rutin')).not.toBeInTheDocument()
  })

  test('Szerkesztés navigates to /me/routines/edit', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /szerkesztés/i }))
    expect(screen.getByTestId('edit-probe')).toBeInTheDocument()
  })
})
