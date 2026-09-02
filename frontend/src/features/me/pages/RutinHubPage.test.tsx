import { fireEvent, render, screen } from '@testing-library/react'
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
function def(habitKey: string, title: string, framework: 'FOGG' | 'CLEAR' | null): HabitChainInfo['defs'][number] {
  return {
    id: `def-${habitKey}`, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
  }
}

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
  defs: [
    def('sun', 'Reggeli fény', 'FOGG'),
    def('intent', 'Napi szándék', 'CLEAR'),
    def('water', 'Hidratálás', null),
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

const { useHabitDay, useHabitSummary, useHabitCatalog, useHabitCatalogActions, updateChain } = vi.hoisted(() => ({
  useHabitDay: vi.fn(),
  useHabitSummary: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
  updateChain: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/hooks', () => ({
  useHabitDay: (d: string) => useHabitDay(d),
  useHabitSummary: () => useHabitSummary(),
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
}))

beforeEach(() => {
  navigate.mockClear()
  updateChain.mockClear()
  useHabitDay.mockReset()
  useHabitDay.mockReturnValue({ habits: habitsToday })
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({ catalog: { chains: [MORNING, EVENING] }, isPending: false })
  useHabitCatalogActions.mockReset()
  useHabitCatalogActions.mockReturnValue({
    updateChain, updateDef: vi.fn(() => Promise.resolve()), reorderChain: vi.fn(() => Promise.resolve()), pending: false,
  })
})

describe('RutinHubPage', () => {
  test('keeps the 30-day counter tiles and the day navigator from the Growth page', () => {
    renderPage()
    expect(screen.getByText('Reggel')).toBeInTheDocument()
    expect(screen.getByText('Este')).toBeInTheDocument()
    expect(screen.getByLabelText(/előző nap/i)).toBeInTheDocument()
  })

  test('badges each habit row with its framework, legacy rows included', () => {
    renderPage()
    expect(screen.getByLabelText('Reggeli fény · szokás-láncolás')).toBeInTheDocument()
    expect(screen.getByLabelText('Napi szándék · négy törvény')).toBeInTheDocument()
    expect(screen.getByLabelText('Hidratálás · keret nélkül')).toBeInTheDocument()
  })

  test('opens the habit page from a row and never renders a tick control', () => {
    renderPage()
    screen.getByLabelText('Reggeli fény · szokás-láncolás').click()
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
})
