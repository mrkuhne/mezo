import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { NeedsRow } from '@/features/today/components/NeedsRow'
import { NEED_META, type NeedBand, type NeedKey, type NeedState } from '@/features/today/logic/needs'

const state = (key: NeedKey, pct: number, band: NeedBand): NeedState => ({
  key,
  emoji: NEED_META[key].emoji,
  label: NEED_META[key].label,
  color: NEED_META[key].color,
  pct,
  ratePerHour: 5,
  zeroAt: null,
  band,
  lastFill: null,
  todayFills: [],
})

const SIX: NeedState[] = [
  state('energia', 45, 'yellow'),
  state('hidratacio', 80, 'green'),
  state('pihenes', 30, 'red'),
  state('mozgas', 10, 'critical'),
  state('lelek', 60, 'green'),
  state('rend', 55, 'yellow'),
]

describe('NeedsRow', () => {
  test('renders 6 buttons in order, each with its pct in the aria-label', () => {
    render(<NeedsRow states={SIX} onOpen={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)
    expect(buttons[0]).toHaveAccessibleName('Energia 45%')
    expect(buttons[1]).toHaveAccessibleName('Hidratáció 80%')
    expect(buttons[2]).toHaveAccessibleName('Pihenés 30%')
    expect(buttons[3]).toHaveAccessibleName('Mozgás 10%, kritikus')
    expect(buttons[4]).toHaveAccessibleName('Lélek 60%')
    expect(buttons[5]).toHaveAccessibleName('Rend 55%')
  })

  test('a critical ring renders a halo circle and its aria-label carries the "kritikus" suffix', () => {
    const { container } = render(<NeedsRow states={SIX} onOpen={() => {}} />)
    const criticalButton = screen.getByRole('button', { name: 'Mozgás 10%, kritikus' })
    expect(criticalButton.querySelector('.td-need-halo')).toBeInTheDocument()
    // No other ring is critical, so it is the ONLY halo on the row.
    expect(container.querySelectorAll('.td-need-halo')).toHaveLength(1)
  })

  test('a non-critical ring has no halo and its arc uses the ring\'s own NEED_META color', () => {
    render(<NeedsRow states={SIX} onOpen={() => {}} />)
    const hidratacio = screen.getByRole('button', { name: 'Hidratáció 80%' })
    expect(hidratacio.querySelector('.td-need-halo')).not.toBeInTheDocument()
    const arc = hidratacio.querySelectorAll('circle')[1]
    expect(arc).toHaveAttribute('stroke', NEED_META.hidratacio.color)
  })

  test('a critical ring\'s arc uses --error-base instead of its own color', () => {
    render(<NeedsRow states={SIX} onOpen={() => {}} />)
    const mozgas = screen.getByRole('button', { name: 'Mozgás 10%, kritikus' })
    const arc = mozgas.querySelectorAll('circle')[1]
    expect(arc).toHaveAttribute('stroke', 'var(--error-base)')
  })

  test('clicking a ring fires onOpen with its key', async () => {
    const onOpen = vi.fn()
    render(<NeedsRow states={SIX} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Hidratáció 80%' }))
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onOpen).toHaveBeenCalledWith('hidratacio')
  })
})
