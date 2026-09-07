import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminOverviewPage } from '@/features/admin/pages/AdminOverviewPage'
import { ADMIN_OVERVIEW_MOCK } from '@/data/admin/adminInsightsMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(<MemoryRouter><AdminOverviewPage /></MemoryRouter>, { wrapper: QueryWrapper })
}

describe('AdminOverviewPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the installation counters', async () => {
    renderPage()
    expect(await screen.findByText('Áttekintés')).toBeInTheDocument()
    expect(screen.getByText(String(ADMIN_OVERVIEW_MOCK.userCount))).toBeInTheDocument()
  })

  it('draws a sparkline per domain', async () => {
    renderPage()
    const charts = await screen.findAllByRole('img', { name: /30 nap/ })
    expect(charts.length).toBeGreaterThanOrEqual(3)
  })
})

describe('AdminOverviewPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the fetched counters', async () => {
    renderPage()
    expect(await screen.findByText('Áttekintés')).toBeInTheDocument()
    expect(await screen.findByText(String(ADMIN_OVERVIEW_MOCK.userCount))).toBeInTheDocument()
  })

  it('shows a tile-level error with a retry when one query fails, without failing the page', async () => {
    server.use(http.get(`${API_BASE}/api/admin/usage/cost-matrix`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect((await screen.findAllByText(/nem elérhető/i)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /újra/i }).length).toBeGreaterThanOrEqual(1)
    // the rest of the page — driven by the still-healthy overview query — still rendered
    expect(screen.getByText('Áttekintés')).toBeInTheDocument()
    expect(await screen.findByText(String(ADMIN_OVERVIEW_MOCK.userCount))).toBeInTheDocument()
  })
})
