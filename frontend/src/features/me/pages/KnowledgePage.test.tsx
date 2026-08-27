import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgePage } from '@/features/me/pages/KnowledgePage'

// The useKnowledge() fact-edges mock field is a mock-only prototype surface (edges exist
// only in the seed) — the dual-mode useKnowledge serves it the seed synchronously in mock
// mode. This does NOT describe the real graph-node "Kapcsolatok" section below, which is
// backed by the live knowledge-graph API (see graphHooks.ts / graphApi.ts).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderPage = () =>
  render(
    <MemoryRouter>
      <KnowledgePage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

test('renders the summary band with derived counts', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Tudásgráf' })).toBeInTheDocument()
  expect(screen.getByText('Me · Tudás')).toBeInTheDocument()
  expect(screen.getByText('15 tudás · 13 kapcsolat')).toBeInTheDocument()
})

test('a tényeket már nem listázza — azoknak a Tudástár a gazdája', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('[data-fact-card]')).toHaveLength(0)
  expect(screen.queryByText('Kategóriánként')).not.toBeInTheDocument()
  expect(screen.queryByText(/Étkezés · 5/)).not.toBeInTheDocument()
})

test('a Tudástárra mutató link ott van az összegző sáv alatt', () => {
  renderPage()
  const link = screen.getByRole('link', { name: /Tények kezelése/ })
  expect(link).toHaveAttribute('href', '/insights/knowledge')
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
  // Scope to the Kapcsolatok node card (not the separate profile card, which also has an
  // "Archivál" button) so this only exercises the "Kapcsolatok" archive path.
  const card = screen.getByText('Késői evés rontja az alvást').closest('[data-graph-node-card]')
  const { getByRole } = within(card as HTMLElement)
  fireEvent.click(getByRole('button', { name: 'Archivál' }))
  await waitFor(() =>
    expect(screen.queryByText('Késői evés rontja az alvást')).not.toBeInTheDocument())
})

test('lifts the profile node out of the Kapcsolatok groups into its own section', async () => {
  renderPage()

  expect(await screen.findByText('Rólad tanultam')).toBeInTheDocument()
  // exactly once: it must not ALSO appear under the "Belátások" group
  expect(screen.getAllByText('Rólad tanultam')).toHaveLength(1)
})
