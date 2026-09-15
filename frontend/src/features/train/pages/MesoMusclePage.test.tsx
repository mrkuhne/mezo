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
import { labelsMerge, nudgeFor } from './MesoMusclePage'

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

const gaugeLegend = () => Array.from(document.querySelectorAll('.pl-scale-legend i'))

test('the hero names the muscle and says, in words, what its number means', () => {
  setup('back')
  const hero = document.querySelector('.pl-dhero')!
  expect(hero.querySelector('h2')?.textContent).toBe('Hát')
  // back @ W3: 14 sets now, ceiling (Építés → MAV) 16 — 2 still fit.
  expect(hero.querySelector('.pl-dhero-number')?.textContent).toContain('14')
  expect(hero.querySelector('.pl-say')?.textContent).toBe(
    'A hát hetente 14 szettet kap. Még 2 fér bele, aztán a terv végéig 16 marad a felső érték.',
  )
  // …and what Monday does to it — read off the arc's own next week (W4 = 16).
  expect(hero.querySelector('.pl-sub-say')?.textContent).toBe('Hétfőn 2 szettel többet kapsz.')
})

// Was „the five section eyebrows all render" — same contract, the T9 Titanium headings.
test('the five section headings all render', () => {
  setup('back')
  expect(screen.getByText('Hol tartasz')).toBeInTheDocument()
  expect(screen.getByText('A 6 hét')).toBeInTheDocument()
  expect(screen.getByText('Hol edzed')).toBeInTheDocument()
  expect(screen.getByText('Honnan jön ez a szám')).toBeInTheDocument()
  expect(screen.getByText('Az előző tervhez képest')).toBeInTheDocument()
})

test('the three plain facts: sessions a week, week one, the most this plan asks', () => {
  setup('back')
  const stats = document.querySelector('.pl-mstats')!
  expect(stats.textContent).toContain('szett az 1. héten')
  expect(stats.textContent).toContain('a legtöbb lesz')
  expect(stats.textContent).toContain('edzés hetente')
  // W1 = 10, the plan's peak = 16 (the last non-pihenőhét week).
  const values = Array.from(stats.querySelectorAll('strong')).map((n) => n.textContent)
  expect(values.slice(1)).toEqual(['10', '16'])
})

// ── The gauge (this page only — VolumeBand is untouched for every other consumer) ──
test('the gauge draws the fill, both landmarks and a labelled pin at the current number', () => {
  setup('back')
  const bar = document.querySelector('.pl-scale-bar')!
  // scale = max(mrv 22, plan peak 16) = 22 → now 14/22, mev 10/22, ceiling 16/22.
  expect(bar.querySelector('.fill')?.getAttribute('style')).toContain('--w: 63.63')
  expect(bar.querySelectorAll('.mark')).toHaveLength(2)
  expect(bar.querySelector('.mark.is-top')?.getAttribute('style')).toContain('--at: 72.72')
  expect(bar.querySelector('.pin')?.textContent).toBe('14')
  expect(gaugeLegend().map((n) => n.querySelector('small')?.textContent))
    .toEqual(['ennyitől fejlődik', 'eddig mész el'])
})

// THE MERGED-LABEL RULE: a muscle you only hold has its lower landmark and its ceiling in
// the same place — ONE caption, never two stacked on top of each other saying the same
// thing. Váll (shoulder) is meso-hyp-04's maintain group: mev 8 === ceiling 8.
test('a maintain muscle renders ONE merged gauge caption, not two', () => {
  setup('shoulder')
  const legend = gaugeLegend()
  expect(legend).toHaveLength(1)
  expect(legend[0].textContent).toBe('8ennyitől fejlődik — és itt tartod')
  // The lower landmark mark is dropped with its caption — the ceiling mark carries both.
  expect(document.querySelectorAll('.pl-scale-bar .mark')).toHaveLength(1)
  expect(document.querySelector('.pl-scale-bar .mark')).toHaveClass('is-top')
})

test('the merge threshold and the --nudge clamp are the prototype rules', () => {
  // Two landmarks within 7 points of each other read as one.
  expect(labelsMerge(44.4, 44.4)).toBe(true)
  expect(labelsMerge(40, 46)).toBe(true)
  expect(labelsMerge(45.4, 72.7)).toBe(false)
  // A label anchored near either end is pulled back onto the track instead of centred.
  expect(nudgeFor(0)).toBe('-16%')
  expect(nudgeFor(13.9)).toBe('-16%')
  expect(nudgeFor(50)).toBe('-50%')
  expect(nudgeFor(86.1)).toBe('-84%')
  expect(nudgeFor(100)).toBe('-84%')
})

