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

  it('applies a feature filter when a breakdown bar is tapped', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /meal_draft/ }))

    // the active narrowing shows up as a clearable chip
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /meal_draft ✕/ })).toBeInTheDocument(),
    )
  })

  it('offers the load-more control only while the server says more rows exist', () => {
    renderPage()
    // LLM_CALLS_MOCK.hasMore is true → the control is offered
    expect(screen.getByRole('button', { name: /További hívások/ })).toBeInTheDocument()
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
})
