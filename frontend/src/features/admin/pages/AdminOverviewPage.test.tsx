import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminOverviewPage } from '@/features/admin/pages/AdminOverviewPage'
import { ADMIN_OVERVIEW_MOCK, ADMIN_COST_MATRIX_MOCK } from '@/data/admin/adminInsightsMock'
import { featureLabel } from '@/features/admin/lib/labels'

// Pulzus (mezo-m079 Task 3) — the rebuilt admin landing: status band, 4 KPI posters, 2 trend
// tiles with Hungarian legends, 3 top-N tiles. Assertions per the task brief's Step 1 list.

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(<MemoryRouter><AdminOverviewPage /></MemoryRouter>, { wrapper: QueryWrapper })
}

describe('AdminOverviewPage / Pulzus (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the status band and the Pulzus heading', async () => {
    renderPage()
    expect(await screen.findByText('Pulzus')).toBeInTheDocument()
    // ADMIN_ALERTS_MOCK carries 2 alerts — the band's non-empty headline, not the all-clear one.
    expect(await screen.findByText(/dolog figyelmet kér/)).toBeInTheDocument()
  })

  it('renders the four KPI eyebrows', async () => {
    const { container } = renderPage()
    await screen.findByText('Pulzus')
    const eyebrows = Array.from(container.querySelectorAll('.mz-eyebrow')).map((el) => el.textContent)
    expect(eyebrows).toEqual(expect.arrayContaining(['Rendszer', 'Költés ma', 'Aktív ma', 'Memória']))
  })

  it('labels the cost trend legend with a Hungarian feature name from the mock cost matrix', async () => {
    renderPage()
    await screen.findByText('Pulzus')
    const topFeature = featureLabel(ADMIN_COST_MATRIX_MOCK.features[0]).label
    expect(screen.getByText(topFeature)).toBeInTheDocument()
  })

  it('renders the three top-list titles', async () => {
    renderPage()
    await screen.findByText('Pulzus')
    expect(screen.getByText('Kik viszik a költést · 7 nap')).toBeInTheDocument()
    expect(screen.getByText('Mire megy a pénz · 7 nap')).toBeInTheDocument()
    expect(screen.getAllByText('Csendes tesztelők').length).toBeGreaterThanOrEqual(1)
  })

  it('links "Kik viszik a költést" through to /admin/users', async () => {
    renderPage()
    await screen.findByText('Pulzus')
    const tile = screen.getByText('Kik viszik a költést · 7 nap').closest('.ad-top') as HTMLElement
    expect(tile).toBeTruthy()
    const link = tile.querySelector('a[href="/admin/users"]')
    expect(link).toBeInTheDocument()
  })

  it('renders the installation counters', async () => {
    const { container } = renderPage()
    await screen.findByText('Pulzus')
    const aktivTile = screen.getByText(/^aktív ma$/i).closest('.mz-tile') as HTMLElement
    expect(aktivTile.querySelector('.ad-big')?.textContent).toContain(String(ADMIN_OVERVIEW_MOCK.activeToday))
    expect(container).toBeTruthy()
  })
})

describe('AdminOverviewPage / Pulzus (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the fetched counters', async () => {
    renderPage()
    expect(await screen.findByText('Pulzus')).toBeInTheDocument()
    const aktivTile = (await screen.findByText(/^aktív ma$/i)).closest('.mz-tile') as HTMLElement
    await waitFor(() => expect(aktivTile.querySelector('.ad-big')).toBeInTheDocument())
    expect(aktivTile.querySelector('.ad-big')?.textContent).toContain(String(ADMIN_OVERVIEW_MOCK.activeToday))
  })

  it('shows a tile-level error with a retry when one query fails, without failing the page', async () => {
    server.use(http.get(`${API_BASE}/api/admin/usage/cost-matrix`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect((await screen.findAllByText(/nem elérhető/i)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /újra/i }).length).toBeGreaterThanOrEqual(1)
    // the rest of the page — driven by the still-healthy overview query — still rendered
    expect(screen.getByText('Pulzus')).toBeInTheDocument()
    expect(await screen.findByText(/^aktív ma$/i)).toBeInTheDocument()
  })
})
