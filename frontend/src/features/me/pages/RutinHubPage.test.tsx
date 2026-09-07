import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RutinHubPage } from '@/features/me/pages/RutinHubPage'
import type { HabitChainInfo, HabitFormation } from '@/data/types'

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
  { key: 'sun', chain: 'MORNING', title: 'Reggeli fény', status: 'done', xp: 5, anchorCopy: 'ébredés után' },
  { key: 'intent', chain: 'MORNING', title: 'Napi szándék', status: 'pending', xp: 5, anchorCopy: 'kávé után' },
  { key: 'water', chain: 'MORNING', title: 'Hidratálás', status: 'pending', xp: 5, anchorCopy: '' },
]

const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [{ key: 'sun', strengthPct: 71 }],
}

function formation(key: string, automaticityPct: number | null): HabitFormation {
  return {
    key, firstDate: '2026-06-01', reps: 40, missed: 5,
    automaticityPct, curveK: 0.03, thresholdPct: 90, minReps: 5,
    repsToThresholdLo: null, repsToThresholdHi: null,
    weeksToThresholdLo: null, weeksToThresholdHi: null,
    repsPerWeek: 5, consistencyPct: 70, timeConstancyPct: null, anchorConstancyPct: null,
    days: [],
  }
}

const {
  useHabitDay, useHabitSummary, useHabitCatalog, useHabitFormations, useProgressionProfile,
  useHabitAiSuggest, useHabitCatalogActions,
} = vi.hoisted(() => ({
  useHabitDay: vi.fn(),
  useHabitSummary: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitFormations: vi.fn(),
  useProgressionProfile: vi.fn(),
  useHabitAiSuggest: vi.fn(),
  useHabitCatalogActions: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitDay: (d: string) => useHabitDay(d),
  useHabitSummary: () => useHabitSummary(),
  useHabitCatalog: () => useHabitCatalog(),
  useHabitFormations: (keys: string[]) => useHabitFormations(keys),
  useProgressionProfile: () => useProgressionProfile(),
  useHabitAiSuggest: () => useHabitAiSuggest(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
}))

beforeEach(() => {
  navigate.mockClear()
  useHabitDay.mockReset()
  useHabitDay.mockReturnValue({ habits: habitsToday })
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({
    catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: false, refetch: vi.fn(),
  })
  useHabitFormations.mockReset()
  useHabitFormations.mockReturnValue(new Map([
    ['sun', formation('sun', 92)], // settled (past the 90% threshold)
    ['intent', formation('intent', 40)],
    ['water', formation('water', null)], // under minReps — no estimate
  ]))
  useProgressionProfile.mockReset()
  useProgressionProfile.mockReturnValue({ data: { life: [] } })
  useHabitAiSuggest.mockReset()
  useHabitAiSuggest.mockReturnValue({ suggest: vi.fn(() => Promise.resolve([])), pending: false, unavailable: false })
  useHabitCatalogActions.mockReset()
  useHabitCatalogActions.mockReturnValue({
    createChain: vi.fn(() => Promise.resolve()), updateChain: vi.fn(), deleteChain: vi.fn(),
    reorderChain: vi.fn(), createDef: vi.fn(), updateDef: vi.fn(), deleteDef: vi.fn(), pending: false,
  })
})

describe('RutinHubPage — hub 2.0 (mezo-mgpr)', () => {
  test('the statstrip keeps the 30-day counters and the active-def cell', () => {
    renderPage()
    expect(screen.getByText('tökéletes reggel · 30 n')).toBeInTheDocument()
    expect(screen.getByText('tökéletes este · 30 n')).toBeInTheDocument()
    expect(screen.getByText('aktív szokás')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('the hero sub counts the settled habits from the formation data', () => {
    renderPage()
    expect(screen.getByText('ma · 1 szokás már magától megy')).toBeInTheDocument()
  })

  test('a Következik sor a soron következő szokást mutatja, és a Nap oldalra NAVIGÁL, nem pipál', () => {
    renderPage()
    const card = screen.getByTestId('next-card')
    expect(card).toHaveTextContent('Következik')
    expect(card).toHaveTextContent('Napi szándék')
    expect(card).toHaveTextContent('kávé után · Reggeli rutin lánc')
    fireEvent.click(within(card).getByRole('button', { name: 'Pipálás a Nap oldalon' }))
    expect(navigate).toHaveBeenCalledWith('/nap/rutin?dp=reggel')
    // the ADR's hard rule: no tick control anywhere on an Én surface
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  test('mind kész: a Következik kártya ünnepel és a Nap oldalra visz', () => {
    useHabitDay.mockReturnValue({ habits: habitsToday.map((h) => ({ ...h, status: 'done' })) })
    renderPage()
    const card = screen.getByTestId('next-card')
    expect(card).toHaveTextContent('A mai rutin kész')
    fireEvent.click(within(card).getByRole('button', { name: /Nap oldal/ }))
    expect(navigate).toHaveBeenCalledWith('/nap/rutin?dp=reggel')
  })

  test('az aktív lánc csempe a következő szokás láncát mutatja, és a lánc-oldalra visz', () => {
    renderPage()
    const tile = screen.getByTestId('chain-tile')
    expect(tile).toHaveTextContent('Aktív lánc · Reggeli rutin')
    expect(tile).toHaveTextContent('1 / 3')
    fireEvent.click(tile)
    expect(navigate).toHaveBeenCalledWith('/me/rutin/lanc/MORNING')
  })

  test('a Szokásaid csempe a saját oldalára visz, a beérett számmal', () => {
    renderPage()
    const tile = screen.getByRole('button', { name: 'Szokásaid' })
    expect(tile).toHaveTextContent('3 aktív · 1 beérett')
    fireEvent.click(tile)
    expect(navigate).toHaveBeenCalledWith('/me/rutin/szokasok')
  })

  test('az Építs csempe az egy létrehozó folyamot nyitja', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Építs' }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj')
  })

  test('a hub nem listáz szokás-sorokat — a lista a saját oldalán él', () => {
    renderPage()
    expect(screen.queryByText('Hidratálás')).toBeNull()
  })

  test('keeps the day navigator — the accepted extension over the prototype', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /Előző nap/ })).toBeInTheDocument()
  })

  test('the active-habit cell ignores the defs of a PAUSED chain', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, isActive: false }, EVENING] },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  test('goes back to the Én hub, not to Growth', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(navigate).toHaveBeenCalledWith('/me')
  })

  test('suppresses the hero standing until the day view has something real', () => {
    useHabitDay.mockReturnValue({ habits: [] })
    renderPage()
    expect(screen.queryByText('0 / 0')).toBeNull()
  })

  test('shows a loading ghost while the catalog is pending and empty', () => {
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: true, isError: false, refetch: vi.fn() })
    useHabitFormations.mockReturnValue(new Map())
    renderPage()
    expect(screen.getByText(/Rutinok betöltése/)).toBeInTheDocument()
  })

  test('shows a retry ghost (not the create doors) when the catalog errored and is empty', () => {
    const refetch = vi.fn()
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: false, isError: true, refetch })
    useHabitFormations.mockReturnValue(new Map())
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))
    expect(refetch).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Építs' })).toBeNull()
  })

  // ---- past-day branch (mezo-x9c2) — untouched by hub 2.0 ----

  test('past day: the summary line reads `Reggel k/n · Este k/n · +XP`', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Előző nap/ }))
    expect(document.querySelector('.gr-daysum')).toHaveTextContent(/^Reggel 1\/3 · Este 0\/0 · \+5 XP$/)
  })

  test('past day shows the day rows read-only, no next card', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Előző nap/ }))
    expect(screen.getByText('Hidratálás')).toBeInTheDocument()
    expect(screen.queryByTestId('next-card')).toBeNull()
  })

  test('empty past day: quiet ghost', () => {
    useHabitDay.mockReturnValue({ habits: [] })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Előző nap/ }))
    expect(screen.getByText('Nincs rutinadat erre a napra')).toBeInTheDocument()
  })
})
