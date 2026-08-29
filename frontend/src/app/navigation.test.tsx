import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

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
  // The Me shell dissolved (mezo-d20.6.1): the settings sheet now opens from the Én hub's
  // Beállítások band, not from the retired SubNavDropdown's ⚙️ extra action.
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

test('/me/people stays a stable full-page sibling of the hub', async () => {
  renderApp('/me/people')
  expect(await screen.findByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
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
  expect(await screen.findByRole('heading', { level: 1, name: 'Röplabda' })).toBeInTheDocument()
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
