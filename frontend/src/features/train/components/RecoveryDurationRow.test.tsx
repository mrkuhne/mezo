import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RecoveryDurationRow } from '@/features/train/components/RecoveryDurationRow'

test('„Meddig tarthat?" + the four chips in prototype order', () => {
  render(<RecoveryDurationRow value={null} onPick={vi.fn()} />)
  expect(screen.getByText('MEDDIG TARTHAT?')).toBeInTheDocument()
  const group = screen.getByRole('group', { name: 'MEDDIG TARTHAT?' })
  expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Csak ma', '2–3 nap', 'Kb. egy hét', 'Nem tudom'])
})

test('a tap picks the estimate; the picked chip is lit', () => {
  const onPick = vi.fn()
  const { rerender } = render(<RecoveryDurationRow value={null} onPick={onPick} />)
  fireEvent.click(screen.getByRole('button', { name: '2–3 nap' }))
  expect(onPick).toHaveBeenCalledWith('FEW_DAYS')
  rerender(<RecoveryDurationRow value="FEW_DAYS" onPick={onPick} />)
  expect(screen.getByRole('button', { name: '2–3 nap' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '2–3 nap' })).toHaveClass('on')
  expect(screen.getByRole('button', { name: 'Nem tudom' })).toHaveAttribute('aria-pressed', 'false')
})

test('disabled while a pick is saving', () => {
  render(<RecoveryDurationRow value="WEEK" disabled onPick={vi.fn()} />)
  for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled()
})
