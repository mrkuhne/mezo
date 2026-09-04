import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RutinHubPage } from '@/features/me/pages/RutinHubPage'
import type { HabitChainInfo } from '@/data/types'

// The page navigates a lot (back to Én, new-recipe wizard, habit detail rows), so useNavigate
// is mocked at the react-router-dom boundary (GoalsPage.test.tsx's mockNavigate idiom) rather
// than routed through real sibling probe routes.
const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage(initialEntry = '/me/rutin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RutinHubPage />
    </MemoryRouter>,
  )
}

// Three catalog defs covering all three framework badges (mezo-3zue): FOGG, CLEAR, and a
// legacy pre-framework def (framework: null).
function def(
  habitKey: string, title: string, framework: 'FOGG' | 'CLEAR' | null,
  overrides: Partial<HabitChainInfo['defs'][number]> = {},
): HabitChainInfo['defs'][number] {
  return {
    id: `def-${habitKey}`, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
    ...overrides,
  }
}

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
  defs: [
    def('sun', 'Reggeli fény', 'FOGG', { position: 1 }),
    def('intent', 'Napi szándék', 'CLEAR', { position: 2 }),
    def('water', 'Hidratálás', null, { position: 3 }),
  ],
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true, defs: [],
}

const habitsToday = [
  { key: 'sun', chain: 'MORNING', title: 'Reggeli fény', status: 'done', xp: 5 },
  { key: 'intent', chain: 'MORNING', title: 'Napi szándék', status: 'pending', xp: 5 },
  { key: 'water', chain: 'MORNING', title: 'Hidratálás', status: 'pending', xp: 5 },
]

const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [{ key: 'sun', strengthPct: 71 }],
}

const {
  useHabitDay, useHabitSummary, useHabitCatalog, useHabitCatalogActions, useProgressionProfile,
  useHabitAiSuggest, updateChain, reorderChain,
} = vi.hoisted(() => ({
  useHabitDay: vi.fn(),
  useHabitSummary: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
  useProgressionProfile: vi.fn(),
  useHabitAiSuggest: vi.fn(),
  updateChain: vi.fn(() => Promise.resolve()),
  reorderChain: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/hooks', () => ({
  useHabitDay: (d: string) => useHabitDay(d),
  useHabitSummary: () => useHabitSummary(),
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
  useProgressionProfile: () => useProgressionProfile(),
  useHabitAiSuggest: () => useHabitAiSuggest(),
}))

beforeEach(() => {
  navigate.mockClear()
  updateChain.mockClear()
  reorderChain.mockClear()
  useHabitDay.mockReset()
  useHabitDay.mockReturnValue({ habits: habitsToday })
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({
    catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: false, refetch: vi.fn(),
  })
  useHabitCatalogActions.mockReset()
  useHabitCatalogActions.mockReturnValue({
    createChain: vi.fn(() => Promise.resolve()),
    updateChain,
    deleteChain: vi.fn(() => Promise.resolve()),
    reorderChain,
    createDef: vi.fn(() => Promise.resolve()),
    deleteDef: vi.fn(() => Promise.resolve()),
    pending: false,
  })
  useProgressionProfile.mockReset()
  useProgressionProfile.mockReturnValue({ data: { life: [] } })
  useHabitAiSuggest.mockReset()
  useHabitAiSuggest.mockReturnValue({ suggest: vi.fn(() => Promise.resolve([])), pending: false, unavailable: false })
})

