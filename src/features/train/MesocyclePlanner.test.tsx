import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MesocyclePlanner } from './MesocyclePlanner'

function setup() {
  return render(
    <MemoryRouter initialEntries={['/train/mesocycles/new']}>
      <MesocyclePlanner />
    </MemoryRouter>,
  )
}

test('step 0 shows the goal-picker title and the goal presets', () => {
  setup()
  expect(screen.getByText('Mit szeretnénk építeni?')).toBeInTheDocument()
  expect(screen.getByText('Hypertrophy')).toBeInTheDocument()
  expect(screen.getByText('Sport-specific')).toBeInTheDocument()
})

test('selecting Hypertrophy then Tovább advances to step 1', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.getByText('Mennyi időnk van?')).toBeInTheDocument()
})
