import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ChainPage } from '@/features/me/pages/ChainPage'
import type { HabitChainInfo } from '@/data/types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function def(
  habitKey: string, title: string, position: number,
  overrides: Partial<HabitChainInfo['defs'][number]> = {},
): HabitChainInfo['defs'][number] {
  return {
    id: `d-${habitKey}`, habitKey, chainKey: 'MORNING', position, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework: null, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
    ...overrides,
  }
}

// viz → feny (linked to viz) → mozgas (linked to VIZ, not the previous) → szabad (free text)
const MORNING: HabitChainInfo = {
  id: 'chain-m', chainKey: 'MORNING', title: 'Reggeli', daypart: 'MORNING', position: 1, isActive: true,
  defs: [
    def('viz', 'Egy pohár víz', 1),
    def('feny', 'Reggeli fény', 2, { framework: 'FOGG', anchorHabitKey: 'viz', celebration: 'x' }),
    def('mozgas', 'Mozgás', 3, { framework: 'FOGG', anchorHabitKey: 'viz', celebration: 'x' }),
    def('szabad', 'Szabad szokás', 4, { anchorCopy: 'ebéd után' }),
  ],
}
const EVENING: HabitChainInfo = {
  id: 'chain-e', chainKey: 'EVENING', title: 'Esti', daypart: 'EVENING', position: 2, isActive: true,
  defs: [def('nyujtas', 'Esti nyújtás', 1, { chainKey: 'EVENING' })],
}
const CUSTOM_EMPTY: HabitChainInfo = {
  id: 'chain-c', chainKey: 'chain_ab12', title: 'Munkanapi', daypart: 'DAY', position: 3, isActive: true,
  defs: [],
}

const habitsToday = [
  { key: 'viz', status: 'done' },
  { key: 'feny', status: 'pending' },
  { key: 'mozgas', status: 'pending' },
  { key: 'szabad', status: 'pending' },
]

const {
  useHabitCatalog, useHabitCatalogActions, useHabitDay, useHabitSummary,
  updateChain, reorderChain, deleteChain,
} = vi.hoisted(() => ({
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
  useHabitDay: vi.fn(),
  useHabitSummary: vi.fn(),
  updateChain: vi.fn(() => Promise.resolve()),
  reorderChain: vi.fn(() => Promise.resolve()),
  deleteChain: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/hooks', () => ({
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
  useHabitDay: (d: string) => useHabitDay(d),
  useHabitSummary: () => useHabitSummary(),
}))

function renderPage(chainKey: string) {
  return render(
    <MemoryRouter initialEntries={[`/me/rutin/lanc/${chainKey}`]}>
      <Routes>
        <Route path="/me/rutin/lanc/:chainKey" element={<ChainPage />} />
        <Route path="/me/rutin" element={<div>RUTIN HUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigate.mockClear()
  updateChain.mockClear()
  reorderChain.mockClear()
  deleteChain.mockClear()
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({
    catalog: { chains: [MORNING, EVENING, CUSTOM_EMPTY] }, isPending: false, isError: false, refetch: vi.fn(),
  })
  useHabitCatalogActions.mockReset()
  useHabitCatalogActions.mockReturnValue({ updateChain, reorderChain, deleteChain, pending: false })
  useHabitDay.mockReset()
  useHabitDay.mockReturnValue({ habits: habitsToday })
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({
    data: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [{ key: 'viz', strengthPct: 80, done28: 20, missed28: 5 }] },
  })
})

describe('ChainPage — a stacking kirajzolva (mezo-vxd8)', () => {
  test('a kötél az előzőhöz kötött sornál teli, máshol szaggatott', () => {
    renderPage('MORNING')
    expect(screen.getByTestId('stack-feny').querySelector('.rt-srail')).toHaveClass('is-linked')
    expect(screen.getByTestId('stack-mozgas').querySelector('.rt-srail')).toHaveClass('is-broken')
    expect(screen.getByTestId('stack-szabad').querySelector('.rt-srail')).toHaveClass('is-broken')
  })

  test('a jelvény megmondja, mihez van kötve a sor — linked / nem az előző / szabad szöveg', () => {
    renderPage('MORNING')
    expect(within(screen.getByTestId('stack-feny')).getByText(/Egy pohár víz/)).toBeInTheDocument()
    expect(within(screen.getByTestId('stack-mozgas')).getByText(/nem az előző/)).toBeInTheDocument()
    expect(within(screen.getByTestId('stack-szabad')).getByText(/ebéd után/)).toBeInTheDocument()
  })

  test('a sor navigál a szokás oldalára, és sehol nincs pipa-kontroll (ADR)', () => {
    renderPage('MORNING')
    fireEvent.click(screen.getByRole('button', { name: /Reggeli fény/ }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/szokas/feny')
    expect(screen.queryByRole('button', { name: /^Pipa/ })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  test('a hero a mai állást és a lánc lefutását mutatja', () => {
    renderPage('MORNING')
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    expect(screen.getByText(/egy pohár víz → reggeli fény/)).toBeInTheDocument()
  })

  test('Szerkesztés: átnevezés + napszak a Kész gombbal megy ki updateChain-ként', async () => {
    renderPage('MORNING')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    fireEvent.change(screen.getByLabelText('A lánc neve'), { target: { value: 'Hajnali' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nap' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kész' }))
    expect(updateChain).toHaveBeenCalledWith('chain-m', { title: 'Hajnali', daypart: 'DAY' })
  })

  test('a ▲▼ a teljes id-permutációt küldi a reorderChain-nek', () => {
    renderPage('MORNING')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mozgás feljebb' }))
    expect(reorderChain).toHaveBeenCalledWith('chain-m', ['d-viz', 'd-mozgas', 'd-feny', 'd-szabad'])
  })

  test('szerkesztő módban a szaggatott kötél magyarázatot kap', () => {
    renderPage('MORNING')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    expect(screen.getByTestId('stack-warn')).toHaveTextContent('Mozgás')
  })

  test('a seed lánc nem törölhető — magyarázat, nem gomb', () => {
    renderPage('MORNING')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    expect(screen.queryByRole('button', { name: /Lánc törlése/ })).toBeNull()
    expect(screen.getByText(/alap rutinok .* nem törölhetők/)).toBeInTheDocument()
  })

  test('az üres custom lánc két koppintással törölhető', async () => {
    renderPage('chain_ab12')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lánc törlése' }))
    expect(deleteChain).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Biztosan törlöd/ }))
    expect(deleteChain).toHaveBeenCalledWith('chain-c')
  })

  test('a lánc szüneteltethető és folytatható', () => {
    renderPage('MORNING')
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    fireEvent.click(screen.getByRole('button', { name: /Lánc szüneteltetése/ }))
    expect(updateChain).toHaveBeenCalledWith('chain-m', { isActive: false })
  })

  test('＋ Új habit a wizard Keret nélkül ajtajához visz, a lánccal előtöltve', () => {
    renderPage('MORNING')
    fireEvent.click(screen.getByRole('button', { name: /Új habit/ }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?chain=MORNING')
  })

  test('ismeretlen chainKey a hubra pattan vissza', () => {
    renderPage('nincs-ilyen')
    expect(screen.getByText('RUTIN HUB')).toBeInTheDocument()
  })
})
