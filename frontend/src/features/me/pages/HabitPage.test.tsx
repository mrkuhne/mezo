import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { HabitPage } from '@/features/me/pages/HabitPage'
import type { HabitChainInfo } from '@/data/types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function def(
  habitKey: string, title: string, framework: 'FOGG' | 'CLEAR' | null,
  overrides: Partial<HabitChainInfo['defs'][number]> = {},
): HabitChainInfo['defs'][number] {
  return {
    id: `d-${habitKey}`, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
    ...overrides,
  }
}

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
  defs: [
    def('sun', 'Reggeli fény', 'FOGG', { position: 1, anchorCopy: 'kitöltöttem a kávét', celebration: 'ökölrázás' }),
    def('intent', 'leírom a napi szándékot', 'CLEAR', {
      position: 2,
      cue: '7:10-kor a konyhában', craving: 'tisztább a fejem', reward: 'a pipa maga',
    }),
    def('water', 'Hidratálás', null, { position: 3 }),
  ],
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true, defs: [],
}

const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [{ key: 'intent', strengthPct: 82, done28: 23, missed28: 5 }],
}

const {
  useHabitSummary, useHabitCatalog, useHabitCatalogActions, updateDef, deleteDef,
} = vi.hoisted(() => ({
  useHabitSummary: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
  updateDef: vi.fn(() => Promise.resolve()),
  deleteDef: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/hooks', () => ({
  useHabitSummary: () => useHabitSummary(),
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
}))

function renderPage(habitKey: string) {
  return render(
    <MemoryRouter initialEntries={[`/me/rutin/szokas/${habitKey}`]}>
      <Routes>
        <Route path="/me/rutin/szokas/:habitKey" element={<HabitPage />} />
        <Route path="/me/rutin" element={<div>RUTIN HUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigate.mockClear()
  updateDef.mockClear()
  deleteDef.mockClear()
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({
    catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: false, refetch: vi.fn(),
  })
  useHabitCatalogActions.mockReset()
  useHabitCatalogActions.mockReturnValue({
    createChain: vi.fn(() => Promise.resolve()),
    updateChain: vi.fn(() => Promise.resolve()),
    deleteChain: vi.fn(() => Promise.resolve()),
    reorderChain: vi.fn(() => Promise.resolve()),
    createDef: vi.fn(() => Promise.resolve()),
    updateDef,
    deleteDef,
    pending: false,
  })
})

describe('HabitPage', () => {
  test('shows the finished recipe sentence and the framework band', () => {
    renderPage('intent')
    expect(screen.getByTestId('recipe-sentence'))
      .toHaveTextContent('7:10-kor a konyhában leírom a napi szándékot, mert tisztább a fejem. Jutalmam: a pipa maga.')
    expect(screen.getByText('Négy törvény')).toBeInTheDocument()
  })

  test('offers pausing, not deleting, as the primary destructive action', () => {
    renderPage('intent')
    expect(screen.getByRole('button', { name: /Szüneteltetés/ })).toBeInTheDocument()
  })

  test('pauses the habit through updateDef', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Szüneteltetés/ }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', { isActive: false })
  })

  test('labels a framework-less habit as legacy and offers re-framing', () => {
    renderPage('water')
    expect(screen.getByText('Keret nélkül')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Keret választása/ }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?prefill=water')
  })

  test('a framework habit offers switching frames', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Keret váltása/ }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?prefill=intent')
  })

  test('the hero carries the 28-day strength and its pipa/kihagyás split', () => {
    renderPage('intent')
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('28 napos erő · 23 pipa · 5 kihagyás')).toBeInTheDocument()
  })

  test('omits the hero sub entirely when the def has no summary row', () => {
    renderPage('sun')
    expect(screen.queryByText(/28 napos erő/)).not.toBeInTheDocument()
  })

  test('saves the edited CLEAR fields, omitting an emptied optional key', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: 'tiszta fejjel indul a nap' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', {
      title: 'leírom a napi szándékot',
      chainKey: 'MORNING',
      xp: 5,
      cue: '7:10-kor a konyhában',
      craving: 'tiszta fejjel indul a nap',
      reward: 'a pipa maga',
    })
  })

  test('refuses to save a CLEAR recipe the backend would reject', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeDisabled()
  })

  test('saves a FOGG recipe with its anchor and celebration', () => {
    renderPage('sun')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-sun', {
      title: 'Reggeli fény',
      chainKey: 'MORNING',
      xp: 5,
      anchorCopy: 'kitöltöttem a kávét',
      celebration: 'ökölrázás',
    })
  })

  test('deletion takes two taps and is not the visually primary action', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Szokás törlése/ }))
    expect(deleteDef).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Biztosan törlöd/ }))
    expect(deleteDef).toHaveBeenCalledWith('d-intent')
  })

  test('an unknown habit key bounces back to the rutin hub', () => {
    renderPage('nincs-ilyen')
    expect(screen.getByText('RUTIN HUB')).toBeInTheDocument()
  })

  test('an unresolved catalog shows the loading ghost instead of bouncing', () => {
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: true, isError: false, refetch: vi.fn() })
    renderPage('intent')
    expect(screen.queryByText('RUTIN HUB')).not.toBeInTheDocument()
  })

  test('the 28-day strip is captioned as counts, never as a calendar', () => {
    const { container } = renderPage('intent')
    expect(container.querySelectorAll('.rt-hist i')).toHaveLength(28)
    expect(container.querySelectorAll('.rt-hist i.is-done')).toHaveLength(23)
    expect(container.querySelectorAll('.rt-hist i.is-miss')).toHaveLength(5)
    expect(screen.getByText(/nem naptár/)).toBeInTheDocument()
  })

  test('never renders a tick control', () => {
    renderPage('intent')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
