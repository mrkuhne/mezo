import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { CharacterRevisionSheet } from '@/features/character/sheets/CharacterRevisionSheet'
import type { CharacterClaimRevisionDto } from '@/data/character/characterApi'
import { ApiError } from '@/data/_client/api'
const state = vi.hoisted(() => ({ revisions: [] as CharacterClaimRevisionDto[], undo: vi.fn(), refetch: vi.fn() }))
vi.mock('@/data/hooks', () => ({ useCharacterClaimRevisions: () => ({ ...state, isLoading: false, isError: false, pending: false }), useCharacterOverview: () => ({ overview: { dimensions: [{ key: 'sleep', title: 'Alvás' }, { key: 'training', title: 'Edzés' }] } }) }))
beforeEach(() => {
  state.undo.mockReset()
  state.revisions = [{ id: 'r1', claimId: 'c1', operation: 'UPDATE', beforeText: 'Korábbi értelmezés', afterText: 'Pontosabb értelmezés', reason: 'A teljes időablakot összevetettük.', canUndo: true, createdAt: '2026-09-21T06:00:00Z' }]
})
test('shows actual before/after and undoes only a revision the server permits', async () => {
  render(<CharacterRevisionSheet claimId="c1" onClose={vi.fn()} />)
  expect(screen.getByRole('dialog', { name: 'Mi változott?' })).toHaveClass('gl-card')
  expect(screen.getByText('Korábbi értelmezés')).toBeInTheDocument()
  expect(screen.getByText('Pontosabb értelmezés')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Visszavonom a változást' }))
  await waitFor(() => expect(state.undo).toHaveBeenCalledWith('r1'))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('visszavontuk'))
})
test('a newer revision conflict is visible and does not claim successful undo', async () => {
  state.undo.mockRejectedValue(new ApiError([{ code: 'CHARACTER_REVISION_CONFLICT', message: 'Conflict' }], 400))
  render(<CharacterRevisionSheet claimId="c1" onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Visszavonom a változást' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Időközben megváltozott'))
  expect(screen.queryByText(/visszavontuk/)).not.toBeInTheDocument()
})
test('historic or undone revisions have no undo action', () => {
  state.revisions[0].canUndo = false
  render(<CharacterRevisionSheet claimId="c1" onClose={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Visszavonom a változást' })).not.toBeInTheDocument()
})
test('equal text still explains actual confidence, withdrawal, chapter and period changes', () => {
  Object.assign(state.revisions[0], {
    beforeText: 'Ugyanaz a megállapítás', afterText: 'Ugyanaz a megállapítás',
    beforeConfidence: .8, afterConfidence: .6, beforeStatus: 'ACTIVE', afterStatus: 'RETIRED',
    beforeDimensionKey: 'sleep', afterDimensionKey: 'training',
    beforeObservedFrom: '2026-09-01', beforeObservedTo: '2026-09-07', afterObservedFrom: '2026-09-01', afterObservedTo: '2026-09-14',
  })
  render(<CharacterRevisionSheet claimId="c1" onClose={vi.fn()} />)
  expect(screen.getByText(/biztos → valószínű/)).toBeInTheDocument()
  expect(screen.getByText(/Aktív → Visszavont/)).toBeInTheDocument()
  expect(screen.getByText(/Alvás → Edzés/)).toBeInTheDocument()
  expect(screen.getByText(/2026. 09. 07.*2026. 09. 14/)).toBeInTheDocument()
})
