import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { TitleBar } from '@/app/TitleBar'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { NapMezoPage } from '@/features/today/pages/NapMezoPage'
import { FrameBack, FrameProvider, useFrameBack, useFrameTitle } from '@/shared/ui/folyadek'
import { PageHead } from '@/shared/ui/mozaik'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'
import { localDateString } from '@/shared/lib/dates'

// Folyadék frame (mezo-n4wf5.1): the title bar replaced the old shell header (AppHeader). Every
// behavioural case of AppHeader.test.tsx lives on here against the new bar; where the subject
// itself changed (the „boop" wordmark → the page title, no date → the date context line), the
// case tests what took its place and says so.
//
// A fejléc a shellben él, tehát MINDKÉT módú CI-futásban ugyanazt kell mutatnia —
// ezért a mock mód kényszerítve van (ugyanaz a minta, mint a hubHeaders.test.tsx-ben).
// Mock módban a companion-feed üres, a demo-briefing viszont megvan, és az Életjel-ringek
// küszöb-nudge-jai a szál végére kerülnek — a badge a TELJES szálat számolja (mezo-atry).
// A notificationFeedSeed-ben 5 olvasatlan értesítés van (nf-1..nf-3, nf-7, nf-12).
// Az óra 2026-08-30 (vasárnap) 13:00-ra van fagyasztva — determinisztikus mindkét CI-módban.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  // A Fuel hub kalauza (mezo-gb1s.1) 600 ms után magától felugrana — a fejléc-tesztek a
  // fejlécet nézik, ezért látottnak seedeljük; a „?" gomb saját tesztje explicit nyit.
  seedAllKalauzSeen()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 30, 13, 0, 0))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

/** Kiírja az élő URL-t, hogy a navigációk megfigyelhetők legyenek. */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}{loc.hash}<span data-testid="origin">{loc.state?.from}</span></div>
}

/** A címsor a shellben ül, a mezo-szál providere és a keret-provider alatt (AppLayout) — a
 *  tesztek ugyanezt a bekötést állítják elő. A `children` az Outlet helye. */
const renderAt = (path: string | string[], children?: React.ReactNode, tabs?: React.ReactNode) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={Array.isArray(path) ? path : [path]} initialIndex={Array.isArray(path) ? path.length - 1 : 0}>
        <TutorialProvider>
          <MezoThreadProvider>
            <FrameProvider>
              <TitleBar>{tabs}</TitleBar>
              {children}
              <LocationProbe />
            </FrameProvider>
          </MezoThreadProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

const barLabels = (container: HTMLElement) =>
  [...container.querySelectorAll('.fo-top button')].map((b) => b.getAttribute('aria-label'))

// ── the two faces ───────────────────────────────────────────────────────────

test('a kalauzos /fuel hubon öt kerek gomb áll a jóváhagyott sorrendben, a cím után a Kalauzzal', async () => {
  const { container } = renderAt('/fuel')
  expect(await screen.findByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeInTheDocument()
  const labels = barLabels(container)
  expect(labels).toHaveLength(6)
  expect(labels[0]).toBe('Minden oldal')
  expect(labels[1]).toMatch(/^Mezo üzenetei/)
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels[3]).toBe('Beállítások')
  expect(labels[4]).toMatch(/^A mai napod/)
  expect(labels[5]).toBe('Kalauz ehhez az oldalhoz')
  // the „?" stands AFTER the title, in the title's line
  expect(container.querySelector('.fo-h h1 + .fo-help')).not.toBeNull()
  // a hub has no back button
  expect(screen.queryByRole('button', { name: 'Vissza' })).toBeNull()
})

