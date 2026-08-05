import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutineEditorPage } from '@/features/me/pages/RoutineEditorPage'
import type { HabitChainInfo } from '@/data/types'

const {
  useHabitCatalog, useHabitCatalogActions, useProgressionProfile,
  reorderChain, updateChain, updateDef,
} = vi.hoisted(() => ({
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
  useProgressionProfile: vi.fn(),
  reorderChain: vi.fn(() => Promise.resolve()),
  updateChain: vi.fn(() => Promise.resolve()),
  updateDef: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/hooks', () => ({
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
  useProgressionProfile: () => useProgressionProfile(),
}))

function def(habitKey: string, chainKey: string, position: number): HabitChainInfo['defs'][number] {
  return {
    id: `def-${habitKey}`, habitKey, chainKey, position, title: habitKey, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
  }
}

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
  position: 1, isActive: true,
  defs: Array.from({ length: 9 }, (_, i) => def(`m${i + 1}`, 'MORNING', i + 1)),
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING',
  position: 2, isActive: true,
  defs: Array.from({ length: 6 }, (_, i) => def(`e${i + 1}`, 'EVENING', i + 1)),
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/me/routines/edit']}>
      <Routes>
        <Route path="/me/routines/edit" element={<RoutineEditorPage />} />
        <Route path="/me/growth" element={<div data-testid="growth-probe" />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  reorderChain.mockClear(); updateChain.mockClear(); updateDef.mockClear()
  useHabitCatalog.mockReturnValue({ catalog: { chains: [MORNING, EVENING] }, isPending: false })
  useHabitCatalogActions.mockReturnValue({
    createChain: vi.fn(() => Promise.resolve()),
    updateChain, deleteChain: vi.fn(() => Promise.resolve()),
    reorderChain,
    createDef: vi.fn(() => Promise.resolve()), updateDef, deleteDef: vi.fn(() => Promise.resolve()),
    pending: false,
  })
  useProgressionProfile.mockReturnValue({ data: { life: [] } })
})

describe('RoutineEditorPage', () => {
  it('renders the seed catalog — 2 chains, 9+6 rows', () => {
    const { container } = renderPage()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-sortable-row]')).toHaveLength(15)
  })

  it('has a back link to /me/growth', () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: /vissza/i }))
    expect(screen.getByTestId('growth-probe')).toBeInTheDocument()
  })

  it('reorder calls reorderChain with the chain id + the new def id list', () => {
    renderPage()
    const firstRow = screen.getByText('m1').closest('[data-sortable-row]') as HTMLElement
    fireEvent.click(within(firstRow).getByRole('button', { name: /lejjebb/i }))
    expect(reorderChain).toHaveBeenCalledWith(
      'chain-morning',
      ['def-m2', 'def-m1', 'def-m3', 'def-m4', 'def-m5', 'def-m6', 'def-m7', 'def-m8', 'def-m9'],
    )
  })

  it('add-habit opens the create sheet for that chain', () => {
    renderPage()
    const addButtons = screen.getAllByRole('button', { name: /új habit/i })
    fireEvent.click(addButtons[0])
    expect(screen.getByRole('heading', { name: 'Új habit' })).toBeInTheDocument()
  })

  it('+ Új rutin opens the chain create sheet', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /új rutin/i }))
    expect(screen.getByRole('heading', { name: 'Új rutin' })).toBeInTheDocument()
  })

  it('shows a ghost state while pending with an empty catalog', () => {
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: true })
    renderPage()
    expect(screen.queryByText('Reggeli rutin')).not.toBeInTheDocument()
    expect(screen.getByText(/rutinok betöltése/i)).toBeInTheDocument()
  })

  it('an inactive chain renders dimmed but its rows stay tappable', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, isActive: false }, EVENING] }, isPending: false,
    })
    const { container } = renderPage()
    const card = screen.getByText('Reggeli rutin').closest('.card')
    expect(card).toHaveClass('is-inert')
    expect(container.querySelectorAll('[data-sortable-row]')).toHaveLength(15)
  })
})
