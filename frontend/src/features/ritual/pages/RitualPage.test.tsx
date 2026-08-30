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
// so the tests that never reach act 5 are unaffected.
// useNeeds is ALSO module-mocked (TodayPage.nudges.test.tsx idiom) so the fix-wave
// readiness-gate test below can force `isPending: true` at act 5 independent of the real
// composed hook's timing — the default `isPending: false` keeps every other test's
// `close(ringsOf(states))` call shape unchanged from before this mock existed.
const mocks = vi.hoisted(() => ({
  useRitualActions: vi.fn(),
  useHabitActions: vi.fn(),
  useNeeds: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useRitualActions: mocks.useRitualActions,
  useHabitActions: mocks.useHabitActions,
}))
vi.mock('@/features/today/logic/useNeeds', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/today/logic/useNeeds')>()),
  useNeeds: mocks.useNeeds,
}))

function setupCloseSpies() {
  const close = vi.fn().mockResolvedValue(undefined)
  const consumeLevelUps = vi.fn()
  // saveReflection is part of the same hook's surface (W1.2) — act 3's ReflectionStep
  // destructures it, so the stub must carry it or the act would throw on advance.
  const saveReflection = vi.fn().mockResolvedValue(undefined)
  mocks.useRitualActions.mockReturnValue({ close, saveReflection, pending: false })
  mocks.useHabitActions.mockReturnValue({ check: vi.fn(), uncheck: vi.fn(), pending: false, consumeLevelUps })
  return { close, consumeLevelUps, saveReflection }
}

// Default spies for every test — the tests below that never reach act 5 never invoke
// close/consumeLevelUps; this only guards against destructuring undefined.
beforeEach(() => {
  setupCloseSpies()
  mocks.useNeeds.mockReturnValue({ states: [], isPending: false })
})
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
  // Today's face-independent landmark: a daypart's own content would make the exit
  // assertion clock-dependent, so anchor on the daypart switcher (mezo-puci).
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
})

test('act 4 (Nyitott hurkok): the journal invite mounts ActivityLogSheet at the page level', async () => {
  stubReduced()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/))
  await user.click(screen.getByText('Tovább')) // act 2 (DayStoryStep) -> act 3 (ReflectionStep)
  await user.click(screen.getByRole('button', { name: 'Ma nem írok' })) // act 3 -> act 4 (LoopsStep)
  expect(screen.getByText('Nyitott hurkok')).toBeInTheDocument()

  // The journal invite is evergreen (LoopsStep.tsx) — always present regardless of check-in/
  // reflect state, so this is deterministic without stubbing checkins/intention data.
  await user.click(screen.getByRole('button', { name: 'Napló' }))
  expect(await screen.findByText('Mi történt ma?')).toBeInTheDocument()
})

test('entering act 5 (Harvest) fires close() exactly once, then silently consumes habit levelUps', async () => {
  stubReduced()
  const { close, consumeLevelUps } = setupCloseSpies()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/)) // act 1 -> act 2
  await user.click(screen.getByText('Tovább')) // act 2 -> act 3 (ReflectionStep)
  await user.click(screen.getByRole('button', { name: 'Ma nem írok' })) // act 3 -> act 4
  await user.click(screen.getByText('Tovább')) // act 4 -> act 5 (HarvestStep)

  expect(screen.getByText('A MAI TERMÉS')).toBeInTheDocument()
  expect(close).toHaveBeenCalledTimes(1)
  // useNeeds resolves (the beforeEach default: isPending false) — the real rings payload
  // goes out, not the pending gate's `undefined` (covered separately below).
  expect(close).toHaveBeenCalledWith(expect.any(Object))
  await waitFor(() => expect(consumeLevelUps).toHaveBeenCalledTimes(1))

  // Re-rendering (e.g. a parent state change) must not re-fire close — the ref guard is
  // act-5-only-once, not a per-render effect.
  await user.click(screen.getByText('Tovább')) // act 5 -> act 6
  expect(close).toHaveBeenCalledTimes(1)
})

test('entering act 5 while useNeeds is still pending calls close(undefined) — never an under-reported snapshot', async () => {
  // Fix-wave review finding: close() is idempotent PER DATE, so a ring snapshot persisted
  // while useNeeds' composite read is still in flight (all-empty-events zero states) would
  // freeze the day's readout on a bad value with no way to re-report it. Passing `undefined`
  // tells the endpoint "no rings this close" instead of a fabricated all-zero one.
  stubReduced()
  mocks.useNeeds.mockReturnValue({ states: [], isPending: true })
  const { close } = setupCloseSpies()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/)) // act 1 -> act 2
  await user.click(screen.getByText('Tovább')) // act 2 -> act 3 (ReflectionStep)
  await user.click(screen.getByRole('button', { name: 'Ma nem írok' })) // act 3 -> act 4
  await user.click(screen.getByText('Tovább')) // act 4 -> act 5 (HarvestStep)

  expect(screen.getByText('A MAI TERMÉS')).toBeInTheDocument()
  expect(close).toHaveBeenCalledTimes(1)
  expect(close).toHaveBeenCalledWith(undefined)
})

test('the ✕ exit before act 5 never calls close (consequence-free up to the Harvest act)', async () => {
  stubReduced()
  const { close, consumeLevelUps } = setupCloseSpies()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/)) // act 1 -> act 2
  await user.click(screen.getByText('Tovább')) // act 2 -> act 3 (ReflectionStep)
  await user.click(screen.getByRole('button', { name: 'Ma nem írok' })) // act 3 -> act 4
  await user.click(screen.getByRole('button', { name: 'Kilépés' }))

  // Today's daypart switcher — the face-independent landmark (mezo-puci).
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
  expect(close).not.toHaveBeenCalled()
  expect(consumeLevelUps).not.toHaveBeenCalled()
})

test('renders six progress dots — one per act', () => {
  stubReduced()
  const { container } = renderApp()
  expect(container.querySelectorAll('.rz-dot')).toHaveLength(6)
})

test('act 3 (Ma milyen volt) sits between A napod íve and Nyitott hurkok, and the skip writes nothing', async () => {
  stubReduced()
  const { saveReflection } = setupCloseSpies()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByRole('button', { name: 'Kezdjük' })) // act 1 -> act 2
  await user.click(screen.getByRole('button', { name: 'Tovább' })) // act 2 -> act 3

  expect(screen.getByText('Milyen volt a napod valójában?')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Ma nem írok' })) // act 3 -> act 4

  expect(screen.getByText('Nyitott hurkok')).toBeInTheDocument()
  expect(saveReflection).not.toHaveBeenCalled()
})

test('act 3 Tovább with prose saves it once, then advances to Nyitott hurkok', async () => {
  stubReduced()
  const { saveReflection } = setupCloseSpies()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByRole('button', { name: 'Kezdjük' })) // act 1 -> act 2
  await user.click(screen.getByRole('button', { name: 'Tovább' })) // act 2 -> act 3

  await user.type(screen.getByRole('textbox', { name: /napod/i }), 'Nehéz nap volt.')
  await user.click(screen.getByRole('button', { name: 'Tovább' })) // act 3 -> act 4

  expect(saveReflection).toHaveBeenCalledTimes(1)
  expect(saveReflection).toHaveBeenCalledWith('Nehéz nap volt.')
  expect(screen.getByText('Nyitott hurkok')).toBeInTheDocument()
})
