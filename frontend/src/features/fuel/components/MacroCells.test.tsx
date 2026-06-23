import { render, screen } from '@testing-library/react'
import { MacroCells } from './MacroCells'

test('renders the four macro values with their labels', () => {
  render(<MacroCells macros={{ kcal: 420, p: 38, c: 12, f: 22 }} />)
  expect(screen.getByText('420')).toBeInTheDocument()
  expect(screen.getByText('38')).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('22')).toBeInTheDocument()
  expect(screen.getByText('kcal')).toBeInTheDocument()
  expect(screen.getByText('Prot')).toBeInTheDocument()
  expect(screen.getByText('Carb')).toBeInTheDocument()
  expect(screen.getByText('Fat')).toBeInTheDocument()
})

test('renders the per-basis rail label when given', () => {
  render(<MacroCells macros={{ kcal: 116, p: 24, c: 0, f: 6 }} perLabel="/100g" />)
  expect(screen.getByText('/100g')).toBeInTheDocument()
})
