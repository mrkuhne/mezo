import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainSubNav } from '@/features/train/pages/TrainSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TrainSubNav /></MemoryRouter>)
}

test('renders all six pills with verbatim labels', () => {
  renderAt('/train')
  for (const label of ['Mai', 'Gym', 'Sport', 'Futás', 'Gyakorlatok', 'Mesociklusok']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/train/sport')
  expect(container.querySelector('.np-pill.on')).toHaveTextContent('Sport')
})

test('Mai (index) is active only on exact /train', () => {
  const { container } = renderAt('/train/gym')
  expect(container.querySelector('.np-pill.on')).toHaveTextContent('Gym')
})
