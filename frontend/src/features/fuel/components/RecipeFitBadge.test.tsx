import { render, screen } from '@testing-library/react'
import { RecipeFitBadge } from '@/features/fuel/components/RecipeFitBadge'

test('pending state shows the Mezo sparkle label, no number', () => {
  render(<RecipeFitBadge score={null} />)
  expect(screen.getByText('Mezo')).toBeInTheDocument()
  expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
})

test('scored state shows the rounded fit number + fit label', () => {
  render(<RecipeFitBadge score={0.92} />)
  expect(screen.getByText('92')).toBeInTheDocument()
  expect(screen.getByText('fit')).toBeInTheDocument()
})
