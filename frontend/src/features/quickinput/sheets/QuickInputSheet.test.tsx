import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'
import { CHECKIN_DIMS } from '@/features/today/sheets/CheckInSheet'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { initialCheckins } from '@/data/today/checkins'
import type { CheckinSlot } from '@/data/types'

// Always returns a value — never `undefined` — so the mocked hook's identity never depends on
// a conditional fallback to the real `useCheckins()` (finding 5): a test that flips the mock
// mid-test would otherwise risk "Rendered fewer hooks than expected" instead of a legible
// assertion failure. Every test gets a deterministic four-slot fixture by default; tests that
// care about a specific state override it with their own `mockReturnValue`.
const checkinsMock = vi.hoisted(() => ({ useCheckins: vi.fn() }))
const gratitudeActionsMock = vi.hoisted(() => ({ useGratitudeActions: vi.fn() }))
const fuelPreviewMock = vi.hoisted(() => ({ useFuelPreview: vi.fn() }))
// Deterministic, MODE-AGNOSTIC data stubs for the v2 head/sublines: the real hooks are
// wall-clock (fuel timeline) or fixture (MSW vs mock seed) dependent, and this suite tests
// the sheet's behavior, not the data layer. The water pair shares a setter through a ref so
// an in-place log re-renders the counter exactly like the real cache write does.
const waterStore = vi.hoisted(() => ({ set: undefined as undefined | ((up: (n: number) => number) => void) }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useState } = await import('react')
  return {
    ...actual,
    useCheckins: () => checkinsMock.useCheckins(),
    useGratitudeActions: () => gratitudeActionsMock.useGratitudeActions(),
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
  }
})

/** A deterministic now-window for the MOST head — the real hook is wall-clock dependent. */
const NOW_WINDOW = {
  time: '13:30', kind: 'meal', label: 'Ebéd-ablak', slotKey: 'lunch',
  state: 'now', mealName: 'Csirkés rizses tál',
} as const

beforeEach(() => {
  checkinsMock.useCheckins.mockReturnValue({ checkins: initialCheckins, saveCheckIn: vi.fn() })
  fuelPreviewMock.useFuelPreview.mockReturnValue({ visible: [NOW_WINDOW], nextStack: undefined, plan: { slots: [NOW_WINDOW] } })
  gratitudeActionsMock.useGratitudeActions.mockReturnValue({
    addEntry: vi.fn().mockResolvedValue(undefined),
    removeEntry: vi.fn(),
    pending: false,
  })
})
afterEach(() => {
  checkinsMock.useCheckins.mockReset()
  gratitudeActionsMock.useGratitudeActions.mockReset()
  fuelPreviewMock.useFuelPreview.mockReset()
})

function LocationProbe() {
  const loc = useLocation()
  return (
    <>
      <div data-testid="loc">{loc.pathname}</div>
      <div data-testid="search">{loc.search}</div>
    </>
  )
}
function renderSheet(onClose = () => {}) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/nap']}>
          <Routes><Route path="*" element={<><QuickInputSheet onClose={onClose} /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

test('renders all eight quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Víz', 'Stack', 'Edzés', 'Súly', 'Check-in', 'Napló', 'Alvás'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
test('a navigating tile closes the sheet and routes to its target', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Stack'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/stack')
})

// ── Design 2.0 quick-log v2 (mezo-d20.1.6) ─────────────────────────────────

test('tiles carry clay icons via sprite use refs — no emojis', () => {
  renderSheet()
  // the Sheet renders through a portal — query the document, not the container
  for (const sym of ['i-suly', 'i-alvas', 'i-naplo', 'i-fuel', 'i-edzes', 'i-stack', 'i-viz']) {
    expect(document.querySelector(`use[href="#${sym}"]`)).not.toBeNull()
  }
})

test('the Étkezés tile routes to the active window’s log page', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByRole('button', { name: /Étkezés/ }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj')
  expect(screen.getByTestId('search')).toHaveTextContent('?w=13%3A30-Eb%C3%A9d-ablak')
})

test('without a now-window the Étkezés tile routes to free-item logging', async () => {
  fuelPreviewMock.useFuelPreview.mockReturnValue({ visible: [], nextStack: undefined, plan: { slots: [] } })
  const onClose = vi.fn()
  renderSheet(onClose)
  expect(screen.getByText('ablakon kívül is')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Étkezés/ }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj')
  expect(screen.getByTestId('search').textContent).toBe('')
})

test('the Étkezés tile’s subline names the active window', () => {
  renderSheet()
  expect(screen.getByText('MOST · Ebéd-ablak')).toBeInTheDocument()
})

