import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { resetNavMemory } from '@/app/navModel'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'
import rawCss from '@/styles/prototype.css?raw'
import frameCss from '@/styles/folyadek-frame.css?raw'

// mezo-gb1s.3: a hub-kalauzok 600 ms után felugranának a navigációs asszertek közben.
beforeEach(() => seedAllKalauzSeen())

// mezo-jkh4: the last-tab memory is a module-level, in-session store — it leaks across
// tests. Every test here renders the nav (BottomBar's effect records the visited tab), so
// without a per-test reset the test order decides what a domain's "first visit" resolves
// to. Under CI's order a prior test left it dirty and the switcher jumped to a remembered
// tab instead of tab 1 (the '/nap' vs '/fuel/stack' flake). Reset before EVERY test so
// each one starts from clean memory and is order-independent.
beforeEach(() => resetNavMemory())

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
}

test('redirects / to Today', async () => {
  renderApp('/')
  // The Nap hub's daypart switch is the face-INDEPENDENT landmark (mezo-d20.2.1).
  expect(await screen.findByRole('button', { name: 'Beállítások' })).toBeInTheDocument()
})
/** The bottom bar's drop of a domain (Folyadék frame, mezo-n4wf5.1). */
const domainDrop = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Területek' })).getByRole('link', { name })

test('switches domains on the bottom bar, then between pages on the top tabs', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/today'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  // Folyadék frame (mezo-n4wf5.1): the bottom bar is the five domains, always — reaching
  // another world is ONE tap on its drop, which jumps to that domain's last-visited tab
  // (here, first-visit → Mezo tab 1 = /mezo, the csapat-üzenőfal). No switcher dialog.
  await screen.findByRole('button', { name: 'Beállítások' })
  await userEvent.click(domainDrop('Mezo'))
  expect(router.state.location.pathname).toBe('/mezo')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Üzenőfal' })).toHaveAttribute('aria-current', 'page')
  // A csapat (top tab) → the Gépterem door → the old grid („Összes funkció”) → a list page: the
  // list page is a post's deep page, so the WALL owns it (spec §2.5, mezo-a9bo7.10) — it is a
  // sub-page now, and the title bar's context line says where it belongs.
  await userEvent.click(screen.getByRole('link', { name: 'A csapat' }))
  await userEvent.click(await screen.findByRole('link', { name: /Gépterem · Összes funkció/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Összes funkció/ }))
  await userEvent.click(await screen.findByRole('link', { name: 'Előrejelzések' }))
  expect(router.state.location.pathname).toBe('/mezo/predictions')
  expect(document.querySelector('.fo-top small')).toHaveTextContent('Mezo · Üzenőfal')
  expect(domainDrop('Mezo')).toHaveAttribute('aria-current', 'true')
  // no chip strip (mezo-twizx) — the back button (the title bar's, running the page's own
  // handler) leads back to the grid
  expect(screen.queryByRole('navigation', { name: 'Boop funkciók' })).not.toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(router.state.location.pathname).toBe('/mezo/karakter/gepterem/osszes')
  expect((await screen.findAllByRole('heading', { name: 'Összes funkció' })).length).toBeGreaterThan(0)
})
// mezo-twizx: the old „Összes funkció” + chip strip (Minták · Előrejelzések · Diagnózis ·
// Kísérletek · Heti) is gone from every page — the new dock and the approved üzenőfal prototype
// have none; the Gépterem's „Összes funkció” grid and each page's own back link carry the way.
test.each(['/mezo/patterns/ref-anna-sleep', '/mezo/patterns', '/me/week'])('%s — no old chip strip', async (path) => {
  renderApp(path)
  // These are sub-pages: the bell is the title bar's face-independent landmark (the settings
  // button lives on the hubs).
  expect(await screen.findByRole('button', { name: /^Értesítések/ })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Boop funkciók' })).not.toBeInTheDocument()
  expect(document.querySelector('.boop-world-navigation')).toBeNull()
})
// Folyadék (mezo-n4wf5.1): the app is light-locked — the settings page has no theme
// selector while the lock holds, and a stored dark preference does not reach the document.
test('Me settings: no theme selector under the light lock, the app stays light', async () => {
  localStorage.setItem('mezo-theme', 'dark')
  renderApp('/me')
  await userEvent.click(await screen.findByRole('button', { name: 'Beállítások' }))
  await userEvent.click(screen.getByRole('link', { name: /Megjelenés és alkalmazás/ }))
  expect(await screen.findByText('Fiók')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Sötét/ })).toBeNull()
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
})

