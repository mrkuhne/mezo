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
    render(<DayStripTile day="Hét" name="Upper" sets={13} minutes={57} muscles={MUSCLES} onOpen={vi.fn()} />)
    expect(screen.getByText('Hét')).toBeInTheDocument()
    expect(screen.getAllByText('Upper')).toHaveLength(1)
    expect(screen.getByText('13 szett · ~57′')).toBeInTheDocument()
  })

  test('opens the day on click, named for screen readers', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<DayStripTile day="Hét" name="Upper" sets={13} minutes={57} muscles={MUSCLES} onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: 'Hét · Upper · szerkesztés' }))
    expect(onOpen).toHaveBeenCalled()
  })

  // Folyadék (mezo-n4wf5.3): the amber dot became the worded „átfedés" pill.
  test('a flagged day says „átfedés”, an unflagged one does not', () => {
    const { unmount } = render(
      <DayStripTile day="Kedd" name="Push" sets={9} minutes={40} muscles={MUSCLES} flagged onOpen={vi.fn()} />,
    )
    expect(screen.getByText('átfedés')).toHaveClass('fo-st', 'warn')
    unmount()
    render(<DayStripTile day="Kedd" name="Push" sets={9} minutes={40} muscles={MUSCLES} onOpen={vi.fn()} />)
    expect(screen.queryByText('átfedés')).not.toBeInTheDocument()
  })

  test('the muscles are poured into one vessel, each layer proportional to its sets', () => {
    const { container } = render(
      <DayStripTile day="Hét" name="Upper" sets={10} minutes={44} muscles={MUSCLES} onOpen={vi.fn()} />,
    )
    const layers = container.querySelectorAll('.fo-pour.sm i')
    expect(layers).toHaveLength(2)
    expect((layers[0] as HTMLElement).style.flexGrow).toBe('7')
    expect((layers[1] as HTMLElement).style.flexGrow).toBe('3')
  })

  test('a rest day is a quiet row that still opens', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const { container } = render(<DayStripTile day="Vas" name="Rest" sets={0} minutes={0} muscles={[]} rest onOpen={onOpen} />)
    expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
    expect(container.querySelector('.fo-row')).toHaveClass('dim')
    expect(container.querySelector('.fo-pour')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Vas · Rest · szerkesztés' }))
    expect(onOpen).toHaveBeenCalled()
  })
})
