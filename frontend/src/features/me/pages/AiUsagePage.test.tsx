import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { AiUsagePage } from '@/features/me/pages/AiUsagePage'
import { LLM_CALLS_MOCK } from '@/data/me/llmUsageHooks'

afterEach(() => vi.unstubAllEnvs())

function renderPage() {
  return render(
    <MemoryRouter>
      <AiUsagePage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AiUsagePage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('opens on the week period with the header numbers and the call list', () => {
    renderPage()

    expect(screen.getByText('AI-napló')).toBeInTheDocument()
    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('$1.86')).toBeInTheDocument()
    // the breakdown and the list both render. `companion_hypothesis` is BOTH a feature-breakdown
    // bar AND (independently, in LLM_CALLS_MOCK) the feature of a listed call, so a plain
    // getByText collides on two elements — scope to the breakdown's bar button (the call row is a
    // `link`, not a `button`), the same disambiguation the "applies a feature filter" test below
    // already relies on for `meal_draft`.
    expect(screen.getByRole('button', { name: /companion_hypothesis/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('switches the period and keeps the three options reachable', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Ma' }))
    expect(screen.getByRole('button', { name: 'Ma' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ez a hónap' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies a feature filter when a breakdown bar is tapped, and narrows the list with it', async () => {
    renderPage()
    const rowsBefore = screen.getAllByRole('link').length

    fireEvent.click(screen.getByRole('button', { name: /meal_draft/ }))

    // the active narrowing shows up as a clearable chip
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /meal_draft ✕/ })).toBeInTheDocument(),
    )
    // …and the list below actually shrinks — mock mode answers the FILTERS, like the server does
    // (LLM_CALLS_MOCK holds exactly one meal_draft call). A chip over an unchanged list was the
    // demo surface lying about what the filter does.
    // Mozaik re-face (mezo-d20.6.8): the back chip is now a PageHead <button> (navigate(-1)),
    // like every other re-faced subpage, not a <Link> — so `link` role only ever matches call
    // rows: exactly 1 remaining after the filter.
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1))
    expect(rowsBefore).toBeGreaterThan(2)
  })

  it('does not offer the load-more control when the window already covers every row', () => {
    renderPage()
    // The seed is 7 rows and the opening window is 50 — there is nothing more to fetch, so the
    // control must be absent (it used to be offered forever off a hardcoded hasMore: true).
    expect(screen.queryByRole('button', { name: /További hívások/ })).toBeNull()
  })

  // ── Mozaik re-face (mezo-d20.6.8): own subpage scaffold + the "~ becslés" disclosure ───────
  it('renders its own back chip (not the removed sub-nav Link) and the estimate footnote', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
    expect(
      screen.getByText('~ becslés — a modellárak tájékoztató jellegűek · Befagyasztott ártábla hívásonként.'),
    ).toBeInTheDocument()
  })
})

describe('AiUsagePage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('raises the requested window when more calls are loaded', async () => {
    const limits: string[] = []
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () =>
        HttpResponse.json({
          from: '2026-08-14',
          totals: { callCount: 60, successCount: 60, errorCount: 0, cancelledCount: 0, unpricedCount: 0, costUsd: 1, currency: 'USD' },
          features: [], models: [],
        }),
      ),
      http.get(`${API_BASE}/api/llm-usage/calls`, ({ request }) => {
        limits.push(new URL(request.url).searchParams.get('limit') ?? '')
        return HttpResponse.json({
          items: [LLM_CALLS_MOCK.items[0]],
          hasMore: true,
        })
      }),
    )

    renderPage()

    await waitFor(() => expect(limits).toEqual(['50']))
    fireEvent.click(screen.getByRole('button', { name: /További hívások/ }))
    await waitFor(() => expect(limits).toContain('100'))
  })

  it('omits the chip counts when the breakdown fails but the list succeeds', async () => {
    // Partial failure: `useDualQuery` hands back the honest-empty rollup on an error, so rendering
    // the counts would print "Siker 0 · Hiba 0 · Megszakadt 0" above a list of real rows. The
    // chips stay clickable (they filter server-side, on the list endpoint that DID answer).
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/api/llm-usage/calls`, () =>
        HttpResponse.json({ items: [LLM_CALLS_MOCK.items[0]], hasMore: false }),
      ),
    )

    renderPage()

    // the list rendered its row…
    await waitFor(() => expect(screen.getByText(/companion_chat/)).toBeInTheDocument())
    // …the rollup said so instead of showing zeros
    await waitFor(() =>
      expect(screen.getByText(/Nem sikerült betölteni az AI-használatot/)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Hiba' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hiba 0/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Siker 0/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Megszakadt 0/ })).toBeNull()
  })
})
