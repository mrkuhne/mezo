import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { MorningTrainingCard } from '@/features/train/components/MorningTrainingCard'

test('lists offending slots with the target and fires both actions', () => {
  const onApply = vi.fn()
  const onSnooze = vi.fn()
  render(
    <MorningTrainingCard
      offending={[
        { dayOfWeek: 1, time: '18:30' },
        { dayOfWeek: 3, time: '18:30' },
      ]}
      windowStart="07:45"
      windowEnd="12:45"
      onApply={onApply}
      onSnooze={onSnooze}
    />,
  )
  expect(screen.getByText(/07:45–12:45/)).toBeInTheDocument()
  expect(screen.getByText(/Kedd 18:30 · Csü 18:30/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Áthelyezés a reggeli ablakba' }))
  expect(onApply).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Maradjon így' }))
  expect(onSnooze).toHaveBeenCalled()
})
