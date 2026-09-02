import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from '@/app/AppHeader'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { NapMezoPage } from '@/features/today/pages/NapMezoPage'
import { QueryWrapper } from '@/test/queryWrapper'

// A fejléc a shellben él, tehát MINDKÉT módú CI-futásban ugyanazt kell mutatnia —
// ezért a mock mód kényszerítve van (ugyanaz a minta, mint a hubHeaders.test.tsx-ben).
// Mock módban a companion-feed üres, a demo-briefing viszont megvan, és az Életjel-ringek
// küszöb-nudge-jai a szál végére kerülnek — a badge a TELJES szálat számolja (mezo-atry:
// a fejléc korábban nudge-ok nélkül épített szálat, ezért a vízjel sosem talált). A
// notificationFeedSeed-ben 3 olvasatlan értesítés van (nf-1..nf-3).
// Az óra 13:00-ra van fagyasztva: a `mockSleepGoal` (ébredés 06:45, cél 450 perc → lefekvés
// 23:15) `faceWindows`-a ekkor reggel 06:15–11:45, nap 11:45–19:15, este 19:15–06:15 — 13:00
// egyértelműen `nap`, determinisztikusan mindkét CI-módban. Enélkül a `?dp=` navigáció és az
// `.nap-offnow` pötty tesztjei a fal-órától függő, flaky eredményt adnának.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 30, 13, 0, 0)) // 13:00 → nowFace === 'nap' (mockSleepGoal)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

/** Kiírja az élő URL-t, hogy a navigációk megfigyelhetők legyenek. */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

/** A fejléc a shellben ül, a mezo-szál providere alatt (AppLayout) — a tesztek ugyanezt a
 *  bekötést állítják elő. A `children` az Outlet helye: alapesetben csak a hely-szonda. */
const renderAt = (path: string, children?: React.ReactNode) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <MezoThreadProvider>
          <AppHeader />
          {children}
          <LocationProbe />
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

const dpItem = (name: string) => screen.getByRole('menuitemradio', { name })

test('a fejléc mind a négy kontrollt viseli, ebben a sorrendben', async () => {
  const { container } = renderAt('/fuel')
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Mezo üzenetei/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Értesítések/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Profil' })).toBeInTheDocument()

  const labels = [...container.querySelectorAll('.nap-head button')]
    .map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[1]).toMatch(/^Mezo üzenetei/)
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels[3]).toBe('Profil')
})

test('a napszakváltó a /fuel oldalról a valóstól eltérő napszakra dp paraméterrel dob', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  await user.click(dpItem('Este'))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap?dp=este')
})

test('a napszakváltó a jelenlegi (valós) napszak választásakor sima /nap-ra dob, dp nélkül', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  await user.click(dpItem('Nap')) // 13:00 → nowFace === 'nap'
  const loc = screen.getByTestId('loc')
  expect(loc).toHaveTextContent('/nap')
  expect(loc.textContent).toBe('/nap')
})

test('a napszakváltó menüje bezárul a választás után', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  const menu = screen.getByRole('menu')
  await user.click(dpItem('Reggel'))
  expect(menu).not.toBeInTheDocument()
})

test('/nap-on kívül a dp paraméter figyelmen kívül marad és nincs eltérés-pötty', async () => {
  const { container } = renderAt('/fuel?dp=este')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-offnow')).toBeNull()
})

test('/nap?dp=este esetén az alvás-ikon és az eltérés-pötty látszik', async () => {
  const { container } = renderAt('/nap?dp=este')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-head use[href="#i-alvas"]')).not.toBeNull()
  expect(container.querySelector('.nap-offnow')).not.toBeNull()
})

test('/nap?dp=nap esetén nincs eltérés-pötty, mert ez a jelenlegi napszak', async () => {
  const { container } = renderAt('/nap?dp=nap')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-offnow')).toBeNull()
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
  const badge = Number(btn.querySelector('.nap-badge')!.textContent)
  expect(badge).toBeGreaterThan(1) // demo-briefing + Életjel-nudge-ok

  // A badge NEM a fejléc saját, rövidebb listáját számolja (ez volt a mezo-atry hiba): a
  // szál a shell providereé, tehát pontosan annyi kártya jelenik meg összesen a két tabon,
  // ahányat a badge számol (mezo-ho9k: a tab-váltó csak megjelenítési bontás, a szál egy).
  await user.click(btn)
  await screen.findByText('Mezo · ma')
  const uzenetekCards = document.querySelectorAll('.nap-mzmsg').length
  await user.click(screen.getByRole('tab', { name: /Életjelek/ }))
  const eletjelekCards = document.querySelectorAll('.nap-mzmsg').length
  expect(uzenetekCards + eletjelekCards).toBe(badge)
})

test('az értesítés-karika badge-e az olvasatlan értesítések számát viseli', async () => {
  renderAt('/nap')
  const btn = await screen.findByRole('button', { name: /^Értesítések/ })
  expect(btn.getAttribute('aria-label')).toBe('Értesítések, 3 olvasatlan')
  expect(btn.querySelector('.nap-badge')).toHaveTextContent('3')
})

test('az értesítés-dropdown a /me/ertesitesek oldalra visz a lábléceről', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await user.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek')
})

