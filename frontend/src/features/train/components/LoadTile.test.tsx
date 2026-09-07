import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { LoadTile } from '@/features/train/components/LoadTile'

const GAUGES = [
  { label: 'Hát', value: 7, max: 8, color: 'var(--tag-gym)', warn: true },
  { label: 'Váll', value: 4, max: 8, color: 'var(--lav-deep)' },
]

describe('LoadTile', () => {
  test('renders the headline number, unit and one gauge per muscle', () => {
    render(<LoadTile tone="day" eyebrow="Napi terhelés · Hét" value={13} unit="szett · ~57′" gauges={GAUGES} onOpen={vi.fn()} />)
    expect(screen.getByText('Napi terhelés · Hét')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('szett · ~57′')).toBeInTheDocument()
    expect(screen.getByText('Hát')).toBeInTheDocument()
    expect(screen.getByText('Váll')).toBeInTheDocument()
  })

  test('opens on click', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<LoadTile tone="week" eyebrow="Heti terhelés" value={46} unit="szett · W1" gauges={GAUGES} onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: /Heti terhelés/ }))
    expect(onOpen).toHaveBeenCalled()
  })

  test('a flagged tile carries an amber dot', () => {
    const { container } = render(
      <LoadTile tone="week" eyebrow="Heti terhelés" value={46} unit="szett" gauges={GAUGES} flagged onOpen={vi.fn()} />,
    )
    expect(container.querySelector('.mz-lt-dot')).toBeInTheDocument()
  })
})
