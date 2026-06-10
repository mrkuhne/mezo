import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditGoalSheet } from './EditGoalSheet'
import { goal } from '@/data/goals'

test('shows the goal fields read-only', () => {
  render(<EditGoalSheet onClose={() => {}} goal={goal} />)
  expect(screen.getByText('Cél súly')).toBeInTheDocument()
  expect(screen.getByText(`${goal.targetWeight} kg`)).toBeInTheDocument()
})

test('closes on Mégse', async () => {
  const onClose = vi.fn()
  render(<EditGoalSheet onClose={onClose} goal={goal} />)
  await userEvent.click(screen.getByRole('button', { name: 'Mégse' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
