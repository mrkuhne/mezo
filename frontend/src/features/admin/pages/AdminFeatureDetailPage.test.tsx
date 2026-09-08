import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminFeatureDetailPage } from '@/features/admin/pages/AdminFeatureDetailPage'
import { ADMIN_FEATURE_DETAIL_MOCK } from '@/data/admin/adminInsightsMock'

// mezo-kxnn Task 3 — the companion_chat mock detail seed's exact numbers (funnel 3/2/1, HU
// reason labels, model rows) both in mock mode AND fetched-for-real via MSW, plus the honest
// 404 ("ismeretlen funkció") and companion-off (null feedbackTrend/downReasons) states.

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage(key = 'companion_chat') {
  return render(
    <MemoryRouter initialEntries={[`/admin/features/${key}`]}>
      <Routes>
        <Route path="/admin/features/:key" element={<AdminFeatureDetailPage />} />
        <Route path="/admin/features" element={<div>FEATURES LIST PAGE</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AdminFeatureDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the Hungarian feature name, kind chip and KPI strip', async () => {
    renderPage()
    expect(await screen.findByText('Beszélgetés a társsal')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('▲ 14')).toBeInTheDocument()
    expect(screen.getByText('▼ 3')).toBeInTheDocument()
    expect(screen.getByText('1 400 ms')).toBeInTheDocument()
  })

  it('renders the funnel with the mock seed numbers (3/2/1) and the tried-user names', async () => {
    renderPage()
    await screen.findByText('Beszélgetés a társsal')
    expect(screen.getByText('Kipróbálta')).toBeInTheDocument()
    // funnel counts: tried=3, repeated=2, habitual=1
    const funnelValues = screen.getAllByText(/^[123]$/)
    expect(funnelValues.length).toBeGreaterThanOrEqual(3)
    // "Daniel"/"Anna"/"Béla" appear both as tried-user chips AND as top-spending users below —
    // assert presence, not uniqueness.
    expect(screen.getAllByText('Daniel').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Anna').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Béla').length).toBeGreaterThan(0)
  })

  it('renders the down-reasons with Hungarian labels', async () => {
    renderPage()
    await screen.findByText('Beszélgetés a társsal')
    expect(screen.getByText('Pontatlan')).toBeInTheDocument()
    expect(screen.getByText('Túl sok')).toBeInTheDocument()
    expect(screen.getByText('Rossz időzítés')).toBeInTheDocument()
  })

  it('renders the cost-by-model rows and the top-spending users', async () => {
    renderPage()
    await screen.findByText('Beszélgetés a társsal')
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText(/\$30\.00/)).toBeInTheDocument()
  })

  it('navigates back to the features list', async () => {
    renderPage()
    await screen.findByText('Beszélgetés a társsal')
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(await screen.findByText('FEATURES LIST PAGE')).toBeInTheDocument()
  })

  it('renders the reliability top errors as muted code text', async () => {
    renderPage()
    await screen.findByText('Beszélgetés a társsal')
    expect(screen.getByText('TIMEOUT')).toBeInTheDocument()
    expect(screen.getByText('RATE_LIMIT')).toBeInTheDocument()
  })
})

describe('AdminFeatureDetailPage — companion-off / unmapped feedback (real mode via MSW override)', () => {
  it('renders the honest "ki van kapcsolva" state instead of an empty feedback trend', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    setToken('t')
    server.use(http.get(`${API_BASE}/api/admin/features/:key`, () => HttpResponse.json({
      ...ADMIN_FEATURE_DETAIL_MOCK,
      feedbackTrend: null,
      downReasons: null,
    })))
    renderPage()
    expect(await screen.findByText('ki van kapcsolva')).toBeInTheDocument()
  })
})

describe('AdminFeatureDetailPage (real mode)', () => {
  it('renders the fetched detail', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    setToken('t')
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Beszélgetés a társsal')).toBeInTheDocument()
    })
  })

  it('shows the "Ismeretlen funkció" state with a back link when the key 404s', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    setToken('t')
    server.use(http.get(`${API_BASE}/api/admin/features/:key`, () =>
      HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND', message: 'nincs ilyen funkció' }], { status: 404 })))
    renderPage('nonexistent_slug')
    expect(await screen.findByText('Ismeretlen funkció.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  })
})
