import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { GoalPlanner } from './GoalPlanner'

test('GoalPlanner step 0 picks a trajectory and a guard', () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(screen.getByText('Mit építünk?')).toBeInTheDocument()
  // Tovább is disabled until a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /erő megtartása/i }))
  // Tovább becomes enabled once a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeEnabled()
})
