import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const REAL_MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000cc'
const realMeso = (status: 'active' | 'planned' | 'archived') => ({
  id: REAL_MESO_ID, title: 'Lifecycle blokk', shortTitle: 'Lifecycle', status,
  startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
  split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
})

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// The real router (createMemoryRouter + app routes) rather than a hand-built Routes tree:
// the day mosaic navigates to a sibling route, and the encoded day token in the resulting
// URL is exactly what this page promises the day page (mezo-d20.15).
function setup(id = 'meso-hyp-04') {
  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${id}`] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

test('the hero says where the run stands: week, phase and the end date', () => {
  setup()
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()
  expect(screen.getByText('Aktív · 3/6 hét · Rámpa · vége Jún 12')).toBeInTheDocument()
})

test('the arc card carries one week dot per week', () => {
  setup()
  // meso-hyp-04 runs 6 weeks — one dot per week, the last one striped (deload).
  expect(document.querySelectorAll('.mz-wdots i')).toHaveLength(6)
  expect(screen.getByText('A blokk íve')).toBeInTheDocument()
})

test("Mezo's decider sentence explains the volume change", () => {
  setup()
  // activeMeso.volumeRecompute.changes[0] is the 'back' (Hát) row.
  expect(screen.getByText(/^Hát:/)).toBeInTheDocument()
})

test('the two status tiles are there — the week one navigates, the rollover forecast does not', () => {
  setup()
  const week = screen.getByRole('button', { name: 'Heti vizsgálat' })
  expect(week).toBeInTheDocument()
  expect(screen.getByText(/szett · \d+ rámpázik · \d+ tart/)).toBeInTheDocument()
  expect(screen.getByText('Hétfőn jön')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hétfőn jön' })).not.toBeInTheDocument()
  expect(screen.getByText('a heti görgetés hajnalban fut')).toBeInTheDocument()
})

test('the day mosaic shows the training days only — no Rest, no sport day', () => {
  setup()
  expect(screen.getByRole('button', { name: 'Hét · Push nap' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Csü · Pull nap' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Vas ·/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Szo ·/ })).not.toBeInTheDocument()
})

test('tapping a day tile opens that day on its own route, with the token URL-encoded', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Hét · Push nap' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/train/mesocycles/meso-hyp-04/days/H%C3%A9t'),
  )
})

test('the in-cycle Fókusz picker is gone — tiers are a planning-time decision', () => {
  setup()
  expect(screen.queryByText('Fókusz')).not.toBeInTheDocument()
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

// The MSW-driven cases pin real mode through a NESTED describe's beforeEach (the
// PatternsPage/ChatPage house idiom) rather than an inline stub inside each test — this
// file's own beforeEach pins MOCK mode, and an inline per-test override of the opposite
// mode is what made the sibling close-sheet test flaky under the real-mode suite (CI #198).
describe('MesocycleBuilderPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('the close sheet POSTs the close endpoint and lands on the run report', async () => {
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
    const router = setup(REAL_MESO_ID)
    await userEvent.click(await screen.findByRole('button', { name: 'Meso lezárása' }))
    await userEvent.click(await screen.findByRole('button', { name: /Lezárás/ }))
    await waitFor(() => expect(calls).toEqual([`close:${REAL_MESO_ID}`]))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/train/mesocycles/${REAL_MESO_ID}/report`),
    )
  })

  test('an archived run has no builder — it lands on its report', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('archived')])),
    )
    const router = setup(REAL_MESO_ID)
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/train/mesocycles/${REAL_MESO_ID}/report`),
    )
  })

  test('Aktiválás POSTs the activate endpoint', async () => {
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
})
