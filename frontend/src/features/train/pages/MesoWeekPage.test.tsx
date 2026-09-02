import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-05-14T09:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const MESO_ID = 'meso-hyp-04'

function setup(path = `/train/mesocycles/${MESO_ID}/week`) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

test('the hero names this week, the total and the delta vs. last week', () => {
  setup()
  expect(screen.getByText('Heti vizsgálat · 3. hét')).toBeInTheDocument()
  expect(screen.getByText(/a múlt héthez képest/)).toBeInTheDocument()
})

test('the stat strip carries four cells: total, delta, up, hold', () => {
  setup()
  const strip = document.querySelector('.mz-statstrip')!
  expect(strip.textContent).toContain('W3')
  expect(strip.textContent).toContain('vs. W2')
  expect(strip.textContent).toContain('rámpázik')
  expect(strip.textContent).toContain('tart')
})

test('one tile per arc muscle, with landmarks, no percentages', () => {
  setup()
  // meso-hyp-04 carries 8 volumePerMuscle groups — one tile each.
  expect(screen.getAllByRole('button', { name: /részletek$/ })).toHaveLength(8)
  expect(screen.getByText('Hát')).toBeInTheDocument()
  expect(screen.getByText('Mell')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/%/)
})

test('the emphasized (highest-ceiling) tile leads the mosaic', () => {
  setup()
  const tiles = screen.getAllByRole('button', { name: /részletek$/ })
  // Hát has the highest ceiling (MAV 16) among meso-hyp-04's groups.
  expect(tiles[0]).toHaveAccessibleName('Hát részletek')
})

test('tapping a tile navigates to the muscle page', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Hát részletek' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/train/mesocycles/${MESO_ID}/week/back`))
})

test('a mesocycle with no volume profile shows the ghost state, not a broken mosaic', () => {
  setup(`/train/mesocycles/meso-str-02/week`) // planned run — no volumePerMuscle
  expect(screen.getByText('A heti vizsgálat a blokk első edzése után jelenik meg.')).toBeInTheDocument()
})

test('an unknown mesocycle id says so instead of crashing', () => {
  setup('/train/mesocycles/nope/week')
  expect(screen.getByText('Ez a mesociklus nem található.')).toBeInTheDocument()
})

// ── Real mode ────────────────────────────────────────────────────────────────
// Pinned through a NESTED describe's beforeEach (the house idiom — this file's own
// beforeEach pins MOCK mode, and an inline per-test override of the opposite mode is what
// made a sibling suite flaky under the real-mode run, CI #198). Mock mode resolves the arc
// synchronously via initialData, so the pending window and the arc's FAILURE arc only exist
// here — and both are what the page renders in production.
describe('MesoWeekPage (real mode)', () => {
  // The default handler's active run (b6f3a0e2-…001) carries exactly one volume profile
  // (chest), so the mosaic is one tile — enough to prove the arc joined the block.
  const REAL_MESO_ID = 'b6f3a0e2-0000-4000-8000-000000000001'
  const realArc = {
    mesocycleId: REAL_MESO_ID, title: 'Hypertrophy 04 · Tavasz', currentWeek: 3, weeks: 6,
    startDate: '2026-05-01', endDate: '2026-06-12', status: 'active',
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
    muscles: [
      {
        muscle: 'chest', region: 'coral', mrv: 20,
        weeks: [
          { week: 1, phase: 'MEV', planned: 8, actual: 8, isCurrent: false },
          { week: 2, phase: 'MEV', planned: 10, actual: 10, isCurrent: false },
          { week: 3, phase: 'MAV', planned: 12, actual: null, isCurrent: true },
          { week: 4, phase: 'MAV', planned: 14, actual: null, isCurrent: false },
          { week: 5, phase: 'MRV', planned: 14, actual: null, isCurrent: false },
          { week: 6, phase: 'Deload', planned: 7, actual: null, isCurrent: false },
        ],
      },
    ],
  }

  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a skeleton holds the page while the block and the arc are in flight, then the mosaic lands', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () => HttpResponse.json(realArc)),
    )
    setup(`/train/mesocycles/${REAL_MESO_ID}/week`)
    // Nothing is resolved on the first paint — a status skeleton, never a „nincs ív" ghost.
    expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
    expect(screen.queryByText(/nem található/)).not.toBeInTheDocument()

    expect(await screen.findByText('Heti vizsgálat · 3. hét')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mell részletek' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Betöltés…' })).not.toBeInTheDocument()
  })

  test('a FAILED arc fetch says try again (with a retry) — not „a blokk első edzése után"', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () => new HttpResponse(null, { status: 404 })),
    )
    setup(`/train/mesocycles/${REAL_MESO_ID}/week`)
    expect(await screen.findByText('Nem sikerült betölteni a heti vizsgálatot — próbáld újra.')).toBeInTheDocument()
    expect(screen.queryByText('A heti vizsgálat a blokk első edzése után jelenik meg.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })

  test('an arc with no muscles is still an arc — the hero renders, the mosaic is simply empty', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        HttpResponse.json({ ...realArc, muscles: [] })),
    )
    setup(`/train/mesocycles/${REAL_MESO_ID}/week`)
    expect(await screen.findByText('Heti vizsgálat · 3. hét')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /részletek$/ })).toHaveLength(0)
    expect(screen.queryByText(/Nem sikerült betölteni/)).not.toBeInTheDocument()
  })
})
