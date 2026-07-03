import { render, screen } from '@testing-library/react'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgePage } from '@/features/me/pages/KnowledgePage'

// The knowledge graph is a mock-only prototype surface (edges exist only in the seed) —
// the dual-mode useKnowledge serves it the seed synchronously in mock mode.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderPage = () => render(<KnowledgePage />, { wrapper: QueryWrapper })

test('renders the summary band with derived counts', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: /Knowledge graph/ })).toBeInTheDocument()
  expect(screen.getByText('15 tudás · 13 kapcsolat')).toBeInTheDocument()
})

test('renders category headers in order with counts', () => {
  renderPage()
  // V1.2 backend taxonomy: train 3 · fuel 5 · health 3 · life 4
  expect(screen.getByText(/Étkezés · 5/)).toBeInTheDocument()
  expect(screen.getByText(/Edzés · 3/)).toBeInTheDocument()
})

test('renders 15 fact cards', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('[data-fact-card]')).toHaveLength(15)
})
