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

// Day-planner (Fuel P5) — the "Napi ritmus" section surfaces the goal's planner
// settings: an Étkezés/nap stepper (3–6) + two <input type="time"> anchors, all
// defaulting from the loaded goal.
test('renders the Napi ritmus section defaulting from the loaded goal', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<EditGoalSheet onClose={() => {}} goal={goal} goalResponse={goalResponse} goalId={goal.id} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Napi ritmus')).toBeInTheDocument()
  expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
  expect(screen.getByLabelText('Ébredés')).toHaveValue('06:00')
  expect(screen.getByLabelText('Lefekvés')).toHaveValue('23:00')
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
  expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('6')
  // back down to the 3 floor
  await userEvent.click(dec)
  await userEvent.click(dec)
  await userEvent.click(dec)
  await userEvent.click(dec) // clamped
  expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('3')
})

test('the planner defaults fall back to 4 / 06:00 / 23:00 when the goal has none', () => {
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
  expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
  expect(screen.getByLabelText('Ébredés')).toHaveValue('06:00')
  expect(screen.getByLabelText('Lefekvés')).toHaveValue('23:00')
})

test('saving the rhythm PUTs the edited planner settings (real mode)', async () => {
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
  expect(body!.wakeTime).toBe('06:00')
  expect(body!.bedTime).toBe('23:00')
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
