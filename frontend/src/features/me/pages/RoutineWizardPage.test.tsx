import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutineWizardPage } from '@/features/me/pages/RoutineWizardPage'
import type { HabitChainInfo } from '@/data/types'

const { useHabitCatalog, useHabitCatalogActions, createDef, navigate } = vi.hoisted(() => ({
  useHabitCatalog: vi.fn(), useHabitCatalogActions: vi.fn(),
  createDef: vi.fn(() => Promise.resolve()), navigate: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
  useProgressionProfile: () => ({ data: { life: [] } }),
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const MORNING: HabitChainInfo = {
  id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
  position: 1, isActive: true,
  defs: [{
    id: 'd1', habitKey: 'sun', chainKey: 'MORNING', position: 1, title: 'Reggeli fény',
    why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
    xp: 5, linkUrl: null, isActive: true, framework: null, anchorHabitKey: null,
    cue: null, craving: null, reward: null, celebration: null, identity: null,
  }],
}

beforeEach(() => {
  useHabitCatalog.mockReturnValue({ catalog: { chains: [MORNING] }, isPending: false, isError: false, refetch: vi.fn() })
  useHabitCatalogActions.mockReturnValue({ createDef, pending: false })
  createDef.mockClear()
  navigate.mockClear()
})

const renderWizard = () => render(<MemoryRouter><RoutineWizardPage /></MemoryRouter>)
const next = () => screen.getByRole('button', { name: /Tovább|Mentés/ })

describe('RoutineWizardPage', () => {
  it('blocks step 1 until a framework is chosen', () => {
    renderWizard()
    expect(next()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    expect(next()).toBeEnabled()
  })

  it('assembles the Fogg sentence as the blanks fill and saves the recipe', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())

    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    expect(screen.getByTestId('recipe-sentence')).toHaveTextContent('Miután kész a Reggeli fény')
    fireEvent.click(next())

    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())

    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    expect(next()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    expect(next()).toBeEnabled()
    fireEvent.click(next())

    expect(createDef).toHaveBeenCalledWith(expect.objectContaining({
      chainKey: 'MORNING', title: 'leírok egy mondatot', mode: 'MANUAL',
      framework: 'FOGG', anchorHabitKey: 'sun', celebration: 'ökölrázás',
    }))
  })

  it('requires craving on the Clear branch before leaving step 3', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Jelzés'), { target: { value: '7:10-kor a konyhában' } })
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Válasz'), { target: { value: 'leírom a szándékot' } })
    expect(next()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: 'tisztább a fejem' } })
    expect(next()).toBeEnabled()
  })

  it('warns softly when the Fogg behaviour looks too big, without blocking', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), {
      target: { value: 'lefutok tizenöt kilométert a hegyen minden egyes reggel' },
    })
    expect(screen.getByText(/nagynak hangzik/)).toBeInTheDocument()
    expect(next()).toBeEnabled()
  })
})