test('a két dropdown kölcsönösen kizárja egymást', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  expect(container.querySelector('.nap-dpmenu')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: /^Értesítések/ }))
  expect(container.querySelector('.nap-dpmenu')).toBeNull()
  expect(container.querySelector('.nap-ntfmenu')).not.toBeNull()
})

test('a profil orb a /me oldalra visz', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Profil' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me')
})

// ── item 7: a dátum-eyebrow ─────────────────────────────────────────────────
test('a fejléc a dátum-eyebrow-val kezdődik', async () => {
  const { container } = renderAt('/fuel')
  await screen.findByRole('button', { name: 'Profil' })
  const eyebrow = container.querySelector('.nap-head .nap-head-grow .mz-eyebrow')
  expect(eyebrow).not.toBeNull()
  // `useToday` napcímke · dátumcímke — a pontos szöveg a data-rétegé, a szerkezet a fejlécé.
  expect(eyebrow!.textContent).toMatch(/\S+ · \S+/)
})

// ── item 5: popover-elvárások ───────────────────────────────────────────────
test('a napszak-menü Escape-re bezárul', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  expect(container.querySelector('.nap-dpmenu')).not.toBeNull()
  await user.keyboard('{Escape}')
  expect(container.querySelector('.nap-dpmenu')).toBeNull()
})

test('az értesítés-menü kívülre kattintásra bezárul', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/nap', <div data-testid="outside">kívül</div>)
  await user.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  expect(container.querySelector('.nap-ntfmenu')).not.toBeNull()
  await user.click(screen.getByTestId('outside'))
  expect(container.querySelector('.nap-ntfmenu')).toBeNull()
})

test('a napszak-menü elemei rádió-menüelemek, a jelenlegi napszak bejelölve', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap?dp=este')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  expect(dpItem('Este')).toHaveAttribute('aria-checked', 'true')
  expect(dpItem('Nap')).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('button', { name: 'Napszak váltása' })).toHaveAttribute('aria-haspopup', 'menu')
  expect(screen.getByRole('button', { name: /^Értesítések/ })).toHaveAttribute('aria-haspopup', 'menu')
})

test('a fejléc gyökere <header> elem, a nap-head app-head osztályokkal', async () => {
  const { container } = renderAt('/fuel')
  await screen.findByRole('button', { name: 'Profil' })
  const head = container.querySelector('.nap-head.app-head')
  expect(head?.tagName).toBe('HEADER')
})

// ── item 7: a popoverek útvonalváltásra záródnak ────────────────────────────
test('a nyitott popover bezárul, amikor a fejléc máshová navigál', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  expect(container.querySelector('.nap-ntfmenu')).not.toBeNull()
  await user.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  await user.click(screen.getByRole('button', { name: 'Napszak váltása' }))
  expect(container.querySelector('.nap-dpmenu')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Profil' }))
  expect(container.querySelector('.nap-dpmenu')).toBeNull()
})

// ── item 2: a napszakválasztás megőrzi a szcenárió-paramétereket ────────────
test('a napszakváltás megőrzi a többi query-paramétert és nem tol history-bejegyzést', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel?day=rough&vulnerable=on')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  await user.click(dpItem('Este'))
  const loc = screen.getByTestId('loc')
  expect(loc.textContent).toContain('/nap?')
  expect(loc.textContent).toContain('day=rough')
  expect(loc.textContent).toContain('vulnerable=on')
  expect(loc.textContent).toContain('dp=este')
  // `replace`: a napszakválasztás nem hagy history-bejegyzést, tehát a Vissza a
  // kiinduló belépésre ugrik vissza (itt: nincs hova, a bejegyzés le lett cserélve).
  await user.click(screen.getByRole('button', { name: 'Napszak váltása' }))
  await user.click(dpItem('Nap')) // nowFace → dp lekerül, a többi marad
  expect(screen.getByTestId('loc').textContent).toBe('/nap?day=rough&vulnerable=on')
})

// ── item 1: az üzenet-badge a látogatás után eltűnik ────────────────────────
test('a Mezo-badge a /nap/uzenetek meglátogatása és elhagyása után eltűnik', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap', (
    <Routes>
      <Route path="/nap" element={<div>nap-hub</div>} />
      <Route path="/nap/uzenetek" element={<NapMezoPage />} />
      <Route path="/me" element={<div>me-hub</div>} />
    </Routes>
  ))
  const msgBtn = await screen.findByRole('button', { name: /^Mezo üzenetei/ })
  expect(msgBtn.getAttribute('aria-label')).toMatch(/olvasatlan/)

  await user.click(msgBtn)
  expect(await screen.findByText('Mezo · ma')).toBeInTheDocument()
  // A vízjel a KÖZÖS szál utolsó elemére került, tehát a badge már itt elalszik.
  expect(screen.getByRole('button', { name: /^Mezo üzenetei/ }).getAttribute('aria-label'))
    .toBe('Mezo üzenetei')

  await user.click(screen.getByRole('button', { name: 'Profil' }))
  expect(await screen.findByText('me-hub')).toBeInTheDocument()
  const after = screen.getByRole('button', { name: /^Mezo üzenetei/ })
  expect(after.getAttribute('aria-label')).toBe('Mezo üzenetei')
  expect(after.querySelector('.nap-badge')).toBeNull()
})
