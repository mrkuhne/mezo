import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopTabs, type TopTabsProps } from '@/app/TopTabs'
import { DOMAINS, activeTabRoute, frameFor, resetNavMemory } from '@/app/navModel'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  resetNavMemory()
})
afterEach(() => vi.unstubAllEnvs())

function renderAt(path: string, props: TopTabsProps = {}) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <MezoThreadProvider><TopTabs {...props} /></MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

const strip = (name: string) => screen.getByRole('navigation', { name: `${name} oldalai` })

// Folyadék frame (mezo-n4wf5.1, owner-approved 2026-10-09): the active domain's four pages are
// pill links at the TOP, under the title — they left the bottom bar (now the five domains,
// BottomBar.test.tsx). Only a HUB has them: a path that IS one of the four tab routes.

test('a hub shows the current domain (Nap) and its four tabs', () => {
  renderAt('/nap')
  const tabs = within(strip('Nap')).getAllByRole('link')
  expect(tabs.map((a) => a.getAttribute('href'))).toEqual(['/nap', '/nap/napom', '/nap/uzenetek', '/nap/rutin'])
  for (const label of ['Mai', 'A napom', 'Beszélgetés', 'Rutin']) expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  // The other domains' tabs are NOT on the strip.
  expect(screen.queryByText('Konyha')).not.toBeInTheDocument()
  expect(screen.queryByText('Súly')).not.toBeInTheDocument()
})

// A napom tab dot (mezo-yjzhw.4): AppLayout decides morning mode and passes it in via
// `dots`, keyed by the tab's own route — TopTabs just renders what it is told.
test('a dots entry for the tab route renders the „kész a tegnapi értékelés" dot', () => {
  const { container } = renderAt('/nap', { dots: { '/nap/napom': true } })
  // the dot is decoration; its meaning is the tab's DESCRIPTION, so the tab's NAME stays „A napom"
  const tab = screen.getByRole('link', { name: 'A napom' })
  expect(tab).toHaveAccessibleDescription('kész a tegnapi értékelés')
  expect(container.querySelector('.td')).toHaveAttribute('aria-hidden', 'true')
})

test('without a dot the A napom tab carries no description', () => {
  const { container } = renderAt('/nap')
  expect(screen.getByRole('link', { name: 'A napom' })).not.toHaveAttribute('aria-describedby')
  expect(container.querySelector('.td')).toBeNull()
})

// The unread count of the Mezo thread rides the „Beszélgetés" pill (the header badge's twin).
test('the Beszélgetés tab carries the thread’s unread count, as its description', () => {
  renderAt('/nap')
  const tab = screen.getByRole('link', { name: 'Beszélgetés' })
  const count = Number(tab.querySelector('.tn')!.textContent)
  expect(count).toBeGreaterThan(0) // mock mode: demo briefing + Életjel nudges
  expect(tab.querySelector('.tn')).toHaveAttribute('aria-hidden', 'true')
  expect(tab).toHaveAccessibleDescription(`${count} olvasatlan`)
  // no other tab, and no other domain's strip, shows a count
  expect(document.querySelectorAll('.tn')).toHaveLength(1)
})

// Replaces „each tab renders its clay icon": the approved pills are labels only.
test('the pills are text — no sprite icon on a tab', () => {
  const { container } = renderAt('/nap')
  expect(container.querySelector('.fo-tabs use')).toBeNull()
})

// Fuel Titanium (mezo-o6uv): az owner által jóváhagyott sorrend. A sor a navModel mátrixból
// épül, a fülek Link-ek a tab.route-ra.
test('a Fuel fülsor a jóváhagyott sorrendet viseli', () => {
  renderAt('/fuel')
  const tabs = within(strip('Fuel')).getAllByRole('link')
  expect(tabs.map((a) => a.textContent?.trim())).toEqual(['Mai', 'Kiegészítők', 'Trendek', 'Konyha'])
  expect(tabs.map((a) => a.getAttribute('href'))).toEqual(['/fuel', '/fuel/stack', '/fuel/trendek', '/fuel/konyha'])
})

