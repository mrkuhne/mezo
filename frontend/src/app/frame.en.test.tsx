import { act, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useMutation } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { authEvents } from '@/data/_client/authEvents'
import { BottomBar } from '@/app/BottomBar'
import { TopTabs } from '@/app/TopTabs'
import { StartupSplash } from '@/app/StartupSplash'
import { QuickLogFab } from '@/app/QuickLogFab'
import MindenOldalPage, { groupsForDomain } from '@/app/MindenOldalPage'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { AuthGate } from '@/app/auth/AuthGate'
import { DOMAINS, domainName, frameFor, pageLabel, resetNavMemory, tabLabel, tabTitle } from '@/app/navModel'
import { PAGE_INDEX } from '@/app/pageIndex'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { QueryWrapper } from '@/test/queryWrapper'
import { LanguageProvider, m, setLang } from '@/shared/i18n'

// The app frame in English (mezo-n4wf5.11, Task 6). The Hungarian cases live beside each component
// (the test setup pins `hu`); here the language is switched to English per test.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  resetNavMemory()
  setLang('en', { persist: false })
})
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

const EN_TABS: Record<string, [string, string[]]> = {
  '/nap': ['Today', ['Now', 'My day', 'Chat', 'Routine']],
  '/train/mai': ['Training', ['Today', 'Plan', 'Load', 'Exercises']],
  '/fuel': ['Fuel', ['Today', 'Supplements', 'Trends', 'Kitchen']],
  '/mezo': ['Mezo', ['Wall', 'The team', 'About you', 'Memories']],
  '/me': ['Me', ['Overview', 'Body', 'Goals', 'Journal']],
}