describe('RutinHubPage', () => {
  test('shows the prototype statstrip instead of the 30-cell counter tiles', () => {
    const { container } = renderPage()
    expect(screen.getByText('tökéletes reggel · 30 n')).toBeInTheDocument()
    expect(screen.getByText('tökéletes este · 30 n')).toBeInTheDocument()
    expect(screen.getByText('aktív szokás')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument() // perfectMorningDays30
    expect(container.querySelector('.gr-covtile')).toBeNull()
    expect(container.querySelector('.gr-cells')).toBeNull()
  })

  test('keeps the day navigator — the accepted extension over the prototype', () => {
    renderPage()
    expect(screen.getByLabelText(/előző nap/i)).toBeInTheDocument()
  })

  test('the active-habit cell counts ACTIVE definitions only', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: [MORNING.defs[0], MORNING.defs[1], { ...MORNING.defs[2], isActive: false }] }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    const cell = screen.getByText('aktív szokás').closest('.mz-statcell') as HTMLElement
    expect(within(cell).getByText('2')).toBeInTheDocument()
  })

  test('badges each habit row with its framework, legacy rows included', () => {
    renderPage()
    expect(screen.getByLabelText('Reggeli fény · szokás-láncolás · 28 napos erő 71%')).toBeInTheDocument()
    expect(screen.getByLabelText('Napi szándék · négy törvény')).toBeInTheDocument()
    expect(screen.getByLabelText('Hidratálás · keret nélkül')).toBeInTheDocument()
  })

  // ---- fix wave (mezo-3zue.4): spec §5's strength NUMBER, and the bar not being silent ----

  test('a habit row shows the strength as a number beside the bar', () => {
    const { container } = renderPage()
    expect(screen.getByText('71%')).toBeInTheDocument()
    expect(container.querySelector('.rt-strength')).toHaveAttribute('aria-hidden', 'true')
  })

  test('the row button names the strength — the bar alone is silent to a screen reader', () => {
    renderPage()
    expect(screen.getByLabelText('Reggeli fény · szokás-láncolás · 28 napos erő 71%')).toBeInTheDocument()
    // a def with no summary row names no standing at all (honesty rule)
    expect(screen.getByLabelText('Hidratálás · keret nélkül')).toBeInTheDocument()
  })

  test('opens the habit page from a row and never renders a tick control', () => {
    renderPage()
    screen.getByLabelText('Reggeli fény · szokás-láncolás · 28 napos erő 71%').click()
    expect(navigate).toHaveBeenCalledWith('/me/rutin/szokas/sun')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('routes the new-recipe CTA to the wizard', () => {
    renderPage()
    screen.getByRole('button', { name: /Új szokás-recept/ }).click()
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj')
  })

  test('goes back to the Én hub, not to Growth', () => {
    renderPage()
    screen.getByRole('button', { name: 'Vissza' }).click()
    expect(navigate).toHaveBeenCalledWith('/me')
  })

  test('keeps chain editing: the active toggle and the chain edit sheet', () => {
    renderPage()
    screen.getByLabelText('Reggeli rutin aktív').click()
    expect(updateChain).toHaveBeenCalledWith('chain-morning', { isActive: false })
  })

  test('shows the past-day branch without strength percentages', () => {
    renderPage()
    fireEvent.click(screen.getByLabelText(/előző nap/i))
    expect(screen.queryByText(/erő \d+%/)).not.toBeInTheDocument()
  })

  // ---- past-day behaviour inherited from GrowthRutinPage (mezo-rmi0.1) ----

  test('past day: the summary line reads `Reggel k/n · Este k/n · +XP`', () => {
    useHabitDay.mockReturnValue({
      habits: [
        ...habitsToday,
        { key: 'bed', chain: 'EVENING', title: 'Időben ágyban', status: 'missed', xp: 5 },
      ],
    })
    const { container } = renderPage()
    fireEvent.click(screen.getByLabelText(/előző nap/i))
    expect(container.querySelector('.gr-daysum')?.textContent).toMatch(/Reggel 1\/3 · Este 0\/1 · \+5 XP/)
    // status-only rows on a past day: no strength bar, no framework badge, no tap target
    expect(container.querySelectorAll('.rt-strength')).toHaveLength(0)
    expect(container.querySelectorAll('.rt-fw')).toHaveLength(0)
  })

  test('past day with a zero chain shows the soft note (never "megszakadt")', () => {
    useHabitDay.mockReturnValue({
      habits: [
        { key: 'sun', chain: 'MORNING', title: 'Reggeli fény', status: 'pending', xp: 5 },
        { key: 'bed', chain: 'EVENING', title: 'Időben ágyban', status: 'done', xp: 5 },
      ],
    })
    renderPage()
    fireEvent.click(screen.getByLabelText(/előző nap/i))
    expect(screen.getByText(/Reggeli rutin kimaradt — a lánc másnap folytatódott\. A 30 napos erő ettől nem nullázódik\./)).toBeInTheDocument()
    expect(screen.queryByText(/megszakadt/)).not.toBeInTheDocument()
  })

  test('empty past day: quiet ghost', () => {
    renderPage()
    useHabitDay.mockReturnValue({ habits: [] })
    fireEvent.click(screen.getByLabelText(/előző nap/i))
    expect(screen.getByText(/Nincs rutinadat erre a napra/i)).toBeInTheDocument()
  })

  // ---- catalog-driven today branch (the fix wave) ----

  test('an inactive chain renders dimmed, it does not disappear', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, isActive: false }, EVENING] }, isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    const card = screen.getByText('Reggeli rutin').closest('.gr-chain')
    expect(card).toHaveClass('is-inert')
    // and its toggle is still there to turn it back on
    fireEvent.click(screen.getByLabelText('Reggeli rutin aktív'))
    expect(updateChain).toHaveBeenCalledWith('chain-morning', { isActive: true })
  })

  test('an inactive definition renders dimmed instead of vanishing with the day view', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: [MORNING.defs[0], MORNING.defs[1], { ...MORNING.defs[2], isActive: false }] }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    // the day view returns ACTIVE defs only — the paused one is absent from it
    useHabitDay.mockReturnValue({ habits: habitsToday.slice(0, 2) })
    renderPage()
    const row = screen.getByLabelText('Hidratálás · keret nélkül').closest('.row')
    expect(row).toHaveClass('is-inert')
  })

  test('the row carries a read-only tick beside the bar and no per-def toggle', () => {
    const { container } = renderPage()
    const row = screen.getByLabelText('Reggeli fény · szokás-láncolás · 28 napos erő 71%')
    expect(within(row).getByText('✓')).toBeInTheDocument()
    expect(row.closest('.row')).toHaveClass('rt-done')
    // a toggle a soron soha többé — a szüneteltetés a HabitPage-en él
    expect(screen.queryByLabelText('Napi szándék aktív')).toBeNull()
    expect(container.querySelector('.rt-hrow .rt-bar')).not.toBeNull()
  })

  test('a paused definition dims but stays tappable through to its habit page', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: [MORNING.defs[0], MORNING.defs[1], { ...MORNING.defs[2], isActive: false }] }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    useHabitDay.mockReturnValue({ habits: habitsToday.slice(0, 2) })
    renderPage()
    const paused = screen.getByLabelText('Hidratálás · keret nélkül')
    expect(paused.closest('.row')).toHaveClass('is-inert')
    expect(paused).not.toBeDisabled()
    fireEvent.click(paused)
    expect(navigate).toHaveBeenCalledWith('/me/rutin/szokas/water')
  })

  test('＋ Új habit opens the habit sheet in create mode for that chain', () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /új habit/i })[0])
    expect(screen.getByRole('heading', { name: 'Új habit' })).toBeInTheDocument()
  })

  test('reorder sends every definition id of the chain, including an inactive one', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: [MORNING.defs[0], MORNING.defs[1], { ...MORNING.defs[2], isActive: false }] }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    useHabitDay.mockReturnValue({ habits: habitsToday.slice(0, 2) })
    renderPage()
    const firstRow = screen.getByText('Reggeli fény').closest('[data-sortable-row]') as HTMLElement
    fireEvent.click(within(firstRow).getByRole('button', { name: /lejjebb/i }))
    // a day-filtered subset would drop `def-water` and be rejected with HABIT_REORDER_MISMATCH
    expect(reorderChain).toHaveBeenCalledWith('chain-morning', ['def-intent', 'def-sun', 'def-water'])
  })

  test('a chain with no habits today still renders with its ＋ Új habit row', () => {
    renderPage()
    const evening = screen.getByText('Esti rutin').closest('.gr-chain') as HTMLElement
    expect(within(evening).getByRole('button', { name: /új habit/i })).toBeInTheDocument()
  })

  test('shows a loading ghost while the catalog is pending and empty', () => {
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: true, isError: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText(/rutinok betöltése/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /új lánc/i })).not.toBeInTheDocument()
  })

  test('shows a retry ghost (not the create CTAs) when the catalog errored and is empty', () => {
    const refetch = vi.fn()
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: false, isError: true, refetch })
    renderPage()
    expect(screen.queryByRole('button', { name: /új lánc/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /újra/i }))
    expect(refetch).toHaveBeenCalled()
  })

  test('an error with stale-but-present chains still renders the normal view', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: true, refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.queryByText(/nem sikerült betölteni/i)).not.toBeInTheDocument()
  })

  test('?new= highlights the freshly created habit row', () => {
    const { container } = renderPage('/me/rutin?new=intent')
    expect(container.querySelectorAll('.rt-row-new')).toHaveLength(1)
    expect(screen.getByLabelText('Napi szándék · négy törvény')).toHaveClass('rt-row-new')
  })

  test('suppresses the hero standing until the day view has something real', () => {
    useHabitDay.mockReturnValue({ habits: [] })
    const { container } = renderPage()
    expect(container.querySelector('.mz-bignum')).toBeNull()
  })
})
