import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BeallitasokPage } from '@/features/me/pages/BeallitasokPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { API_BASE, setToken } from '@/data/_client/api'
import { tokenStore } from '@/data/_client/tokenStore'
import { server } from '@/test/msw/server'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'

// Beállítások oldal — a korábbi téma-only SettingsSheet utódja (hub-tile-reorg spec).
// Csoportosított lista: Téma választó helyben + Értesítések / AI-napló sorok, amelyek a
// meglévő oldalakra navigálnak. A téma-viselkedés a sheet-teszt kontraktusának portja.

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  localStorage.setItem('mezo-theme', 'light')
})
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/me/beallitasok']}>
          <TutorialProvider>
            <Routes>
              <Route path="/me/beallitasok" element={<BeallitasokPage />} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </TutorialProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('a Téma választó helyben él az oldalon és átbillenti a data-theme-et', async () => {
  renderPage()
  expect(await screen.findByText('Téma')).toBeInTheDocument()
  // Manual light => no attribute (light is the CSS base); choosing Sötét flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Sötét/ }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('az Értesítések sor a kapcsolók oldalára navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Értesítések' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek/beallitasok')
})

test('az AI-napló sor az AI-napló oldalra navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'AI-napló' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ai-usage')
})

test('a vissza-chip az Én hubra visz', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('loc')).toHaveTextContent(/^\/me$/)
})

test('mock mode (owner): a Beta admin sor látszik és az admin oldalra visz', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Beta admin' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/beallitasok/admin')
})

test('real mode (USER): sem a Beta admin, sem az AI-napló sor nem jelenik meg, és a hívás el sem indul', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { setToken } = await import('@/data/_client/api')
  const { http, HttpResponse } = await import('msw')
  const { server } = await import('@/test/msw/server')
  const { API_BASE } = await import('@/test/msw/handlers')
  setToken('t')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '00000000-0000-0000-0000-000000000002', email: 'anna@test.local', name: 'Anna',
    role: 'USER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
  })))
  // The endpoint is OWNER-only (LlmUsageController.requireOwner()) — a USER hitting it
  // would 403 (twice with the query's retry). Count hits rather than trusting the row
  // staying hidden as proof the fetch never fired.
  let hits = 0
  server.use(http.get(`${API_BASE}/api/llm-usage/summary`, () => {
    hits += 1
    return HttpResponse.json({ day: { callCount: 0, costUsd: null, currency: 'USD' }, week: { callCount: 0, costUsd: null, currency: 'USD' }, month: { callCount: 0, costUsd: null, currency: 'USD' } })
  }))
  renderPage()
  await screen.findByRole('button', { name: 'Értesítések' })
  expect(screen.queryByRole('button', { name: 'Beta admin' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'AI-napló' })).toBeNull()
  // Settle any pending microtasks/effects before asserting the negative.
  await new Promise((r) => setTimeout(r, 0))
  expect(hits).toBe(0)
  setToken(null)
})

test('real mode (OWNER): az AI-napló sor mutatja a heti összesítőt', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { setToken } = await import('@/data/_client/api')
  const { http, HttpResponse } = await import('msw')
  const { server } = await import('@/test/msw/server')
  const { API_BASE } = await import('@/test/msw/handlers')
  setToken('t')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '00000000-0000-0000-0000-000000000001', email: 'owner@mezo.local', name: 'Owner',
    role: 'OWNER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
  })))
  server.use(http.get(`${API_BASE}/api/llm-usage/summary`, () => HttpResponse.json({
    day: { callCount: 1, costUsd: 0, currency: 'USD' },
    week: { callCount: 9, costUsd: 0.05, currency: 'USD' },
    month: { callCount: 40, costUsd: 0.2, currency: 'USD' },
  })))
  renderPage()
  expect(await screen.findByText(/9 hívás/)).toBeInTheDocument()
  setToken(null)
})

test('a Kalauzok sor törli a seen-állapotot', async () => {
  localStorage.setItem('mezo.kalauz.v1', JSON.stringify({ fuel: { version: 1, seenAt: '2026-08-30T10:00:00.000Z', completedAt: null, dismissedAtStep: null } }))
  renderPage()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Kalauzok újranézése' }))
  await waitFor(() => expect(localStorage.getItem('mezo.kalauz.v1')).toBe('{}'))
})

test('a sor visszajelzést ad, és hiba esetén nem hazudik sikert', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.delete(`${API_BASE}/api/tutorial/progress`, () => new HttpResponse(null, { status: 500 })))
  renderPage()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Kalauzok újranézése' }))
  expect(await screen.findByText('Most nem sikerült — próbáld újra.')).toBeInTheDocument()
})

// Fiók csoport (S2, mezo-qw37.2): a fiók azonossága a /api/auth/me-ből, jelszócsere sheetben,
// kijelentkezés csak ott, ahol van munkamenet mögötte.
test('a Fiók csoport a nevet és az e-mailt mutatja, a jelszócsere sheetet nyit', async () => {
  renderPage()
  expect(await screen.findByText('Fiók')).toBeInTheDocument()
  expect(screen.getByText('Daniel')).toBeInTheDocument()
  expect(screen.getByText('daniel@mezo.local')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó módosítása' }))
  expect(await screen.findByRole('dialog', { name: 'Új jelszó' })).toBeInTheDocument()
})

test('mock módban nincs Kijelentkezés sor (nincs mögötte munkamenet)', async () => {
  renderPage()
  await screen.findByText('Fiók')
  expect(screen.queryByRole('button', { name: 'Kijelentkezés' })).not.toBeInTheDocument()
})

test('valós módban a Kijelentkezés törli a tokent', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t'); tokenStore.set('t')
  renderPage()
  expect(await screen.findByText('Owner')).toBeInTheDocument()
  expect(screen.getByText('owner@mezo.local')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Kijelentkezés' }))
  expect(tokenStore.get()).toBeNull()
  setToken(null)
})
