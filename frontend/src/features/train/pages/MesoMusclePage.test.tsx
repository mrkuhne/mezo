import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { CAPTION_MIN_GAP, spreadCaptions } from './MesoMusclePage'

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

const hero = () => document.querySelector('.fo-hero') as HTMLElement
/** The measuring cylinder's captions, top (ceiling) first. */
const cylCaptions = () => Array.from(document.querySelectorAll('.ep-cyl .wl em')).map((n) => n.textContent)
const facts = () => Array.from(document.querySelectorAll('.ep-mfacts b')).map((n) => n.textContent)

// Folyadék F3 (prototype vilagos/edzes.js `izom()`): the muscle's name rides the title bar; the hero says the
// number as a verdict.
test('the hero says, in words, what the muscle\'s number means', () => {
  setup('back')
  expect(screen.getByText('Hát')).toBeInTheDocument()
  // back @ W3: 14 sets now, ceiling (Építés → MAV) 16 — 2 still fit.
  expect(hero().querySelector('.fo-hero-lbl')?.textContent).toBe('3. hét · Építés')
  expect(hero().querySelector('.fo-hero-verdict')?.textContent).toBe('A hát hetente 14 szettet kap.')
  // …and what Monday does to it — read off the arc's own next week (W4 = 16).
  expect(hero().querySelector('.fo-hero-sub')?.textContent).toBe(
    'Még 2 fér bele, aztán a terv végéig 16 marad a felső érték. Hétfőn 2 szettel többet kapsz.',
  )
  expect(within(hero()).getByRole('img', { name: 'Hát a testtérképen' })).toHaveClass('ex-body')
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
  const stats = document.querySelector('.ep-mfacts')!
  expect(stats.textContent).toContain('szett az 1. héten')
  expect(stats.textContent).toContain('a legtöbb lesz')
  expect(stats.textContent).toContain('edzés hetente')
  // W1 = 10, the plan's peak = 16 (the last non-pihenőhét week).
  expect(facts().slice(1)).toEqual(['10', '16'])
})

// ── The measuring cylinder (this page only) ──
test('the cylinder draws the liquid to the current number and both lines with their captions', () => {
  setup('back')
  const cyl = document.querySelector('.ep-cyl')!
  // scale = max(mrv 22, plan peak 16) = 22 → now 14/22, mev 10/22, ceiling 16/22.
  const liquid = cyl.querySelector('.l') as HTMLElement
  expect(liquid.getAttribute('data-level')).toBe('63.6')
  expect(liquid.style.height).toBe(`${(14 / 22) * 90}%`) // the liquid uses 90% of the vessel
  expect(liquid.querySelector('b')?.textContent).toBe('14')
  expect(cyl.querySelectorAll('.wl')).toHaveLength(2)
  expect(cyl.querySelector('.wl.top')?.getAttribute('data-at')).toBe('72.7')
  expect(cyl.querySelector('.wl.low')).toHaveClass('d') // the lower threshold is the dashed one
  expect(cylCaptions()).toEqual(['eddig mész el · 16', 'ennyitől fejlődik · 10'])
  expect(cyl).toHaveAccessibleName('Hát: 14 szett hetente; 10 szettől fejlődik, 16 szettig mész el')
})

// THE MERGED-LABEL RULE: a muscle you only hold has its lower threshold and its ceiling in
// the same place — ONE line and ONE caption, never two stacked on top of each other saying
// the same thing. Váll (shoulder) is meso-hyp-04's maintain group: mev 8 === ceiling 8.
test('a maintain muscle renders ONE merged line and caption, not two', () => {
  setup('shoulder')
  expect(cylCaptions()).toEqual(['ennyitől fejlődik — és itt tartod · 8'])
  expect(document.querySelectorAll('.ep-cyl .wl')).toHaveLength(1)
  expect(document.querySelector('.ep-cyl .wl')).toHaveClass('top')
})

