import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryProvider } from './QueryProvider'

/**
 * mezo-l0k0: a failed owner-token bootstrap must NEVER silently render the app
 * unauthenticated — it retries with backoff, and a persistent failure shows the explicit
 * degraded screen with a manual retry instead of the children.
 */
describe('QueryProvider bootstrap recovery (real mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
  })
  afterEach(() => vi.unstubAllEnvs())

  const renderApp = () =>
    render(
      <QueryProvider>
        <div data-testid="app">APP</div>
      </QueryProvider>,
    )

  test('renders the app when the bootstrap succeeds', async () => {
    renderApp()
    expect(await screen.findByTestId('app')).toBeInTheDocument()
  })

  test('a transient failure is retried and the app still comes up', async () => {
    let calls = 0
    server.use(
      http.post(`${API_BASE}/api/auth/login`, () => {
        calls += 1
        if (calls === 1) return HttpResponse.error()
        return HttpResponse.json({ token: 'tok-1' })
      }),
    )
    renderApp()
    expect(await screen.findByTestId('app', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  test('a persistent failure renders the degraded screen — NEVER the unauthenticated app', async () => {
    server.use(http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.error()))
    renderApp()
    expect(
      await screen.findByText(/Nem érem el a szervert/, undefined, { timeout: 15000 }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('app')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  }, 20000)

  test('the manual retry recovers once the backend is back', async () => {
    let up = false
    server.use(
      http.post(`${API_BASE}/api/auth/login`, () =>
        up ? HttpResponse.json({ token: 'tok-2' }) : HttpResponse.error(),
      ),
    )
    renderApp()
    const retry = await screen.findByRole('button', { name: 'Újra' }, { timeout: 15000 })
    up = true
    await act(async () => { retry.click() })
    expect(await screen.findByTestId('app', undefined, { timeout: 5000 })).toBeInTheDocument()
  }, 25000)
})
