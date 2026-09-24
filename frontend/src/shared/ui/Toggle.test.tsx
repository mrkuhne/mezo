import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from '@/shared/ui/Toggle'

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

test('disabled: carries the disabled attribute and does not fire onToggle when clicked', async () => {
  const onToggle = vi.fn()
  render(<Toggle on={false} onToggle={onToggle} ariaLabel="Téma váltás" disabled />)
  const btn = screen.getByRole('switch', { name: 'Téma váltás' })
  expect(btn).toBeDisabled()
  await userEvent.click(btn)
  expect(onToggle).not.toHaveBeenCalled()
})

test('glass variant: same switch contract, skin left to the üveg stylesheet (mezo-me75u.7)', async () => {
  const onToggle = vi.fn()
  render(<Toggle glass on={true} onToggle={onToggle} ariaLabel="Téma váltás" />)
  const btn = screen.getByRole('switch', { name: 'Téma váltás' })
  expect(btn).toHaveAttribute('aria-checked', 'true')
  expect(btn).toHaveClass('uv-tgl', 'is-on')
  // no inline background: an inline skin would outrank the page's lit accent
  expect(btn.getAttribute('style')).toBeNull()
  await userEvent.click(btn)
  expect(onToggle).toHaveBeenCalledTimes(1)
})
