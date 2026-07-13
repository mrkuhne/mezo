import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BrandRow } from '@/features/today/components/BrandRow'

test('BrandRow shows the Mezo wordmark', () => {
  render(<MemoryRouter><BrandRow /></MemoryRouter>)
  expect(screen.getByText('Mezo')).toBeInTheDocument()
})
test('BrandRow exposes the Insights entry point', () => {
  render(<MemoryRouter><BrandRow /></MemoryRouter>)
  expect(screen.getByLabelText('Insights')).toBeInTheDocument()
})
