import { render, screen, fireEvent } from '@testing-library/react'
import { ChatMessage } from '@/features/insights/components/ChatMessage'
import type { ChatMessage as ChatMessageT } from '@/data/types'

// mezo-8z79: the blank-answer rendering contract. The backend can no longer PERSIST a blank
// answer, but rows written before that guard are still in history, and an in-flight streamed
// answer is legitimately blank while its tool chips run — the two must not look the same.
describe('ChatMessage (blank assistant answer)', () => {
  it('names the missing answer on a persisted blank row', () => {
    render(<ChatMessage m={{ id: 'm-1', role: 'assistant', ts: '10:43', text: '' }} />)
    expect(screen.getByText('Erre a körre nem érkezett válasz.')).toBeInTheDocument()
  })

  it('stays silent for the in-flight streaming bubble, which has no persisted id', () => {
    render(<ChatMessage m={{ role: 'assistant', ts: 'most', text: '' }} />)
    expect(screen.queryByText('Erre a körre nem érkezett válasz.')).not.toBeInTheDocument()
  })

  it('renders the prose when there IS an answer', () => {
    render(<ChatMessage m={{ id: 'm-2', role: 'assistant', ts: '10:43', text: 'Szia!' }} />)
    expect(screen.getByText('Szia!')).toBeInTheDocument()
    expect(screen.queryByText('Erre a körre nem érkezett válasz.')).not.toBeInTheDocument()
  })
})

describe('ChatMessage (grouped refs, mezo-vdf4)', () => {
  const manyRefs: ChatMessageT = {
    id: 'm-g1', role: 'assistant', ts: '11:25', text: 'Válasz.',
    refs: [
      { kind: 'Sleep', id: 'sleep-2026-08-25' },
      { kind: 'Sleep', id: 'sleep-2026-08-26' },
      { kind: 'Sleep', id: 'sleep-2026-08-27' },
      { kind: 'Workout', id: 'w-2026-08-26' },
    ],
  }

  it('more than 3 refs: one group chip per kind with a count, no full chips yet', () => {
    render(<ChatMessage m={manyRefs} />)
    expect(screen.getByRole('button', { name: /Alvás.*×3/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Edzés.*×1/ })).toBeInTheDocument()
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(0)
  })

  it('tapping a group expands ONLY that group into full chips', () => {
    render(<ChatMessage m={manyRefs} />)
    fireEvent.click(screen.getByRole('button', { name: /Alvás.*×3/ }))
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(3)
    expect(screen.getByText('aug. 25.')).toBeInTheDocument()
    // opening the other group closes the first
    fireEvent.click(screen.getByRole('button', { name: /Edzés.*×1/ }))
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(1)
    expect(screen.getByText('aug. 26.')).toBeInTheDocument()
  })

  it('3 or fewer refs render as full chips immediately, no group buttons', () => {
    render(
      <ChatMessage
        m={{ id: 'm-g2', role: 'assistant', ts: '11:25', text: 'V.', refs: [
          { kind: 'Pattern', id: 'p-x', label: 'gyógyszer × étvágy' },
          { kind: 'Sleep', id: 'sleep-2026-08-25' },
        ] }}
      />,
    )
    expect(document.querySelectorAll('.mzc-refg')).toHaveLength(0)
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(2)
  })
})
