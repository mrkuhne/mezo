import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FuelMaiView } from './FuelMaiView'

const renderView = () => render(<MemoryRouter><FuelMaiView /></MemoryRouter>)

test('renders header, macro hero, timeline and micronutrients', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Pacing' })).toBeInTheDocument()
  expect(screen.getByText(/1840/)).toBeInTheDocument()
  expect(screen.getByText('Mikrotápanyagok · heti')).toBeInTheDocument()
})
test('opening a meal score sheet then closing it', async () => {
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: /AI/ })[0])
  expect(await screen.findByText('Súlyozott bontás')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText('Súlyozott bontás')).not.toBeInTheDocument())
})
test('Replan button opens the replan sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Replan' }))
  expect(await screen.findByText(/Replan · Mezo/)).toBeInTheDocument()
})
