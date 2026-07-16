import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { MemoirPage } from '@/features/insights/pages/MemoirPage'

const renderPage = () => render(<MemoirPage />, { wrapper: QueryWrapper })

describe('MemoirPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the memoir card, anchors, anniversary card and archive footer', () => {
    renderPage()
    expect(screen.getByText('Heti memoár · Hét 20 · 2026 · Máj 11-17')).toBeInTheDocument()
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
    // RefTag renders "[PR] Chest Row 102.5 × 9"; RTL normalizes &nbsp; to a space, so this matches.
    // If it ever doesn't, fall back to: screen.getByText(/Chest Row 102\.5 × 9/)
    expect(screen.getByText(/Chest Row 102\.5 × 9/)).toBeInTheDocument()
    expect(screen.getByText('Évforduló · 1 hónap')).toBeInTheDocument()
    expect(screen.getByText('Memoir archive · 17 darab')).toBeInTheDocument()
  })

  test('reaction chips toggle the brand state', async () => {
    renderPage()
    const like = screen.getByRole('button', { name: /Like/ })
    expect(like.className).not.toMatch(/brand/)
    await userEvent.click(like)
    expect(like.className).toMatch(/brand/)
  })
})

describe('MemoirPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the real weekly memoir, without the mock-only demo extras', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/memoir`, () =>
        HttpResponse.json({
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
    expect(screen.queryByText('Memoir archive · 17 darab')).not.toBeInTheDocument()
  })

  test('renders the honest készül placeholder on the default 404, not the demo fiction', async () => {
    renderPage()
    expect(await screen.findByText('Az első memoár a hét zárásakor készül el.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText('Egy hét amikor a tested megtanult várni')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('Évforduló · 1 hónap')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Like/ })).not.toBeInTheDocument()
  })
})