test('captions that sit close while their numbers differ are pushed apart, not stacked', () => {
  // Far enough apart already — untouched, to the decimal.
  expect(spreadCaptions(45.4, 72.7)).toEqual([45.4, 72.7])
  // Exactly the minimum gap still counts as far enough.
  expect(spreadCaptions(40, 40 + CAPTION_MIN_GAP)).toEqual([40, 40 + CAPTION_MIN_GAP])
  // A collision opens to the minimum gap around its own midpoint, so each caption moves by at most half of it.
  expect(spreadCaptions(50, 50)).toEqual([50 - CAPTION_MIN_GAP / 2, 50 + CAPTION_MIN_GAP / 2])
  expect(spreadCaptions(48, 52)).toEqual([50 - CAPTION_MIN_GAP / 2, 50 + CAPTION_MIN_GAP / 2])
  // Near the ends the pair slides back INSIDE the scale rather than hanging off it.
  expect(spreadCaptions(0, 0)).toEqual([0, CAPTION_MIN_GAP])
  expect(spreadCaptions(100, 100)).toEqual([100 - CAPTION_MIN_GAP, 100])
})

test('the plan ramp draws one vessel per week, this week ringed and the pihenőhét hatched', () => {
  setup('back') // W3 is current, W6 is the pihenőhét
  const tubes = screen.getByRole('group', { name: 'A hát heti szettszáma a terv 6 hetében' })
  const vials = Array.from(tubes.querySelectorAll('.fo-vial'))
  expect(vials.map((v) => v.className.replace('fo-vial', '').trim())).toEqual(['', '', 'now', 'ghost', 'ghost', 'ghost hatch'])
  expect(vials.map((v) => v.querySelector('b')?.textContent)).toEqual(['10', '12', '14', '16', '16', '8'])
  expect(tubes.querySelector('.fo-vial.now b')?.textContent).toBe('14')
  expect(screen.getByText(/Az utolsó hét pihenőhét — ott 8 szettre esik vissza/)).toBeInTheDocument()
})

test('a where-row is a door to that day', async () => {
  const router = setup('back')
  const rows = document.querySelectorAll('button.ep-where')
  expect(rows.length).toBeGreaterThan(0)
  expect(rows[0].querySelector('.ex-day')).not.toBeNull() // the weekday in its round chip
  await userEvent.click(rows[0] as HTMLElement)
  await waitFor(() =>
    expect(router.state.location.pathname).toMatch(new RegExp(`^/train/mesocycles/${MESO_ID}/days/`)))
})

test('the derivation has 4 numbered steps, in plain words', () => {
  setup('back')
  const nums = document.querySelectorAll('.ep-deriv .ex-day')
  expect(Array.from(nums).map((n) => n.textContent)).toEqual(['1', '2', '3', '4'])
  expect(screen.getByText('Kiinduló ajánlás')).toBeInTheDocument()
  expect(screen.getByText('Fókusz · Építés')).toBeInTheDocument()
  expect(screen.getByText('Rád szabva')).toBeInTheDocument()
  expect(screen.getByText('Ebben a tervben')).toBeInTheDocument()
  expect(screen.getByText('indul: 10 · felső érték: 16 · hetente +2')).toBeInTheDocument()
  expect(screen.getByText('1. hét: 10 · 2. hét: 12 · 3. hét · most: 14 · hétfőn: +2')).toBeInTheDocument()
  // how sure the band is: a level, and the inert „Felülír"
  expect(document.querySelector('.ep-deriv .fo-level')?.textContent).toMatch(/^Mennyire biztos a sáv\d+%$/)
  expect(screen.getByRole('button', { name: 'Felülír · hamarosan' })).toBeDisabled()
  // the engine's words never reach the screen
  expect(document.querySelector('.ep-deriv')?.textContent).not.toMatch(/MEV|MAV|MRV|Baseline|baseline|plafon|blokk/)
})

test('Rád szabva shows the real adjustments when the engine made them', () => {
  setup('back') // back's fixture carries 2 adjustments (pattern + sport-cross)
  expect(screen.getByText(/Pull Day konzisztencia/)).toBeInTheDocument()
  expect(screen.queryByText('nincs igazítás — a kiinduló ajánlás érvényes')).not.toBeInTheDocument()
})