test('the Én tab lands on the hub Mozaik face — no subnav dropdown (mezo-d20.6.1)', async () => {
  renderApp('/me')
  expect(await screen.findByRole('button', { name: 'Beállítások' })).toBeInTheDocument()
  // mezo-lhqw7: the hub is „Hol tartok" — the Súly tile became the Test tab (a top tab now).
  expect(await screen.findByRole('button', { name: 'Célok állása' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Súly' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute('href', '/me/weight')
  expect(screen.queryByLabelText('Me alnavigáció')).not.toBeInTheDocument()
})

test('the Fuel tab lands on the hub Mozaik face — no subnav dropdown (mezo-d20.4.1)', async () => {
  renderApp('/fuel')
  // mezo-jb84 (owner): a csempe-sáv lekerült a Mai-ról, a beállítás pedig a dátumsorba
  // költözött. A face-független horgony így a beállítás-ikon és a nap blokkjai.
  expect(await screen.findByRole('button', { name: 'Beállítások' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Receptek' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Fuel alnavigáció')).not.toBeInTheDocument()
})

test('/fuel/stack stays a stable full-page sibling of the Fuel hub', async () => {
  const { container } = renderApp('/fuel/stack')
  // The hub's Protokoll door is stable across loading, empty, next-action and all-done states.
  // Real-mode CI intentionally starts with an empty protocol, while mock mode has a next item.
  // (S2/mezo-g2vl: the four-tile mosaic became the band list + two poster doors; the protocol
  // door is the surviving stable landmark.)
  expect(await screen.findByRole('button', { name: /Protokoll/ })).toBeInTheDocument()
  expect(container.querySelector('.mz-page.mz-p-sage')).toBeInTheDocument()
  expect(container.querySelector('.mz-page-head')).not.toBeInTheDocument()
})

test('/mezo/karakter is the Karakter dossier hub — reachable as a stable route (mezo-1gim.13)', async () => {
  renderApp('/mezo/karakter')
  // The ring's aria-label is the face-independent landmark: mock mode starts pre-bootstrap
  // (all CORE dims at maturity 0), so the intro ceremony's CTA is what actually renders.
  expect(await screen.findByRole('button', { name: 'Kezdjétek el' })).toBeInTheDocument()
})

test('a saved /mezo/menu link lands on the „Összes funkció” grid, which reaches the Karakter dimensions', async () => {
  renderApp('/mezo/menu')
  // (the title bar and the page both say „Összes funkció” until the page is re-dressed)
  expect((await screen.findAllByRole('heading', { name: 'Összes funkció' })).length).toBeGreaterThan(0)
  await userEvent.click(await screen.findByRole('link', { name: 'Karakter' }))
  expect(await screen.findByText('Amit eddig tudunk rólad')).toBeInTheDocument()
})

// Karakter moved to the Mezo domain (mezo-jkh4): legacy `/me/karakter/*` links (old
// bookmarks, notification deep-links) redirect to `/mezo/karakter/*`, subpath preserved.
test('/me/karakter redirects to /mezo/karakter (legacy link)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/me/karakter'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await screen.findByRole('button', { name: 'Kezdjétek el' })
  expect(router.state.location.pathname).toBe('/mezo/karakter')
})

test('/me/karakter/konzilium redirects to /mezo/karakter/konzilium preserving the subpath', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/me/karakter/konzilium'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect((await screen.findAllByText('Konzílium')).length).toBeGreaterThan(0)
  expect(router.state.location.pathname).toBe('/mezo/karakter/konzilium')
})

// Last-tab memory (mezo-jkh4): each domain's drop returns it to its last-visited tab.
test('a domain drop returns to the last-visited tab (memory)', async () => {
  // navMemory is cleared in beforeEach, so this starts from a clean, order-independent store.
  // mezo-o6uv: the remembered tab is Kiegészítők (`/fuel/stack`) — Receptek left the Fuel row.
  const router = createMemoryRouter(routes, { initialEntries: ['/fuel/stack'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  // Visit a Fuel tab (Kiegészítők) so it is remembered, then leave for another domain.
  await screen.findByRole('button', { name: 'Beállítások' })
  await userEvent.click(domainDrop('Nap'))
  expect(router.state.location.pathname).toBe('/nap')
  // From Nap, the Fuel drop lands back on Kiegészítők, not Fuel tab 1.
  await userEvent.click(domainDrop('Fuel'))
  expect(router.state.location.pathname).toBe('/fuel/stack')
  expect(await screen.findByRole('link', { name: 'Kiegészítők' })).toHaveAttribute('aria-current', 'page')
})

test('/mezo/karakter/dimenziok is the Dimenziók list — a stable full-page sibling (mezo-1gim.13, Task 4)', async () => {
  renderApp('/mezo/karakter/dimenziok')
  // Mock mode starts pre-bootstrap (MOCK_OVERVIEW_EMPTY — 7 CORE dims only, no CHAPTER yet),
  // so the derived count here is 7, not the fully-seeded dossier's 8.
  expect(await screen.findByText(/7 témakör · mindegyik pontosítható/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Fizikai/ })).toBeInTheDocument()
})

test('/mezo/karakter/dimenzio/:key opens one dimension\'s claims (mezo-1gim.13, Task 4)', async () => {
  renderApp('/mezo/karakter/dimenzio/physical')
  expect((await screen.findAllByText('Fizikai')).length).toBeGreaterThan(0)
  expect(screen.getByText('Beszélgess erről Mezóval')).toBeInTheDocument()
})

test('/mezo/karakter/feed opens the feed with its filters — no in-page tab strip (mezo-me75u.9)', async () => {
  renderApp('/mezo/karakter/feed')
  expect(await screen.findByRole('button', { name: 'Beszélgetések' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: /karakter/i })).not.toBeInTheDocument()
})

test('/mezo/karakter/csapat redirects to A csapat — the 9-expert roster retired (mezo-me75u.9)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/mezo/karakter/csapat'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect((await screen.findAllByRole('heading', { name: 'A csapat' })).length).toBeGreaterThan(0)
  expect(router.state.location.pathname).toBe('/mezo/csapat')
  expect(screen.getByRole('link', { name: 'A csapat' })).toHaveAttribute('aria-current', 'page')
})

test('/mezo/karakter/konzilium renders as a stable full-page sibling (mezo-sp9w, Task 9)', async () => {
  // Mode-agnostic: real mode's MSW handler seeds an empty conference list (GET
  // /api/character/conference -> []), so this only asserts the page itself renders as a
  // stable full-page sibling — not the decision-first content, which KonziliumPage.test.tsx
  // already covers against the mock fixtures.
  renderApp('/mezo/karakter/konzilium')
  expect((await screen.findAllByText('Konzílium')).length).toBeGreaterThan(0)
})

test('/mezo/karakter/gepterem is the geek-transparency hub — a stable full-page sibling (mezo-1gim.14, Task 4)', async () => {
  renderApp('/mezo/karakter/gepterem')
  expect(await screen.findByText(/Boop működése · források, memória és futások/)).toBeInTheDocument()
  // Fix round 1 (a11y): the Futások tile carries no `aria-label` any more — its accessible
  // name is its own text content (eyebrow + the live line), so the query matches on that.
  expect(screen.getByRole('button', { name: /Futások/ })).toBeInTheDocument()
})

test('/mezo/karakter/gepterem/futasok is the week-stepped run timeline (mezo-1gim.14, Task 4)', async () => {
  renderApp('/mezo/karakter/gepterem/futasok')
  expect(await screen.findByText(/a pipeline futásai, hetekre bontva/i)).toBeInTheDocument()
})

test('/mezo/karakter/gepterem/futas/:id opens one run\'s detail (mezo-1gim.14, Task 4)', async () => {
  renderApp('/mezo/karakter/gepterem/futas/ejsz-27')
  // ejsz-27 is a seeded signal night (2 fired chains) — the flow strip is the
  // face-independent landmark.
  expect(await screen.findByRole('group', { name: 'Futás-lánc' })).toBeInTheDocument()
})

test('/mezo/karakter/gepterem/adatforrasok is the Bekötve|Tervezett data-source inventory (mezo-1gim.14, Task 5)', async () => {
  renderApp('/mezo/karakter/gepterem/adatforrasok')
  expect(await screen.findByText(/mit olvas a rendszer ma, és mit tervez/i)).toBeInTheDocument()
})

test('/mezo/karakter/gepterem/adatforrasok/kor/:n renders the honest not-found face now that every round has landed (mezo-1gim.15, Task 8)', async () => {
  // Rounds 1-4 have all landed for real via mezo-1gim.15 — INVENTORY_ROUNDS is empty in
  // production, so any :n now hits KorPage's honest not-found face instead of a real round.
  renderApp('/mezo/karakter/gepterem/adatforrasok/kor/4')
  expect(await screen.findByText('Ez a kör nem található.')).toBeInTheDocument()
})

test('/mezo/karakter/gepterem/detektorok lists the 40 real detectors (mezo-1gim.14/.15, Tasks 5-8)', async () => {
  renderApp('/mezo/karakter/gepterem/detektorok')
  expect(await screen.findByText(/a ma aktív katalógus, egy mondatban/i)).toBeInTheDocument()
})

test('Adatforrások\' Tervezett segment survives a kör round-trip (fix round 1, mezo-1gim.14)', async () => {
  // Bug: the segment used to be raw useState — remounting AdatforrasokPage on the way back
  // from a kör mini-page silently reset it to Bekötve. Now useStickyTab-backed
  // (character.adatforrasok.view), the same idiom Sport/Futás/Fuel-slots/Memória use for their
  // own in-view segmented controls.
  //
  // Round 4 landed for real (mezo-1gim.15, Task 8) — INVENTORY_ROUNDS is empty in production, so
  // there is no more clickable round tile to drive the round-trip through. The kör route (and
  // its own AdatforrasokPage remount on the way back) still exists though — a stray/old :n now
  // renders KorPage's honest not-found face instead of a real round, but the remount + sticky-
  // segment coverage this test guards is unchanged, so the round-trip is driven via the router
  // directly instead of a click on a round tile that no longer exists.
  const router = createMemoryRouter(routes, { initialEntries: ['/mezo/karakter/gepterem/adatforrasok'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await userEvent.click(await screen.findByRole('tab', { name: 'Tervezett' }))
  expect(screen.getByRole('tab', { name: 'Tervezett' })).toHaveAttribute('aria-selected', 'true')
  router.navigate('/mezo/karakter/gepterem/adatforrasok/kor/4')
  expect(await screen.findByText('Ez a kör nem található.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByRole('tab', { name: 'Tervezett' })).toHaveAttribute('aria-selected', 'true')
})

test('/me/people stays a stable full-page sibling of the hub', async () => {
  renderApp('/me/people')
  // Mozaik 2.0 re-face (mezo-d20.11): the `Kapcsolatok` h1 became the prototype's
  // page hero (and the page owns a back chip — `‹ Hol tartok` since mezo-lhqw7) — the route is unchanged.
  expect(await screen.findByText('Kapcsolatok', { selector: '.mz-hero-nm' })).toBeInTheDocument()
})
test('the bottom bar stays visible on the regular Train tab', () => {
  const { container } = renderApp('/train')
  expect(container.querySelector('.fo-nav')).toBeTruthy()
})

// The six-tile Edzés hub retired in Train Titanium T4 (mezo-88iwa.5) — /train forwards
// to Mai (router.trainIndexRedirect.test.tsx owns the redirect itself); this asserts
// the landed page still carries no subnav dropdown, the property the retired test named.
test('the Edzés tab lands on Mai — no subnav dropdown (mezo-88iwa.5)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/train'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  // Mai's Titanium face dropped the „Mai nap” h1 (mezo-88iwa.6) — the DayStrip is the
  // page's first element, so that is what proves the landing.
  expect(await screen.findByRole('tablist', { name: 'Hét napjai' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/train/mai')
  expect(screen.queryByLabelText('Train alnavigáció')).not.toBeInTheDocument()
})

test('/train/sport stays a stable full-page sibling of the hub', async () => {
  renderApp('/train/sport')
  // Mozaik 2.0 re-face (mezo-d20.11): the `Röplabda` h1 became the prototype's
  // page hero — the route itself is unchanged.
  expect(await screen.findByText('Sport', { selector: '.mz-hero-nm' })).toBeInTheDocument()
})
test('the bottom bar hides on the full-screen active-workout session (mezo-8141)', () => {
  const { container } = renderApp('/train/session')
  expect(container.querySelector('.fo-nav')).toBeNull()
})
test('the bottom bar hides on the full-screen Napzárás ritual flow (mezo-ilsj)', () => {
  const { container } = renderApp('/ritual')
  expect(container.querySelector('.fo-nav')).toBeNull()
})
// The settings centre keeps the title bar but not the bottom bar — the gate the old tab bar had.
test.each(['/settings', '/settings/fuel'])('the bottom bar hides under %s, the title bar stays', (path) => {
  const { container } = renderApp(path)
  expect(container.querySelector('.fo-nav')).toBeNull()
  expect(container.querySelector('.fo-fab')).toBeNull()
  expect(container.querySelector('.fo-top')).not.toBeNull()
})
// T8 Task 4 final review (mezo-88iwa.9): the sport flow is full-screen too — measured at
// 320px the tab bar and the coral FAB covered the ceremony's close CTA and honesty line.
test('the bottom bar and the FAB hide on the full-screen sport log flow (mezo-88iwa.9)', () => {
  const { container } = renderApp('/train/sport/log')
  expect(container.querySelector('.fo-nav')).toBeNull()
  expect(container.querySelector('.fo-fab')).toBeNull()
})


// mezo-d20.1.2 óta a clay <symbol> defek egyetlen példányban élnek; mezo-ju4j6.3-ban ez a
// példány FELJEBB költözött az AppLayoutból a gyökérbe (main.tsx), mert az indító-képernyő
// is agyag-jelet visel, és az MINDKÉT shell fölött él. A `<use>`-ok ugyanúgy feloldódnak,
// és a duplikált id veszélye pont az, ami ellen ez a teszt véd: ha valaki visszatenné a
// saját példányát a shellbe, a gyökérbeli mellett KÉT `#i-nap` lenne a dokumentumban.
test('a shell NEM mountol saját clay sprite-példányt (mezo-ju4j6.3)', () => {
  renderApp('/today')
  expect(document.querySelectorAll('symbol#i-nap')).toHaveLength(0)
  expect(document.querySelectorAll('symbol#s-orb')).toHaveLength(0)
})

// --- Design 2.0 shell (mezo-d20.1.1): /nap + /mezo routes, legacy redirects, floating FAB ---

test('/nap renders the day spine (Today content) and /today redirects to it', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect(await screen.findByRole('button', { name: 'Beállítások' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/nap')
  cleanup()
  const legacy = createMemoryRouter(routes, { initialEntries: ['/today'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={legacy} /></ThemeProvider></QueryWrapper>)
  await screen.findByRole('button', { name: 'Beállítások' })
  expect(legacy.state.location.pathname).toBe('/nap')
})

// Titanium rebuild (mezo-mhum): /nap/gyors is the FAB's full-page picker destination
// (BottomBar.test.tsx proves the FAB navigates here from /nap exactly) — this is the
// router-config-level half, proving `routes` itself resolves the path to NapGyorsPage.
test('/nap/gyors resolves from the router config to the full-page quick-log picker', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap/gyors'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect(await screen.findByText('Mi érkezett?')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/nap/gyors')
})

// A napom (mezo-yjzhw.4): its route sits deeper than the tab itself (`/nap/napom/:date`),
// so the longest-prefix rule (navModel.activeTabRoute) needs to still land on the tab. In the
// Folyadék frame (F2, mezo-n4wf5.2) a day picked on A napom is the SAME hub page showing another
// day (`hubChild`): the top tabs stay and „A napom" is the lit pill; there is no back button.
test('/nap/napom/2026-09-23 belongs to the „A napom" tab', async () => {
  renderApp('/nap/napom/2026-09-23')
  expect(await screen.findByRole('link', { name: 'A napom' })).toHaveAttribute('aria-current', 'page')
  expect(document.querySelector('.fo-tabs')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Vissza' })).toBeNull()
})

test('/insights/chat redirects into the Mezo tab preserving the subpath', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/insights/chat'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  // The chat is a full-page sibling after the shell dissolution (mezo-d20.5.1) —
  // the composer's send chip is its stable landmark.
  await screen.findByLabelText('Küldés')
  expect(router.state.location.pathname).toBe('/mezo/chat')
})

test('the floating quick-log FAB is present on tabs and hidden on full-screen flows', () => {
  const { container } = renderApp('/train')
  expect(container.querySelector('.fo-fab')).not.toBeNull()
  const ritual = renderApp('/ritual')
  expect(ritual.container.querySelector('.fo-fab')).toBeNull()
})

test('the floating chat bubble is retired — Mezo is a first-class tab now (decision B)', () => {
  renderApp('/nap')
  expect(screen.queryByRole('button', { name: 'Beszélgetés a társsal' })).not.toBeInTheDocument()
})

test('hides the quick-log FAB on the chat page but keeps the bottom bar', () => {
  const { container } = renderApp('/mezo/chat')
  expect(container.querySelector('.fo-fab')).toBeNull()
  expect(container.querySelector('.fo-nav')).not.toBeNull()
})

// mezo-7flr: the companion-first /nap has a bottom composer that owns the thumb zone, so the
// coral FAB (which would overlap the send button) is hidden there — same call as the chat page.
test('hides the quick-log FAB on the companion-first /nap but keeps the bottom bar', () => {
  const { container } = renderApp('/nap')
  expect(container.querySelector('.fo-fab')).toBeNull()
  expect(container.querySelector('.fo-nav')).not.toBeNull()
})

// Replaces „the sticky header keeps its compact aurora …": the aurora and the condensed mode are
// gone with the old header. What the case protected still holds on the title bar — it pins, its
// controls keep their sizes, and the chat (its own header) does not get a second one.
test('the sticky title bar keeps its controls without doubling the chat header', async () => {
  const barRule = frameCss.match(/\.fo-top \{[^}]+\}/)?.[0] ?? ''
  const buttonRule = frameCss.match(/\.fo-ib \{[^}]+\}/)?.[0] ?? ''
  const hubButtonRule = frameCss.match(/\.fo-trow\.hub \.fo-ib \{[^}]+\}/)?.[0] ?? ''

  expect.soft(barRule).toContain('position: sticky; top: 0')
  expect.soft(barRule).toContain('padding: 18px 18px 0')
  expect.soft(frameCss).not.toMatch(/is-cond|app-head/)
  expect.soft(buttonRule).toContain('width: 42px; height: 42px')
  expect.soft(hubButtonRule).toContain('width: 38px; height: 38px')

  const nap = renderApp('/nap')
  const bar = nap.container.querySelector('.fo-top')!
  expect.soft(bar.querySelector('.fo-h h1')?.textContent).toBe('Ma')
  expect.soft(bar.querySelector('.app-head-wordmark')).toBeNull()
  for (const name of ['Minden oldal', 'Beállítások', /Mezo üzenetei/, /Értesítések/]) {
    expect.soft(screen.getByRole('button', { name }).querySelector('svg')).toHaveAttribute('width', '24')
  }
  // The day orb is the shared 30px Drop inside a round button.
  expect.soft((bar.querySelector('.fo-day .fo-drop') as HTMLElement).style.getPropertyValue('--s')).toBe('30px')
  expect.soft(bar.querySelectorAll('.fo-btns > .fo-ib')).toHaveLength(5)
  nap.unmount()

  const { container } = renderApp('/mezo/chat')
  await screen.findByLabelText('Küldés')
  expect.soft(container.querySelector('.fo-top')).toBeNull()
  expect.soft(container.querySelectorAll('.mzc-chathead')).toHaveLength(1)
  expect.soft(rawCss.match(/\.mzc-chathead\s*\{[^}]+\}/)?.[0] ?? '').toContain('top: 0')
})

test('/fuel/log/uj is a stable full-page sibling — the logging page (mezo-bq2t)', async () => {
  // Pins the REAL route string: FuelLogNewPage.test.tsx builds its own memory router with a
  // literal path, so only this test would catch a typo in the app's own route table.
  const { container } = renderApp('/fuel/log/uj')
  // No `w` → the honest out-of-window face is the route-independent landmark.
  expect(await screen.findByText('Ablakon kívül')).toBeInTheDocument()
  expect(container.querySelector('.mz-page.flognew-page')).toBeInTheDocument()
})

test('hides the quick-log FAB on the logging page but keeps the bottom bar (mezo-bq2t)', async () => {
  // The sticky save bar owns the thumb zone there (measured: the FAB sat right on top of it),
  // and a "quick log" FAB on the logging page itself is redundant — the /mezo/chat precedent.
  const { container } = renderApp('/fuel/log/uj')
  await screen.findByText('Ablakon kívül')
  expect(container.querySelector('.fo-fab')).toBeNull()
  expect(container.querySelector('.fo-nav')).not.toBeNull()
})

test('hides the quick-log FAB on the quick-log picker page itself (mezo-mhum)', async () => {
  // /nap/gyors IS the QuickLogSurface picker (page variant) — the FAB would float over its
  // own destination and open the modal sheet duplicate on top of the full-page picker.
  const { container } = renderApp('/nap/gyors')
  await screen.findByText('Mi érkezett?')
  expect(container.querySelector('.fo-fab')).toBeNull()
  expect(container.querySelector('.fo-nav')).not.toBeNull()
})

// Fix round 2 (owner rule): the header back returns where the user came from; a page's fixed
// „parent" route is only the fallback for a direct link. The notification feed names `/me`.
test('back from the notification feed returns to the page it was opened from, not to its parent', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/fuel'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await userEvent.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Összes értesítés ›' }))
  expect(router.state.location.pathname).toBe('/me/ertesitesek')
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(router.state.location.pathname).toBe('/fuel')
})

test('on a direct link the notification feed’s back goes to its fallback, the Én hub', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/me/ertesitesek'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(router.state.location.pathname).toBe('/me')
})
