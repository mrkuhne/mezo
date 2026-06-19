import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { GoalPlanner } from './GoalPlanner'

test('GoalPlanner step 0 picks a trajectory and a guard', () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(screen.getByText('Mit építünk?')).toBeInTheDocument()
  // Tovább is disabled until a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /erő megtartása/i }))
  // Tovább becomes enabled once a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeEnabled()
})

test('GoalPlanner real-mode save posts profile+goal and activates in order', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  let profileBody: { activityLevel?: string } | null = null
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
      calls.push('profile')
      profileBody = (await request.json()) as { activityLevel?: string }
      return HttpResponse.json({ sex: 'M', heightCm: 180, birthDate: '1991-03-01' })
    }),
    http.post(`${API_BASE}/api/goals`, () => {
      calls.push('goal')
      return HttpResponse.json({ id: 'g1', status: 'planned' })
    }),
    http.post(`${API_BASE}/api/goals/g1/activate`, () => {
      calls.push('activate')
      return HttpResponse.json({ id: 'g1', status: 'active' })
    }),
  )
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/goals/new']}>
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
  // Step 0 -> 1: pick a trajectory, advance
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  // Step 1 -> 2: the default target date (start + 56 days) already satisfies
  // canNext, so just a title is needed
  fireEvent.change(screen.getByLabelText('Cél neve'), { target: { value: 'Nyári cut' } })
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  // Step 2: the activity-level picker renders (default MODERATE); pick VERY so the
  // upsert carries a non-default value.
  expect(screen.getByText('Aktivitási szint')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /nagyon aktív/i }))
  // create + activate
  fireEvent.click(screen.getByRole('button', { name: /létrehozása \+ aktiválás/i }))
  await waitFor(() => expect(calls).toEqual(['profile', 'goal', 'activate']))
  expect(profileBody).not.toBeNull()
  expect(profileBody!.activityLevel).toBe('VERY')
  vi.unstubAllEnvs()
})
