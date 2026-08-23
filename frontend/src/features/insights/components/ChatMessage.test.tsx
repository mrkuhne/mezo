import { render, screen } from '@testing-library/react'
import { ChatMessage } from '@/features/insights/components/ChatMessage'

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
