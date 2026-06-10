import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FuelStackView } from './FuelStackView'
import { QueryWrapper } from '@/test/queryWrapper'

const renderView = () => render(
  <QueryWrapper><MemoryRouter><FuelStackView /></MemoryRouter></QueryWrapper>,
)

test('renders context, active stack and generated timing', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'AI builder' })).toBeInTheDocument()
  expect(screen.getByText(/AI-generált timing/)).toBeInTheDocument()
})
test('Hozzáadás opens the stack picker', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Hozzáadás' }))
  expect(await screen.findByText('Mit szedjünk')).toBeInTheDocument()
})
test('Bekapcsolás shows the applied toast', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Bekapcsolás/ }))
  expect(await screen.findByText(/Protokoll · v/)).toBeInTheDocument()
})
