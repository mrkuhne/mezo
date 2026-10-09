import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BottomBar } from '@/app/BottomBar'
import { QuickLogFab } from '@/app/QuickLogFab'
import { resetNavMemory } from '@/app/navModel'
import { QueryWrapper } from '@/test/queryWrapper'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'

beforeEach(() => resetNavMemory())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.hash}</div>
}

function renderAt(path: string) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}><BottomBar /><LocationProbe /></MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
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

const bar = () => screen.getByRole('navigation', { name: 'Területek' })
const domainLinks = () => within(bar()).getAllByRole('link')

// Folyadék frame (mezo-n4wf5.1, owner-approved 2026-10-09): the bottom bar is the FIVE DOMAINS,
// always — not a domain-switch mark + the current domain's four tabs (the Titanium bar,
// mezo-jkh4). The four tabs moved to the top (TopTabs.test.tsx); the domain-switcher dialog
// is gone, so reaching another domain is ONE tap on its drop.

test('the bar shows the five domains, always, in order', () => {
  renderAt('/nap')
  expect(domainLinks().map((a) => a.textContent?.trim())).toEqual(['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én'])
  // first visit → each domain's tab 1
  expect(domainLinks().map((a) => a.getAttribute('href'))).toEqual(['/nap', '/train/mai', '/fuel', '/mezo', '/me'])
})

test.each(['/nap', '/train/week', '/fuel/stack/protocol', '/mezo/chat', '/me/goals/new'])(
  'the same five domains stand on %s — the bar is not contextual', (path) => {
    renderAt(path)
    expect(domainLinks().map((a) => a.textContent?.trim())).toEqual(['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én'])
  })

test('the bar carries the domains only — no tab of any domain is on it', () => {
  renderAt('/nap')
  for (const label of ['Mai', 'A napom', 'Beszélgetés', 'Rutin', 'Konyha', 'Test']) {
    expect(within(bar()).queryByText(label)).not.toBeInTheDocument()
  }
})

test.each([
  ['/nap', 'Nap'], ['/nap/rutin', 'Nap'], ['/train/week', 'Edzés'], ['/train', 'Edzés'],
  ['/fuel/recipes/r1', 'Fuel'], ['/mezo/karakter/feed', 'Mezo'], ['/me/sleep', 'Én'],
])('the active domain is derived from the first path segment — %s lights %s', (path, name) => {
  renderAt(path)
  const lit = domainLinks().filter((a) => a.getAttribute('aria-current') === 'true')
  expect(lit.map((a) => a.textContent?.trim())).toEqual([name])
  expect(lit[0]).toHaveClass('on')
  expect(domainLinks().filter((a) => a.classList.contains('on'))).toHaveLength(1)
})

test('a path outside the five domains lights Nap, so the bar always shows a coherent state', () => {
  renderAt('/minden')
  expect(within(bar()).getByRole('link', { name: 'Nap' })).toHaveAttribute('aria-current', 'true')
})

test('tapping a domain goes straight to it — its tab 1 on a first visit', async () => {
  renderAt('/nap')
  await userEvent.click(within(bar()).getByRole('link', { name: 'Mezo' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/mezo')
  expect(within(bar()).getByRole('link', { name: 'Mezo' })).toHaveAttribute('aria-current', 'true')
})

// Last-tab memory (mezo-jkh4) moved here unchanged: the bar records every navigation and each
// drop returns its domain to the last-visited tab.
test('switching domains keeps the remembered tab', async () => {
  const user = userEvent.setup()
  renderAt('/fuel/stack')
  await user.click(within(bar()).getByRole('link', { name: 'Én' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me')
  await user.click(within(bar()).getByRole('link', { name: 'Fuel' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/stack')
})

test('a deep page is remembered as its OWNING tab (owns rule, mezo-jb84)', async () => {
  const user = userEvent.setup()
  renderAt('/fuel/recipes/r1')
  await user.click(within(bar()).getByRole('link', { name: 'Nap' }))
  expect(within(bar()).getByRole('link', { name: 'Fuel' })).toHaveAttribute('href', '/fuel/konyha')
  await user.click(within(bar()).getByRole('link', { name: 'Fuel' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/konyha')
})

// The domain switcher is gone (replaces the old dialog cases: the five-card list, the focus
// trap, the inert background, the backdrop dismiss, the glass card). What took its place is
// that there is NOTHING to open: no popup trigger, no dialog, nothing made inert.
test('there is no domain switcher: no dialog trigger on the bar, and a tap opens none', async () => {
  const { container } = renderAt('/nap')
  expect(container.querySelector('[aria-haspopup="dialog"]')).toBeNull()
  expect(within(bar()).queryByRole('button')).not.toBeInTheDocument()
  await userEvent.click(within(bar()).getByRole('link', { name: 'Edzés' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.querySelector('[inert]')).toBeNull()
  expect(document.querySelector('.domain-switcher, .domain-switcher-overlay')).toBeNull()
})

// Replaces „navigation uses living Boops": the marks are the five drops; only the active one is
// alive (breathing) and it stands fuller than the rest.
test('each domain is a drop in its own colour — the active one alive and fuller', () => {
  renderAt('/fuel')
  const drops = domainLinks().map((a) => a.querySelector('.fo-drop') as HTMLElement)
  expect(drops.every(Boolean)).toBe(true)
  expect(drops.map((d) => d.style.getPropertyValue('--c'))).toEqual(['#1F6FEB', '#F26A3D', '#1E9E6A', '#6D5BD0', '#0E9AA7'])
  expect(drops.map((d) => d.classList.contains('alive'))).toEqual([false, false, true, false, false])
  expect(drops.map((d) => d.style.getPropertyValue('--s'))).toEqual(['34px', '34px', '40px', '34px', '34px'])
  // the level: 86 for the active drop, the resting levels for the others (kit.js FILL)
  const level = (d: HTMLElement) => 100 - Number(d.querySelector('.liq')!.getAttribute('d')!.match(/^M-20 (\d+)/)![1])
  expect(drops.map(level)).toEqual([70, 34, 86, 50, 58])
  // decoration only: the link's name is the domain's name
  expect(document.querySelector('svg.boop')).toBeNull()
})

// Replaces „the bar is one still glass surface": one nav landmark in the frame's own dress.
test('the bar is one `fo-nav` landmark named Területek', () => {
  renderAt('/fuel')
  expect(bar()).toHaveClass('fo-nav')
  expect(bar()).not.toHaveClass('tab-bar')
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
})

// --- The floating FAB (same behaviour and gate; the Folyadék look) ---

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

test('the FAB wears the frame dress', () => {
  renderFabAt('/train')
  expect(screen.getByRole('button', { name: 'Gyors logolás' })).toHaveClass('fo-fab')
})
