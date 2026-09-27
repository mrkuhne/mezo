import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TeamChatThread } from '@/data/character/teamChatApi'
import { TypingRow, CloseTag, RememberedChip } from './ReplyAfterlife'

const baseThread: TeamChatThread = {
  id: 'tc-thread-x',
  flagKey: 'late_eating',
  ruleLabel: 'Késői étkezés',
  owner: 'falat',
  guest: null,
  status: 'RESOLVED',
  openedAt: '2026-09-27T17:50:00Z',
  closedAt: '2026-09-27T21:52:00Z',
  pushed: false,
  actions: [],
  applied: null,
  closeReason: 'REPLY',
  closeNote: 'meccsnap',
  offer: null,
  offerTag: null,
  remembered: null,
}

describe('TypingRow', () => {
  it('shows the typing row while an answer is awaited', () => {
    render(<TypingRow character="falat" />)
    expect(screen.getByRole('status')).toHaveTextContent('Falat ír…')
  })
})

describe('CloseTag', () => {
  it('renders the REPLY close reason as "{Name} lezárta: {closeNote}" with the csendben pill', () => {
    render(<CloseTag thread={baseThread} />)
    expect(screen.getByText('Falat lezárta: meccsnap')).toBeInTheDocument()
    expect(screen.getByText('csendben')).toBeInTheDocument()
  })

  it('renders the EXCUSED close reason as "Kivétel: {closeNote}"', () => {
    render(<CloseTag thread={{ ...baseThread, closeReason: 'EXCUSED', closeNote: 'meccsnap' }} />)
    expect(screen.getByText('Kivétel: meccsnap')).toBeInTheDocument()
    expect(screen.getByText('csendben')).toBeInTheDocument()
  })

  it('renders nothing without a closeReason', () => {
    const { container } = render(<CloseTag thread={{ ...baseThread, closeReason: null }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RememberedChip', () => {
  const resolvedThread: TeamChatThread = {
    ...baseThread,
    remembered: { text: 'Meccsnapokon későn eszel — ez rendben van.', contextTag: 'meccsnap', active: true },
  }

  it('renders the close tag and the remembered chip, and undo calls back', async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined)
    render(<RememberedChip thread={resolvedThread} onUndo={onUndo} />)
    expect(screen.getByText(/Megjegyeztem:/)).toBeInTheDocument()
    expect(screen.getByText('Meccsnapokon későn eszel — ez rendben van.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    expect(onUndo).toHaveBeenCalledWith(resolvedThread.id)
  })

  it('shows nothing while remembered is null', () => {
    const { container } = render(<RememberedChip thread={baseThread} onUndo={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing while remembered.active is true after render but hides once inactive, showing the undone line instead', () => {
    const undone: TeamChatThread = { ...resolvedThread, remembered: { ...resolvedThread.remembered!, active: false } }
    render(<RememberedChip thread={undone} onUndo={vi.fn()} />)
    expect(screen.queryByText(/Megjegyeztem:/)).not.toBeInTheDocument()
    expect(screen.getByText('Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.')).toBeInTheDocument()
  })

  it('shows an error and keeps the chip when undo fails', async () => {
    const onUndo = vi.fn().mockRejectedValue(new Error('nope'))
    render(<RememberedChip thread={resolvedThread} onUndo={onUndo} />)
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    expect(await screen.findByText('Nem sikerült visszavonni — próbáld újra.')).toBeInTheDocument()
    expect(screen.getByText(/Megjegyeztem:/)).toBeInTheDocument()
  })
})
