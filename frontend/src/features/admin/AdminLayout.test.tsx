import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { useArrival } from '@/shared/ui/mozaik/arrival'

// AdminLayout's own <nav> carries a real accessible name ("Admin navigáció" — see
// AdminRail.tsx). TabBar (frontend/src/app/TabBar.tsx) carries NO aria-label at all, so
// there is no accessible name to assert against for "the app tab bar is absent" — instead
// we assert that AdminLayout never renders the TabBar's `.tab-bar` DOM at all, which is the
// only way to genuinely distinguish the two layouts (TabBar is not even imported here, so
// this doubles as a smoke check that no other test pollutes the tree).

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderLayout(initial = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>admin content</div>} />
        </Route>
        <Route path="/" element={<div>app root</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AdminLayout (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the rail and the outlet for the owner', async () => {
    renderLayout()
    expect(await screen.findByText('admin content')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /admin navigáció/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Áttekintés/ })).toBeInTheDocument()
  })

  it('never renders the app tab bar', async () => {
    const { container } = renderLayout()
    await screen.findByText('admin content')
    expect(container.querySelector('.tab-bar')).not.toBeInTheDocument()
  })

  // Task 20 (mezo-d5iy.20): AdminLayout used to mount no ArrivalProvider at all, so every
  // `useArrival()`/`useSettledArrival()` consumer under it (every admin page's `EntranceGroup`)
  // fell back to arrival.tsx's context default of 'push' — ALWAYS, regardless of navigation —
  // and replayed its entrance choreography on every route change, including back/forward (POP)
  // navigation. Modeled directly on arrival.test.tsx's own `ArrivalProbe` pattern (a plain read
  // of `useArrival()`, not `EntranceGroup`'s `useState`-snapshotted `useSettledArrival()` — that
  // snapshot can lag the context by one render under MemoryRouter's synchronous test navigation,
  // which is a test-harness quirk of the snapshot-on-mount pattern itself, not something this
  // test needs to exercise): probe what value AdminLayout's own children actually see.
  function ArrivalProbe({ label, to }: { label: string; to: string }) {
    const navigate = useNavigate()
    const arrival = useArrival()
    return (
      <div>
        <output>{label}:{arrival}</output>
        <button onClick={() => navigate(to)}>go-forward</button>
        <button onClick={() => navigate(-1)}>go-back</button>
      </div>
    )
  }

  it('threads a back-navigation (POP) into the arrival context instead of defaulting to push', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/a']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="a" element={<ArrivalProbe label="page a" to="/admin/b" />} />
            <Route path="b" element={<ArrivalProbe label="page b" to="/admin/a" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
      { wrapper: QueryWrapper },
    )

    expect(await screen.findByText('page a:push')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'go-forward' }))
    // A forward (PUSH) navigation is a genuine arrival.
    expect(await screen.findByText('page b:push')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'go-back' }))
    // A back (POP) navigation is a return, not an arrival — without the ArrivalProvider fix
    // this would still read "push" (the context default), never "pop".
    expect(await screen.findByText('page a:pop')).toBeInTheDocument()
  })
})

describe('AdminLayout (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('sends a non-owner back to the app root', async () => {
    setToken('test-token')
    server.use(http.get(`${API_BASE}/api/auth/me`, () =>
      HttpResponse.json({
        id: 'u1', email: 'anna@mezo.local', name: 'Anna', role: 'USER',
        onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
      })))

    renderLayout()

    await waitFor(() => expect(screen.getByText('app root')).toBeInTheDocument())
  })

  it('does not bounce the owner while /api/auth/me is still pending', async () => {
    setToken('test-token')
    let resolve!: () => void
    const pending = new Promise<void>((r) => { resolve = r })
    server.use(http.get(`${API_BASE}/api/auth/me`, async () => {
      await pending
      return HttpResponse.json({
        id: 'u1', email: 'owner@mezo.local', name: 'Owner', role: 'OWNER',
        onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
      })
    }))

    renderLayout()

    // While the request is in flight, neither the redirect nor the outlet should have
    // fired yet — the layout must wait, not guess.
    expect(screen.queryByText('app root')).not.toBeInTheDocument()
    expect(screen.queryByText('admin content')).not.toBeInTheDocument()

    resolve()
    expect(await screen.findByText('admin content')).toBeInTheDocument()
  })
})
