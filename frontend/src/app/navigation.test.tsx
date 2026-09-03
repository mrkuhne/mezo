import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

// mezo-gb1s.3: a hub-kalauzok 600 ms után felugranának a navigációs asszertek közben.
beforeEach(() => seedAllKalauzSeen())

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
}

test('redirects / to Today', async () => {
  renderApp('/')
  // The Nap hub's daypart switch is the face-INDEPENDENT landmark (mezo-d20.2.1).
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
})
test('navigates between tabs by clicking the bottom nav', async () => {
  renderApp('/today')
  // Decision B (mezo-d20.1.1): the companion section is the first-class Mezo tab —
  // the Nap hub carries no ✨ header link any more. The tab lands on the hub Mozaik
  // face (mezo-d20.5.1): chat opener + tile mosaic, no subnav dropdown.
  await userEvent.click((await screen.findAllByRole('link')).find(a => a.getAttribute('href') === '/mezo')!)
  expect(await screen.findByRole('button', { name: 'Beszélgetés a társsal' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Insights alnavigáció')).not.toBeInTheDocument()
})
test('Me screen theme selector flips data-theme', async () => {
  // Default is now circadian-auto (wall-clock dependent); preset manual light so this
  // navigation smoke test stays deterministic. Auto/circadian resolution is covered by
  // CircadianTheme.test + ThemeProvider.test.
  // The Me shell dissolved (mezo-d20.6.1): "Beállítások" is now a hub tile that navigates to
  // its own full page (`/me/beallitasok`, `BeallitasokPage`), not the retired SubNavDropdown's
  // ⚙️ extra action or a settings sheet.
  localStorage.setItem('mezo-theme', 'light')
  renderApp('/me')
  await userEvent.click(await screen.findByRole('button', { name: 'Beállítások' }))
  // Manual light => no attribute (light is the CSS base); choosing Sötét flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Sötét/ }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('the Én tab lands on the hub Mozaik face — no subnav dropdown (mezo-d20.6.1)', async () => {
  renderApp('/me')
  expect(await screen.findByRole('button', { name: 'Beállítások' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Súly' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Me alnavigáció')).not.toBeInTheDocument()
})

test('the Fuel tab lands on the hub Mozaik face — no subnav dropdown (mezo-d20.4.1)', async () => {
  renderApp('/fuel')
  // The Fuel-beállítások band (the retired SubNavDropdown's ⚙️ extra action, re-homed)
  // and the tile mosaic are the face-independent landmarks.
  expect(await screen.findByRole('button', { name: 'Fuel-beállítások' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Receptek' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Fuel alnavigáció')).not.toBeInTheDocument()
})

test('/fuel/stack stays a stable full-page sibling of the Fuel hub', async () => {
  const { container } = renderApp('/fuel/stack')
  // Mozaik face since the fidelity audit (mezo-d20.11): the `.pghead-np` h1 "Napi protokoll"
  // became a sage MozaikPage with the prototype's "Stack" hero — the ROUTE is what this
  // navigation test pins, so it asserts the page scaffold, not the retired headline.
  expect(await screen.findByText('Stack')).toBeInTheDocument()
  expect(container.querySelector('.mz-page.mz-p-sage')).toBeInTheDocument()
})

test('/me/karakter is the Karakter dossier hub — reachable as a stable route (mezo-1gim.13)', async () => {
  renderApp('/me/karakter')
  // The ring's aria-label is the face-independent landmark: mock mode starts pre-bootstrap
  // (all CORE dims at maturity 0), so the intro ceremony's CTA is what actually renders.
  expect(await screen.findByRole('button', { name: 'Kezdjétek el' })).toBeInTheDocument()
})

test('the Mezo hub links to the Karakter dossier hub (hub-tile-reorg)', async () => {
  renderApp('/mezo')
  await userEvent.click(await screen.findByRole('button', { name: 'Karakter' }))
  expect(await screen.findByRole('button', { name: 'Kezdjétek el' })).toBeInTheDocument()
})

test('/me/karakter/dimenziok is the Dimenziók list — a stable full-page sibling (mezo-1gim.13, Task 4)', async () => {
  renderApp('/me/karakter/dimenziok')
  // Mock mode starts pre-bootstrap (MOCK_OVERVIEW_EMPTY — 7 CORE dims only, no CHAPTER yet),
  // so the derived count here is 7, not the fully-seeded dossier's 8.
  expect(await screen.findByText('7 dimenzió, egy helyen')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Fizikai' })).toBeInTheDocument()
})

test('/me/karakter/dimenzio/:key opens one dimension\'s claims (mezo-1gim.13, Task 4)', async () => {
  renderApp('/me/karakter/dimenzio/physical')
  expect(await screen.findByText('Fizikai')).toBeInTheDocument()
  expect(screen.getByText('Beszélgess erről Mezóval')).toBeInTheDocument()
})

test('/me/karakter/feed is the day-grouped observation feed (mezo-1gim.13, Task 4)', async () => {
  renderApp('/me/karakter/feed')
  expect(await screen.findByText('Amit mostanában megtudtam rólad')).toBeInTheDocument()
})

test('/me/karakter/csapat is the 9-persona team page (mezo-1gim.13, Task 5)', async () => {
  renderApp('/me/karakter/csapat')
  expect(await screen.findByText('Mezo belső tanácsa — ők dolgoznak a karakteren')).toBeInTheDocument()
  expect(screen.getByText('Doki')).toBeInTheDocument()
  expect(screen.getByText('Elnök · Integrátor')).toBeInTheDocument()
})

test('/me/karakter/konzilium is the conference list — a stable full-page sibling (mezo-1gim.13, Task 5)', async () => {
  renderApp('/me/karakter/konzilium')
  expect(await screen.findByText('a csapat heti tanácskozásai')).toBeInTheDocument()
})

test('/me/karakter/gepterem is the geek-transparency hub — a stable full-page sibling (mezo-1gim.14, Task 4)', async () => {
  renderApp('/me/karakter/gepterem')
  expect(await screen.findByText('mi táplálja a dossziét — nyíltan')).toBeInTheDocument()
  // Fix round 1 (a11y): the Futások tile carries no `aria-label` any more — its accessible
  // name is its own text content (eyebrow + the live line), so the query matches on that.
  expect(screen.getByRole('button', { name: /Futások/ })).toBeInTheDocument()
})

test('/me/karakter/gepterem/futasok is the week-stepped run timeline (mezo-1gim.14, Task 4)', async () => {
  renderApp('/me/karakter/gepterem/futasok')
  expect(await screen.findByText('a pipeline futásai, hetekre bontva')).toBeInTheDocument()
})

test('/me/karakter/gepterem/futas/:id opens one run\'s detail (mezo-1gim.14, Task 4)', async () => {
  renderApp('/me/karakter/gepterem/futas/ejsz-27')
  // ejsz-27 is a seeded signal night (2 fired chains) — the flow strip is the
  // face-independent landmark.
  expect(await screen.findByRole('group', { name: 'Futás-lánc' })).toBeInTheDocument()
})

test('/me/karakter/gepterem/adatforrasok is the Bekötve|Tervezett data-source inventory (mezo-1gim.14, Task 5)', async () => {
  renderApp('/me/karakter/gepterem/adatforrasok')
  expect(await screen.findByText('mit olvas a rendszer ma, és mit tervez')).toBeInTheDocument()
})

test('/me/karakter/gepterem/adatforrasok/kor/:n renders the honest not-found face now that every round has landed (mezo-1gim.15, Task 8)', async () => {
  // Rounds 1-4 have all landed for real via mezo-1gim.15 — INVENTORY_ROUNDS is empty in
  // production, so any :n now hits KorPage's honest not-found face instead of a real round.
  renderApp('/me/karakter/gepterem/adatforrasok/kor/4')
  expect(await screen.findByText('Ez a kör nem található.')).toBeInTheDocument()
})

test('/me/karakter/gepterem/detektorok lists the 40 real detectors (mezo-1gim.14/.15, Tasks 5-8)', async () => {
  renderApp('/me/karakter/gepterem/detektorok')
  expect(await screen.findByText('a ma aktív katalógus, egy mondatban')).toBeInTheDocument()
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
  const router = createMemoryRouter(routes, { initialEntries: ['/me/karakter/gepterem/adatforrasok'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await userEvent.click(await screen.findByRole('tab', { name: 'Tervezett' }))
  expect(screen.getByRole('tab', { name: 'Tervezett' })).toHaveAttribute('aria-selected', 'true')
  router.navigate('/me/karakter/gepterem/adatforrasok/kor/4')
  expect(await screen.findByText('Ez a kör nem található.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByRole('tab', { name: 'Tervezett' })).toHaveAttribute('aria-selected', 'true')
})

test('/me/people stays a stable full-page sibling of the hub', async () => {
  renderApp('/me/people')
  // Mozaik 2.0 re-face (mezo-d20.11): the `Kapcsolatok` h1 became the prototype's
  // page hero (and the page finally owns a `‹ Én` back chip) — the route is unchanged.
  expect(await screen.findByText('Kapcsolatok', { selector: '.mz-hero-nm' })).toBeInTheDocument()
})
test('the tab bar stays visible on the regular Train tab', () => {
  const { container } = renderApp('/train')
  expect(container.querySelector('.tab-bar')).toBeTruthy()
})

test('the Edzés tab lands on the hub Mozaik face — no subnav dropdown (mezo-d20.3.1)', async () => {
  renderApp('/train')
  expect(await screen.findByRole('button', { name: 'Heti terv' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Train alnavigáció')).not.toBeInTheDocument()
})

test('/train/sport stays a stable full-page sibling of the hub', async () => {
  renderApp('/train/sport')
  // Mozaik 2.0 re-face (mezo-d20.11): the `Röplabda` h1 became the prototype's
  // page hero — the route itself is unchanged.
  expect(await screen.findByText('Sport', { selector: '.mz-hero-nm' })).toBeInTheDocument()
})
test('the tab bar hides on the full-screen active-workout session (mezo-8141)', () => {
  const { container } = renderApp('/train/session')
  expect(container.querySelector('.tab-bar')).toBeNull()
})
test('the tab bar hides on the full-screen Napzárás ritual flow (mezo-ilsj)', () => {
  const { container } = renderApp('/ritual')
  expect(container.querySelector('.tab-bar')).toBeNull()
})


test('the app shell mounts the clay sprite defs once (mezo-d20.1.2)', () => {
  renderApp('/today')
  expect(document.querySelector('symbol#i-nap')).not.toBeNull()
  expect(document.querySelector('symbol#s-orb')).not.toBeNull()
  expect(document.querySelectorAll('#ig-orb')).toHaveLength(1)
})

// --- Design 2.0 shell (mezo-d20.1.1): /nap + /mezo routes, legacy redirects, floating FAB ---

test('/nap renders the day spine (Today content) and /today redirects to it', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/nap')
  cleanup()
  const legacy = createMemoryRouter(routes, { initialEntries: ['/today'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={legacy} /></ThemeProvider></QueryWrapper>)
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(legacy.state.location.pathname).toBe('/nap')
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
  expect(container.querySelector('.quicklog-fab')).not.toBeNull()
  const ritual = renderApp('/ritual')
  expect(ritual.container.querySelector('.quicklog-fab')).toBeNull()
})

test('the floating chat bubble is retired — Mezo is a first-class tab now (decision B)', () => {
  renderApp('/nap')
  expect(screen.queryByRole('button', { name: 'Beszélgetés a társsal' })).not.toBeInTheDocument()
})

test('hides the quick-log FAB on the chat page but keeps the tab bar', () => {
  const { container } = renderApp('/mezo/chat')
  expect(container.querySelector('.quicklog-fab')).toBeNull()
  expect(container.querySelector('.tab-bar')).not.toBeNull()
})

test('/fuel/log/uj is a stable full-page sibling — the logging page (mezo-bq2t)', async () => {
  // Pins the REAL route string: FuelLogNewPage.test.tsx builds its own memory router with a
  // literal path, so only this test would catch a typo in the app's own route table.
  const { container } = renderApp('/fuel/log/uj')
  // No `w` → the honest out-of-window face is the route-independent landmark.
  expect(await screen.findByText('Ablakon kívül')).toBeInTheDocument()
  expect(container.querySelector('.mz-page.flognew-page')).toBeInTheDocument()
})

test('hides the quick-log FAB on the logging page but keeps the tab bar (mezo-bq2t)', async () => {
  // The sticky save bar owns the thumb zone there (measured: the FAB sat right on top of it),
  // and a "quick log" FAB on the logging page itself is redundant — the /mezo/chat precedent.
  const { container } = renderApp('/fuel/log/uj')
  await screen.findByText('Ablakon kívül')
  expect(container.querySelector('.quicklog-fab')).toBeNull()
  expect(container.querySelector('.tab-bar')).not.toBeNull()
})
