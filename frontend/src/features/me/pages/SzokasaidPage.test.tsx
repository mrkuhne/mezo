import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SzokasaidPage } from '@/features/me/pages/SzokasaidPage'
import type { HabitChainInfo, HabitFormation } from '@/data/types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function def(
  habitKey: string, title: string,
  overrides: Partial<HabitChainInfo['defs'][number]> = {},
): HabitChainInfo['defs'][number] {
  return {
    id: `d-${habitKey}`, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework: null, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
    ...overrides,
  }
}

const MORNING: HabitChainInfo = {
  id: 'chain-m', chainKey: 'MORNING', title: 'Reggeli', daypart: 'MORNING', position: 1, isActive: true,
  defs: [
    def('kesz', 'Beérett szokás', { position: 1 }),
    def('epul', 'Épülő szokás', { position: 2 }),
    def('friss', 'Friss szokás', { position: 3 }),
    def('szunetel', 'Szünetelő', { position: 4, isActive: false }),
  ],
}

function formation(key: string, over: Partial<HabitFormation> = {}): HabitFormation {
  return {
    key, firstDate: '2026-06-01', reps: 48, missed: 6,
    automaticityPct: 40, curveK: 0.03, thresholdPct: 90, minReps: 5,
    repsToThresholdLo: 30, repsToThresholdHi: 80,
    weeksToThresholdLo: 5, weeksToThresholdHi: 11,
    repsPerWeek: 5, consistencyPct: 70, timeConstancyPct: null, anchorConstancyPct: null,
    days: [], ...over,
  }
}

const { useHabitCatalog, useHabitFormations } = vi.hoisted(() => ({
  useHabitCatalog: vi.fn(),
  useHabitFormations: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitCatalog: () => useHabitCatalog(),
  useHabitFormations: (keys: string[]) => useHabitFormations(keys),
}))

function renderPage() {
  return render(<MemoryRouter initialEntries={['/nap/rutin/szokasok']}><SzokasaidPage /></MemoryRouter>)
}

beforeEach(() => {
  navigate.mockClear()
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({
    catalog: { chains: [MORNING] }, isPending: false, isError: false, refetch: vi.fn(),
  })
  useHabitFormations.mockReset()
  useHabitFormations.mockReturnValue(new Map([
    ['kesz', formation('kesz', { automaticityPct: 93, reps: 120 })],
    ['epul', formation('epul', { automaticityPct: 40 })],
    ['friss', formation('friss', {
      automaticityPct: null, curveK: null, reps: 2,
      repsToThresholdLo: null, repsToThresholdHi: null,
      weeksToThresholdLo: null, weeksToThresholdHi: null,
    })],
  ]))
})

