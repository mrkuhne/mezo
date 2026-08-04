import { render, screen } from '@testing-library/react'
import { Spinner } from '@/shared/ui/Spinner'

test('announces itself to AT with a default Hungarian label', () => {
  render(<Spinner />)
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
})

test('size + tone map to the CSS contract', () => {
  render(<Spinner size="lg" tone="primary" label="Mentés folyamatban" />)
  const el = screen.getByRole('status', { name: 'Mentés folyamatban' })
  expect(el).toHaveClass('spinner', 'lg', 'tone-primary')
})
