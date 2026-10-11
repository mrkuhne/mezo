import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { LoadTile } from '@/features/train/components/LoadTile'

describe('LoadTile', () => {
  test('renders the title and the headline number with its unit', () => {
    render(<LoadTile title="Heti terhelés · izmonként" value={46} unit="szett · 1. hét" onOpen={vi.fn()} />)
    expect(screen.getByText('Heti terhelés · izmonként')).toBeInTheDocument()
    expect(screen.getByText('46 szett · 1. hét')).toBeInTheDocument()
  })

  test('opens on click', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<LoadTile title="Heti terhelés" value={46} unit="szett · 1. hét" onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: /Heti terhelés/ }))
    expect(onOpen).toHaveBeenCalled()
  })

  // Folyadék (mezo-n4wf5.3): the amber dot became a worded pill that counts the lints.
  test('a flagged row counts its lints in an amber pill; an unflagged one has none', () => {
    const { unmount } = render(<LoadTile title="Heti terhelés" value={46} unit="szett" flags={2} onOpen={vi.fn()} />)
    expect(screen.getByText('2 jelzés')).toHaveClass('fo-st', 'warn')
    unmount()
    render(<LoadTile title="Heti terhelés" value={46} unit="szett" onOpen={vi.fn()} />)
    expect(screen.queryByText(/jelzés/)).not.toBeInTheDocument()
  })
})
