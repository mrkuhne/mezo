import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const REAL_MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000cc'
const realMeso = (status: 'active' | 'planned' | 'archived') => ({
  id: REAL_MESO_ID, title: 'Lifecycle blokk', shortTitle: 'Lifecycle', status,
  startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
  split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
})
import { MesocycleBuilderPage } from '@/features/train/pages/MesocycleBuilderPage'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function setup(id = 'meso-hyp-04') {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/${id}`]}>
        <Routes>
          <Route path="/train/mesocycles/:id" element={<MesocycleBuilderPage />} />
          <Route path="/train/mesocycles/:id/report" element={<div>riport</div>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the meso title as the level-1 heading', () => {
  setup()
  expect(
    screen.getByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' }),
  ).toBeInTheDocument()
})

test('renders the three view-switcher buttons', () => {
  setup()
  expect(screen.getByRole('button', { name: 'Áttekintés' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Volumen' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument()
})

test('tapping a training day row opens DayDetailSheet with the planned-exercise copy', async () => {
  const user = userEvent.setup()
  setup()
  // The current Csü Pull day — an unambiguous training day.
  await user.click(screen.getByRole('button', { name: 'Pull · Csü' }))
  expect(screen.getByText(/gyakorlat tervezve/)).toBeInTheDocument()
})

test('Meso lezárása opens the close sheet instead of closing straight away', async () => {
  const user = userEvent.setup()
  const calls: string[] = []
  server.use(
    http.post(`${API_BASE}/api/train/mesocycles/:id/close`, ({ params }) => {
      calls.push(`close:${params.id}`)
      return HttpResponse.json({ id: params.id })
    }),
  )
  setup()
  await user.click(screen.getByRole('button', { name: 'Meso lezárása' }))
  expect(await screen.findByRole('heading', { name: 'Futam lezárása' })).toBeInTheDocument()
  expect(calls).toEqual([]) // nothing closed until the sheet is confirmed
})

test('the close sheet POSTs the close endpoint and lands on the run report (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([realMeso('active')]),
    ),
    http.post(`${API_BASE}/api/train/mesocycles/:id/close`, ({ params }) => {
      calls.push(`close:${params.id}`)
      return HttpResponse.json({ id: params.id, status: 'archived' })
    }),
  )
  setup(REAL_MESO_ID)
  await userEvent.click(await screen.findByRole('button', { name: 'Meso lezárása' }))
  await userEvent.click(await screen.findByRole('button', { name: /Lezárás/ }))
  await waitFor(() => expect(calls).toEqual([`close:${REAL_MESO_ID}`]))
  await waitFor(() =>
    expect(screen.getByTestId('loc')).toHaveTextContent(`/train/mesocycles/${REAL_MESO_ID}/report`),
  )
})

test('an archived run has no builder — it lands on its report (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('archived')])),
  )
  setup(REAL_MESO_ID)
  await waitFor(() =>
    expect(screen.getByTestId('loc')).toHaveTextContent(`/train/mesocycles/${REAL_MESO_ID}/report`),
  )
})

test('Aktiválás POSTs the activate endpoint in real mode', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([realMeso('planned')]),
    ),
    http.post(`${API_BASE}/api/train/mesocycles/:id/activate`, ({ params }) => {
      calls.push(`activate:${params.id}`)
      return HttpResponse.json({ id: params.id })
    }),
  )
  setup(REAL_MESO_ID)
  await screen.findByRole('button', { name: /Aktiválás/ })
  await userEvent.click(screen.getByRole('button', { name: /Aktiválás/ }))
  await waitFor(() => expect(calls).toEqual([`activate:${REAL_MESO_ID}`]))
})
