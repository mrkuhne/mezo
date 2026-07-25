import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Force reduced-motion so the np-draw/rz-breath entrance choreography never masks content
// under jsdom (stubReduced pattern, LevelUpScreen.test.tsx precedent).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// useRitualActions/useHabitActions are mocked so the close-on-enter tests can spy on
// `close`/`consumeLevelUps` call counts — every OTHER hook stays real (importOriginal),
// so the 4 pre-existing tests above (which never reach act 4) are unaffected.
const mocks = vi.hoisted(() => ({
  useRitualActions: vi.fn(),
  useHabitActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useRitualActions: mocks.useRitualActions,
  useHabitActions: mocks.useHabitActions,
}))

function setupCloseSpies() {
  const close = vi.fn().mockResolvedValue(undefined)
  const consumeLevelUps = vi.fn()
  mocks.useRitualActions.mockReturnValue({ close, pending: false })
  mocks.useHabitActions.mockReturnValue({ check: vi.fn(), uncheck: vi.fn(), pending: false, consumeLevelUps })
  return { close, consumeLevelUps }
}

// Default spies for every test — the 4 pre-existing tests below never reach act 4, so
// they never invoke close/consumeLevelUps; this only guards against destructuring undefined.
beforeEach(() => setupCloseSpies())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function renderApp(path = '/ritual') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
}

test('act 1 (Megérkezés) renders the fixed arrival line and no tab bar', () => {
  stubReduced()
  const { container } = renderApp()
  expect(screen.getByText('A nap véget ért.')).toBeInTheDocument()
  expect(screen.getByText('Zárjuk le együtt.')).toBeInTheDocument()
  expect(container.querySelector('.tab-bar')).toBeNull()
})

test('clicking Kezdjük advances from act 1 to act 2 (DayStoryStep)', async () => {
  stubReduced()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/))
  expect(screen.getByText('A napod íve')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'A napod íve — összegzés' })).toBeInTheDocument()
  expect(screen.queryByText('A nap véget ért.')).not.toBeInTheDocument()
})

test('the ✕ exit (Kilépés) navigates straight to /today, consequence-free from act 1', async () => {
  stubReduced()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByRole('button', { name: 'Kilépés' }))
  expect(await screen.findByText(/briefing/i)).toBeInTheDocument()
})

test('act 3 (Nyitott hurkok): the journal invite mounts ActivityLogSheet at the page level', async () => {
  stubReduced()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/))
  await user.click(screen.getByText('Tovább')) // act 2 (DayStoryStep) -> act 3 (LoopsStep)
  expect(screen.getByText('Nyitott hurkok')).toBeInTheDocument()

  // The journal invite is evergreen (LoopsStep.tsx) — always present regardless of check-in/
  // reflect state, so this is deterministic without stubbing checkins/intention data.
  await user.click(screen.getByRole('button', { name: 'Napló' }))
  expect(await screen.findByText('Mi történt ma?')).toBeInTheDocument()
})

test('entering act 4 (Harvest) fires close() exactly once, then silently consumes habit levelUps', async () => {
  stubReduced()
  const { close, consumeLevelUps } = setupCloseSpies()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/)) // act 1 -> act 2
  await user.click(screen.getByText('Tovább')) // act 2 -> act 3
  await user.click(screen.getByText('Tovább')) // act 3 -> act 4 (HarvestStep)

  expect(screen.getByText('A MAI TERMÉS')).toBeInTheDocument()
  expect(close).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(consumeLevelUps).toHaveBeenCalledTimes(1))

  // Re-rendering (e.g. a parent state change) must not re-fire close — the ref guard is
  // act-4-only-once, not a per-render effect.
  await user.click(screen.getByText('Tovább')) // act 4 -> act 5
  expect(close).toHaveBeenCalledTimes(1)
})

test('the ✕ exit before act 4 never calls close (consequence-free up to the Harvest act)', async () => {
  stubReduced()
  const { close, consumeLevelUps } = setupCloseSpies()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/)) // act 1 -> act 2
  await user.click(screen.getByText('Tovább')) // act 2 -> act 3
  await user.click(screen.getByRole('button', { name: 'Kilépés' }))

  expect(await screen.findByText(/briefing/i)).toBeInTheDocument()
  expect(close).not.toHaveBeenCalled()
  expect(consumeLevelUps).not.toHaveBeenCalled()
})
