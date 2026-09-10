import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapGyorsPage } from '@/features/today/pages/NapGyorsPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { initialCheckins } from '@/data/today/checkins'
import { localDateString } from '@/shared/lib/dates'

// Same data-layer stubs as QuickInputSheet.test.tsx (the two surfaces share the same
// `QuickLogSurface` grid — mezo-mhum) so this page's tiles/sublines render deterministically.
const checkinsMock = vi.hoisted(() => ({ useCheckins: vi.fn() }))
const fuelPreviewMock = vi.hoisted(() => ({ useFuelPreview: vi.fn() }))
const waterStore = vi.hoisted(() => ({ set: undefined as undefined | ((up: (n: number) => number) => void) }))
// Records every `navigate(...)` argument in call order (mezo-mhum whole-branch-review finding):
// `MemoryRouter`'s history applies a `go(-1)` and a subsequent `push(target)` SYNCHRONOUSLY, in
// the same tick, so asserting on final `location.pathname` alone can't tell "close() was a no-op"
// apart from "close() ran navigate(-1) but the later push happened to win" — both land on the
// same final path in jsdom. Real browsers differ: `history.go(-1)` is genuinely async there (the
// popstate/traversal is queued), so a `navigate(-1)` queued behind `navigate(target)` fires AFTER
// and reverts it — the exact runtime-reproduced bug. Wrapping `useNavigate` to log calls (while
// still delegating to the real one, so location assertions keep working) gives a jsdom-safe,
// deterministic proxy for that ordering: the page variant must NEVER call `navigate(-1)` for a
// navigating tile, regardless of what jsdom's synchronous history does with it.
const navigateCalls = vi.hoisted(() => [] as unknown[])
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => {
      const real = actual.useNavigate()
      return (...args: Parameters<typeof real>) => {
        navigateCalls.push(args[0])
        return real(...args)
      }
    },
  }
})
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useState } = await import('react')
  return {
    ...actual,
    useCheckins: () => checkinsMock.useCheckins(),
    useFuelPreview: () => fuelPreviewMock.useFuelPreview(),
    useFuelDay: () => {
      const [water, setWater] = useState(1850)
      waterStore.set = setWater
      return { fuel: { consumed: { water }, targets: { water: 3000 } } }
    },
    useWaterActions: () => ({ logWater: (ml: number) => waterStore.set?.(n => n + ml) }),
    useWeight: () => ({
      weightLog: [{ date: '2026-05-22', value: 78.6 }],
      weightTrends: { latestTrendKg: 78.6, weeklyRateKgPerWeek: -0.5, last4wRateKgPerWeek: -0.5 },
      logWeight: vi.fn(),
    }),
    useToday: () => ({
      today: { workoutTime: '17:00', workoutType: 'Pull Day' },
      workoutDone: false,
    }),
    useQuickLogSport: () => ({
      sessions: [
        { id: 's3', sport: 'volleyball', isoDate: localDateString(), duration: 45 },
      ],
      logSportSession: vi.fn(),
    }),
  }
})

const NOW_WINDOW = {
  time: '13:30', kind: 'meal', label: 'Ebéd-ablak', slotKey: 'lunch',
  state: 'now', mealName: 'Csirkés rizses tál',
} as const

beforeEach(() => {
  checkinsMock.useCheckins.mockReturnValue({ checkins: initialCheckins, saveCheckIn: vi.fn() })
  fuelPreviewMock.useFuelPreview.mockReturnValue({ visible: [NOW_WINDOW], nextStack: undefined, plan: { slots: [NOW_WINDOW] } })
  navigateCalls.length = 0
})
afterEach(() => {
  checkinsMock.useCheckins.mockReset()
  fuelPreviewMock.useFuelPreview.mockReset()
})

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

// Two-entry history with the page NOT at index 0 (mezo-mhum whole-branch-review finding): a
// one-entry MemoryRouter made `navigate(-1)` (NapGyorsPage's `onDone`) clamp to a no-op, so a
// regression where a navigating tile's `close()` fires that SAME `navigate(-1)` before its own
// `navigate(target)` went undetected here. `initialIndex: 1` makes `go(-1)` a real back-step.
function renderPage() {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/nap', '/nap/gyors']} initialIndex={1}>
          <Routes><Route path="*" element={<><NapGyorsPage /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

test('renders all nine quick-log tiles and the Mondd el Mezónak row', () => {
  renderPage()
  for (const label of ['Étkezés', 'Víz', 'Stack', 'Edzés', 'Sport', 'Súly', 'Check-in', 'Napló', 'Alvás'])
    expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.getByText('Mondd el Mezónak')).toBeInTheDocument()
})

test('the Stack tile navigates to /fuel/stack without also invoking the page onDone (mezo-mhum)', async () => {
  // MemoryRouter applies `go(-1)` and the subsequent `push(target)` in the same synchronous
  // tick, so both a correct and a buggy `close` land on the same final `location.pathname`
  // (real browsers differ: `history.go(-1)` is genuinely async there, so a `navigate(-1)`
  // queued behind `navigate(target)` fires AFTER it and reverts it — the runtime-reproduced
  // bug). Asserting on `navigateCalls` catches the ordering directly: the page variant's grid
  // must never call `navigate(-1)` for a navigating tile, whatever jsdom's history does with it.
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /Stack/ }))
  await vi.waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/stack'))
  expect(navigateCalls).not.toContain(-1)
  expect(navigateCalls).toContain('/fuel/stack')
})

test('the Étkezés tile navigates to the fuel logger without also invoking the page onDone (mezo-mhum)', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /Étkezés/ }))
  await vi.waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj'))
  expect(navigateCalls).not.toContain(-1)
  expect(navigateCalls.some(c => typeof c === 'string' && c.startsWith('/fuel/log/uj'))).toBe(true)
})
