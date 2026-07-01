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
