import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { EditGoalSheet } from '@/features/me/sheets/EditGoalSheet'
import { goal, goalResponse } from '@/data/me/goals'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

afterEach(() => vi.unstubAllEnvs())

test('shows the goal fields read-only', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<EditGoalSheet onClose={() => {}} goal={goal} goalResponse={goalResponse} goalId={goal.id} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Cél súly')).toBeInTheDocument()
  expect(screen.getByText(`${goal.targetWeight} kg`)).toBeInTheDocument()
})

// Day-planner (Fuel P5) — the "Napi ritmus" section now surfaces only the meal
// cadence: an Étkezés/nap stepper (3–6) defaulting from the loaded goal. The
// wake/bed anchor moved to the sleep goal (mezo-dbsr), so the two <input type="time">
// rows are GONE and a hint points at the Alvás page.
test('renders the Napi ritmus section with only the meal-cadence stepper', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<EditGoalSheet onClose={() => {}} goal={goal} goalResponse={goalResponse} goalId={goal.id} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Napi ritmus')).toBeInTheDocument()
  expect(screen.getByLabelText(/Étkezés\/nap/)).toHaveTextContent('4')
  // the wake/bed anchor rows are gone — they live on the sleep goal now
  expect(screen.queryByLabelText('Ébredés')).toBeNull()
  expect(screen.queryByLabelText('Lefekvés')).toBeNull()
  expect(screen.getByText('Az ébredés/lefekvés horgony az Alvás oldalon állítható.')).toBeInTheDocument()
})

test('the meal stepper clamps between 3 and 6', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<EditGoalSheet onClose={() => {}} goal={goal} goalResponse={goalResponse} goalId={goal.id} />, { wrapper: QueryWrapper })
  const inc = screen.getByRole('button', { name: 'Étkezés növelése' })
  const dec = screen.getByRole('button', { name: 'Étkezés csökkentése' })
  // from 4 → up to the 6 cap
  await userEvent.click(inc)
  await userEvent.click(inc)
  await userEvent.click(inc) // clamped
  expect(screen.getByLabelText(/Étkezés\/nap/)).toHaveTextContent('6')
  // back down to the 3 floor
  await userEvent.click(dec)
  await userEvent.click(dec)
  await userEvent.click(dec)
  await userEvent.click(dec) // clamped
  expect(screen.getByLabelText(/Étkezés\/nap/)).toHaveTextContent('3')
})

test('the meal-cadence default falls back to 4 when the goal has none', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const bare = { ...goalResponse, mealsPerDay: undefined, wakeTime: undefined, bedTime: undefined }
  render(
    <EditGoalSheet
      onClose={() => {}}
      goal={{ ...goal, mealsPerDay: null, wakeTime: null, bedTime: null }}
      goalResponse={bare}
      goalId={goal.id}
    />,
    { wrapper: QueryWrapper },
  )
  expect(screen.getByLabelText(/Étkezés\/nap/)).toHaveTextContent('4')
  // no wake/bed rows to fall back — the anchor lives on the sleep goal now
  expect(screen.queryByLabelText('Ébredés')).toBeNull()
  expect(screen.queryByLabelText('Lefekvés')).toBeNull()
})

test('saving the rhythm PUTs the edited meal cadence, passing wake/bed through (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let body: Record<string, unknown> | null = null
  server.use(
    http.put(`${API_BASE}/api/goals/${goalResponse.id}`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ ...goalResponse, status: 'active' })
    }),
  )
  const onClose = vi.fn()
  render(<EditGoalSheet onClose={onClose} goal={goal} goalResponse={goalResponse} goalId={goalResponse.id} />, { wrapper: QueryWrapper })
  await userEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' })) // 4 → 5
  await userEvent.click(screen.getByRole('button', { name: 'Ritmus mentése' }))
  await waitFor(() => expect(body).not.toBeNull())
  expect(body!.mealsPerDay).toBe(5)
  // wake/bed are no longer editable here — the PUT passes the persisted goal's
  // values straight through (spec §6, mezo-dbsr), NOT anything the sheet holds.
  expect(body!.wakeTime).toBe(goalResponse.wakeTime)
  expect(body!.bedTime).toBe(goalResponse.bedTime)
  // required contract fields preserved in the payload
  expect(body!.startWeightKg).toBe(goalResponse.startWeightKg)
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

// The target/cél pace must render as %/hét (sourced from rateTargetPctPerWeek →
// goal.rateTarget), with the Hungarian decimal comma. It is the GOAL TARGET, NOT
// the observed kg/hét trend the hero shows — the two are distinct quantities.
test('shows the target pace as %/hét with a Hungarian decimal comma', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<EditGoalSheet onClose={() => {}} goal={goal} goalResponse={goalResponse} goalId={goal.id} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Cél tempó')).toBeInTheDocument()
  expect(screen.getByText('0,6 %/hét')).toBeInTheDocument()
  // the stale kg/hét unit must NOT be surfaced on the goal target field
  expect(screen.queryByText(/kg\/hét/)).not.toBeInTheDocument()
})

test('closes on Kész', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const onClose = vi.fn()
  render(<EditGoalSheet onClose={onClose} goal={goal} goalResponse={goalResponse} goalId={goal.id} />, { wrapper: QueryWrapper })
  await userEvent.click(screen.getByRole('button', { name: 'Kész' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

// Real-mode management actions — assert each fires the matching goalApi endpoint
// and closes the sheet on success.
describe('management actions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('Archiválás calls the archive endpoint and closes', async () => {
    const calls: string[] = []
    server.use(
      http.post(`${API_BASE}/api/goals/g1/archive`, () => {
        calls.push('archive')
        return HttpResponse.json({ ...goal, status: 'archived' })
      }),
    )
    const onClose = vi.fn()
    render(<EditGoalSheet onClose={onClose} goal={goal} goalResponse={goalResponse} goalId="g1" />, { wrapper: QueryWrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Archiválás' }))
    await waitFor(() => expect(calls).toEqual(['archive']))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('Törlés requires the inline confirm before hitting the delete endpoint', async () => {
    const calls: string[] = []
    server.use(
      http.delete(`${API_BASE}/api/goals/g1`, () => {
        calls.push('remove')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const onClose = vi.fn()
    render(<EditGoalSheet onClose={onClose} goal={goal} goalResponse={goalResponse} goalId="g1" />, { wrapper: QueryWrapper })

    // First click only arms the confirm — no API call yet.
    await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
    expect(calls).toEqual([])
    // The confirm button now appears; clicking it fires the delete.
    await userEvent.click(screen.getByRole('button', { name: 'Biztosan törlöd?' }))
    await waitFor(() => expect(calls).toEqual(['remove']))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
