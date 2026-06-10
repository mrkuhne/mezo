import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MesocycleBuilder } from './MesocycleBuilder'

function setup(id = 'meso-hyp-04') {
  return render(
    <MemoryRouter initialEntries={[`/train/mesocycles/${id}`]}>
      <Routes>
        <Route path="/train/mesocycles/:id" element={<MesocycleBuilder />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('renders the meso title as the level-1 heading', () => {
  setup()
  expect(
    screen.getByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' }),
  ).toBeInTheDocument()
})

test('renders the three view-switcher buttons', () => {
  setup()
  expect(screen.getByRole('button', { name: 'Áttekintés' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Volumen' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument()
})

test('tapping a training day row opens DayDetailSheet with the planned-exercise copy', async () => {
  const user = userEvent.setup()
  setup()
  // The current Csü Pull day — an unambiguous training day.
  await user.click(screen.getByRole('button', { name: 'Pull · Csü' }))
  expect(screen.getByText(/gyakorlat tervezve/)).toBeInTheDocument()
})
