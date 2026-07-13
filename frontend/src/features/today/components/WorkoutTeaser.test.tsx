import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { WorkoutTeaser } from '@/features/today/components/WorkoutTeaser'
import { workout } from '@/data/today/today'

function renderTeaser(niggle = true) {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <Routes>
        <Route path="/today" element={<WorkoutTeaser workout={workout} niggle={niggle} />} />
        <Route path="/train" element={<div>TRAIN ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('shows title + Gym typetag, niggle banner text and navigates to /train on the CTA', async () => {
  const { container } = renderTeaser(true)
  expect(screen.getByText(workout.title)).toBeInTheDocument()
  const typetag = container.querySelector('.typetag')
  expect(typetag).not.toBeNull()
  expect(typetag).toHaveTextContent(/Gym/i)
  // Niggle strip renders the human-copy detail field, not hardcoded text (spec fix).
  expect(screen.getByText(workout.niggleWarning.detail, { exact: false })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Indítsuk/ }))
  expect(screen.getByText('TRAIN ROUTE')).toBeInTheDocument()
})
test('hides niggle banner when niggle off', () => {
  renderTeaser(false)
  expect(screen.queryByText(workout.niggleWarning.detail, { exact: false })).not.toBeInTheDocument()
})
