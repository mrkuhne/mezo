import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ServingToggle } from './ServingToggle'

test('renders both bases and reports a change', async () => {
  const onChange = vi.fn()
  render(<ServingToggle value="serving" servings={2} onChange={onChange} />)
  expect(screen.getByRole('button', { name: '1 adag' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Egész · 2 adag/ }))
  expect(onChange).toHaveBeenCalledWith('whole')
})
