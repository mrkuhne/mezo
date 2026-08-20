import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { JournalNote } from '@/data/journal/journalTypes'

const acts = vi.hoisted(() => ({ useJournalActions: vi.fn(), useDecisionActions: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useJournalActions: acts.useJournalActions,
  useDecisionActions: acts.useDecisionActions,
}))

function note(over: Partial<JournalNote> = {}): JournalNote {
  return {
    id: 'jn-1', occurredOn: '2026-08-10', text: 'Fáradt vagyok, de motivált',
    source: 'quickinput', createdAt: '2026-08-10T08:00:00.000Z', ...over,
  }
}

function renderSheet(props: Partial<Parameters<typeof JournalSheet>[0]> = {}) {
  const Wrapper = makeHookWrapper()
  return render(
    <Wrapper>
      <JournalSheet onClose={() => {}} {...props} />
    </Wrapper>,
  )
}

describe('JournalSheet', () => {
  const addNote = vi.fn()
  const updateNote = vi.fn()
  const removeNote = vi.fn()
  const addDecision = vi.fn()
  const reviewDecision = vi.fn()
  beforeEach(() => {
    acts.useJournalActions.mockReturnValue({ addNote, updateNote, removeNote, pending: false })
    acts.useDecisionActions.mockReturnValue({ addDecision, reviewDecision, pending: false })
  })
  afterEach(() => vi.clearAllMocks())

  test('create mode: title + typing text and hitting Mentem calls addNote and closes', async () => {
    addNote.mockResolvedValue(note())
    const onClose = vi.fn()
    renderSheet({ onClose })
    expect(screen.getByText('Mi jár a fejedben?')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Írd le, mi jár a fejedben…'), { target: { value: 'Ma jó napom volt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentem' }))

    await waitFor(() => expect(addNote).toHaveBeenCalledWith('Ma jó napom volt', expect.any(String)))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateNote).not.toHaveBeenCalled()
  })

  test('Mentem stays disabled with empty text', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Mentem' })).toBeDisabled()
  })

  test('edit mode: entry prop prefills text + date, and Mentem calls updateNote', async () => {
    updateNote.mockResolvedValue(note({ text: 'Frissített szöveg' }))
    const onClose = vi.fn()
    renderSheet({ onClose, entry: note() })

    expect(screen.getByText('Bejegyzés szerkesztése')).toBeInTheDocument()
    const textarea = screen.getByPlaceholderText('Írd le, mi jár a fejedben…') as HTMLTextAreaElement
    expect(textarea.value).toBe('Fáradt vagyok, de motivált')
    expect(screen.getByLabelText('Dátum')).toHaveValue('2026-08-10')

    fireEvent.change(textarea, { target: { value: 'Frissített szöveg' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentem' }))

    await waitFor(() => expect(updateNote).toHaveBeenCalledWith('jn-1', 'Frissített szöveg', '2026-08-10'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(addNote).not.toHaveBeenCalled()
  })

  test('create mode shows no delete control', () => {
    renderSheet()
    expect(screen.queryByRole('button', { name: 'Törlés' })).not.toBeInTheDocument()
  })

  test('edit mode delete needs a second confirm tap before removeNote fires', async () => {
    removeNote.mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderSheet({ onClose, entry: note() })

    fireEvent.click(screen.getByRole('button', { name: 'Törlés' }))
    expect(removeNote).not.toHaveBeenCalled()
    const confirmButton = screen.getByRole('button', { name: 'Biztosan törlöd?' })
    expect(confirmButton).toBeInTheDocument()

    fireEvent.click(confirmButton)
    await waitFor(() => expect(removeNote).toHaveBeenCalledWith('jn-1'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('offers a Döntés mode in create mode and saves through the decision hook', async () => {
    addDecision.mockResolvedValue({ id: 'dec-1' })
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSheet({ onClose })

    await user.click(screen.getByRole('button', { name: 'Döntés' }))
    expect(screen.getByText(/visszanézzük/i)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /Döntés/i }), 'Esti edzésre váltok.')
    await user.click(screen.getByRole('button', { name: 'Mentem' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(addDecision).toHaveBeenCalledWith('Esti edzésre váltok.', expect.any(String))
    expect(addNote).not.toHaveBeenCalled()
  })

  test('hides the mode toggle when editing an existing note', () => {
    renderSheet({ entry: note({ id: 'jn1', occurredOn: '2026-08-15', text: 'Régi.' }) })

    expect(screen.queryByRole('button', { name: 'Döntés' })).not.toBeInTheDocument()
  })
})