test('the Víz tile opens the amount picker in place and the log lands', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  expect(screen.getByText('1850 ml')).toBeInTheDocument() // hu-HU leaves 4-digit numbers ungrouped
  await userEvent.click(screen.getByRole('button', { name: /Víz/ }))
  expect(await screen.findByText('Mennyit ittál?')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('the Súly tile opens the weight log sheet in place', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByRole('button', { name: /Súly/ }))
  expect(await screen.findByText('Mi a számunk ma?')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('live sublines: Edzés reads the day plan, Súly the latest weight', () => {
  renderSheet()
  expect(screen.getByText(/17:00 · Pull Day/)).toBeInTheDocument()
  expect(screen.getByText(/78,6/)).toBeInTheDocument()
})
test('the Mezo row closes the sheet and navigates to the companion chat', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Mondd el Mezónak'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/mezo/chat')
})

test('the Napló tile swaps the menu for a two-option picker, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Napló'))
  expect(await screen.findByText('Mit naplózol?')).toBeInTheDocument()
  expect(screen.getByText('Aktivitás')).toBeInTheDocument()
  expect(screen.getByText('Napló')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('picking Aktivitás from the Napló picker swaps to the activity log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Napló'))
  await screen.findByText('Mit naplózol?')
  await userEvent.click(screen.getByText('Aktivitás'))
  expect(await screen.findByText('Tevékenységnapló')).toBeInTheDocument()
  expect(screen.queryByText('Mit naplózol?')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('picking Napló from the Napló picker swaps to the JournalSheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Napló'))
  await screen.findByText('Mit naplózol?')
  await userEvent.click(screen.getByText('Napló'))
  expect(await screen.findByText('Mi jár a fejedben?')).toBeInTheDocument()
  expect(screen.queryByText('Mit naplózol?')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('the Hála tile in the Napló picker opens JournalSheet in gratitude mode, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Napló'))
  await screen.findByText('Mit naplózol?')
  await userEvent.click(screen.getByRole('button', { name: /Hála/ }))
  expect(await screen.findByText('Hálabejegyzés')).toBeInTheDocument()
  expect(screen.queryByText('Mit naplózol?')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('the Alvás tile swaps the menu for the sleep log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Alvás'))
  expect(await screen.findByText('Hogyan aludtunk?')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('the Check-in tile swaps the menu for the check-in sheet on the next fillable slot', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Check-in'))
  // Asserts the exact slot, not just that A sheet opened: `initialCheckins` has 06:30 and 10:00
  // done, so the next fillable slot is index 2 (14:00). A regression that pinned a constant index
  // instead of `nextCheckInIdx` would still open a sheet — only the time gives it away.
  expect(await screen.findByText('Heartbeat · 14:00')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('with every slot done the Check-in tile falls back to navigating to Today', async () => {
  checkinsMock.useCheckins.mockReturnValue({
    checkins: ['06:30', '10:00', '14:00', '20:00'].map(time => ({
      time, state: 'done' as const, values: null, note: null,
    })),
    saveCheckIn: vi.fn(),
  })
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Check-in'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap')
})

// A single fillable slot (mirrors the review's own repro: "with only the 20:00 slot unfilled").
// The real `useCheckins()` flips a just-saved slot's state via its OWN hook-local optimistic
// `local` state — a plain static mock return value never re-renders on `saveCheckIn`, so it
// can't exercise the race at all. This fixture is reactive on purpose (see below) so the mock
// reproduces the same re-render-mid-close timing the real hook does.
const ONE_SLOT_LEFT: CheckinSlot[] = ['06:30', '10:00', '14:00', '20:00'].map((time, i) => ({
  time,
  state: i < 3 ? 'done' : 'pending',
  values: i < 3 ? { energy: 7, stress: 4, body: 7, mental: 7 } : null,
  note: null,
}))

// A minimal stand-in for `useCheckins`' own optimistic layer: a real `useState` (this runs
// INSIDE `QuickInputSheet`'s render via the mocked `useCheckins()` call, so it participates in
// the same fiber/hook order) whose setter fires on `saveCheckIn`, exactly like `checkinHooks.ts`'
// `setLocal`. Without this, `saveCheckIn` would be an inert spy and the component would never
// re-render mid-close — which is precisely why finding 1 needed a stateful mock, not a static one.
function useReactiveCheckinsMock(initial: CheckinSlot[]) {
  const [checkins, setCheckins] = useState(initial)
  const saveCheckIn = (idx: number, data: Partial<CheckinSlot>) => {
    setCheckins(prev => prev.map((c, i) => (i === idx ? { ...c, ...data } : c)))
  }
  return { checkins, saveCheckIn }
}

// Regression for the finding-1 bug: `saveCheckIn` flips the just-saved slot's state
// synchronously, before `CheckInSheet`'s exit-animation `onClose` fires. A live
// `checkins.findIndex(isFillableSlot)` re-evaluated on every render used to flip negative the
// instant that optimistic state landed (when this was the LAST fillable slot), and the `phase
// === 'checkin' && checkInIdx >= 0` guard failing mid-exit unmounted `CheckInSheet` — killing
// its pending exit timer — before `onClose` ever ran, leaving the quick-log menu stuck open
// forever. Deterministic regardless of mock/real mode: the fixture above is fully owned by this
// test, not by whichever mode's real hook/MSW handler happens to be live.
test('driving a check-in all the way to Mentés closes the sheet (regression)', async () => {
  checkinsMock.useCheckins.mockImplementation(() => useReactiveCheckinsMock(ONE_SLOT_LEFT))
  const onClose = vi.fn()
  renderSheet(onClose)

  await userEvent.click(screen.getByText('Check-in'))
  expect(await screen.findByText(/Heartbeat ·/)).toBeInTheDocument()

  // Skip every dimension (the auto-advance-on-tap step) to reach the summary/save step —
  // agnostic to which slot index was picked, since it only depends on the dimension count.
  for (let i = 0; i < CHECKIN_DIMS.length; i++) {
    await userEvent.click(screen.getByText('Kihagy →'))
  }

  const saveButton = await screen.findByText(/Mentés ·/)
  await userEvent.click(saveButton)

  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
})
