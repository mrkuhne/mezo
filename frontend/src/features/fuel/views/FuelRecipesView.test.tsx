import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FuelRecipesView } from './FuelRecipesView'
const renderView = () => render(<MemoryRouter><FuelRecipesView /></MemoryRouter>)

test('renders stats, filters and recipe cards', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Saját szakácskönyv' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})
test('filtering by query narrows the list to empty', async () => {
  renderView()
  await userEvent.type(screen.getByPlaceholderText(/Keress receptek között/), 'zzzznomatch')
  expect(screen.getByText('Nincs egyező recept.')).toBeInTheDocument()
})
test('Új opens the new-recipe sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Új' }))
  expect(await screen.findByText('Hozz össze valamit')).toBeInTheDocument()
})
