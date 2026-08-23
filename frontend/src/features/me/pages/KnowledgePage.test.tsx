import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgePage } from '@/features/me/pages/KnowledgePage'

// The useKnowledge() fact-edges mock field is a mock-only prototype surface (edges exist
// only in the seed) — the dual-mode useKnowledge serves it the seed synchronously in mock
// mode. This does NOT describe the real graph-node "Kapcsolatok" section below, which is
// backed by the live knowledge-graph API (see graphHooks.ts / graphApi.ts).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderPage = () => render(<KnowledgePage />, { wrapper: QueryWrapper })

test('renders the summary band with derived counts', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Tudásgráf' })).toBeInTheDocument()
  expect(screen.getByText('Me · Tudás')).toBeInTheDocument()
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

test('renders the Kapcsolatok section grouped by kind with strongest-edge lines', () => {
  renderPage()
  expect(screen.getByText(/Kapcsolatok/)).toBeInTheDocument()
  expect(screen.getByText('Minták · 1')).toBeInTheDocument()
  expect(screen.getByText('Késői evés rontja az alvást')).toBeInTheDocument()
  expect(screen.getByText('Késői evés → kiváltja → Rossz alvás · erős')).toBeInTheDocument()
})

test('archiving a graph node removes it from the Kapcsolatok section (mock mode)', async () => {
  renderPage()
  const archiveButtons = screen.getAllByRole('button', { name: 'Archivál' })
  fireEvent.click(archiveButtons[0])
  await waitFor(() =>
    expect(screen.queryByText('Késői evés rontja az alvást')).not.toBeInTheDocument())
})
