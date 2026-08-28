import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { FloatingReturnLayer } from '@/app/FloatingReturnLayer'
import type { WorkoutTodayResponse } from '@/data/train/trainApi'

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

/** Isolated harness: the layer + a location probe on a wildcard route, with the
 *  workoutToday cache pre-seeded so both modes exercise the same states without
 *  the network (staleTime Infinity keeps the seed from being refetched over). */
function renderAt(path: string, today: WorkoutTodayResponse | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(['train', 'workoutToday', null], today)
  const router = createMemoryRouter(
    [{ path: '*', element: <><FloatingReturnLayer /><LocationProbe /></> }],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

const openToday: WorkoutTodayResponse = {
  templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
  dayLabel: 'Ked',
  title: 'Pull Day',
  openWorkout: {
    id: 'b1f3a0e2-0000-4000-8000-000000000020',
    templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
    date: '2026-08-24',
    status: 'active',
    sets: [
      { id: 's1', exerciseId: 'e1', setIndex: 1, skipped: false },
      { id: 's2', exerciseId: 'e1', setIndex: 2, skipped: false },
      { id: 's3', exerciseId: 'e2', setIndex: 1, skipped: true },
    ],
  },
}

// Design 2.0 decision B (mezo-d20.1.1): the floating chat bubble is retired — Mezo is a
// first-class tab; this layer is session-return chrome only.
test('a regular tab renders nothing without an open workout — the chat bubble is gone', () => {
  renderAt('/nap', null)
  expect(screen.queryByRole('button')).toBeNull()
})

test('an open workout adds the resume FAB with the done-set badge (skipped rows excluded)', async () => {
  renderAt('/nap', openToday)
  const fab = screen.getByRole('button', { name: 'Vissza az edzéshez' })
  expect(fab).toHaveTextContent('2')
  await userEvent.click(fab)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/session')
})

test('a completed today-workout suppresses the resume FAB even if openWorkout rides along', () => {
  renderAt('/nap', { ...openToday, completedWorkout: openToday.openWorkout })
  expect(screen.queryByRole('button', { name: 'Vissza az edzéshez' })).toBeNull()
})

test('the active session route renders nothing — no bubble, no resume FAB', () => {
  renderAt('/train/session', openToday)
  expect(screen.queryByRole('button')).toBeNull()
})

test('the chat route shows a return bar while a workout is open', async () => {
  renderAt('/mezo/chat', openToday)
  expect(screen.queryByRole('button', { name: 'Beszélgetés a társsal' })).toBeNull()
  const bar = screen.getByRole('button', { name: /Vissza az edzéshez/ })
  expect(bar).toHaveTextContent('Pull Day')
  expect(bar).toHaveTextContent('2 szett kész')
  await userEvent.click(bar)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/session')
})

test('the chat route renders nothing without an open workout', () => {
  renderAt('/mezo/chat', null)
  expect(screen.queryByRole('button')).toBeNull()
})

test.each(['/me/sleep/night', '/ritual'])('the layer hides entirely on %s', (path) => {
  renderAt(path, openToday)
  expect(screen.queryByRole('button')).toBeNull()
})
