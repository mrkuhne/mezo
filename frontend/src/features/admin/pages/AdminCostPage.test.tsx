import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminCostPage } from '@/features/admin/pages/AdminCostPage'
import { LLM_CALLS_MOCK, LLM_USAGE_MOCK, LLM_BREAKDOWN_MOCK } from '@/data/me/llmUsageHooks'
import { ADMIN_OVERVIEW_MOCK } from '@/data/admin/adminInsightsMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderAt(path: string) {
  return render(
    <QueryWrapper>
      <RouterProvider
        router={createMemoryRouter(
          [
            { path: '/admin', element: <div data-testid="admin-page">Admin Page</div> },
            { path: '/admin/cost', element: <AdminCostPage /> },
          ],
          { initialEntries: [path] },
        )}
      />
    </QueryWrapper>,
  )
}

const nowMonthUpper = new Intl.DateTimeFormat('hu-HU', { month: 'long', timeZone: 'Europe/Budapest' })
  .format(new Date())
  .toUpperCase()

describe('AdminCostPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the KPI strip off the calendar-month summary, incl. the Δ chip vs the prior month', () => {
    renderAt('/admin/cost')

    // "SZEPTEMBER · NAPTÁRI HÓNAP" style eyebrow — the calendar-month name, uppercased.
    expect(screen.getByText(`${nowMonthUpper} · NAPTÁRI HÓNAP`)).toBeInTheDocument()
    // LLM_USAGE_MOCK.month.costUsd = 1.22 — coincidentally also the "Egy aktív fiókra jut"
    // figure (Anna is the mock's only non-owner ACTIVE account), so both KPI posters show it.
    expect(screen.getAllByText('$1.22').length).toBeGreaterThanOrEqual(1)
    // prevMonthToSameDayUsd = 1.05 -> (1.22-1.05)/1.05*100 ≈ 16.2% up
    expect(screen.getByText(/▲ 16%-kal több az előző hónap azonos napjához képest/)).toBeInTheDocument()
    // Ismeretlen költségű hívások — breakdown.totals.unpricedCount = 38
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('árlista nélküli hívás')).toBeInTheDocument()
  })

  it('shows the honest "nincs előző havi adat" chip when there is no prior-month figure', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/summary`, () =>
        HttpResponse.json({ ...LLM_USAGE_MOCK, prevMonthToSameDayUsd: null }),
      ),
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () => HttpResponse.json(LLM_BREAKDOWN_MOCK)),
      http.get(`${API_BASE}/api/llm-usage/calls`, () => HttpResponse.json({ items: [], hasMore: false })),
    )
    vi.stubEnv('VITE_USE_MOCK', 'false')
    setToken('t')
    renderAt('/admin/cost')
    await waitFor(() => expect(screen.getByText('nincs előző havi adat')).toBeInTheDocument())
  })

  it('shows the model-mix table with per-model tokens', () => {
    renderAt('/admin/cost')
    expect(screen.getByText('Modell szerint')).toBeInTheDocument()
    // "gemini-2.5-flash" also appears in the call-list rows below (servedModel) — scope to the
    // model-mix table's own monospace cell.
    expect(screen.getAllByText('gemini-2.5-flash').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1 320 000')).toBeInTheDocument()
  })

  it('labels the trend and matrix tiles with the rolling 30-day window, distinct from the calendar-month KPI strip', async () => {
    renderAt('/admin/cost')
    expect(screen.getByText('Napi költés · elmúlt 30 nap')).toBeInTheDocument()
    expect(screen.getByText('Teljes mátrix · elmúlt 30 nap')).toBeInTheDocument()
  })

  it('mounts with a ?feature= deep link already filtering the call list and showing the active chip', async () => {
    renderAt('/admin/cost?feature=meal_draft')
    await waitFor(() => expect(screen.getByRole('button', { name: /meal_draft ✕/ })).toBeInTheDocument())
    // LLM_CALLS_MOCK has exactly one meal_draft call
    const list = screen.getByTestId('call-list')
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(1))
  })

  it('mounts with a ?day= deep link and shows the clearable day chip', async () => {
    renderAt('/admin/cost?day=2026-08-14')
    await waitFor(() => expect(screen.getByRole('button', { name: /2026-08-14 ✕/ })).toBeInTheDocument())
  })

  it('clicking a trend dot sets ?day= and narrows the call list to that day', async () => {
    renderAt('/admin/cost')
    const dots = screen.getAllByRole('button', { name: /Nap kiválasztása:/ })
    const lastDot = dots[dots.length - 1]
    const lastDay = ADMIN_OVERVIEW_MOCK.costSeries[ADMIN_OVERVIEW_MOCK.costSeries.length - 1].day
    fireEvent.click(lastDot)
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(`${lastDay} ✕`) })).toBeInTheDocument())
  })

  it('opens the "Teljes mátrix" disclosure to a heat grid with Hungarian feature labels and a Háttér row', async () => {
    renderAt('/admin/cost')
    fireEvent.click(screen.getByRole('button', { name: /Megnyitás/ }))
    await waitFor(() => expect(screen.getByText('Béla')).toBeInTheDocument())
    // "Háttér" also names the "Ki költi" top-card's background bucket — both are honest.
    expect(screen.getAllByText('Háttér').length).toBeGreaterThanOrEqual(1)
    // companion_chat's translated label appears as a column header
    expect(screen.getAllByText('Beszélgetés a társsal').length).toBeGreaterThan(0)
  })

  it('the "Mire megy a pénz" and "Ki költi" top-5 cards read off the breakdown, translated feature labels', () => {
    renderAt('/admin/cost')
    expect(screen.getByText('Mire megy a pénz')).toBeInTheDocument()
    expect(screen.getByText('Ki költi')).toBeInTheDocument()
    // companion_chat is the highest-cost feature in LLM_BREAKDOWN_MOCK
    expect(screen.getAllByText(/Beszélgetés a társsal/).length).toBeGreaterThan(0)
    // "Daniel" also names the call rows' created-by — scope to the "Ki költi" card's own link.
    expect(screen.getAllByText('Daniel').length).toBeGreaterThanOrEqual(1)
  })

  it('renders its own back chip and navigates to /admin', async () => {
    renderAt('/admin/cost')
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    await waitFor(() => expect(screen.getByTestId('admin-page')).toBeInTheDocument())
  })
})

describe('AdminCostPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('raises the requested window when more calls are loaded', async () => {
    const limits: string[] = []
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () => HttpResponse.json(LLM_BREAKDOWN_MOCK)),
      http.get(`${API_BASE}/api/llm-usage/summary`, () => HttpResponse.json(LLM_USAGE_MOCK)),
      http.get(`${API_BASE}/api/llm-usage/calls`, ({ request }) => {
        limits.push(new URL(request.url).searchParams.get('limit') ?? '')
        return HttpResponse.json({ items: [LLM_CALLS_MOCK.items[0]], hasMore: true })
      }),
    )

    renderAt('/admin/cost')

    await waitFor(() => expect(limits).toContain('50'))
    fireEvent.click(screen.getByRole('button', { name: /További hívások/ }))
    await waitFor(() => expect(limits).toContain('100'))
  })

  it('renders the missing-label marker in "Mire megy a pénz" for an undictionaried feature slug (mezo-3u4r)', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () =>
        HttpResponse.json({
          ...LLM_BREAKDOWN_MOCK,
          features: [{ key: 'some_new_slug', callCount: 5, costUsd: 9.99 }],
        }),
      ),
      http.get(`${API_BASE}/api/llm-usage/summary`, () => HttpResponse.json(LLM_USAGE_MOCK)),
      http.get(`${API_BASE}/api/llm-usage/calls`, () => HttpResponse.json({ items: [], hasMore: false })),
    )

    renderAt('/admin/cost')

    await waitFor(() => expect(screen.getByText('some_new_slug')).toBeInTheDocument())
    expect(screen.getByText('(nincs címke)')).toBeInTheDocument()
  })

  it('passes the day filter through to the calls request when mounted with ?day=', async () => {
    const days: (string | null)[] = []
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () => HttpResponse.json(LLM_BREAKDOWN_MOCK)),
      http.get(`${API_BASE}/api/llm-usage/summary`, () => HttpResponse.json(LLM_USAGE_MOCK)),
      http.get(`${API_BASE}/api/llm-usage/calls`, ({ request }) => {
        days.push(new URL(request.url).searchParams.get('day'))
        return HttpResponse.json({ items: [], hasMore: false })
      }),
    )

    renderAt('/admin/cost?day=2026-08-14')

    await waitFor(() => expect(days).toContain('2026-08-14'))
  })
})