// A /mezo kalauza kivezetve (mezo-a9bo7.10) — ez a kalauz nélküli HUB.
test('kalauz nélküli hubon nincs „?" gomb — az öt kontroll a sorrendjében', async () => {
  const { container } = renderAt('/mezo')
  await screen.findByRole('button', { name: 'Beállítások' })
  expect(screen.queryByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeNull()
  const labels = barLabels(container)
  expect(labels).toHaveLength(5)
  expect(labels[0]).toBe('Minden oldal')
  expect(labels[3]).toBe('Beállítások')
  expect(labels[4]).toMatch(/^A mai napod/)
})

// Az éjszakai mód D11 szerint sosem kap kalauzt (az appban chrome-mentes, de a findKalauz-ára
// ez a teszt így is őszintén rákérdezhet) — és aloldal: vissza + csengő, semmi más.
test('aloldalon a sáv: vissza · cím · csengő — kalauz nélküli oldalon „?" nélkül', async () => {
  const { container } = renderAt('/me/sleep/night')
  await screen.findByRole('button', { name: /^Értesítések/ })
  expect(screen.queryByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeNull()
  const labels = barLabels(container)
  expect(labels).toHaveLength(2)
  expect(labels[0]).toBe('Vissza')
  expect(labels[1]).toMatch(/^Értesítések/)
  for (const gone of ['Minden oldal', 'Beállítások', /^Mezo üzenetei/, /^A mai napod/]) {
    expect(screen.queryByRole('button', { name: gone })).toBeNull()
  }
})

test('kalauzos aloldalon a „?" a cím után áll, a vissza és a csengő között', async () => {
  const { container } = renderAt('/fuel/recipes')
  expect(await screen.findByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeInTheDocument()
  const labels = barLabels(container)
  expect(labels[0]).toBe('Vissza')
  expect(labels[1]).toBe('Kalauz ehhez az oldalhoz')
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels).toHaveLength(3)
})

test('a „?" megnyitja az oldal kalauzát, és nyitva az is-open osztályt viseli', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  const q = await screen.findByRole('button', { name: 'Kalauz ehhez az oldalhoz' })
  expect(q).toHaveAttribute('aria-haspopup', 'dialog')
  await user.click(q)
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(q).toHaveClass('is-open')
})

// A folyadék-pötty (`.new`) = T3 oldal még nem látott kalauzzal; látott kalauznál nincs.
test('a látottnak seedelt kalauz „?" gombja nem visel pöttyöt', async () => {
  renderAt('/fuel')
  expect(await screen.findByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).not.toHaveClass('new')
})

// ── what the bar SAYS (replaces the „boop" wordmark cases: the left side is no longer a
//    constant brand mark — it answers „hol vagyok") ──────────────────────────
test('a hub címe az oldal neve, nem szó-logó — és a régi szekció-jelölés sincs', async () => {
  const { container } = renderAt('/fuel')
  expect(await screen.findByRole('heading', { level: 1, name: 'Fuel' })).toBeInTheDocument()
  expect(container.querySelector('.app-head-wordmark')).toBeNull()
  expect(container.querySelector('.app-head-title')).toBeNull()
  expect(container.querySelector('.fo-eb use')).toBeNull()
})

test('a cím az oldallal változik — a hubon a fül címe, mélyoldalon a lap neve a kontextus-sorral', async () => {
  const hub = renderAt('/train/mesocycles')
  expect(await screen.findByRole('heading', { level: 1, name: 'Terv' })).toBeInTheDocument()
  hub.unmount()
  const { container } = renderAt('/fuel/recipes')
  expect(await screen.findByRole('heading', { level: 1, name: 'Receptek' })).toBeInTheDocument()
  expect(container.querySelector('.fo-title small')).toHaveTextContent('Fuel · Konyha')
})

// Replaces „nincs többé dátum-eyebrow a fejlécben": the approved frame brings the date BACK as
// the hub's context line (the phone's status bar still shows the clock, not the weekday).
test('a hub kontextus-sora a mai dátum, hosszú magyar alakban', async () => {
  const { container } = renderAt('/fuel')
  await screen.findByRole('button', { name: /^A mai napod/ })
  expect(container.querySelector('.fo-eb')).toHaveTextContent('Vasárnap, augusztus 30.')
  expect(container.querySelector('.fo-top .mz-eyebrow')).toBeNull()
})

test('az átöltözött oldal felülírhatja a címet és a kontextus-sort (useFrameTitle)', async () => {
  function Page() { useFrameTitle({ title: 'Ebéd', eyebrow: 'Fuel · 12:40' }); return null }
  const { container } = renderAt('/fuel/etkezes/m1', <Page />)
  expect(await screen.findByRole('heading', { level: 1, name: 'Ebéd' })).toBeInTheDocument()
  expect(container.querySelector('.fo-title small')).toHaveTextContent('Fuel · 12:40')
})

test('a fülsor helye a címsoron BELÜL van, és csak hubon rajzolódik ki', async () => {
  const hub = renderAt('/fuel', undefined, <nav data-testid="tabs" />)
  await screen.findByRole('button', { name: /^A mai napod/ })
  expect(screen.getByTestId('tabs').closest('header')).toHaveClass('fo-top')
  hub.unmount()
  renderAt('/fuel/recipes', undefined, <nav data-testid="tabs" />)
  await screen.findByRole('button', { name: 'Vissza' })
  expect(screen.queryByTestId('tabs')).toBeNull()
})

// ── the five buttons ────────────────────────────────────────────────────────

// Az oldal-leltár bejárata (mezo-ju4j6.17) a nyugdíjazott területváltó alsó soráról ide
// költözött. A hash a lényeg: a ~100 soros leltár a terület saját szakaszán nyílik.
test('a „Minden oldal" gomb a leltárt nyitja, arra a területre horgonyozva, ahonnan jössz', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel/stack')
  await user.click(await screen.findByRole('button', { name: 'Minden oldal' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/minden#fuel')
})

test('az Üzenetek karika a /nap/uzenetek oldalra navigál', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/mezo')
  await user.click(await screen.findByRole('button', { name: /^Mezo üzenetei/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/uzenetek')
})

test('az Üzenetek karika badge-e a szál TELJES hosszát viseli, a nudge-okkal együtt', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap', (
    <Routes>
      <Route path="/nap" element={<div>nap-hub</div>} />
      <Route path="/nap/uzenetek" element={<NapMezoPage />} />
    </Routes>
  ))
  const btn = await screen.findByRole('button', { name: /^Mezo üzenetei/ })
  const badge = Number(btn.querySelector('.fo-badge-n')!.textContent)
  expect(badge).toBeGreaterThan(1) // demo-briefing + Életjel-nudge-ok

  // A badge NEM a fejléc saját, rövidebb listáját számolja (ez volt a mezo-atry hiba): a
  // szál a shell providereé, tehát pontosan annyi kártya jelenik meg összesen a két tabon,
  // ahányat a badge számol (mezo-ho9k: a tab-váltó csak megjelenítési bontás, a szál egy).
  await user.click(btn)
  await screen.findByText('Mezo · ma')
  const uzenetekCards = document.querySelectorAll('.nap-mzmsg, .nap-mzrow').length
  await user.click(screen.getByRole('tab', { name: /Életjelek/ }))
  const eletjelekCards = document.querySelectorAll('.nap-mzmsg, .nap-mzrow').length
  expect(uzenetekCards + eletjelekCards).toBe(badge)
})

test('az értesítés-karika badge-e az olvasatlan értesítések számát viseli', async () => {
  renderAt('/nap')
  const btn = await screen.findByRole('button', { name: /^Értesítések/ })
  // 5 az `notificationFeedSeed` olvasatlan sorainak száma (mezo-3n2so adta az ötödiket) —
  // a szám a seedből SZÁRMAZIK, nem önálló tény.
  expect(btn.getAttribute('aria-label')).toBe('Értesítések, 5 olvasatlan')
  expect(btn.querySelector('.fo-badge-n')).toHaveTextContent('5')
})

test('a csengő az aloldalon is ugyanazt a panelt nyitja', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/fuel/recipes')
  const bell = await screen.findByRole('button', { name: 'Értesítések, 5 olvasatlan' })
  await user.click(bell)
  expect(bell).toHaveAttribute('aria-expanded', 'true')
  expect(container.querySelector('.fo-top > .nap-ntfpanel')).not.toBeNull()
})

test('az értesítés-dropdown a /me/ertesitesek oldalra visz a lábléceről', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await user.click(screen.getByRole('button', { name: 'Összes értesítés ›' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek')
})

// mezo-idz2: a jobb szélső orb a mai nap-oldalra visz; a profil az alsó „Én" cseppen van.
test('a nap-orb a mai nap-oldalára visz', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: /^A mai napod/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent(`/nap/napom/${localDateString()}`)
})

test('settings replaces daypart picker and preserves originating page', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel?day=rough')
  expect(screen.queryByRole('button', { name: 'Napszak váltása' })).toBeNull()
  await user.click(await screen.findByRole('button', { name: 'Beállítások' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/settings')
  expect(screen.getByTestId('origin')).toHaveTextContent('/fuel?day=rough')
})

// ── popover-elvárások ───────────────────────────────────────────────────────

test('az értesítés-menü kívülre kattintásra bezárul', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/nap', <div data-testid="outside">kívül</div>)
  await user.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  expect(container.querySelector('.nap-ntfpanel')).not.toBeNull()
  await user.click(screen.getByTestId('outside'))
  expect(container.querySelector('.nap-ntfpanel')).toBeNull()
})

test('az értesítés-menü Escape-re és útvonalváltásra is bezárul', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/nap', <Link to="/fuel">fuel</Link>)
  const bell = await screen.findByRole('button', { name: /^Értesítések/ })
  await user.click(bell)
  await user.keyboard('{Escape}')
  expect(container.querySelector('.nap-ntfpanel')).toBeNull()
  await user.click(bell)
  expect(container.querySelector('.nap-ntfpanel')).not.toBeNull()
  // the scrim would swallow a pointer click on the page — the route change is what closes it
  screen.getByRole('link', { name: 'fuel' }).click()
  expect(await screen.findByRole('heading', { level: 1, name: 'Fuel' })).toBeInTheDocument()
  await waitFor(() => expect(container.querySelector('.nap-ntfpanel')).toBeNull())
})

test('a címsor gyökere <header> elem, a fo-top osztállyal — aloldalon a sub jelzővel', async () => {
  const hub = renderAt('/fuel')
  await screen.findByRole('button', { name: /^A mai napod/ })
  const head = hub.container.querySelector('.fo-top')
  expect(head?.tagName).toBe('HEADER')
  expect(head).not.toHaveClass('sub')
  expect(hub.container.querySelector('.nap-head, .app-head')).toBeNull()
  hub.unmount()
  const sub = renderAt('/fuel/recipes')
  await screen.findByRole('button', { name: 'Vissza' })
  expect(sub.container.querySelector('header.fo-top')).toHaveClass('sub')
})

// ── az üzenet-badge a látogatás után eltűnik ────────────────────────────────
test('a Mezo-badge a /nap/uzenetek meglátogatása és elhagyása után eltűnik', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap', (
    <Routes>
      <Route path="/nap" element={<div>nap-hub</div>} />
      <Route path="/nap/uzenetek" element={<><NapMezoPage /><Link to="/fuel">tovább</Link></>} />
      <Route path="/fuel" element={<div>fuel-hub</div>} />
    </Routes>
  ))
  const msgBtn = await screen.findByRole('button', { name: /^Mezo üzenetei/ })
  expect(msgBtn.getAttribute('aria-label')).toMatch(/olvasatlan/)

  await user.click(msgBtn)
  expect(await screen.findByText('Mezo · ma')).toBeInTheDocument()
  // A vízjel a KÖZÖS szál utolsó elemére került, tehát a badge már itt elalszik.
  expect(screen.getByRole('button', { name: /^Mezo üzenetei/ }).getAttribute('aria-label'))
    .toBe('Mezo üzenetei')

  // Elhagyva az oldalt (egy másik hubra, ahol a gomb megint látszik) a badge nem jön vissza.
  await user.click(screen.getByRole('link', { name: 'tovább' }))
  expect(await screen.findByText('fuel-hub')).toBeInTheDocument()
  const after = screen.getByRole('button', { name: /^Mezo üzenetei/ })
  expect(after.getAttribute('aria-label')).toBe('Mezo üzenetei')
  expect(after.querySelector('.fo-badge-n')).toBeNull()
})

