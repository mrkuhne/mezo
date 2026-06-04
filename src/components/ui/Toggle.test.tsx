import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from './Toggle'

test('renders a switch with the given aria-label and pressed state', () => {
  render(<Toggle on={true} onToggle={() => {}} ariaLabel="Téma váltás" />)
  const btn = screen.getByRole('switch', { name: 'Téma váltás' })
  expect(btn).toHaveAttribute('aria-checked', 'true')
})

test('fires onToggle when clicked', async () => {
  const onToggle = vi.fn()
  render(<Toggle on={false} onToggle={onToggle} ariaLabel="Téma váltás" />)
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(onToggle).toHaveBeenCalledTimes(1)
})
