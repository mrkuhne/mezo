import { render, screen } from '@testing-library/react'
import { KnowledgePage } from '@/features/me/pages/KnowledgePage'

test('renders the summary band with derived counts', () => {
  render(<KnowledgePage />)
  expect(screen.getByRole('heading', { level: 1, name: /Knowledge graph/ })).toBeInTheDocument()
  expect(screen.getByText('15 tudás · 13 kapcsolat')).toBeInTheDocument()
})

test('renders category headers in order with counts', () => {
  render(<KnowledgePage />)
  expect(screen.getByText(/Preferencia · 6/)).toBeInTheDocument()
  expect(screen.getByText(/Fiziológia · 2/)).toBeInTheDocument()
})

test('renders 15 fact cards', () => {
  const { container } = render(<KnowledgePage />)
  expect(container.querySelectorAll('[data-fact-card]')).toHaveLength(15)
})
