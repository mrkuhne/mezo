import { QueryWrapper } from '@/test/queryWrapper'
import type { ReactNode } from 'react'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { CharacterReplyThread } from '@/features/character/components/CharacterReplyThread'
import { MOCK_EXPERTS } from '@/data/character/characterMock'
const state = vi.hoisted(() => ({ send: vi.fn(), retry: vi.fn(), replies: [] as object[] }))
vi.mock('@/data/hooks', async (original) => ({
  ...(await original<object>()),
  useCharacterReplies: () => ({ ...state, pending: false, isLoading: false, isError: false }),
  useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
}))
const render = (ui: ReactNode) => rtlRender(<QueryWrapper>{ui}</QueryWrapper>)
const source = { sourceType: 'OBSERVATION' as const, sourceId: 'post-1', sourceIndex: 0 }
beforeEach(() => {
  state.send.mockReset()
  state.replies = []
})
test('failed save retains the draft and repeats the same idempotency key', async () => {
  state.send.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({})
  render(<CharacterReplyThread source={source} initialOpen />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Már nem szedem.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('textbox')).toHaveValue('Már nem szedem.')
  fireEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await waitFor(() => expect(state.send).toHaveBeenCalledTimes(2))
  expect(state.send.mock.calls[0]).toEqual(state.send.mock.calls[1])
})
test('failed processing shows the saved reply and a retry instead of success', () => {
  state.replies = [
    { id: 'r1', text: 'Válaszom', createdAt: '2026-09-20T10:00:00Z', status: 'FAILED', authorName: 'Te' },
  ]
  render(<CharacterReplyThread source={source} />)
  expect(screen.getByText('Válaszom')).toBeInTheDocument()
  expect(screen.getByText(/A válaszod mentve/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Feldolgozás újra' }))
  expect(state.retry).toHaveBeenCalledWith('r1')
  expect(screen.queryByText('Közösen pontosítva')).not.toBeInTheDocument()
})
test('stored experts respond after the user and before Mezo, with the recorded recipient', () => {
  state.replies = [{ id: 'r1', text: 'Már reggel fáradt voltam.', authorName: 'Te', createdAt: '2026-09-21T07:00:00Z', status: 'COMPLETED', outcome: 'UNCHANGED', outcomeText: 'Még megfigyeljük.', discussion: [
    { expertKey: 'szomnologus', argument: 'A reggeli tapasztalatod fontos.', stance: 'SUPPORT', round: 1, replyToExpert: 'user' },
    { expertKey: 'edzo', argument: 'A terhelést is nézzük hozzá.', stance: 'NUANCE', round: 2, replyToExpert: 'szomnologus' },
  ] }]
  render(<CharacterReplyThread source={source} />)
  const user = screen.getByText('Már reggel fáradt voltam.')
  const expert = screen.getByText('A reggeli tapasztalatod fontos.')
  const chair = screen.getByText('Még megfigyeljük.')
  expect(user.compareDocumentPosition(expert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(expert.compareDocumentPosition(chair) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText(/Válasz neked/)).toBeInTheDocument()
  // U9: the replied-to expert is named as the csapatfal character (Szomnológus → Szunya)
  expect(screen.getByText(/Válasz: Szunya/)).toBeInTheDocument()
  expect(screen.queryByText('Közösen pontosítva')).not.toBeInTheDocument()
})
