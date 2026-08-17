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
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useCheckins: () => checkinsMock.useCheckins() }
})

beforeEach(() => {
  checkinsMock.useCheckins.mockReturnValue({ checkins: initialCheckins, saveCheckIn: vi.fn() })
})
afterEach(() => checkinsMock.useCheckins.mockReset())

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}
function renderSheet(onClose = () => {}) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/today']}>
          <Routes><Route path="*" element={<><QuickInputSheet onClose={onClose} /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

test('renders all eight quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Edzés', 'Víz', 'Súly', 'Stack', 'Check-in', 'Alvás', 'Napló'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
test('a tile closes the sheet and navigates to its target', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Súly'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})
test('the chat row closes the sheet and navigates to the companion chat', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Beszélgetés a társsal'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/insights/chat')
})

test('the Napló tile swaps the menu for the activity log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Napló'))
  expect(await screen.findByText('Tevékenységnapló')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
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
  expect(screen.getByText('mára mind megvan')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Check-in'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/today')
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
