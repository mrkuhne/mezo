import { Fragment } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { ThemeProvider } from '@/app/ThemeProvider'
import { API_BASE, setToken } from '@/data/_client/api'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import type { MeResponse } from '@/data/auth/authApi'
import { BeallitasokPage } from '@/features/me/pages/BeallitasokPage'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { LANG_KEY, LanguageProvider, getLang, setLang } from '@/shared/i18n'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { server } from '@/test/msw/server'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

// The „Nyelv" block on /settings/general: a two-button group stored with the account.
let client!: QueryClient
function Probe() { client = useQueryClient(); return null }

/** `provider: false` leaves the account-language sync out, so a test can pin the language with `setLang`
 *  (the mock account says Hungarian and the sync would win) and watch one DOM node follow it. */
function renderPage({ provider = true }: { provider?: boolean } = {}) {
  const Sync = provider ? LanguageProvider : Fragment
  return render(
    <QueryProvider>
      <Sync>
        <Probe />
        <ThemeProvider>
          <MemoryRouter initialEntries={['/settings/general']}>
            <TutorialProvider>
              <Routes><Route path="/settings/general" element={<BeallitasokPage />} /><Route path="*" element={null} /></Routes>
            </TutorialProvider>
          </MemoryRouter>
        </ThemeProvider>
      </Sync>
    </QueryProvider>,
  )
}

const meBody = (language: 'hu' | 'en'): MeResponse => ({
  id: '00000000-0000-0000-0000-000000000001', email: 'owner@mezo.local', name: 'Owner',
  role: 'OWNER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest', language,
})
const group = (name: string) => screen.getByRole('group', { name })

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); localStorage.clear() })
afterEach(() => { client?.clear(); vi.unstubAllEnvs(); setToken(null); setLang('hu', { persist: false }) })

describe('Nyelv block (mock mode)', () => {
  it('is the first section, above „Fiók", with the new Hungarian hero sentence', async () => {
    renderPage()
    await screen.findByText('Daniel')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.slice(0, 2)).toEqual(['Nyelv', 'Fiók'])
    expect(screen.getByText('Ugyanaz a világ. A saját nyelveden és szokásaiddal.')).toBeInTheDocument()
  })

  it('shows Magyar pressed by default, English not pressed', async () => {
    renderPage()
    const g = group('Az app nyelve')
    expect(within(g).getByRole('button', { name: 'Magyar' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the body sentence and the in-progress note in Hungarian', () => {
    renderPage()
    expect(screen.getByText('Az app, a csapat és a Mezo ezen a nyelven szól hozzád. Amit eddig írtál vagy kaptál, úgy marad, ahogy íródott.')).toBeInTheDocument()
    expect(screen.getByText('Az angol változat készül, egyes oldalak még magyarul jelennek meg.')).toBeInTheDocument()
  })

  it('pressing English switches the page to English and stores en (device cache and cached me)', async () => {
    renderPage()
    await screen.findByText('Daniel')
    await userEvent.click(within(group('Az app nyelve')).getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'At home in the app.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Language' })).toBeInTheDocument()
    const g = group('App language')
    expect(within(g).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g).getByRole('button', { name: 'Magyar' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('The same world. In your language, with your habits.')).toBeInTheDocument()
    expect(screen.getByText('The app, the team and Mezo speak to you in this language. What you wrote or received before stays as it was written.')).toBeInTheDocument()
    expect(screen.getByText('English is in progress — some pages still appear in Hungarian.')).toBeInTheDocument()
    expect(client.getQueryData<MeResponse>(ME_QUERY_KEY)?.language).toBe('en')
    expect(localStorage.getItem(LANG_KEY)).toBe('en')
    expect(getLang()).toBe('en')
  })

  it('the English page: Account, Around you and Owner tools sections', async () => {
    setLang('en', { persist: false })
    renderPage({ provider: false })
    await screen.findByText('Daniel')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Language', 'Account', 'Around you', 'Owner tools'])
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replay the guides' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI log' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit account details' })).toBeInTheDocument()
  })

  it('the guide line follows the language at runtime, without a remount', async () => {
    renderPage({ provider: false })
    const status = screen.getAllByRole('status').find((el) => el.textContent?.startsWith('Az első indítás'))!
    expect(status).toHaveTextContent('Az első indítás és az oldal-kalauzok újra megjelennek')
    act(() => setLang('en', { persist: false }))
    // the same DOM node, its text now in English
    expect(status).toHaveTextContent('The first-run intro and the page guides show again')
  })
})

describe('Nyelv block (real mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    setToken('t')
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
  })

  it('pressing the already-selected language does nothing', async () => {
    let puts = 0
    server.use(http.put(`${API_BASE}/api/auth/me/language`, () => { puts += 1; return HttpResponse.json(meBody('hu')) }))
    renderPage()
    await screen.findByText('Owner')
    await userEvent.click(within(group('Az app nyelve')).getByRole('button', { name: 'Magyar' }))
    await new Promise((r) => setTimeout(r, 30))
    expect(puts).toBe(0)
    expect(getLang()).toBe('hu')
  })

  it('pressing English sends the choice to the account', async () => {
    let body: unknown
    server.use(http.put(`${API_BASE}/api/auth/me/language`, async ({ request }) => { body = await request.json(); return HttpResponse.json(meBody('en')) }))
    renderPage()
    await screen.findByText('Owner')
    await userEvent.click(within(group('Az app nyelve')).getByRole('button', { name: 'English' }))
    await waitFor(() => expect(body).toEqual({ language: 'en' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'At home in the app.' })).toBeInTheDocument()
  })

  it('a failed save rolls back: Magyar is pressed again and the save-failed toast shows', async () => {
    server.use(http.put(`${API_BASE}/api/auth/me/language`, () => HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'x' }], { status: 500 })))
    const toasts: ToastMessage[] = []
    const off = onToast((t) => toasts.push(t))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderPage()
    await screen.findByText('Owner')
    await userEvent.click(within(group('Az app nyelve')).getByRole('button', { name: 'English' }))
    await waitFor(() => expect(toasts.length).toBe(1))
    await waitFor(() => expect(getLang()).toBe('hu'))
    const g = await screen.findByRole('group', { name: 'Az app nyelve' })
    expect(within(g).getByRole('button', { name: 'Magyar' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { level: 1, name: 'Otthon az appban.' })).toBeInTheDocument()
    off(); err.mockRestore()
  })
})
