import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { routes } from '@/app/router'
import { SPLASH_DURATION_MS } from '@/app/startupChoreography'
import { API_BASE, setToken } from '@/data/_client/api'
import type { MeResponse } from '@/data/auth/authApi'
import { getLang, setLang } from '@/shared/i18n'
import { server } from '@/test/msw/server'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

// A language switch must not reset what has app-root lifetime (mezo-n4wf5.11, final review). These
// tests mount what `main.tsx` mounts -- `AppProviders` around the real routes -- on the Settings
// page that carries the switch.
// The app's query client is one module-level instance: each test hands it back empty.
let client: QueryClient | undefined
function Probe() { client = useQueryClient(); return null }

function renderApp() {
  const router = createMemoryRouter(routes, { initialEntries: ['/settings/general'] })
  return render(<AppProviders><Probe /><RouterProvider router={router} /></AppProviders>)
}

const group = (name: string) => screen.getByRole('group', { name })
const meBody = (language: 'hu' | 'en'): MeResponse => ({
  id: '00000000-0000-0000-0000-000000000001', email: 'owner@mezo.local', name: 'Owner',
  role: 'OWNER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest', language,
})

afterEach(async () => {
  vi.useRealTimers()
  if (client) await waitFor(() => expect(client!.isMutating()).toBe(0))
  client?.clear(); client = undefined
 })
afterEach(() => { vi.unstubAllEnvs(); setToken(null); setLang('hu', { persist: false }) })

describe('the startup intro and a language switch', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); localStorage.clear() })

  it('the intro plays once: pressing English does not bring it back, and the page is in English', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { container } = renderApp()
    expect(getLang()).toBe('hu')
    expect(container.querySelector('.startup-stage')).not.toBeNull() // not skipped: the intro is up
    expect(container.querySelector('.startup-content')).toHaveAttribute('inert')
    await act(async () => { await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS) })
    vi.useRealTimers()
    expect(container.querySelector('.startup-stage')).toBeNull()
    const phone = container.querySelector('.startup-content .phone-screen')
    expect(phone).not.toBeNull()

    await userEvent.click(within(group('Az app nyelve')).getByRole('button', { name: 'English' }))

    expect(getLang()).toBe('en')
    expect(container.querySelector('.startup-stage')).toBeNull()
    expect(container.querySelector('.fo-sp')).toBeNull()
    expect(container.querySelector('.startup-content')).not.toHaveAttribute('inert')
    expect(screen.getByRole('heading', { level: 2, name: 'Language' })).toBeInTheDocument()
    expect(within(group('App language')).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    // the shell above the remount boundary is the same node: the phone frame was never remounted
    expect(container.querySelector('.startup-content .phone-screen')).toBe(phone)
  })

  it('a switch while the intro is still playing does not restart it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { container } = renderApp()
    await act(async () => { await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS - 500) })
    const stage = container.querySelector('.startup-stage')
    expect(stage).not.toBeNull()
    expect(screen.getByRole('status', { name: 'Boop betöltése' })).toBeInTheDocument()
    act(() => setLang('en', { persist: false }))
    expect(container.querySelector('.startup-stage')).toBe(stage) // the same intro, still running
    expect(screen.getByRole('status', { name: 'Loading Boop' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(container.querySelector('.startup-stage')).toBeNull() // and it ends on its original deadline
  })
})

describe('a failed language save (real mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    localStorage.clear()
    localStorage.setItem('mezo.splash.skip', '1')
    setToken('t')
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
  })

  it.each([
    ['500', () => HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'x' }], { status: 500 })],
    ['network error', () => HttpResponse.error()],
  ])('%s: after the rollback the save-failed toast is on screen, in Hungarian, exactly once', async (_n, resolver) => {
    server.use(http.put(`${API_BASE}/api/auth/me/language`, resolver))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderApp()
    await userEvent.click(within(await screen.findByRole('group', { name: 'Az app nyelve' })).getByRole('button', { name: 'English' }))
    await waitFor(() => expect(getLang()).toBe('hu')) // rolled back
    const g = await screen.findByRole('group', { name: 'Az app nyelve' })
    expect(within(g).getByRole('button', { name: 'Magyar' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
    const toasts = screen.getAllByTestId('toast-item')
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toHaveTextContent('Mentés sikertelen — próbáld újra')
    expect(toasts[0]).toHaveAttribute('data-kind', 'error')
    expect(document.body.contains(toasts[0])).toBe(true)
    err.mockRestore()
  })
})
