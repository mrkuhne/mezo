import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProfileNodeCard } from './ProfileNodeCard'

const node = {
  id: 'gn-profile',
  kind: 'INSIGHT' as const,
  title: 'Rólad tanultam',
  summary: 'A rövid, konkrét reggeli üzenet válik be nálad.',
  sourceKind: 'profile',
  topEdges: [],
  updatedAt: '2026-08-20T10:00:00.000Z',
}

describe('ProfileNodeCard', () => {
  it('shows the learned prose read-only', () => {
    render(<ProfileNodeCard node={node} onArchive={() => {}} />)

    expect(screen.getByText(/A rövid, konkrét reggeli üzenet/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('archives on demand and says what archiving does', async () => {
    const onArchive = vi.fn()
    render(<ProfileNodeCard node={node} onArchive={onArchive} />)

    await userEvent.click(screen.getByRole('button', { name: 'Archivál' }))

    expect(onArchive).toHaveBeenCalledOnce()
    expect(screen.getByText(/következő heti/i)).toBeInTheDocument()
  })
})
