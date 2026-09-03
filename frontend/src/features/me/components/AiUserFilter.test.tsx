import { render, screen, fireEvent } from '@testing-library/react'
import { AiUserFilter } from '@/features/me/components/AiUserFilter'

const groups = [
  { userId: 'u-1', name: 'Daniel', callCount: 300, totalTokens: 900000, costUsd: 1.31 },
  { userId: null, name: null, callCount: 42, totalTokens: 200000, costUsd: 0.21 },
]

test('renders Mindenki + one chip per account + a non-clickable background bucket', () => {
  const onSelect = vi.fn()
  render(<AiUserFilter groups={groups} selected={null} onSelect={onSelect} />)
  expect(screen.getByRole('button', { name: 'Mindenki' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Daniel 300' }))
  expect(onSelect).toHaveBeenCalledWith('u-1')
  expect(screen.getByText('Háttér 42')).not.toHaveAttribute('role', 'button')
})

test('the active chip clears itself', () => {
  const onSelect = vi.fn()
  render(<AiUserFilter groups={groups} selected="u-1" onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('button', { name: /Daniel 300/ }))
  expect(onSelect).toHaveBeenCalledWith(null)
})
