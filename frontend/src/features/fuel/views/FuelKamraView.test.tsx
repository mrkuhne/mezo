import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FuelKamraView } from './FuelKamraView'
const renderView = () => render(<MemoryRouter><FuelKamraView /></MemoryRouter>)

test('renders stats, type filters and grouped items', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Polc' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Supplement' })).toBeInTheDocument()
})
test('Import opens the import sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  expect(await screen.findByText('Új tétel a Kamrába')).toBeInTheDocument()
})
test('query filters to empty-state', async () => {
  renderView()
  await userEvent.type(screen.getByPlaceholderText(/Keress tétel/), 'zzzznope')
  expect(screen.getByText('Nincs egyező tétel.')).toBeInTheDocument()
})
