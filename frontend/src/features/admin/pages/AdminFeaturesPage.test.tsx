import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminFeaturesPage } from '@/features/admin/pages/AdminFeaturesPage'
import { adminRoutes } from '@/features/admin/adminRoutes'
import { ADMIN_FEATURE_BOARD_MOCK, ADMIN_SCREEN_USAGE_MOCK } from '@/data/admin/adminInsightsMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(<MemoryRouter><AdminFeaturesPage /></MemoryRouter>, { wrapper: QueryWrapper })
}

describe('AdminFeaturesPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the summary strip', async () => {
    renderPage()
    expect(await screen.findByText('Aktívan használt funkciók')).toBeInTheDocument()
    expect(screen.getByText('Aktívan használt funkciók')).toBeInTheDocument()
    expect(screen.getByText('Van visszajelzése')).toBeInTheDocument()
    expect(screen.getByText(/Összköltség/)).toBeInTheDocument()
  })

  it('renders a Hungarian row name from the mock seed', async () => {
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    expect(screen.getByText('Beszélgetés a társsal')).toBeInTheDocument()
  })

  it('groups system-kind rows under a muted "Rendszer" divider, below the regular rows', async () => {
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    const divider = await screen.findByText('Rendszer')
    const unknownRow = screen.getByText('Ismeretlen hívás')
    // the divider must precede the system row in document order
    expect(divider.compareDocumentPosition(unknownRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('links each row to its detail page', async () => {
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    expect(screen.getByRole('link', { name: 'Beszélgetés a társsal' })).toHaveAttribute(
      'href',
      '/admin/features/companion_chat',
    )
  })

  it('renders the screen-usage tile from the shared screen-usage hook', async () => {
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    expect(screen.getByText('Képernyők · megnyitások')).toBeInTheDocument()
    const label = ADMIN_SCREEN_USAGE_MOCK.screens[0].screen
    // the screen tile renders its route pattern's Hungarian label, not the raw key
    expect(screen.queryByText(label)).not.toBeInTheDocument()
  })

  it('changing the period button selects it and re-labels the cost summary cell', async () => {
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    const btn90 = screen.getByRole('button', { name: '90 nap' })
    fireEvent.click(btn90)
    expect(btn90).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('Összköltség · 90d')).toBeInTheDocument()
  })

  it('changing the sort control reorders the scorecard', async () => {
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    const btnCost = screen.getByRole('button', { name: 'költség' })
    fireEvent.click(btnCost)
    expect(btnCost).toHaveAttribute('aria-pressed', 'true')
    const names = screen.getAllByRole('link').map((l) => l.getAttribute('aria-label'))
    // companion_chat has the highest costUsd (42.3) in the seed — first under a cost sort.
    expect(names[0]).toBe('Beszélgetés a társsal')
  })
})

describe('/admin/usage redirect (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('redirects /admin/usage to /admin/features (AdminFeaturesPage)', async () => {
    const router = createMemoryRouter(adminRoutes, { initialEntries: ['/admin/usage'] })
    render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
    expect(await screen.findByText('Aktívan használt funkciók')).toBeInTheDocument()
    expect(screen.getByText('Funkciók', { selector: '.mz-hero-nm' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/features')
  })
})

describe('AdminFeaturesPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the fetched board', async () => {
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    await waitFor(() => {
      expect(screen.getByText('Beszélgetés a társsal')).toBeInTheDocument()
    })
  })

  it('renders a missing-marker for an unlabelled key served by an MSW override, not the seed', async () => {
    server.use(http.get(`${API_BASE}/api/admin/features`, () => HttpResponse.json({
      ...ADMIN_FEATURE_BOARD_MOCK,
      rows: [
        ...ADMIN_FEATURE_BOARD_MOCK.rows,
        {
          key: 'brand_new_unlabelled_slug', kind: 'ai', uniqueUsers: 2,
          usesPerWeek: Array(12).fill(1), habitUserShare: 0.1, helped: null, acceptedShare: null,
          costUsd: 1, costPerUse: 0.5, unknownCalls: 0, errorPct: 0, p90LatencyMs: 100, screenViews: null,
        },
      ],
    })))
    renderPage()
    expect(await screen.findByText('brand_new_unlabelled_slug (nincs címke)')).toBeInTheDocument()
  })

  it('degrades only the screen tile when the screens endpoint fails', async () => {
    server.use(http.get(`${API_BASE}/api/admin/usage/screens`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Beszélgetés a társsal')).toBeInTheDocument()
    })
    expect(await screen.findByText(/nem elérhető/i)).toBeInTheDocument()
  })

  it('refetches the board when the period changes', async () => {
    const requestedPeriods: string[] = []
    server.use(http.get(`${API_BASE}/api/admin/features`, ({ request }) => {
      const period = new URL(request.url).searchParams.get('period') ?? '30d'
      requestedPeriods.push(period)
      return HttpResponse.json({ ...ADMIN_FEATURE_BOARD_MOCK, period })
    }))
    renderPage()
    await screen.findByText('Aktívan használt funkciók')
    await waitFor(() => expect(requestedPeriods).toContain('30d'))
    fireEvent.click(screen.getByRole('button', { name: '90 nap' }))
    await waitFor(() => expect(requestedPeriods).toContain('90d'))
  })
})
