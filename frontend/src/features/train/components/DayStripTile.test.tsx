import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DayStripTile } from '@/features/train/components/DayStripTile'

const MUSCLES = [
  { label: 'Hát', sets: 7, color: 'var(--tag-gym)' },
  { label: 'Váll', sets: 3, color: 'var(--lav-deep)' },
]

describe('DayStripTile', () => {
  // mezo-yty6 final review, I5: the eyebrow used to be `${day} · ${type}` while the heading
  // rendered `name` — and MesoWeekEditor fed BOTH from `day.type` (MesoDay has no name
  // field), so every tile printed the same string twice. Weekday and name, once each.
  test('shows the weekday and the day name once each, plus the set/minute meta', () => {
    render(<DayStripTile day="Hét" name="Upper" sets={13} minutes={57} muscles={MUSCLES} tone="coral" onOpen={vi.fn()} />)
    expect(screen.getByText('Hét')).toBeInTheDocument()
    expect(screen.getAllByText('Upper')).toHaveLength(1)
    expect(screen.getByText('13 szett · ~57′')).toBeInTheDocument()
  })

  test('opens the day on click, named for screen readers', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<DayStripTile day="Hét" name="Upper" sets={13} minutes={57} muscles={MUSCLES} tone="coral" onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: 'Hét · Upper · szerkesztés' }))
    expect(onOpen).toHaveBeenCalled()
  })

  test('a flagged day carries an amber dot', () => {
    const { container } = render(
      <DayStripTile day="Kedd" name="Push" sets={9} minutes={40} muscles={MUSCLES} tone="rose" flagged onOpen={vi.fn()} />,
    )
    expect(container.querySelector('.mz-dst-dot')).toBeInTheDocument()
  })

  test('the muscle rail is proportional to the sets', () => {
    const { container } = render(
      <DayStripTile day="Hét" name="Upper" sets={10} minutes={44} muscles={MUSCLES} tone="coral" onOpen={vi.fn()} />,
    )
    const rails = container.querySelectorAll('.mz-dst-rail i')
    expect(rails).toHaveLength(2)
    expect((rails[0] as HTMLElement).style.flexGrow).toBe('7')
    expect((rails[1] as HTMLElement).style.flexGrow).toBe('3')
  })
})