test('Rád szabva reads honestly empty for triceps (no adjustments in the fixture)', () => {
  setup('triceps')
  expect(screen.getByText('nincs igazítás — a kiinduló ajánlás érvényes')).toBeInTheDocument()
})

// Was „a maintain-tier muscle skips the ramp band but keeps the rest of the page": the
// Titanium gauge replaces the ramp-only `VolumeBand`, so a maintain muscle now gets the
// SAME gauge (merged caption above) — and still the whole rest of the page.
test('a maintain muscle keeps the whole page, cylinder included', () => {
  setup('shoulder')
  expect(screen.getByText('A 6 hét')).toBeInTheDocument()
  expect(screen.getByText('Hol tartasz')).toBeInTheDocument()
  expect(document.querySelector('.ep-cyl')).toBeInTheDocument()
  expect(hero().querySelector('.fo-hero-sub')?.textContent).toContain('Ez így is marad')
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
   *  `previousBlock` reads the archived runs' own `volumePerMuscle` snapshots. An optional
   *  `volumeRecompute` lands on the ACTIVE run only — `grindHeldGroups` (mesoBands.ts) reads
   *  it straight off the mesocycle the page found, the same seam the real backend uses. */
  function runList(
    back: Record<string, unknown> | null,
    archivedBack: Record<string, unknown> | null,
    volumeRecompute?: Record<string, unknown>,
  ) {
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
      ...(volumeRecompute ? { volumeRecompute } : {}),
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

  test('a FAILED arc fetch says try again, not „a terv első edzése után"', async () => {
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
    expect(hero().querySelector('.fo-hero-lbl')?.textContent).toBe('3. hét · Hangsúly')
    expect(screen.queryByText(/Emphasize/)).not.toBeInTheDocument()
  })

  // The cylinder's ends, on real markup: a ceiling at 100% of the scale and a lower threshold at 10% keep both
  // lines and both captions exactly where the numbers put them (far apart — nothing is nudged).
  test('lines at the two ends of the cylinder stand at their true positions', async () => {
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
    // scale = max(mrv 20, peak 20) = 20 → mev at 10%, ceiling at 100%.
    const top = document.querySelector('.ep-cyl .wl.top') as HTMLElement
    const low = document.querySelector('.ep-cyl .wl.low') as HTMLElement
    expect(top.getAttribute('data-at')).toBe('100.0')
    expect(low.getAttribute('data-at')).toBe('10.0')
    expect(top.style.bottom).toBe('90%')
    expect(low.style.bottom).toBe('9%')
    expect(top.style.getPropertyValue('--dy')).toBe('0.0px')
    expect(low.style.getPropertyValue('--dy')).toBe('0.0px')
    // the liquid stands at the ceiling: full to the top line
    expect((document.querySelector('.ep-cyl .l') as HTMLElement).style.height).toBe('90%')
  })

  // Was the gauge's edge clamp for its pin: in the cylinder a LOW level has no room for the numeral inside the
  // liquid, so it stands above the surface instead (prototype `.l.lo`, under 28% of the scale).
  test('a low level carries its numeral above the liquid, a high one inside it', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json(runList({
          mev: 4, mav: 16, mrv: 20, current: 4,
          source: { baseline: { name: 'RP guidelines · intermediate', mev: 4, mav: 16, mrv: 20 }, adjustments: [], confidence: 0.8 },
        }, null))),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        HttpResponse.json(backArc([2, 3, 4, 8, 12, 4], 20))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Hol tartasz')
    // 4 of a scale of 20 → 20%: under the threshold
    expect(document.querySelector('.ep-cyl .l')).toHaveClass('lo')
    expect(document.querySelector('.ep-cyl .l b')?.textContent).toBe('4')
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

    // The previous plan's own identity stays legible, not just its numbers.
    expect(screen.getByText('Előző terved: Hypertrophy 03')).toBeInTheDocument()

    const vials = Array.from(document.querySelectorAll('.ep-vs .fo-vial'))
    expect(vials).toHaveLength(2)
    expect(vials[0].textContent).toContain('8 → 24') // akkor: start → peak
    expect(vials[1].textContent).toContain('10 → 20') // most: this plan is LOWER
    // The down move carries no red/danger/warning modifier anywhere: „Most" keeps the muscle's own colour,
    // and the previous peak stands in it as a quiet dashed waterline.
    expect(vials[1].className).toBe('fo-vial')
    expect(vials[1].getAttribute('style')).toContain('--c: color-mix')
    expect(vials[1].querySelector('.wl')).not.toBeNull()
    expect(document.querySelector('.ep-vs')!.innerHTML).not.toMatch(/fo-bad|fo-warn|danger|is-down|is-bad|negative/i)
    expect(screen.getByText('Az előző terv magasabbra vitt — most más izom kapja a hangsúlyt.')).toBeInTheDocument()
  })

  // ── Fix round 1 (review findings 1, 3, 4, 5) ─────────────────────────────────

  // Finding 1: the „Hétfőn N szettel többet kapsz" promise is clamped to `tile.step`
  // (mesoWeek.ts), not the raw arc delta — a grind-held muscle (current < ceiling, held for
  // a grind week) has step 0, even though its own next planned week still shows +2 in the
  // raw series. Fixture built through the page's normal data seam (MSW handlers), mirroring
  // mesoWeek.test.ts's own grind-held fixture (`volumeRecompute.changes[…].reason === 'tartás'`).
  test('a grind-held muscle never promises Monday sets the engine is not giving (fix round 1)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json(runList(
          {
            mev: 10, mav: 16, mrv: 22, current: 14,
            source: { baseline: { name: 'RP guidelines · intermediate', mev: 10, mav: 16, mrv: 22 }, adjustments: [], confidence: 0.8 },
          },
          null,
          { lastRun: '', nextRun: '', trigger: '', changes: [{ muscle: 'back', change: 'tart (14)', reason: 'tartás' }] },
        ))),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        // Week 4 (next Monday) plans 16 — a raw +2 over the current 14 — but the muscle is
        // grind-held (current 14 < ceiling 16), so the engine's own step is 0.
        HttpResponse.json(backArc([10, 12, 14, 16, 16, 8], 22))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Hát')
    expect(hero().querySelector('.fo-hero-sub')?.textContent).toMatch(/ Hétfőn nem változik\.$/)
    expect(hero().textContent).not.toMatch(/szettel többet kapsz/)
  })

  // Finding 3: „close together" and „the same" are different questions. mev 19 and ceiling 20 land 3.8
  // points apart on this scale, but 19 !== 20 — the text „ennyitől fejlődik — és itt tartod" would be a lie,
  // so both lines and both captions render, the captions pushed apart so they do not print on each other.
  test('a near-but-not-equal threshold/ceiling renders both captions, not the merged text (fix round 1)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json(runList({
          mev: 19, mav: 20, mrv: 26, current: 19,
          source: { baseline: { name: 'RP guidelines · intermediate', mev: 19, mav: 20, mrv: 26 }, adjustments: [], confidence: 0.8 },
        }, null))),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        HttpResponse.json(backArc([15, 17, 19, 20, 20, 10], 26))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Hol tartasz')
    expect(document.querySelectorAll('.ep-cyl .wl')).toHaveLength(2)
    expect(cylCaptions()).toEqual(['eddig mész el · 20', 'ennyitől fejlődik · 19'])
    // the lines keep their true places; only the captions slide — the top one up, the low one down
    const dy = (sel: string) => parseFloat((document.querySelector(sel) as HTMLElement).style.getPropertyValue('--dy'))
    expect(dy('.ep-cyl .wl.top')).toBeLessThan(0)
    expect(dy('.ep-cyl .wl.low')).toBeGreaterThan(0)
  })

  // Finding 4: the plan's peak is the MAX planned value over the non-pihenőhét weeks, not
  // the LAST one — a tapering plan (peak mid-block, tapering into the final working week)
  // would otherwise under-report both the „a legtöbb lesz" fact and the gauge scale.
  test('a tapering plan\'s peak is the block MAX, not its last working week (fix round 1)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json(runList({
          mev: 10, mav: 20, mrv: 18, current: 18,
          source: { baseline: { name: 'RP guidelines · intermediate', mev: 10, mav: 20, mrv: 18 }, adjustments: [], confidence: 0.8 },
        }, null))),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        // Week 4 (20) is the true peak; week 5 (16) — the last non-deload week — tapers down
        // before the week-6 deload. The LAST-week reading would report 16.
        HttpResponse.json(backArc([10, 14, 18, 20, 16, 8], 18))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Hol tartasz')
    expect(facts()[2]).toBe('20') // „a legtöbb lesz" — the MAX (week 4), not the last (16).
    // The cylinder's scale widens to the true peak (max(mrv 18, peak 20) = 20), not to 18: the
    // liquid reads 18/20 = 90%, not 18/18 = 100%.
    expect(document.querySelector('.ep-cyl .l')?.getAttribute('data-level')).toBe('90.0')
  })

  // Finding 5: the versus bars clamp against their OWN scale (`versusScale`), not the
  // gauge's `scale` — an archived peak above this plan's scale must not pin both bars to an
  // identical 100% width while their numbers still differ.
  test('an archived peak above the current scale renders unequal then / now levels (fix round 1)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json(runList({
          mev: 10, mav: 20, mrv: 20, current: 18,
          source: { baseline: { name: 'RP guidelines · intermediate', mev: 10, mav: 20, mrv: 20 }, adjustments: [], confidence: 0.8 },
        }, { mev: 10, mav: 20, mrv: 20, current: 30 }))), // archived peak (30) far above this plan's scale (20)
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () =>
        HttpResponse.json(backArc([10, 14, 18, 20, 20, 10], 20))),
    )
    setup('back', REAL_MESO_ID)
    await screen.findByText('Az előző tervhez képest')
    const levels = Array.from(document.querySelectorAll('.ep-vs .fo-tube .l')).map((l) => parseFloat((l as HTMLElement).style.getPropertyValue('--p')))
    expect(levels).toHaveLength(2)
    // versusScale = max(scale 20, prev.peak 30) = 30 → akkor 30/30 (a full vessel = 94%), most 20/30 of it.
    expect(levels[0]).toBeCloseTo(94, 5)
    expect(levels[1]).toBeCloseTo((20 / 30) * 94, 5)
    expect(levels[0]).not.toBe(levels[1])
  })
})

