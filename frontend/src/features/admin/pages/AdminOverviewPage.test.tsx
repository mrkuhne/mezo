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
import { costDeltaCopy, deltaVsTrailingAvg } from '@/features/admin/lib/adminViz'

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

  it('renders the three top-list titles, each as a SINGLE eyebrow line (fix round 1: no duplicate caption)', async () => {
    renderPage()
    await screen.findByText('Pulzus')
    expect(screen.getAllByText('Kik viszik a költést · 7 nap')).toHaveLength(1)
    expect(screen.getAllByText('Mire megy a pénz · 7 nap')).toHaveLength(1)
    expect(screen.getAllByText('Csendes tesztelők')).toHaveLength(1)
    // no leftover TopListTile-internal heading nodes (fix round 1 removed both)
    expect(document.querySelectorAll('.ad-eyebrow')).toHaveLength(0)
    expect(document.querySelectorAll('.ad-top h3')).toHaveLength(0)
  })

  it('links "Kik viszik a költést" through to /admin/users', async () => {
    renderPage()
    await screen.findByText('Pulzus')
    const tile = screen.getByText('Kik viszik a költést · 7 nap').closest('.mz-tile') as HTMLElement
    expect(tile).toBeTruthy()
    const link = tile.querySelector('a[href="/admin/users"]')
    expect(link).toBeInTheDocument()
  })

  it('renders the Költés ma delta chip with a worded comparison to the trailing weekly average', async () => {
    renderPage()
    await screen.findByText('Pulzus')
    const delta = deltaVsTrailingAvg(ADMIN_OVERVIEW_MOCK.costSeries.map((d) => d.amountUsd), 7)
    expect(screen.getByText(costDeltaCopy(delta))).toBeInTheDocument()
  })

  it('renders the Csendes tesztelők rows without a share bar', async () => {
    const { container } = renderPage()
    await screen.findByText('Pulzus')
    const quietTile = screen.getByText('Csendes tesztelők').closest('.mz-tile') as HTMLElement
    expect(quietTile.querySelectorAll('.sharebar')).toHaveLength(0)
    expect(container).toBeTruthy()
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

  // Final review F2: an info-only alert set (nothing actionable) must NOT read as
  // "N figyelmeztetés" on a coral wash — it renders the all-good ring plus a muted info tag.
  it('renders the Rendszer KPI as all-good + a muted info tag when every alert is info-only severity', async () => {
    server.use(http.get(`${API_BASE}/api/admin/alerts`, () => HttpResponse.json({
      generatedAt: new Date().toISOString(),
      alerts: [{
        key: 'tester_quiet', severity: 'info', title: 'Egy tesztelő régóta nem jelentkezett be',
        detail: 'Anna 25 napja nem aktív.', link: '/admin/users',
      }],
    })))
    renderPage()
    await screen.findByText('Pulzus')
    const rendszerTile = (await screen.findByText(/^rendszer$/i)).closest('.mz-tile') as HTMLElement
    await waitFor(() => expect(rendszerTile.querySelector('.ad-tag')).toBeInTheDocument())
    // no bogus "N figyelmeztetés" numeral, and no unstyled `ad-tag null`
    expect(rendszerTile.querySelector('.ad-big')).not.toBeInTheDocument()
    expect(rendszerTile.querySelector('.ad-tag')).toHaveClass('ad-tag', 'mut')
    expect(rendszerTile.querySelector('.ad-tag')).toHaveTextContent('1 információ')
    expect(rendszerTile).toHaveClass('mz-w-sage')
  })
})
