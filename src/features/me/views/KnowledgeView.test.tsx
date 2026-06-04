import { render, screen } from '@testing-library/react'
import { KnowledgeView } from './KnowledgeView'

test('renders the summary band with derived counts', () => {
  render(<KnowledgeView />)
  expect(screen.getByRole('heading', { level: 1, name: /Knowledge graph/ })).toBeInTheDocument()
  expect(screen.getByText('15 tudás · 13 kapcsolat')).toBeInTheDocument()
})

test('renders category headers in order with counts', () => {
  render(<KnowledgeView />)
  expect(screen.getByText(/Preferencia · 6/)).toBeInTheDocument()
  expect(screen.getByText(/Fiziológia · 2/)).toBeInTheDocument()
})

test('renders 15 fact cards and the tool chips', () => {
  const { container } = render(<KnowledgeView />)
  expect(container.querySelectorAll('[data-fact-card]')).toHaveLength(15)
  expect(screen.getByText(/get_knowledge_facts/)).toBeInTheDocument()
})
