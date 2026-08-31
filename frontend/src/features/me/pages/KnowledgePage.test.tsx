import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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

// helper: render with an initial URL
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
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

test('the base view is the kind grid — six tiles, counts, no node cards', () => {
  const { container } = renderPage()
  expect(container.querySelector('.tud-summary')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Minták' })).toHaveTextContent('1')
  expect(screen.getByText('Szezonok')).toBeInTheDocument() // empty kind still present
  // the flat card list is gone
  expect(container.querySelectorAll('[data-graph-node-card]')).toHaveLength(0)
  expect(screen.queryByText('Késői evés → kiváltja → Rossz alvás · erős')).not.toBeInTheDocument()
})

test('tapping a kind tile opens the category view and sets ?kind=', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Minták' }))
  expect(await screen.findByText('Minták · 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Késői evés rontja az alvást/ })).toBeInTheDocument()
  expect(screen.getByText('2 kapcsolat')).toBeInTheDocument()
  // grid + profile are replaced in this view
  expect(screen.queryByRole('button', { name: 'Célok' })).not.toBeInTheDocument()
  expect(screen.queryByText('Rólad tanultam')).not.toBeInTheDocument()
})

test('?kind= deep link lands in the category view; invalid kind falls back to the grid', () => {
  renderAt('/?kind=PATTERN')
  expect(screen.getByText('Minták · 1')).toBeInTheDocument()
  cleanup()
  renderAt('/?kind=NOPE')
  expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
})

test('back chip returns to the grid', async () => {
  renderAt('/?kind=PATTERN')
  fireEvent.click(screen.getByRole('button', { name: '‹ Kategóriák' }))
  expect(await screen.findByRole('button', { name: 'Minták' })).toBeInTheDocument()
})

test('node row opens the detail sheet; Archivál archives and the node disappears', async () => {
  renderAt('/?kind=PATTERN')
  fireEvent.click(screen.getByRole('button', { name: /^Késői evés rontja az alvást/ }))
  // sheet content: edge lines now live HERE, not in the row
  expect(await screen.findByText('Késői evés → kiváltja → Rossz alvás · erős')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Archivál' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /^Késői evés rontja az alvást/ })).not.toBeInTheDocument())
})

test('lifts the profile node out of the Kapcsolatok groups into its own section', async () => {
  renderPage()

  expect(await screen.findByText('Rólad tanultam')).toBeInTheDocument()
  // exactly once: it must not ALSO appear under the "Belátások" group
  expect(screen.getAllByText('Rólad tanultam')).toHaveLength(1)
})