// ── vissza: oda, ahonnan jöttél ─────────────────────────────────────────────

test('a vissza gomb az oldal SAJÁT kezelőjét futtatja, ha az átadta (useFrameBack)', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onBack = vi.fn()
  function Page() { useFrameBack(onBack); return null }
  renderAt('/fuel/recipes', <Page />)
  await user.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(onBack).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes')
})

test('saját kezelő nélkül oda visz vissza, ahonnan jöttél', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/me', <Link to="/fuel/recipes">receptek</Link>)
  await user.click(await screen.findByRole('link', { name: 'receptek' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes')
  await user.click(await screen.findByRole('button', { name: 'Vissza' }))
  // NOT the owning tab (/fuel/konyha): the user came from the Én hub
  expect(screen.getByTestId('loc')).toHaveTextContent('/me')
})

test('ha nincs hova visszalépni (közvetlen link), a lapot birtokló fülre visz', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel/recipes')
  await user.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/konyha')
})

test.each([
  ['/settings/fuel', '/nap'],
  ['/minden', '/nap'],
  ['/nap/napom/2026-08-30', '/nap/napom'],
  ['/train/review/abc', '/train/mai'],
])('közvetlen linkről a %s vissza gombja ide visz: %s', async (path, home) => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt(path)
  await user.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('loc').textContent).toBe(home)
})

