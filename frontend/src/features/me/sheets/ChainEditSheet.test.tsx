import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChainEditSheet } from '@/features/me/sheets/ChainEditSheet'
import type { HabitChainInfo } from '@/data/types'

const { createChain, updateChain, deleteChain, useHabitCatalogActions } = vi.hoisted(() => ({
  createChain: vi.fn(() => Promise.resolve()),
  updateChain: vi.fn(() => Promise.resolve()),
  deleteChain: vi.fn(() => Promise.resolve()),
  useHabitCatalogActions: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({ useHabitCatalogActions: () => useHabitCatalogActions() }))

const CUSTOM_EMPTY: HabitChainInfo = {
  id: 'chain-custom', chainKey: 'chain_custom1', title: 'Déli szünet', daypart: 'DAY',
  position: 3, isActive: true, defs: [],
}
const CUSTOM_NONEMPTY: HabitChainInfo = {
  ...CUSTOM_EMPTY, id: 'chain-custom2', chainKey: 'chain_custom2',
  defs: [{
    id: 'def-1', habitKey: 'x', chainKey: 'chain_custom2', position: 1, title: 'X', why: null,
    anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework: null, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
  }],
}
const SEED: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
  position: 1, isActive: true, defs: [],
}

beforeEach(() => {
  createChain.mockClear(); updateChain.mockClear(); deleteChain.mockClear()
  useHabitCatalogActions.mockReturnValue({ createChain, updateChain, deleteChain, pending: false })
})

describe('ChainEditSheet — create', () => {
  it('creates a chain with the typed title + selected daypart', () => {
    const onClose = vi.fn()
    render(<ChainEditSheet onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Rutin neve'), { target: { value: 'Déli szünet' } })
    fireEvent.click(screen.getByRole('button', { name: /napközben/i }))
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))
    expect(createChain).toHaveBeenCalledWith({ title: 'Déli szünet', daypart: 'DAY' })
  })

  it('has no delete affordance while creating (nothing exists yet to delete)', () => {
    render(<ChainEditSheet onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /törlése/i })).not.toBeInTheDocument()
  })
})

describe('ChainEditSheet — edit', () => {
  it('pre-fills title + daypart and calls updateChain with the changed fields', () => {
    render(<ChainEditSheet chain={CUSTOM_EMPTY} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Rutin neve')).toHaveValue('Déli szünet')
    fireEvent.change(screen.getByLabelText('Rutin neve'), { target: { value: 'Ebéd utáni pihi' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))
    expect(updateChain).toHaveBeenCalledWith('chain-custom', { title: 'Ebéd utáni pihi', daypart: 'DAY' })
  })

  it('an empty custom chain offers delete, and it calls deleteChain', () => {
    render(<ChainEditSheet chain={CUSTOM_EMPTY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /törlése/i }))
    expect(deleteChain).toHaveBeenCalledWith('chain-custom')
  })

  it('a non-empty custom chain has no delete button, just an explainer', () => {
    render(<ChainEditSheet chain={CUSTOM_NONEMPTY} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /törlése/i })).not.toBeInTheDocument()
    expect(screen.getByText(/csak üres rutin törölhető/i)).toBeInTheDocument()
  })

  it('a seed chain (MORNING/EVENING) has no delete button, just an explainer', () => {
    render(<ChainEditSheet chain={SEED} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /törlése/i })).not.toBeInTheDocument()
    expect(screen.getByText(/alap rutinok nem törölhetők/i)).toBeInTheDocument()
  })
})
