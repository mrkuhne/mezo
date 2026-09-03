import { render, screen } from '@testing-library/react'
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

function setup(muscle = 'back', mesoId = MESO_ID) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${mesoId}/week/${muscle}`],
  })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

test('the hero names the muscle, current → ceiling', () => {
  setup('back')
  // back: current 16, ceiling (grow → MAV) 16 in the meso-hyp-04 fixture.
  expect(screen.getByText(/Hát/)).toBeInTheDocument()
  expect(document.querySelector('.mz-bignum')?.textContent).toContain('16')
})

test('the five section eyebrows all render', () => {
  setup('back')
  expect(screen.getByText('A sáv · hol tartasz')).toBeInTheDocument()
  expect(screen.getByText('A blokk íve · W1 → deload')).toBeInTheDocument()
  expect(screen.getByText('Ezen a héten · hol dolgozik')).toBeInTheDocument()
  expect(screen.getByText('Honnan a sáv · levezetés')).toBeInTheDocument()
  expect(screen.getByText('Előző blokk')).toBeInTheDocument()
})

test('the block-arc spark carries a per-week label row — most / csúcs / deload', () => {
  setup('back') // W3 is current, W5 is the last ramp week (csúcs), W6 is deload
  const labels = Array.from(document.querySelectorAll('.mz-arclbl span')).map((n) => n.textContent)
  expect(labels).toEqual(['W1', 'W2', 'W3 · most', 'W4', 'W5 · csúcs', 'deload'])
})

test('the derivation has 4 numbered steps', () => {
  setup('back')
  const nums = document.querySelectorAll('.mz-dnum')
  expect(Array.from(nums).map((n) => n.textContent)).toEqual(['1', '2', '3', '4'])
  expect(screen.getByText('Baseline · RP tábla')).toBeInTheDocument()
  expect(screen.getByText('Fókusz-sáv · Grow')).toBeInTheDocument()
  expect(screen.getByText('Rád szabva')).toBeInTheDocument()
  expect(screen.getByText('Eredő · a blokkban')).toBeInTheDocument()
})

test('Rád szabva shows the real adjustments when the engine made them', () => {
  setup('back') // back's fixture carries 2 adjustments (pattern + sport-cross)
  expect(screen.getByText(/Pull Day konzisztencia/)).toBeInTheDocument()
  expect(screen.queryByText('nincs igazítás — a baseline érvényes')).not.toBeInTheDocument()
})

test('Rád szabva reads honestly empty for triceps (no adjustments in the fixture)', () => {
  setup('triceps')
  expect(screen.getByText('nincs igazítás — a baseline érvényes')).toBeInTheDocument()
})

test('a maintain-tier muscle (shoulder) skips the ramp band but keeps the rest of the page', () => {
  setup('shoulder')
  expect(screen.getByText('A blokk íve · W1 → deload')).toBeInTheDocument()
  expect(screen.queryByText('A sáv · hol tartasz')).not.toBeInTheDocument()
})

test('previous-block ghost when no archived run ever carried this muscle', () => {
  setup('back')
  // meso-hyp-04's own fixture archived runs carry no volumePerMuscle snapshot.
  expect(screen.getByText('nincs előző blokk')).toBeInTheDocument()
})

test('a muscle missing from the arc shows the ghost state, not a crash', () => {
  setup('core') // not one of meso-hyp-04's volumePerMuscle groups
  expect(screen.getByText('Ez az izom nincs a heti vizsgálatban.')).toBeInTheDocument()
})

// ── Real mode ────────────────────────────────────────────────────────────────
// Nested describe (house idiom) — mock mode resolves the arc synchronously via initialData,
// so the pending window this page renders in production only exists here. The outer
// beforeEach's fake timers are handed back first: MSW's async resolution needs a real clock.
describe('MesoMusclePage (real mode)', () => {
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

  beforeEach(() => {
    vi.useRealTimers()
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () => HttpResponse.json(realArc)),
    )
  })
  afterEach(() => vi.unstubAllEnvs())

  test('a skeleton holds the page while the block and the arc are in flight, then the muscle lands', async () => {
    setup('chest', REAL_MESO_ID)
    expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
    // Never the „nincs ilyen izom" / „nincs ilyen blokk" ghost mid-flight.
    expect(screen.queryByText(/nincs a heti vizsgálatban|nem található/)).not.toBeInTheDocument()

    // current 14 → ceiling 14 (chest is Grow, so MAV is the plafon) — the resolved hero.
    expect(await screen.findByText(/Mell · Grow/)).toBeInTheDocument()
    expect(screen.getByText('Honnan a sáv · levezetés')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Betöltés…' })).not.toBeInTheDocument()
  })

  test('a FAILED arc fetch says try again, not „a blokk első edzése után"', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () => new HttpResponse(null, { status: 500 })),
    )
    setup('chest', REAL_MESO_ID)
    expect(await screen.findByText('Nem sikerült betölteni a heti vizsgálatot — próbáld újra.')).toBeInTheDocument()
  })
})
