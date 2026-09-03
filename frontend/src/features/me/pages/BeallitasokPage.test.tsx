import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BeallitasokPage } from '@/features/me/pages/BeallitasokPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { API_BASE } from '@/data/_client/api'
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

test('real mode (USER): sem a Beta admin, sem az AI-napló sor nem jelenik meg', async () => {
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
  renderPage()
  await screen.findByRole('button', { name: 'Értesítések' })
  expect(screen.queryByRole('button', { name: 'Beta admin' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'AI-napló' })).toBeNull()
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
