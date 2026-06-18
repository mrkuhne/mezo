import { render, screen } from '@testing-library/react'
import { GoalsView } from './GoalsView'
import { QueryWrapper } from '@/test/queryWrapper'

test('renders the goal hero, weights and identity frame', () => {
  render(<GoalsView />, { wrapper: QueryWrapper })
  expect(screen.getByRole('heading', { level: 1, name: /Hosszú cél/ })).toBeInTheDocument()
  expect(screen.getByText('Fogyás · Nyári forma')).toBeInTheDocument()
  expect(screen.getAllByText('78.6').length).toBeGreaterThan(0) // current weight
  expect(screen.getByText(/Egészséges erő/)).toBeInTheDocument() // identityFrame
  expect(screen.queryByText('7 nap')).not.toBeInTheDocument() // trend cells moved to /me/weight
})

test('renders the factors section with tool chips', () => {
  render(<GoalsView />, { wrapper: QueryWrapper })
  expect(screen.getByText('Reta D3-D5 alacsony étvágy')).toBeInTheDocument()
  expect(screen.getByText(/get_weight_log/)).toBeInTheDocument()
})

test('renders linked mesocycles with status chips', () => {
  render(<GoalsView />, { wrapper: QueryWrapper })
  expect(screen.getByText('Hypertrophy 04')).toBeInTheDocument()
  expect(screen.getByText('AKTÍV')).toBeInTheDocument()
})
