// mezo-d5iy.17: `me/beallitasok/admin` and `me/ai-usage/*` are legacy redirects into `/admin`
// that live INSIDE the AppLayout tree (reachable by any authenticated user, not just owners —
// e.g. an old bookmark or a stale in-app navigate() call). Unwrapped, a non-owner following one
// used to land on `/admin`, where AdminLayout fires an error toast and bounces them back to `/`
// — a jarring "eject" UX. `OwnerOnlyRedirect` (router.tsx) now gates both: owners still get the
// original redirect, non-owners are sent to `/` silently (no toast), and the pending window in
// between renders nothing rather than guessing.
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { setToken } from '@/data/_client/api'

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

const OWNER_ME = {
  id: 'u-owner', email: 'owner@mezo.local', name: 'Owner', role: 'OWNER',
  onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
}
const USER_ME = {
  id: 'u-anna', email: 'anna@mezo.local', name: 'Anna', role: 'USER',
  onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
}

describe('legacy /admin redirects (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('test-token') })
  afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

  it('owner following /me/beallitasok/admin still lands on /admin/accounts', async () => {
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(OWNER_ME)))
    const router = renderApp('/me/beallitasok/admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/accounts'))
  })

  it('non-owner following /me/beallitasok/admin is sent to / silently, no toast, no /admin visit', async () => {
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(USER_ME)))
    const router = renderApp('/me/beallitasok/admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.queryByText(/nincs jogosultság/i)).not.toBeInTheDocument()
  })

  it('owner following /me/ai-usage/* still lands on /admin/cost (LegacyPathRedirect keeps the trailing path)', async () => {
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(OWNER_ME)))
    const router = renderApp('/me/ai-usage/anything')
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/cost/anything'))
  })

  it('non-owner following /me/ai-usage/* is sent to / silently, no toast, no /admin visit', async () => {
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(USER_ME)))
    const router = renderApp('/me/ai-usage/anything')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.queryByText(/nincs jogosultság/i)).not.toBeInTheDocument()
  })

  it('renders nothing while /api/auth/me is still pending (no premature redirect either way)', async () => {
    let resolve!: () => void
    const pending = new Promise<void>((r) => { resolve = r })
    server.use(http.get(`${API_BASE}/api/auth/me`, async () => {
      await pending
      return HttpResponse.json(OWNER_ME)
    }))
    const router = renderApp('/me/beallitasok/admin')
    expect(router.state.location.pathname).toBe('/me/beallitasok/admin')
    resolve()
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/accounts'))
  })
})
