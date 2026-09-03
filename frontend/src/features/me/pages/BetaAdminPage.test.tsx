import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { BetaAdminPage } from '@/features/me/pages/BetaAdminPage'
import { ADMIN_INVITES_MOCK, MOCK_TEMP_PASSWORD } from '@/data/admin/adminMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(<MemoryRouter><BetaAdminPage /></MemoryRouter>, { wrapper: QueryWrapper })
}

describe('BetaAdminPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('opens on Meghívók with both seeded codes, the used one labelled with its consumer', () => {
    renderPage()
    expect(screen.getByText('Beta admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Meghívók' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('MEZO-7KQ2-XN4P')).toBeInTheDocument()
    expect(screen.getByText(/felhasználta: Anna/)).toBeInTheDocument()
    // a used code cannot be revoked — exactly one Törlés (the open code)
    expect(screen.getAllByRole('button', { name: /Törlés/ })).toHaveLength(1)
  })

  it('mints a new labelled code from the input and shows it on top', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Címke'), { target: { value: 'Csaba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Új kód' }))
    await waitFor(() => expect(screen.getAllByText(/^MEZO-/)).toHaveLength(ADMIN_INVITES_MOCK.length + 1))
    expect(screen.getAllByText('Csaba')[0]).toBeInTheDocument()
  })

  it('revokes the open code', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Törlés/ }))
    await waitFor(() => expect(screen.queryByText('MEZO-7KQ2-XN4P')).toBeNull())
  })


  it('lists the accounts on Felhasználók, resets a password into a sheet, and toggles a status', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Felhasználók' }))
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Béla')).toBeInTheDocument()
    // the owner row has no toggle (self) — two toggles for the two USER rows
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.getByRole('switch', { name: 'Letiltás: Béla' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('switch', { name: 'Letiltás: Béla' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Letiltás: Béla' })).toHaveAttribute('aria-checked', 'false'))

    fireEvent.click(screen.getAllByRole('button', { name: /Jelszó-reset/ })[0])
    await waitFor(() => expect(screen.getByText('Ideiglenes jelszó')).toBeInTheDocument())
    expect(screen.getByText(MOCK_TEMP_PASSWORD)).toBeInTheDocument()
  })
})

describe('BetaAdminPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the MSW lists and POSTs a new code', async () => {
    let posted: unknown = null
    server.use(http.post(`${API_BASE}/api/admin/invites`, async ({ request }) => {
      posted = await request.json()
      return HttpResponse.json({ ...ADMIN_INVITES_MOCK[0], id: 'real-new', code: 'MEZO-REAL-CODE', label: 'Dóra' })
    }))
    renderPage()
    await waitFor(() => expect(screen.getByText('MEZO-7KQ2-XN4P')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Címke'), { target: { value: 'Dóra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Új kód' }))
    await waitFor(() => expect(posted).toEqual({ label: 'Dóra', expiresInDays: null }))
  })

  it('shows the honest empty when there is no invite', async () => {
    server.use(http.get(`${API_BASE}/api/admin/invites`, () => HttpResponse.json([])))
    renderPage()
    await waitFor(() => expect(screen.getByText('Nincs nyitott meghívó.')).toBeInTheDocument())
  })

  it('keeps Törlés disabled for the in-flight DELETE and re-enables it once the network resolves', async () => {
    const deferred: { resolve: (() => void) | null } = { resolve: null }
    server.use(http.delete(`${API_BASE}/api/admin/invites/:id`, () => new Promise((resolve) => {
      deferred.resolve = () => resolve(new HttpResponse(null, { status: 204 }))
    })))
    renderPage()
    await waitFor(() => expect(screen.getByText('MEZO-7KQ2-XN4P')).toBeInTheDocument())
    const del = screen.getByRole('button', { name: /Törlés/ })
    fireEvent.click(del)
    await waitFor(() => expect(del).toBeDisabled())
    deferred.resolve?.()
    // the GET handler stays the static seed, so re-enablement (not row removal) is the
    // observable proof that the mutation settled and released the guard.
    await waitFor(() => expect(del).not.toBeDisabled())
  })

  // Fix (mezo-qw37.3 review): mint/deleteInvite/resetFor/setStatus all call `mutateAsync`, which
  // rejects on failure — a bare `void` on the click handler silences the lint but not the
  // rejection, so a 500 (or a non-owner deep-linking here past the client-side gate) used to
  // escape as an unhandled promise rejection. Each site now ends in `.catch(() => {})`.
  it('does not leak an unhandled rejection when a mutation 500s, and leaves the page usable', async () => {
    const seenRejections: unknown[] = []
    const onUnhandledRejection = (event: PromiseRejectionEvent) => { seenRejections.push(event.reason) }
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    server.use(http.delete(`${API_BASE}/api/admin/invites/:id`, () => HttpResponse.json(
      { messages: [{ code: 'ADMIN_INVITE_USED', text: 'error' }] }, { status: 409 })))
    try {
      renderPage()
      await waitFor(() => expect(screen.getByText('MEZO-7KQ2-XN4P')).toBeInTheDocument())
      const del = screen.getByRole('button', { name: /Törlés/ })
      fireEvent.click(del)
      await waitFor(() => expect(del).not.toBeDisabled())
      // page stays usable — the seed row is still there and other controls still work
      expect(screen.getByText('MEZO-7KQ2-XN4P')).toBeInTheDocument()
      // give any stray rejection a microtask/macrotask to surface before asserting its absence
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(seenRejections).toEqual([])
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  })

  it('keeps Jelszó-reset and the status toggle disabled for the in-flight reset-password call', async () => {
    const deferred: { resolve: (() => void) | null } = { resolve: null }
    server.use(http.post(`${API_BASE}/api/admin/users/:id/reset-password`, () => new Promise((resolve) => {
      deferred.resolve = () => resolve(HttpResponse.json({ temporaryPassword: 'RealTempPw2026' }))
    })))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Felhasználók' }))
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument())
    const reset = screen.getAllByRole('button', { name: /Jelszó-reset/ })[0]
    const toggle = screen.getByRole('switch', { name: 'Letiltás: Béla' })
    fireEvent.click(reset)
    await waitFor(() => expect(reset).toBeDisabled())
    expect(toggle).toBeDisabled()
    deferred.resolve?.()
    await waitFor(() => expect(screen.getByText('Ideiglenes jelszó')).toBeInTheDocument())
    expect(screen.getByText('RealTempPw2026')).toBeInTheDocument()
  })
})