test('marks the active tab — /nap/rutin lights Rutin, not Mai', () => {
  renderAt('/nap/rutin')
  expect(screen.getByRole('link', { name: 'Rutin' })).toHaveClass('on')
  expect(screen.getByRole('link', { name: 'Rutin' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Mai' })).not.toHaveClass('on')
  expect(screen.getByRole('link', { name: 'Mai' })).not.toHaveAttribute('aria-current')
})

test('the domain is derived from the first path segment — /train/week shows Edzés', () => {
  renderAt('/train/week')
  for (const label of ['Mai', 'Terv', 'Terhelés', 'Gyakorlatok']) {
    expect(within(strip('Edzés')).getByRole('link', { name: label })).toBeInTheDocument()
  }
  expect(screen.getByRole('link', { name: 'Terhelés' })).toHaveClass('on')
})

// Train Titanium (mezo-88iwa.5): az owner által jóváhagyott sorrend és a négy fül.
test('a Train fülsor a jóváhagyott sorrendet viseli', () => {
  renderAt('/train/mai')
  const tabs = within(strip('Edzés')).getAllByRole('link')
  expect(tabs.map((a) => a.textContent?.trim())).toEqual(['Mai', 'Terv', 'Terhelés', 'Gyakorlatok'])
  expect(tabs.map((a) => a.getAttribute('href'))).toEqual([
    '/train/mai', '/train/mesocycles', '/train/week', '/train/exercises',
  ])
})

// `train-tabs` anchors the Edzés kalauz's tab-row card — on the train strip only.
test('the train strip carries the kalauz anchor; the other domains’ strips do not', () => {
  const train = renderAt('/train/mai')
  expect(strip('Edzés')).toHaveAttribute('data-kalauz-anchor', 'train-tabs')
  train.unmount()
  renderAt('/fuel')
  expect(strip('Fuel')).not.toHaveAttribute('data-kalauz-anchor')
})

// Was: „a domain sub-page that is not one of the four keeps the bar with no tab highlighted".
// The strip belongs to hubs — a path that is not a tab route has no strip at all.
test('a domain path that is not one of the four tab routes has no tab strip', () => {
  const { container } = renderAt('/train')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(container.querySelector('.fo-tabs')).toBeNull()
})

// mezo-88iwa.5: a pre-redirect szerződés — /train önmaga egyik fület sem gyújtja ki.
test('activeTabRoute /train-en null-t ad vissza (pre-redirect szerződés)', () => {
  const train = DOMAINS.find((d) => d.id === 'train')!
  expect(activeTabRoute(train, '/train')).toBeNull()
})

// The longest-prefix / owns rule (navModel.activeTabRoute) on the DEEP pages. They used to light
// a tab on the bottom bar; a deep page is a sub-page now — no strip — and the owning tab shows
// as the title bar's context line („Terület · Fül") and as the back fallback. Every case kept.
const OWNED: [string, string, string][] = [
  // Train (mezo-88iwa.5 … P2)
  ['/train/session', 'Edzés', 'Mai'],
  ['/train/review/abc', 'Edzés', 'Mai'],
  ['/train/mesocycles/x/days/Hét', 'Edzés', 'Terv'],
  ['/train/mesocycles/konyvtar', 'Edzés', 'Terv'],
  ['/train/futas/123', 'Edzés', 'Terv'],
  ['/train/sport/log', 'Edzés', 'Mai'],
  ['/train/gym', 'Edzés', 'Terhelés'],
  ['/train/week/terkep', 'Edzés', 'Terhelés'],
  ['/train/week/mozgas', 'Edzés', 'Terhelés'],
  ['/train/medals', 'Edzés', 'Gyakorlatok'],
  ['/train/exercises/f1e3a0e2-0000-4000-8000-000000000072', 'Edzés', 'Gyakorlatok'],
  // Fuel (mezo-jb84): a mély oldalak nem a fülük útvonala alatt élnek
  ['/fuel/recipes', 'Fuel', 'Konyha'],
  ['/fuel/recipes/r1', 'Fuel', 'Konyha'],
  ['/fuel/recipes/muhely', 'Fuel', 'Konyha'],
  ['/fuel/kamra', 'Fuel', 'Konyha'],
  ['/fuel/kamra/p1', 'Fuel', 'Konyha'],
  ['/fuel/etkezes/m1', 'Fuel', 'Mai'],
  ['/fuel/log/uj', 'Fuel', 'Mai'],
  ['/fuel/settings', 'Fuel', 'Mai'],
  ['/fuel/gyogyszer', 'Fuel', 'Kiegészítők'],
  ['/fuel/stack/protocol', 'Fuel', 'Kiegészítők'],
]
test.each(OWNED)('%s a(z) %s · %s fülhöz tartozik — aloldal, fülsor nélkül', (path, domain, tab) => {
  const frame = frameFor(path, new Date(2026, 9, 7))
  expect(frame.isHub).toBe(false)
  expect(frame.tab?.label).toBe(tab)
  expect(frame.eyebrow).toBe(`${domain} · ${tab}`)
  const { container } = renderAt(path)
  expect(container.querySelector('.fo-tabs')).toBeNull()
})

test.each([
  ['/fuel/trendek', 'Fuel', 'Trendek'],
  ['/fuel', 'Fuel', 'Mai'],
  ['/fuel/stack', 'Fuel', 'Kiegészítők'],
  ['/train/exercises', 'Edzés', 'Gyakorlatok'],
])('%s a(z) %s fülsorán a(z) %s fület gyújtja ki', (path, domain, tab) => {
  renderAt(path)
  expect(within(strip(domain)).getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page')
  expect(within(strip(domain)).getAllByRole('link').filter((a) => a.getAttribute('aria-current'))).toHaveLength(1)
})
