import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GratitudeStreakCard } from './GratitudeStreakCard'

const { useGratitudeEntries } = vi.hoisted(() => ({ useGratitudeEntries: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({ ...(await importOriginal<object>()), useGratitudeEntries }))

describe('GratitudeStreakCard', () => {
  it('renders the derived streak', () => {
    useGratitudeEntries.mockReturnValue({ data: [{ id: '1', occurredOn: '2026-08-21', text: 'a', lifeArea: null, createdAt: '' },
      { id: '2', occurredOn: '2026-08-20', text: 'b', lifeArea: 'cooking', createdAt: '' }], isPending: false, isError: false, refetch: vi.fn() })
    render(<GratitudeStreakCard from="2026-05-21" to="2026-08-21" todayIso="2026-08-21" />)
    expect(screen.getByText(/2 napos sorozat/)).toBeInTheDocument()
  })
  it('renders the ghost copy when there are no entries', () => {
    useGratitudeEntries.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
    render(<GratitudeStreakCard from="2026-05-21" to="2026-08-21" todayIso="2026-08-21" />)
    expect(screen.getByText(/Még nincs hálabejegyzés/)).toBeInTheDocument()
  })
})
