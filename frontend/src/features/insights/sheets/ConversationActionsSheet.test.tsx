import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConversationActionsSheet } from '@/features/insights/sheets/ConversationActionsSheet'
import { makeHookWrapper } from '@/test/queryWrapper'

const acts = vi.hoisted(() => ({ rename: vi.fn(), remove: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useConversationActions: () => acts,
}))

const conversation = {
  id: 'c-1', title: 'nézd meg kérlek a súlyomat', startedAt: '2026-08-31T10:00:00Z', lastMessageAt: null,
}

function renderSheet(over: Partial<Parameters<typeof ConversationActionsSheet>[0]> = {}) {
  const Wrapper = makeHookWrapper()
  return render(
    <Wrapper>
      <ConversationActionsSheet conversation={conversation} onClose={() => {}} {...over} />
    </Wrapper>,
  )
}

describe('ConversationActionsSheet (F7.5)', () => {
  afterEach(() => vi.clearAllMocks())

  test('rename: input prefilled with the title, Mentés fires rename with the trimmed value', async () => {
    acts.rename.mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderSheet({ onClose })

    fireEvent.click(screen.getByRole('button', { name: /Átnevezés/ }))
    const input = screen.getByRole('textbox', { name: 'A beszélgetés címe' })
    expect(input).toHaveValue('nézd meg kérlek a súlyomat')
    fireEvent.change(input, { target: { value: '  Súly-plató nyomozás  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))

    await waitFor(() => expect(acts.rename).toHaveBeenCalledWith('c-1', 'Súly-plató nyomozás'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('delete needs two steps and the confirm copy is warm, not punishing', async () => {
    acts.remove.mockResolvedValue(undefined)
    const onDeleted = vi.fn()
    renderSheet({ onDeleted })

    fireEvent.click(screen.getByRole('button', { name: /^Törlés/ }))
    expect(acts.remove).not.toHaveBeenCalled()
    expect(screen.getByText(/a belőlük tanult emlékeket ez nem érinti/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Törlöm' }))
    await waitFor(() => expect(acts.remove).toHaveBeenCalledWith('c-1'))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  })

  test('Mégse on the confirm returns to the action rows without deleting', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /^Törlés/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mégse' }))
    expect(acts.remove).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Átnevezés/ })).toBeInTheDocument()
  })
})
