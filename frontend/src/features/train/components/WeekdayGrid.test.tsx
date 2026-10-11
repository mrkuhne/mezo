import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WeekdayGrid } from '@/features/train/components/WeekdayGrid'

test('marks the selected weekday pressed and emits the clicked index', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<WeekdayGrid value={1} onChange={onChange} />)

  // DAY_ORDER index = dayOfWeek (Monday=0). Kedd(1) is selected.
  expect(screen.getByRole('button', { name: 'Kedd' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Pén' })).toHaveAttribute('aria-pressed', 'false')

  await user.click(screen.getByRole('button', { name: 'Pén' }))
  expect(onChange).toHaveBeenCalledWith(4)
})

// Folyadék (mezo-n4wf5.3, prototype `chips(DSH, …)`): the kit's pills wear the short weekday; the
// accessible name stays the DAY_ORDER word.
test('the pills show the short weekday and the chosen one is the filled pill', () => {
  render(<WeekdayGrid value={3} onChange={vi.fn()} />)
  const pills = screen.getAllByRole('button')
  expect(pills.map((b) => b.textContent)).toEqual(['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'])
  expect(screen.getByRole('button', { name: 'Csü' })).toHaveClass('fo-pill', 'on')
  expect(screen.getByRole('group', { name: 'Nap' })).toHaveClass('fo-pills')
})
