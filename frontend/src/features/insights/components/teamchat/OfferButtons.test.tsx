import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TeamChatThread } from '@/data/character/teamChatApi'
import { OfferButtons } from './OfferButtons'

const baseThread: TeamChatThread = {
  id: 'tc-thread-late-eating',
  flagKey: 'late_eating',
  ruleLabel: 'Késői étkezés',
  owner: 'falat',
  guest: null,
  status: 'OPEN',
  openedAt: '2026-09-27T17:50:00Z',
  closedAt: null,
  pushed: false,
  actions: [],
  applied: null,
  closeReason: null,
  closeNote: null,
  offer: 'EXCUSE',
  offerTag: 'meccsnap',
  remembered: null,
}

describe('OfferButtons', () => {
  it('excuse offer shows one tap with the tag', () => {
    render(<OfferButtons thread={baseThread} onAnswer={vi.fn()} busy={false} />)
    expect(screen.getByRole('button', { name: 'Igen, meccsnap volt' })).toBeInTheDocument()
  })

  it('review offer shows two taps: Rendben van (KEEP) and Nem, figyelj rá (STOP)', () => {
    render(<OfferButtons thread={{ ...baseThread, offer: 'REVIEW' }} onAnswer={vi.fn()} busy={false} />)
    expect(screen.getByRole('button', { name: 'Rendben van' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nem, figyelj rá' })).toBeInTheDocument()
  })

  it('excuse tap calls onAnswer with EXCUSED', async () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined)
    render(<OfferButtons thread={baseThread} onAnswer={onAnswer} busy={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Igen, meccsnap volt' }))
    expect(onAnswer).toHaveBeenCalledWith(baseThread.id, 'EXCUSED')
  })

  it('review taps call onAnswer with KEEP / STOP', async () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined)
    render(<OfferButtons thread={{ ...baseThread, offer: 'REVIEW' }} onAnswer={onAnswer} busy={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rendben van' }))
    expect(onAnswer).toHaveBeenCalledWith(baseThread.id, 'KEEP')
    await userEvent.click(screen.getByRole('button', { name: 'Nem, figyelj rá' }))
    expect(onAnswer).toHaveBeenCalledWith(baseThread.id, 'STOP')
  })

  it('disables buttons while busy', () => {
    render(<OfferButtons thread={baseThread} onAnswer={vi.fn()} busy />)
    expect(screen.getByRole('button', { name: 'Igen, meccsnap volt' })).toBeDisabled()
  })

  it('never renders offer buttons on a closed ügy', () => {
    const { container } = render(<OfferButtons thread={{ ...baseThread, status: 'RESOLVED', offer: null }} onAnswer={vi.fn()} busy={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('never renders without an offer', () => {
    const { container } = render(<OfferButtons thread={{ ...baseThread, offer: null }} onAnswer={vi.fn()} busy={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an error line on failure', async () => {
    const onAnswer = vi.fn().mockRejectedValue(new Error('nope'))
    render(<OfferButtons thread={baseThread} onAnswer={onAnswer} busy={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Igen, meccsnap volt' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült beállítani')
  })
})
