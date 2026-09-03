import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { MemoirPage } from '@/features/insights/pages/MemoirPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <MemoirPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const FEEDBACK_GROUP = 'Visszajelzés a heti memoárról'

describe('MemoirPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the hero, the chapter card, anchors and the anniversary card', () => {
    renderPage()
    // Mozaik re-face (mezo-d20.5.5): page hero from the prototype #page-memoar.
    expect(screen.getByText('Memoár')).toBeInTheDocument()
    expect(screen.getByText('a közös történetünk, hétről hétre')).toBeInTheDocument()
    expect(screen.getByText('Heti memoár · Hét 20 · 2026 · Máj 11-17')).toBeInTheDocument()
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
    // RefTag renders "[PR] Chest Row 102.5 × 9"; RTL normalizes &nbsp; to a space, so this matches.
    // If it ever doesn't, fall back to: screen.getByText(/Chest Row 102\.5 × 9/)
    expect(screen.getByText(/Chest Row 102\.5 × 9/)).toBeInTheDocument()
    // The anchors row speaks Hungarian now (prototype: "Horgonyok", not "Anchors").
    expect(screen.getByText('Horgonyok')).toBeInTheDocument()
    expect(screen.queryByText('Anchors')).toBeNull()
    expect(screen.getByText('Évforduló · 1 hónap')).toBeInTheDocument()
    // The dead decorative archive row is retired (audit §3: "not to promote into tiles";
    // the prototype dropped it) — no false affordance survives the re-face.
    expect(screen.queryByText(/Memoir archive/)).toBeNull()
  })

  test('the chapter card wears the mz-memoir face: Fraunces title + lavender glow + lav-washed anniversary', () => {
    const { container } = renderPage()
    const card = container.querySelector('.mz-memoir')
    expect(card).not.toBeNull()
    expect(card!.querySelector('.mz-memoir-ttl')?.textContent).toBe('Egy hét amikor a tested megtanult várni')
    expect(container.querySelector('.mz-anniv')).not.toBeNull()
  })

  test('renders the feedback chips instead of the retired mock reaction row (mezo-kr9v)', () => {
    renderPage()
    // The Phase-1 Like/Love/Save/Dismiss row was a mock-only false affordance — gone for good.
    expect(screen.queryByText('Love')).toBeNull()
    expect(screen.queryByRole('button', { name: /Like/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Dismiss/ })).toBeNull()
    expect(screen.getByRole('group', { name: FEEDBACK_GROUP })).toBeInTheDocument()
  })

  test('a 👍 tap marks the chip pressed', async () => {
    renderPage()
    const up = screen.getByRole('button', { name: /Segített/ })
    expect(up).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(up)
    await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'))
  })
})

describe('MemoirPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the real weekly memoir, without the mock-only demo extras', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/memoir`, () =>
        HttpResponse.json({
          id: '9c2f1a44-0000-4000-8000-000000000777',
          weekStart: '2026-06-29',
          title: 'A várakozás hete',
          body: 'Szép hét volt, tartottad a ritmust.',
          anchors: [{ kind: 'Memory', label: '2026-07-01' }],
          generatedAt: '2026-07-05T19:00:00Z',
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText('A várakozás hete')).toBeInTheDocument()
    expect(screen.getByText('Szép hét volt, tartottad a ritmust.')).toBeInTheDocument()
    expect(screen.getByText(/2026-07-01/)).toBeInTheDocument()
    // Demo-only extras are mock-only now.
    expect(screen.queryByText('Évforduló · 1 hónap')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Like/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Memoir archive/)).not.toBeInTheDocument()
    // ...but the feedback chips are NOT mock-only — that asymmetry was the mezo-kr9v bug.
    expect(screen.getByRole('group', { name: FEEDBACK_GROUP })).toBeInTheDocument()
  })

  test('renders the honest készül placeholder on the default 404, not the demo fiction', async () => {
    renderPage()
    expect(await screen.findByText('Az első memoár a hét zárásakor készül el.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText('Egy hét amikor a tested megtanult várni')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('Évforduló · 1 hónap')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Like/ })).not.toBeInTheDocument()
    // No memoir → no artifact to vote on → no chips.
    expect(screen.queryByRole('group', { name: FEEDBACK_GROUP })).not.toBeInTheDocument()
  })
})

// F7.5 (mezo-d20.8.5): the un-retired archive footer navigates to the shelf.
describe('MemoirPage archive CTA', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('the Archívum card is a real navigation affordance, not a dead label', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /Archívum — a korábbi fejezetek/ })).toBeInTheDocument()
  })
})