describe('bottom bar', () => {
  const renderBar = (path = '/nap') => render(
    <QueryWrapper><LevelUpProvider><MemoryRouter initialEntries={[path]}><BottomBar /></MemoryRouter></LevelUpProvider></QueryWrapper>,
  )

  test('reads Today Training Fuel Mezo Me', () => {
    renderBar()
    const bar = screen.getByRole('navigation', { name: 'Areas' })
    expect(within(bar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Today', 'Training', 'Fuel', 'Mezo', 'Me'])
  })

  test('switching the language at runtime changes the bar (nothing is frozen at module load)', () => {
    setLang('hu', { persist: false })
    render(
      <QueryWrapper><LevelUpProvider><MemoryRouter initialEntries={['/nap']}>
        <LanguageProvider><BottomBar /></LanguageProvider>
      </MemoryRouter></LevelUpProvider></QueryWrapper>,
    )
    expect(within(screen.getByRole('navigation', { name: 'Területek' })).getAllByRole('link').map((a) => a.textContent))
      .toEqual(['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én'])
    act(() => setLang('en', { persist: false }))
    expect(within(screen.getByRole('navigation', { name: 'Areas' })).getAllByRole('link').map((a) => a.textContent))
      .toEqual(['Today', 'Training', 'Fuel', 'Mezo', 'Me'])
  })

  test('the quick-log button is named in English', () => {
    render(<QueryWrapper><LevelUpProvider><MemoryRouter><QuickLogFab /></MemoryRouter></LevelUpProvider></QueryWrapper>)
    expect(screen.getByRole('button', { name: 'Quick log' })).toBeInTheDocument()
  })
})

describe('top tabs', () => {
  test.each(Object.entries(EN_TABS))('%s: four tabs per FR_EN', (path, [domain, tabs]) => {
    render(
      <QueryWrapper><MemoryRouter initialEntries={[path]}><MezoThreadProvider><TopTabs /></MezoThreadProvider></MemoryRouter></QueryWrapper>,
    )
    const strip = screen.getByRole('navigation', { name: `${domain} pages` })
    // firstChild = the label; the unread badge (Chat) is a sibling element
    expect(within(strip).getAllByRole('link').map((a) => a.firstChild?.textContent)).toEqual(tabs)
  })

  test('the tab marks speak English', () => {
    render(
      <QueryWrapper><MemoryRouter initialEntries={['/nap']}>
        <MezoThreadProvider><TopTabs dots={{ '/nap/napom': true }} /></MezoThreadProvider>
      </MemoryRouter></QueryWrapper>,
    )
    expect(screen.getByText('yesterday’s review is ready')).toBeInTheDocument()
  })
})

describe('navModel lookups', () => {
  test('hub titles and eyebrows follow the language', () => {
    const today = new Date(2026, 9, 7)
    expect(frameFor('/nap', today)).toMatchObject({ title: 'Today', eyebrow: 'Wednesday, 7 October' })
    expect(frameFor('/train/mai', today).title).toBe('Training')
    expect(frameFor('/fuel', today).title).toBe('Fuel')
    expect(frameFor('/me', today).title).toBe('Me')
    expect(frameFor('/fuel/recipes', today).eyebrow).toBe('Fuel · Kitchen')
  })

  test('the settings and all-pages routes', () => {
    const today = new Date(2026, 9, 7)
    expect(frameFor('/settings', today)).toMatchObject({ title: 'Settings', eyebrow: 'Settings' })
    expect(frameFor('/minden', today)).toMatchObject({ title: 'All pages', eyebrow: 'Map of the app' })
    expect(frameFor('/settings/fuel', today).title).toBe('Fuel settings')
  })

  test('a label with an English entry is translated; one without falls back to Hungarian', () => {
    const byRoute = (route: string) => PAGE_INDEX.find((p) => p.route === route)!
    expect(pageLabel(byRoute('/settings/mezo/about'))).toBe('About me')
    expect(pageLabel(byRoute('/nap'))).toBe('Now')
    expect(pageLabel(byRoute('/fuel/trendek'))).toBe('Trends')
    // Fuel's own slice (Folyadék F5) translated its pages
    expect(pageLabel(byRoute('/fuel/kamra'))).toBe('Pantry')
    expect(pageLabel(byRoute('/fuel/stack/manage/add'))).toBe('Set up a new item')
    // a page whose slice has not come yet keeps its Hungarian label
    expect(pageLabel(byRoute('/settings/me/goal'))).toBe(byRoute('/settings/me/goal').label)
  })

  const SETTINGS_TITLES: Array<[string, string, string]> = [
    ['/settings/notifications', 'Értesítés-beállítások', 'Notification settings'],
    ['/settings/account', 'Fiókadatok', 'Account details'],
    ['/settings/train', 'Edzés beállításai', 'Training settings'],
    ['/settings/train/gym', 'Gym időpontok', 'Gym times'],
    ['/settings/train/sport', 'Sport időpontok', 'Sport times'],
    ['/settings/me', 'Személyes alapadatok', 'Personal basics'],
    ['/settings/me/biometrics', 'Testprofil', 'Body profile'],
    ['/settings/me/sleep', 'Alváscél', 'Sleep goal'],
    ['/settings/mezo', 'Mezo beállításai', 'Mezo settings'],
    ['/settings/mezo/context', 'Személyes prompt', 'Personal prompt'],
    ['/settings/nap', 'Napi ritmus', 'Daily rhythm'],
  ]

  test.each(SETTINGS_TITLES)('%s: English title in English, the Hungarian label in Hungarian', (route, hu, en) => {
    const page = PAGE_INDEX.find((p) => p.route === route)!
    expect(page.label).toBe(hu)
    expect(pageLabel(page)).toBe(en)
    expect(frameFor(route, new Date(2026, 9, 7)).title).toBe(en)
    setLang('hu', { persist: false })
    expect(pageLabel(page)).toBe(hu)
    expect(frameFor(route, new Date(2026, 9, 7)).title).toBe(hu)
  })

  test('the Settings pages owned by other slices still fall back to Hungarian in English', () => {
    for (const route of ['/settings/me/goal']) {
      const page = PAGE_INDEX.find((p) => p.route === route)!
      expect(pageLabel(page)).toBe(page.label)
    }
  })

  test('the Hungarian catalog is word-for-word the source (domains, tabs, titles, indexed labels)', () => {
    setLang('hu', { persist: false })
    for (const d of DOMAINS) {
      expect(domainName(d)).toBe(d.name)
      for (const t of d.tabs) {
        expect(tabLabel(d.id, t)).toBe(t.label)
        expect(tabTitle(d.id, t)).toBe(t.title ?? t.label)
      }
    }
    for (const p of PAGE_INDEX) expect(pageLabel(p)).toBe(p.label)
  })
})

describe('Minden oldal', () => {
  test('headings, counts and translated labels read English; a page whose slice has not come stays Hungarian', () => {
    render(<MemoryRouter><MindenOldalPage /></MemoryRouter>)
    expect(screen.getByText('All pages')).toBeInTheDocument()
    expect(screen.getByText('INDEX')).toBeInTheDocument()
    expect(screen.getByText('Shared settings')).toBeInTheDocument()
    expect(screen.getByText('About me')).toBeInTheDocument()
    expect(screen.getAllByText(/^\d+ pages$/).length).toBeGreaterThan(0)
    // Fuel's pages are translated by their own slice (Folyadék F5)…
    expect(screen.getByText('Pantry')).toBeInTheDocument()
    expect(screen.queryByText('Kamra')).toBeNull()
    // …a page of a later slice is still its Hungarian label
    expect(screen.getByText(PAGE_INDEX.find((p) => p.route === '/settings/me/goal')!.label)).toBeInTheDocument()
  })

  test('the group headings are the tab labels in English', () => {
    const nap = DOMAINS.find((d) => d.id === 'nap')!
    const heads = groupsForDomain(nap, PAGE_INDEX.filter((p) => p.route.startsWith('/nap'))).map((g) => g.heading)
    expect(heads.slice(0, 4)).toEqual(['Now', 'My day', 'Chat', 'Routine'])
  })
})

describe('splash', () => {
  test('its status is named in English', () => {
    render(<StartupSplash><div>APP</div></StartupSplash>)
    expect(screen.getByRole('status', { name: 'Loading Boop' })).toBeInTheDocument()
  })
})

describe('generic toast', () => {
  test('a failed write says so in English, with the trace when there is one', async () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => { seen.push(t) })
    function Probe() {
      const bad = useMutation({ mutationFn: async () => { throw new Error('x') } })
      return <button onClick={() => bad.mutate()}>go</button>
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<QueryProvider><Probe /></QueryProvider>)
    await act(async () => { (await screen.findByText('go')).click() })
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0]).toMatchObject({ kind: 'error', text: "Couldn't save — try again" })
    off()
    vi.restoreAllMocks()
  })
})

describe('auth gate', () => {
  test('a session that expired is announced in English on the sign-in screen', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    render(<QueryWrapper><AuthGate><div>APP</div></AuthGate></QueryWrapper>)
    await screen.findByRole('heading', { name: /./ })
    act(() => authEvents.emitSignedOut('expired'))
    expect(await screen.findByText('Your session expired, please sign in again.')).toBeInTheDocument()
  })

  test('an unreachable server is announced in English, with a retry', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.error()))
    setToken('t')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<QueryWrapper><AuthGate><div>APP</div></AuthGate></QueryWrapper>)
    expect(await screen.findByRole('heading', { name: "I can't reach the server" }, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    vi.restoreAllMocks()
  }, 10000)

  test('the catalog is read at call time', () => {
    expect(m().frame.auth.retry).toBe('Try again')
    setLang('hu', { persist: false })
    expect(m().frame.auth.retry).toBe('Újra')
  })
})
