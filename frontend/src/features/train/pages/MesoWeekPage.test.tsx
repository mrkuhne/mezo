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
  expect(screen.getByText('Melyik izmod hol tart')).toBeInTheDocument()
  expect(screen.getByText(/a múlt héthez képest/)).toBeInTheDocument()
})

// Was „the stat strip carries four cells" (T9 Task 5): the four `StatCell`s are gone — the
// Titanium hero says the same four facts as ONE sentence (the owner's rule: the sentence is
// the page), and the raw word „rámpázik" the old `up` cell carried is itself on the banned
// list. Same contract, re-pinned on the sentence: the total, and how many muscles are
// growing / capped / merely held.
test('the hero sentence counts the growing, the capped and the held muscles', () => {
  setup()
  const hero = document.querySelector('.pl-dhero')!
  // meso-hyp-04 @ W3: chest 12/14 and back 14/16 still have room; five sit at their
  // ceiling; shoulder is the maintain group.
  expect(hero.textContent).toContain('8 izomcsoportot edzel ezen a héten')
  expect(hero.textContent).toContain('2 izomban van még hova nőni')
  expect(hero.textContent).toContain('5 elérte a felső értéket')
  expect(hero.textContent).toContain('1 izmot csak szinten tartasz')
  expect(hero.querySelector('.pl-dhero-number')?.textContent).toContain('88')
})

test('the hero carries the week body map — both sides, since a week touches both', () => {
  setup()
  const map = screen.getByRole('img', { name: 'A heted izomtérképe' })
  expect(map).toHaveClass('body-map-duo')
  expect(document.querySelector('.pl-dhero-art')).toContainElement(map)
})

test('one row per arc muscle, with landmarks, no percentages', () => {
  setup()
  // meso-hyp-04 carries 8 volumePerMuscle groups — one row each.
  expect(screen.getAllByRole('button', { name: /részletek$/ })).toHaveLength(8)
  expect(screen.getByText('Hát')).toBeInTheDocument()
  expect(screen.getByText('Mell')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/%/)
})

// The rows rank by ROOM TO THE CEILING (the prototype's rule), not by raw ceiling: the
// muscles with something still to give lead. Hát and Mell both have 2 sets of room, and the
// bigger ceiling breaks the tie — so Hát still leads, and the five capped groups follow.
test('the rows rank by room to the ceiling, the capped ones last', () => {
  setup()
  const names = screen.getAllByRole('button', { name: /részletek$/ }).map((b) => b.getAttribute('aria-label'))
  expect(names[0]).toBe('Hát részletek')
  expect(names[1]).toBe('Mell részletek')
  expect(names.slice(2)).not.toContain('Hát részletek')
})

// The three verdict SENTENCES the slice pins — each prefixed by the Hungarian tier word
// (tierLabel), never a raw English tier and never a bare number pair.
test('each row says its verdict in words, prefixed by the tier', () => {
  setup()
  const say = (label: string) =>
    screen.getByRole('button', { name: `${label} részletek` }).querySelector('.pl-item-say')?.textContent
  expect(say('Hát')).toBe('Építés · Még 2 szett fér bele.')
  expect(say('Váll')).toBe('Tartás · Ezt most szinten tartod.')
  expect(say('Bicepsz')).toBe('Építés · Elérte a felső értéket ebben a tervben.')
  expect(document.body.textContent).not.toMatch(/Emphasize|Maintain|Grow/)
})

// The one thing on this page that talks about the FUTURE — nothing else carries it.
test('the live-rollover banner stays', () => {
  setup()
  expect(screen.getByText(/Élő rendszer/)).toBeInTheDocument()
})

test('tapping a row navigates to the muscle page', async () => {
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

  test('a skeleton holds the page while the block and the arc are in flight, then the list lands', async () => {
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

  test('an arc with no muscles is still an arc — the hero renders, the list is simply empty', async () => {
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
