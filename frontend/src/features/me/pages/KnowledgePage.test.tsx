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

// mezo-d20.11 (ADR 0032): the page wears its own Mozaik scaffold — the prototype's `‹ Én`
// back chip + the page-hero — instead of the old .pghead-np band, which offered no way back
// and repeated the hero's own counts inside the summary tile.
test('renders the Mozaik hero with the derived counts and a way back', () => {
  const { container } = renderPage()
  expect(screen.getByText('Tudásgráf')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(screen.getByText('‹ Én')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('15')
  expect(screen.getByText('tudás · 13 kapcsolat · élő mindmap')).toBeInTheDocument()
  // The old .pghead-np band is gone — no page mixes the two header generations any more.
  expect(container.querySelector('.pghead-np')).toBeNull()
})

// The armed-but-silent EntranceGroup (audit group B: play 1, rise 0) — every direct child
// now carries `.rise`, and each `.rise` sits INSIDE the `.mz-play` wrapper.
test('every .rise element sits inside the armed EntranceGroup', () => {
  const { container } = renderPage()
  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  const rises = container.querySelectorAll('.rise')
  expect(rises.length).toBeGreaterThan(0)
  for (const el of rises) expect(play!.contains(el)).toBe(true)
})

test('a tényeket már nem listázza — azoknak a Tudástár a gazdája', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('[data-fact-card]')).toHaveLength(0)
  expect(screen.queryByText('Kategóriánként')).not.toBeInTheDocument()
  expect(screen.queryByText(/Étkezés · 5/)).not.toBeInTheDocument()
})

test('a Tudástárra mutató link ott van az összegző sáv alatt', () => {
  renderPage()
  const link = screen.getByRole('link', { name: /A tények kezelése/ })
  expect(link).toHaveAttribute('href', '/mezo/knowledge')
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

// Mozaik re-face (mezo-d20.6.7): the summary tile + node/profile tiles wear the
// Tudástár .mz-facttile recipe, per-kind washed (mezo-d20.5.5's shared vocabulary).
test('the summary band and node tiles wear the Mozaik wash tiles', () => {
  const { container } = renderPage()
  expect(container.querySelector('.tud-summary')).toBeInTheDocument()
  // the seeded PATTERN node ("Késői evés rontja az alvást") washes sage
  const patternTile = screen.getByText('Késői evés rontja az alvást').closest('[data-graph-node-card]')
  expect(patternTile).toHaveClass('mz-w-sage')
  // the profile node reuses the same tile primitive, uncolored
  const profileTile = screen.getByText('Rólad tanultam').closest('[data-profile-node-card]')
  expect(profileTile).toHaveClass('mz-facttile')
})