// Fix round 1: a page whose own back is plain `navigate(-1)` used to hand THAT to the bar — and
// on a direct deep link (nothing in history) the back button did nothing. Such a page marks its
// handler `history`, registers nothing, and gets the bar's default.
function HistoryPage({ kind }: { kind: 'head' | 'back' }) {
  const onBack = vi.fn()
  return kind === 'head' ? <PageHead glass history label="Vissza" onBack={onBack} /> : <FrameBack history onBack={onBack}>‹</FrameBack>
}
test.each([
  ['head', '/nap/kuldetesek', '/nap'],
  ['back', '/nap/checkin', '/nap'],
  ['head', '/fuel/gyogyszer', '/fuel/stack'],
  ['back', '/fuel/recipes/r1/edit', '/fuel/konyha'],
] as const)('közvetlen linkről a „csak vissza a történetben" oldal (%s, %s) vissza gombja a birtokló fülre visz: %s', async (kind, path, home) => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt(path, <HistoryPage kind={kind} />)
  // ONE back control, the bar's
  expect(await screen.findAllByRole('button', { name: 'Vissza' })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('loc').textContent).toBe(home)
})

test('ugyanez az oldal, ha VAN honnan jönni: oda visz vissza, nem a fülre', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/me', (
    <Routes>
      <Route path="/me" element={<Link to="/nap/kuldetesek">küldetések</Link>} />
      <Route path="/nap/kuldetesek" element={<HistoryPage kind="back" />} />
    </Routes>
  ))
  await user.click(await screen.findByRole('link', { name: 'küldetések' }))
  expect(screen.getByTestId('loc').textContent).toBe('/nap/kuldetesek')
  await user.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('loc').textContent).toBe('/me')
})
