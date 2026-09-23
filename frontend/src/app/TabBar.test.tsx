import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from '@/app/TabBar'
import { QuickLogFab } from '@/app/QuickLogFab'
import { resetNavMemory, DOMAINS, activeTabRoute } from '@/app/navModel'
import { QueryWrapper } from '@/test/queryWrapper'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'

beforeEach(() => resetNavMemory())

function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

function LocationProbe() {
  const loc = useLocation()
  // The hash is rendered too: the leltár row navigates with one, and a probe that drops it
  // would let that navigation "pass" while landing at the top of the wrong section.
  return <div data-testid="loc">{loc.pathname}{loc.hash}</div>
}

function renderFabAt(path: string) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="*" element={<><QuickLogFab /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

// Titanium navigation (mezo-jkh4): the bottom bar is a domain-switch mark + the CURRENT
// domain's four contextual tabs — not the always-flat five-domain bar. The switch mark
// carries only the animated companion avatar; tapping it
// opens the domain-switcher dialog.

test('the bar shows the switch mark + the current domain (Nap) and its four tabs', () => {
  renderAt('/nap', <TabBar />)
  expect(screen.getByRole('button', { name: 'Területváltó: Nap' })).toBeInTheDocument()
  for (const label of ['Mai', 'Beszélgetés', 'Rutin', 'Napzárás']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  // The other domains' tabs are NOT on the bar — this is a contextual bar, not a flat one.
  // (mezo-o6uv: 'Receptek' left the Fuel row, so 'Konyha' is the live Fuel-only label here.)
  expect(screen.queryByText('Konyha')).not.toBeInTheDocument()
  expect(screen.queryByText('Súly')).not.toBeInTheDocument()
})

test("each tab renders its clay icon via a sprite use ref (Nap's four + the switch mark)", () => {
  const { container } = renderAt('/nap', <TabBar />)
  for (const sym of ['i-mezo', 'i-nap', 'i-rend', 'i-hold']) {
    expect(container.querySelector(`use[href="#${sym}"]`)).not.toBeNull()
  }
})

// Fuel Titanium (mezo-o6uv): az owner által jóváhagyott sorrend és a négy új ikon.
// A sáv a navModel mátrixból épül, a fülek Link-ek a tab.route-ra (TabBar.tsx:50-64).
test('a Fuel fülsor a jóváhagyott sorrendet és ikonokat viseli', () => {
  renderAt('/fuel', <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Fuel menü' })
  const tabs = within(bar).getAllByRole('link')
  expect(tabs.map(a => a.textContent?.trim())).toEqual(['Mai', 'Kiegészítők', 'Trendek', 'Konyha'])
  expect(tabs.map(a => a.getAttribute('href'))).toEqual([
    '/fuel', '/fuel/stack', '/fuel/trendek', '/fuel/konyha',
  ])
  expect(tabs.map(a => a.querySelector('use')?.getAttribute('href'))).toEqual([
    '#i-tanyer', '#i-kiegeszito', '#i-trend', '#i-fazek',
  ])
})

// A leghosszabb-prefix aktív-fül szabály (navModel.activeTabRoute) a mély Fuel-oldalakon is tart.
test('a Kiegészítők fül aktív a stack mélyebb oldalain is', () => {
  renderAt('/fuel/stack/protocol', <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Fuel menü' })
  expect(within(bar).getByRole('link', { name: /Kiegészítők/ })).toHaveAttribute('aria-current', 'page')
})

test('marks the active tab via longest-matching-prefix — /nap/rutin lights Rutin, not Mai', () => {
  renderAt('/nap/rutin', <TabBar />)
  expect(screen.getByText('Rutin').closest('a')!.className).toContain('active')
  expect(screen.getByText('Mai').closest('a')!.className).not.toContain('active')
})

test('the active domain is derived from the first path segment — /train/week shows Edzés', () => {
  renderAt('/train/week', <TabBar />)
  expect(screen.getByRole('button', { name: 'Területváltó: Edzés' })).toBeInTheDocument()
  for (const label of ['Mai', 'Terv', 'Terhelés', 'Gyakorlatok']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  expect(screen.getByText('Terhelés').closest('a')!.className).toContain('active')
})

test('a domain sub-page that is not one of the four keeps the bar with no tab highlighted', () => {
  // /train itself is the pre-redirect domain home — none of the four tabs own it (Task 2
  // adds the /train → /train/mai redirect; here the bare contract stays: no tab lights up).
  const { container } = renderAt('/train', <TabBar />)
  expect(container.querySelector('a.tab-item.active')).toBeNull()
  // The domain bar itself still resolves to Edzés.
  expect(screen.getByRole('button', { name: 'Területváltó: Edzés' })).toBeInTheDocument()
})

// Train Titanium (mezo-88iwa.5): az owner által jóváhagyott sorrend és a négy fül (2026-09-12
// döntés — sport/futás nem önálló fül: a logolás a Main, a tervek a Terven, a történet a
// Terhelésen él a volumen mellett).
test('a Train fülsor a jóváhagyott sorrendet és ikonokat viseli', () => {
  renderAt('/train/mai', <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Edzés menü' })
  const tabs = within(bar).getAllByRole('link')
  expect(tabs.map(a => a.textContent?.trim())).toEqual(['Mai', 'Terv', 'Terhelés', 'Gyakorlatok'])
  expect(tabs.map(a => a.getAttribute('href'))).toEqual([
    '/train/mai', '/train/mesocycles', '/train/week', '/train/exercises',
  ])
  expect(tabs.map(a => a.querySelector('use')?.getAttribute('href'))).toEqual([
    '#i-edzes', '#i-retegek', '#i-meso', '#i-naplo',
  ])
})

// A leghosszabb-prefix / owns szabály (navModel.activeTabRoute) a mély Train-oldalakon is tart.
test.each([
  ['/train/session', 'Mai'],
  ['/train/review/abc', 'Mai'],
  ['/train/mesocycles/x/days/Hét', 'Terv'],
  // The moved library (Train Titanium T9 Task 2, mezo-88iwa.10) lights Terv via the plain
  // longest-prefix rule — `/train/mesocycles` IS its tab route, so no `owns` entry is needed.
  ['/train/mesocycles/konyvtar', 'Terv'],
  ['/train/futas/123', 'Terv'],
  // T8 Task 4 (mezo-88iwa.9): the full-screen sport-logging flow sits UNDER /train/sport,
  // which the Mai tab already `owns` — so the owns rule reaches it with no new entry.
  ['/train/sport/log', 'Mai'],
  ['/train/gym', 'Terhelés'],
  // T12 Task 4: the two Terhelés subscreens sit UNDER /train/week — the plain prefix rule
  // lights the tab with no `owns` entry needed.
  ['/train/week/terkep', 'Terhelés'],
  ['/train/week/mozgas', 'Terhelés'],
  ['/train/medals', 'Gyakorlatok'],
  // Parity P2 Task 4/5: one exercise's own story page — the Gyakorlatok row owns it.
  ['/train/exercises/f1e3a0e2-0000-4000-8000-000000000072', 'Gyakorlatok'],
])('%s a(z) %s fület gyújtja ki', (path, tab) => {
  renderAt(path, <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Edzés menü' })
  expect(within(bar).getByRole('link', { name: new RegExp(tab) }))
    .toHaveAttribute('aria-current', 'page')
})

// mezo-88iwa.5: a pre-redirect szerződés — /train önmaga egyik fület sem gyújtja ki, amíg
// a Task 2 redirectje be nem kerül (itt csak a navModel-szintű kontraktust rögzítjük).
test('activeTabRoute /train-en null-t ad vissza (pre-redirect szerződés)', () => {
  const train = DOMAINS.find(d => d.id === 'train')!
  expect(activeTabRoute(train, '/train')).toBeNull()
})

test('the switch mark opens the domain-switcher dialog listing the five domains', async () => {
  renderAt('/nap', <TabBar />)
  await userEvent.click(screen.getByRole('button', { name: 'Területváltó: Nap' }))
  const dialog = screen.getByRole('dialog', { name: 'Területváltó' })
  expect(within(dialog).queryByRole('heading')).not.toBeInTheDocument()
  // Five domain cards + the leltár row at the bottom (mezo-ju4j6.17).
  expect(within(dialog).getAllByRole('button')).toHaveLength(6)
  expect(within(dialog).getByRole('button', { name: /Minden oldal/ })).toBeInTheDocument()
  expect(dialog.closest('.sheet')).toBeNull()
  for (const name of ['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én']) {
    expect(within(dialog).getByText(name)).toBeInTheDocument()
  }
  // Each domain lists its four tab labels joined by " · ".
  expect(within(dialog).getByText('Mai · Beszélgetés · Rutin · Napzárás')).toBeInTheDocument()
  expect(within(dialog).getByText('Üzenőfal · Menü · Rólad · Emlékek')).toBeInTheDocument()
})

test('switcher focuses the current card, contains keyboard focus and restores the opener', async () => {
  const user = userEvent.setup()
  renderAt('/me', <TabBar />)
  const opener = screen.getByRole('button', { name: 'Területváltó: Én' })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Területváltó' })
  // The trap spans every button in the dialog — the five cards AND the leltár row, so
  // the last stop before wrapping is the leltár row, not the fifth card (mezo-ju4j6.17).
  const buttons = within(dialog).getAllByRole('button')
  expect(buttons).toHaveLength(6)
  expect(buttons[4]).toHaveFocus()          // Én — the current domain's card
  await user.tab()
  expect(buttons[5]).toHaveFocus()          // Minden oldal
  await user.tab()
  expect(buttons[0]).toHaveFocus()          // wraps to the first card
  await user.tab({ shift: true })
  expect(buttons[5]).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

test('the leltár row opens Minden oldal anchored to the domain you came from', async () => {
  const user = userEvent.setup()
  renderAt('/fuel/stack', <><TabBar /><LocationProbe /></>)
  await user.click(screen.getByRole('button', { name: 'Területváltó: Fuel' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Minden oldal/ }))
  // The hash is the point: a ~100-item inventory that always opened at the top would make
  // the reader hunt for the area they were already standing in.
  expect(screen.getByTestId('loc')).toHaveTextContent('/minden#fuel')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('background is inert while choosing and tapping outside dismisses without navigating', async () => {
  const user = userEvent.setup()
  renderAt('/nap', <><TabBar /><LocationProbe /></>)
  const background = screen.getByTestId('loc').closest('.phone-screen') ?? screen.getByTestId('loc').parentElement!
  await user.click(screen.getByRole('button', { name: 'Területváltó: Nap' }))
  expect(background).toHaveAttribute('inert')
  const overlay = screen.getByRole('dialog').parentElement!
  await user.click(overlay)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(background).not.toHaveAttribute('inert')
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap')
})

test('switching domains keeps the remembered contextual tab and closes the overlay', async () => {
  const user = userEvent.setup()
  renderAt('/fuel/stack', <><TabBar /><LocationProbe /></>)
  await user.click(screen.getByRole('button', { name: 'Területváltó: Fuel' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Én / }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Területváltó: Én' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Fuel / }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/stack')
  expect(screen.getByRole('link', { name: 'Kiegészítők' })).toHaveAttribute('aria-current', 'page')
})

// --- The floating FAB (unchanged by the Titanium rebuild — kept from mezo-mhum) ---

test('the floating FAB opens the quick-log sheet away from /nap', async () => {
  renderFabAt('/train')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors logolás' }))
  expect(screen.getByText('Gyors logolás', { selector: 'h2' })).toBeInTheDocument()
  expect(screen.getByText('Étkezés')).toBeInTheDocument()
})

// Titanium rebuild (mezo-mhum): from /nap EXACTLY the FAB is the tile→page portal to the
// full-page quick-log picker instead of the modal sheet — every other route (including /nap's
// own subpages, e.g. /nap/checkin) keeps opening the sheet, covered by the test above.
test('the floating FAB navigates to the full-page picker from /nap exactly', async () => {
  renderFabAt('/nap')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors logolás' }))
  expect(screen.queryByText('Gyors logolás', { selector: 'h2' })).not.toBeInTheDocument()
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/gyors')
})

// mezo-jb84: a Fuel mély oldalai nem a fülük útvonala alatt élnek (`/fuel/recipes`,
// `/fuel/kamra`, `/fuel/etkezes/…`), ezért prefix-hosszra a `/fuel` — a Mai — nyert, és a
// felhasználó a Konyhában állva a Mai fület látta kigyulladva. Élesben ez jött vissza.
test.each([
  ['/fuel/recipes', 'Konyha'],
  ['/fuel/recipes/r1', 'Konyha'],
  ['/fuel/recipes/muhely', 'Konyha'],
  ['/fuel/kamra', 'Konyha'],
  ['/fuel/kamra/p1', 'Konyha'],
  ['/fuel/etkezes/m1', 'Mai'],
  ['/fuel/log/uj', 'Mai'],
  ['/fuel/settings', 'Mai'],
  ['/fuel/gyogyszer', 'Kiegészítők'],
  ['/fuel/stack/protocol', 'Kiegészítők'],
  ['/fuel/trendek', 'Trendek'],
  ['/fuel', 'Mai'],
])('%s a(z) %s fület gyújtja ki', (path, tab) => {
  renderAt(path, <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Fuel menü' })
  expect(within(bar).getByRole('link', { name: new RegExp(tab) }))
    .toHaveAttribute('aria-current', 'page')
})


test('navigation uses living Boops and an avatar-only corner button', async () => {
  renderAt('/nap', <TabBar />)
  const opener = screen.getByRole('button', { name: 'Területváltó: Nap' })
  expect(opener.querySelector('svg.boop')).toHaveClass('is-alive')
  expect(opener.querySelector('.domain-switch-name')).toBeNull()
  await userEvent.click(opener)
  const avatars = screen.getByRole('dialog').querySelectorAll('svg.boop')
  expect(avatars).toHaveLength(5)
  for (const avatar of avatars) expect(avatar).toHaveClass('is-alive')
})

// Üveg (bible §7.2, mezo-me75u.1): one floating glass bar in the active domain's accent, with
// NO sheen (owner 2026-09-23); the switcher is a glass card whose five Boops stay the buttons.
test('the bar is one still glass surface and the switcher a glass card', async () => {
  renderAt('/fuel', <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Fuel menü' })
  expect(bar).toHaveClass('tab-bar', 'glass', 'is-still')
  expect(bar).toHaveAttribute('data-domain', 'fuel')
  await userEvent.click(screen.getByRole('button', { name: 'Területváltó: Fuel' }))
  const dialog = screen.getByRole('dialog', { name: 'Területváltó' })
  expect(dialog).toHaveClass('domain-switcher', 'glass')
  expect(within(dialog).getByRole('button', { name: /^Fuel —/ })).toHaveAttribute('aria-current', 'true')
})
