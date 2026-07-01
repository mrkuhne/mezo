import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { EditGoalSheet } from '@/features/me/sheets/EditGoalSheet'
import { goal } from '@/data/me/goals'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

afterEach(() => vi.unstubAllEnvs())

test('shows the goal fields read-only', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<EditGoalSheet onClose={() => {}} goal={goal} goalId={goal.id} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Cél súly')).toBeInTheDocument()
  expect(screen.getByText(`${goal.targetWeight} kg`)).toBeInTheDocument()
})

// The target/cél pace must render as %/hét (sourced from rateTargetPctPerWeek →
// goal.rateTarget), with the Hungarian decimal comma. It is the GOAL TARGET, NOT
// the observed kg/hét trend the hero shows — the two are distinct quantities.
test('shows the target pace as %/hét with a Hungarian decimal comma', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<EditGoalSheet onClose={() => {}} goal={goal} goalId={goal.id} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Cél tempó')).toBeInTheDocument()
  expect(screen.getByText('0,6 %/hét')).toBeInTheDocument()
  // the stale kg/hét unit must NOT be surfaced on the goal target field
  expect(screen.queryByText(/kg\/hét/)).not.toBeInTheDocument()
})

test('closes on Kész', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const onClose = vi.fn()
  render(<EditGoalSheet onClose={onClose} goal={goal} goalId={goal.id} />, { wrapper: QueryWrapper })
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
    render(<EditGoalSheet onClose={onClose} goal={goal} goalId="g1" />, { wrapper: QueryWrapper })
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
    render(<EditGoalSheet onClose={onClose} goal={goal} goalId="g1" />, { wrapper: QueryWrapper })

    // First click only arms the confirm — no API call yet.
    await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
    expect(calls).toEqual([])
    // The confirm button now appears; clicking it fires the delete.
    await userEvent.click(screen.getByRole('button', { name: 'Biztosan törlöd?' }))
    await waitFor(() => expect(calls).toEqual(['remove']))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