test('the plan ramp draws one bar per week, this week lit and the pihenőhét hatched', () => {
  setup('back') // W3 is current, W6 is the pihenőhét
  const bars = Array.from(document.querySelectorAll('.pl-arc i'))
  expect(bars.map((b) => b.className)).toEqual(['is-past', 'is-past', 'is-now', '', '', 'is-deload'])
  expect(Array.from(document.querySelectorAll('.pl-weekvals i')).map((n) => n.textContent))
    .toEqual(['10', '12', '14', '16', '16', '8'])
  expect(document.querySelector('.pl-weekvals .is-now')?.textContent).toBe('14')
  expect(screen.getByText(/Az utolsó hét pihenőhét — ott 8 szettre esik vissza/)).toBeInTheDocument()
})

test('a where-row is a door to that day', async () => {
  const router = setup('back')
  const rows = document.querySelectorAll('.pl-ex.is-link')
  expect(rows.length).toBeGreaterThan(0)
  await userEvent.click(rows[0] as HTMLElement)
  await waitFor(() =>
    expect(router.state.location.pathname).toMatch(new RegExp(`^/train/mesocycles/${MESO_ID}/days/`)))
})

test('the derivation has 4 numbered steps', () => {
  setup('back')
  const nums = document.querySelectorAll('.mz-dnum')
  expect(Array.from(nums).map((n) => n.textContent)).toEqual(['1', '2', '3', '4'])
  expect(screen.getByText('Baseline · RP tábla')).toBeInTheDocument()
  expect(screen.getByText('Fókusz-sáv · Építés')).toBeInTheDocument()
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

// Was „a maintain-tier muscle skips the ramp band but keeps the rest of the page": the
// Titanium gauge replaces the ramp-only `VolumeBand`, so a maintain muscle now gets the
// SAME gauge (merged caption above) — and still the whole rest of the page.
test('a maintain muscle keeps the whole page, gauge included', () => {
  setup('shoulder')
  expect(screen.getByText('A 6 hét')).toBeInTheDocument()
  expect(screen.getByText('Hol tartasz')).toBeInTheDocument()
  expect(document.querySelector('.pl-scale-bar')).toBeInTheDocument()
  expect(document.querySelector('.pl-dhero .pl-say')?.textContent).toContain('és ez így is marad')
})

test('previous-plan ghost when no archived run ever carried this muscle', () => {
  setup('back')
  // meso-hyp-04's own fixture archived runs carry no volumePerMuscle snapshot.
  expect(screen.getByText(/Ehhez az izomhoz még nincs korábbi terved/)).toBeInTheDocument()
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

  /** The run list, with an optional `back` profile and an optional ARCHIVED sibling run —
   *  `previousBlock` reads the archived runs' own `volumePerMuscle` snapshots. */
  function runList(back: Record<string, unknown> | null, archivedBack: Record<string, unknown> | null) {
    const base = {
      title: 'Hypertrophy 04 · Tavasz', shortTitle: 'Hypertrophy 04',
      goal: 'Felsőtest hypertrophy · izomtömeg építés',
      startDate: '2026-05-01', endDate: '2026-06-12', weeks: 6, currentWeek: 3,
      split: 'Pull / Push / Legs · 5×/hét', style: 'RP · 6 hét',
      phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
      musclePriorities: {}, days: [],
    }
    const runs: unknown[] = [{
      ...base, id: REAL_MESO_ID, status: 'active',
      volumePerMuscle: back ? { back } : {},
    }]
    if (archivedBack) {
      runs.push({
        ...base, id: 'b6f3a0e2-0000-4000-8000-0000000000aa', status: 'archived',
        title: 'Hypertrophy 03 · Tél', shortTitle: 'Hypertrophy 03',
        startDate: '2026-02-01', endDate: '2026-03-14', closedAt: '2026-03-14',
        volumePerMuscle: { back: archivedBack },
      })
    }
    return runs
  }

  const backArc = (weeks: number[], mrv: number) => ({
    ...realArc,
    muscles: [{
      muscle: 'back', region: 'sky', mrv,
      weeks: weeks.map((planned, i) => ({
        week: i + 1,
        phase: realArc.phaseCurve[i],
        planned,
        actual: i + 1 < 3 ? planned : null,
        isCurrent: i + 1 === 3,
      })),
    }],
  })

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

    expect(await screen.findByText('Mell')).toBeInTheDocument()
    expect(screen.getByText('Honnan jön ez a szám')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Betöltés…' })).not.toBeInTheDocument()
  })

  test('a FAILED arc fetch says try again, not „a blokk első edzése után"', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () => new HttpResponse(null, { status: 500 })),
    )
    setup('chest', REAL_MESO_ID)
    expect(await screen.findByText('Nem sikerült betölteni a heti vizsgálatot — próbáld újra.')).toBeInTheDocument()
  })

  // The fixture's musclePriorities carry `back: 'emphasize'` — the tier chip renders the
  // shared Hungarian vocabulary (tierLabel.ts), never the raw English tier name that used
  // to be inlined on this page's hero line.
  test('an emphasize-tier muscle renders "Hangsúly", never "Emphasize"', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([{
          id: REAL_MESO_ID, title: 'Hypertrophy 04 · Tavasz', shortTitle: 'Hypertrophy 04',
          status: 'active', goal: 'Felsőtest hypertrophy · izomtömeg építés',
          startDate: '2026-05-01', endDate: '2026-06-12', weeks: 6, currentWeek: 3,
          split: 'Pull / Push / Legs · 5×/hét', style: 'RP · 6 hét',
          phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
          musclePriorities: { back: 'emphasize' },
          volumePerMuscle: {
            back: {
              mev: 10, mav: 16, mrv: 22, current: 16,
              source: { baseline: { name: 'RP guidelines · intermediate', mev: 10, mav: 14, mrv: 20 }, adjustments: [], confidence: 0.8 },
            },
          },
          days: [],
        }]),
      ),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        HttpResponse.json(backArc([10, 12, 16, 18, 20, 10], 22))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Hát')
    expect(document.querySelector('.pl-dhero-tag')?.textContent).toBe('3. hét · Hangsúly')
    expect(screen.queryByText(/Emphasize/)).not.toBeInTheDocument()
  })

  // --nudge EDGE-CLAMPING, on real markup: a ceiling that lands at 100% of the scale and a
  // lower landmark at 10% would both be centred half-way off the track without the clamp.
  test('gauge labels at the track edges carry the clamped --nudge, not the centred default', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json(runList({
          mev: 2, mav: 20, mrv: 20, current: 20,
          source: { baseline: { name: 'RP guidelines · intermediate', mev: 2, mav: 20, mrv: 20 }, adjustments: [], confidence: 0.8 },
        }, null))),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        HttpResponse.json(backArc([2, 8, 20, 20, 20, 10], 20))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Hol tartasz')
    const legend = gaugeLegend()
    expect(legend).toHaveLength(2)
    // scale = max(mrv 20, peak 20) = 20 → mev at 10% (left edge), ceiling at 100% (right).
    expect(legend[0].getAttribute('style')).toContain('--nudge: -16%')
    expect(legend[1].getAttribute('style')).toContain('--nudge: -84%')
    expect(document.querySelector('.pl-scale-bar .pin')?.getAttribute('style')).toContain('--nudge: -84%')
  })

  // NEVER RED ON A DOWN MOVE: the previous plan peaked at 24, this one stops at 20. The
  // „Most" row keeps the muscle's own colour and its only class stays `is-now` — no
  // warning/danger/down modifier is ever added, and the sentence calls it a shift of focus.
  test('a lower peak than the previous plan is not drawn as a failure', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json(runList({
          mev: 10, mav: 20, mrv: 26, current: 20,
          source: { baseline: { name: 'RP guidelines · intermediate', mev: 10, mav: 20, mrv: 26 }, adjustments: [], confidence: 0.8 },
        }, { mev: 8, mav: 20, mrv: 26, current: 24 }))),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        HttpResponse.json(backArc([10, 14, 18, 20, 20, 10], 26))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Az előző tervhez képest')

    const rows = Array.from(document.querySelectorAll('.pl-versus-row'))
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('8 → 24') // akkor: start → peak
    expect(rows[1].textContent).toContain('10 → 20') // most: this plan is LOWER
    // The down move carries no red/danger/warning modifier anywhere in the versus block.
    expect(rows[1].className).toBe('pl-versus-row is-now')
    expect(document.querySelector('.pl-versus')!.innerHTML).not.toMatch(/red|danger|warn|is-down|is-bad|negative/i)
    expect(screen.getByText('Az előző terv magasabbra vitt — most más izom kapja a hangsúlyt.')).toBeInTheDocument()
  })
})
