import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { WorkoutTeaser } from '@/features/today/components/WorkoutTeaser'
import { workout } from '@/data/today'

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
test('shows title + niggle banner and navigates to /train on the CTA', async () => {
  renderTeaser(true)
  // Title appears twice (card heading + CTA), faithful to the prototype markup.
  expect(screen.getAllByText(workout.title).length).toBeGreaterThan(0)
  expect(screen.getByText(/aktív niggle/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Indítsuk/ }))
  expect(screen.getByText('TRAIN ROUTE')).toBeInTheDocument()
})
test('hides niggle banner when niggle off', () => {
  renderTeaser(false)
  expect(screen.queryByText(/aktív niggle/)).not.toBeInTheDocument()
})