describe('SzokasaidPage — a lista saját oldala (mezo-mgpr)', () => {
  test('egy szokás egy sor: név, szakasz, ismétlésszám, szint a %-kal, hátralévő idő', () => {
    renderPage()
    const tile = screen.getByTestId('habit-tile-epul')
    expect(within(tile).getByText('Épülő szokás')).toBeInTheDocument()
    expect(within(tile).getByText('épül')).toBeInTheDocument()
    expect(within(tile).getByText('48')).toBeInTheDocument()
    expect(within(tile).getByText('40%')).toBeInTheDocument()
    expect(within(tile).getByText('5–11 hét')).toBeInTheDocument()
    expect(within(tile).getByText(/van hátra/)).toBeInTheDocument()
    // the automaticity is a small level, not a ring
    expect(tile.querySelector('.fo-mini .t i')).toHaveStyle({ height: '40%' })
    expect(tile.querySelector('svg circle')).toBeNull()
  })

  test('a beérett csempe Beérett feliratot visel, nem határidőt', () => {
    renderPage()
    const tile = screen.getByTestId('habit-tile-kesz')
    expect(within(tile).getByText('magától megy')).toBeInTheDocument()
    expect(within(tile).getByText('Beérett')).toBeInTheDocument()
  })

  test('minReps alatt nincs százalék és nincs határidő — csak ami hiányzik (honesty rule)', () => {
    renderPage()
    const tile = screen.getByTestId('habit-tile-friss')
    expect(within(tile).getByText('—')).toBeInTheDocument()
    expect(within(tile).getByText('még gyűlik az adat')).toBeInTheDocument()
    expect(within(tile).getByText('3 ismétlés')).toBeInTheDocument()
    expect(within(tile).getByText(/a becslésig/)).toBeInTheDocument()
  })

  test('a négy szakasz-szűrő csempe a saját darabszámát mutatja, és többes szűrésre kapcsol', () => {
    renderPage()
    const filters = screen.getAllByRole('button', { pressed: false }).filter((b) => b.classList.contains('rb-stg-b'))
    expect(filters).toHaveLength(4)
    // counts: 'friss' no-estimate → stage 0; 'epul' 40% → stage 1; 'kesz' 93% → stage 3
    expect(filters[0]).toHaveTextContent('1')
    expect(filters[1]).toHaveTextContent('1')
    expect(filters[2]).toHaveTextContent('0')
    expect(filters[3]).toHaveTextContent('1')
    // the riper the stage, the higher its vessel stands
    expect(filters.map((b) => (b.querySelector('.t i') as HTMLElement).style.height)).toEqual(['25%', '50%', '75%', '100%'])
    fireEvent.click(filters[3])
    expect(filters[3]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('habit-tile-kesz')).toBeInTheDocument()
    expect(screen.queryByTestId('habit-tile-epul')).toBeNull()
    expect(screen.getByRole('heading', { name: /Szokások · 1/ })).toBeInTheDocument()
    fireEvent.click(filters[2])
    expect(screen.getByRole('heading', { name: /Szokások · 1/ })).toBeInTheDocument()
    fireEvent.click(filters[3])
    expect(screen.getByText('Ebben a szakaszban most nincs szokásod.')).toBeInTheDocument()
  })

  test('a hero a valódi darabszámokból beszél, és az Új szokás a wizardot nyitja', () => {
    const { container } = renderPage()
    const hero = container.querySelector('.fo-hero') as HTMLElement
    expect(hero).toHaveTextContent('3 aktív szokás · melyik szakaszt mutassam?')
    expect(hero).toHaveTextContent('1 már magától megy, 1 úton van oda.')
    fireEvent.click(within(hero).getByRole('button', { name: '+ Új szokás' }))
    expect(navigate).toHaveBeenCalledWith('/nap/rutin/uj')
  })

  test('szűrő nélkül minden látszik — nincs ötödik „Mind" csempe', () => {
    renderPage()
    expect(screen.getByTestId('habit-tile-kesz')).toBeInTheDocument()
    expect(screen.getByTestId('habit-tile-epul')).toBeInTheDocument()
    expect(screen.getByTestId('habit-tile-friss')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Mind$/ })).toBeNull()
  })

  test('a szünetelő szokás nincs a listán (a hub aktív-szabálya)', () => {
    renderPage()
    expect(screen.queryByText('Szünetelő')).toBeNull()
  })

  test('a csempe a szokás oldalára visz, és sehol nincs pipa', () => {
    renderPage()
    fireEvent.click(within(screen.getByTestId('habit-tile-epul')).getByRole('button'))
    expect(navigate).toHaveBeenCalledWith('/nap/rutin/szokas/epul')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  test('formálódás szerint rendez: a legérettebb elöl, a becslés nélküli a végén', () => {
    renderPage()
    const tiles = screen.getAllByTestId(/habit-tile-/)
    expect(tiles.map((t) => t.getAttribute('data-testid')))
      .toEqual(['habit-tile-kesz', 'habit-tile-epul', 'habit-tile-friss'])
  })
})

// Én IA final review (mezo-lhqw7): the chip names where it LANDS — the builder is „Rutinok"
// (/nap/rutin/epites, „Rutinok szerkesztése"); only the builder's own chip says „Rutin" (/nap/rutin).
test('the back chip says „Rutinok" and lands on the routine builder', () => {
  renderPage()
  const back = screen.getByRole('button', { name: 'Vissza' })
  expect(back).toHaveTextContent(/^‹Rutinok$/)
  fireEvent.click(back)
  expect(navigate).toHaveBeenCalledWith('/nap/rutin/epites')
})
