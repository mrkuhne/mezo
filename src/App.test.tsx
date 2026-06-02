import { render, screen } from '@testing-library/react'
import App from './App'

test('app boots', () => {
  render(<App />)
  expect(screen.getByText('Mezo boot OK')).toBeInTheDocument()
})