// ── the explain layer (mezo-b516k; Folyadék F3) ──────────────────────────────────────────
// The text link on the hero's liquid row, the prototype's copy word for word. The aria-label is
// `"<title> — mit jelent?"`.
test('„Mit jelentenek a jelölések?" explains the two lines of the cylinder, word for word', async () => {
  const user = userEvent.setup()
  setup('back')
  const btn = screen.getByRole('button', { name: 'Mit jelentenek a jelölések? — mit jelent?' })
  expect(btn.closest('.fo-hero-acts')).not.toBeNull()
  await user.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Mit jelentenek a jelölések?' })).getByText(
      'Az alsó jelölés alatt nincs elég inger ahhoz, hogy ez az izom fejlődjön. A felső érték az, ameddig ebben a tervben elmész — ezt a fókuszod szabja meg.',
    ),
  ).toBeInTheDocument()
})

// The no-duplicate-text directive (mezo-b516k fix round 1): the lower threshold is printed ONCE on the page's
// graphic — on the cylinder's own caption — never repeated in a plain paragraph behind the link.
test('the lower threshold is printed once on the cylinder — no near-duplicate paragraph', () => {
  setup('back')
  expect(cylCaptions().filter((c) => c?.startsWith('ennyitől fejlődik'))).toEqual(['ennyitől fejlődik · 10'])
  expect(screen.queryByText(/^10 szett alatt nincs elég inger/)).not.toBeInTheDocument()
})
