import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoTervPage } from '@/features/train/pages/MesoTervPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{`${pathname}${search}`}</div>
}

function setup() {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <MesoTervPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// --- The poster (Train Titanium T9 Task 3, mezo-88iwa.10) ---
// The landing IS the running block now: no `Mesociklusok` h1, no `+ Új` chip, no
// library sections. Every number is derived from mocks[0] (meso-hyp-04: week 3 of 6,
// phaseCurve MEV MEV MAV MAV MRV Deload) through logic/mesoBands.ts + wizard/dayTiles.ts,
// never hard-coded against the prototype's illustrative copy.

test('the poster is ONE button carrying its own a11y name, with the block name inside', () => {
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(poster).toHaveTextContent('Hypertrophy 04 · Tavasz')
})

test('the poster leads with the week numeral (3. hét / 6)', () => {
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(poster).toHaveTextContent('3. hét')
  expect(poster).toHaveTextContent('/ 6')
})

test('the phase pill reads the derived phase in the owner\'s words (meso-hyp-04 week 3 = MAV -> Rámpa -> Emelkedés)', () => {
  // The banned-word sweep (T9 fix round 1): `phaseChip`'s own „Rámpa" is itself the
  // banned word, so PHASE_LABEL must translate ALL three phases, not just Deload.
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(poster).toHaveTextContent('Emelkedés')
  expect(poster).not.toHaveTextContent(/rámpa/i)
})

// A REAL deload fixture (T9 fix round 1 — the earlier version of this test rendered
// week 3, MAV, and only asserted "not deload text", which would pass even if the pill
// rendered nothing at all). meso-hyp-04's own shape (id b6f3a0e2…, real-mode handler
// default) at currentWeek 6 lands squarely on its phaseCurve's `Deload` entry.
describe('a Deload week', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('makes the pill POSITIVELY say Pihenőhét — never the engine word', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([
          {
            id: 'b6f3a0e2-0000-4000-8000-000000000001',
            title: 'Hypertrophy 04 · Tavasz',
            shortTitle: 'Hypertrophy 04',
            status: 'active',
            goal: 'Felsőtest hypertrophy · izomtömeg építés',
            startDate: '2026-05-01',
            endDate: '2026-06-12',
            weeks: 6,
            currentWeek: 6,
            split: 'Pull / Push / Legs · 5×/hét',
            style: 'RP · 6 hét',
            phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
            musclePriorities: { back: 'emphasize' },
            volumePerMuscle: {
              chest: {
                mev: 8, mav: 14, mrv: 20, current: 14,
                source: {
                  baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 12, mrv: 18 },
                  adjustments: [],
                  confidence: 0.78,
                },
              },
            },
            days: [
              {
                id: 'a1f3a0e2-0000-4000-8000-000000000010',
                day: 'Csü', type: 'Pull', muscle: 'back+bicep', exerciseCount: 1, current: true,
                exercises: [
                  {
                    id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
                    muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound',
                  },
                ],
              },
            ],
          },
        ]),
      ),
    )
    render(
      <QueryWrapper>
        <MemoryRouter>
          <MesoTervPage />
        </MemoryRouter>
      </QueryWrapper>,
    )
    const poster = await screen.findByRole('button', { name: 'Aktív mezociklus megnyitása' })
    expect(poster).toHaveTextContent('Pihenőhét')
    expect(poster).not.toHaveTextContent(/deload/i)
  })
})

test('the poster carries ONE plain sentence: where you are, what it weighs, when the pihenőhét lands', () => {
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  // set total = sum of runBands(meso).current over its 8 tracked groups
  // (14+16+12+10+10+12+10+12 = 96) — the same math mesoBands.test.ts pins; 5 training
  // days (Szo = volleyball, Vas = rest are off-days); the Deload is week 6 → 3 weeks out.
  expect(poster).toHaveTextContent('A 6 hétből a 3. héten jársz: 96 szett, 5 edzésnapra osztva — 3 hét múlva jön a pihenőhét.')
})

test('the whole-poster tap opens the builder deep-link (the whole-card contract)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04')
})

// --- „A heted" day cards ---

test('every training day is a card with its FULL weekday name and its type', () => {
  // Pinned clock (napszak test-bomb rule): a Saturday, so no fixture training day is 'ma'
  // and the accessible names stay stable every real weekday.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-18T12:00:00'))
  try {
    setup()
    // meso-hyp-04 trains Hét/Kedd/Sze/Csü/Pén; Szo is volleyball, Vas is rest.
    expect(screen.getByRole('button', { name: 'Hétfő · Push' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Szerda · Legs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Péntek · Push · light' })).toBeInTheDocument()
  } finally { vi.useRealTimers() }
})

test('a day card carries its boxed facts (szett / perc / gyakorlat) from dayTileData', () => {
  // Pinned clock, same reason as its two siblings above and below (napszak test-bomb rule):
  // a training day that happens to BE today gets „ · ma" appended to its accessible name, so
  // this `getByRole` failed on real Mondays — and only on Mondays, which is why it survived
  // until one (2026-09-21, found in the visszaöltöztetés close-out, mezo-ju4j6.16). Saturday
  // is not a fixture training day, so every name stays stable.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-18T12:00:00'))
  try {
    setup()
    // Hétfő: 4+3+3+3+3 = 16 working sets, round(16 * 4.4) = 70 perc, 5 exercises.
    const monday = screen.getByRole('button', { name: 'Hétfő · Push' })
    expect(monday).toHaveTextContent('16szett')
    expect(monday).toHaveTextContent('70perc')
    expect(monday).toHaveTextContent('5gyakorlat')
  } finally { vi.useRealTimers() }
})

test('rest and sport days are slim rows, not cards', () => {
  setup()
  expect(screen.queryByRole('button', { name: /^Vasárnap/ })).toBeNull()
  expect(screen.getByText('pihenőnap')).toBeInTheDocument()
  expect(screen.getByText('Volleyball · meccs')).toBeInTheDocument()
})

test('a day card opens that day\'s own page', async () => {
  // Pinned clock (napszak test-bomb rule): a Saturday, so no fixture training day is 'ma'
  // and the accessible names stay stable every real weekday.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-18T12:00:00'))
  try {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Szerda · Legs' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04/days/Sze')
  } finally { vi.useRealTimers() }
})

// --- The MA chip (todayDayToken, mesoDates.ts) ---
describe('the MA chip marks today wherever it lands', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  // U5 (mezo-me75u.5): the marker became the card's state stamp („Ma"), one of the
  // four the week speaks — Megvolt · Részben · Ma · Jön. Same meaning, new vocabulary.
  it('a Thursday puts the Ma stamp on the Csütörtök card (and its a11y name says · ma)', () => {
    vi.setSystemTime(new Date('2026-07-16T12:00:00')) // Thursday
    setup()
    const thursday = screen.getByRole('button', { name: 'Csütörtök · Pull · ma' })
    expect(thursday).toHaveTextContent('Ma')
    expect(screen.getAllByText('Ma')).toHaveLength(1)
  })

  it('a Sunday puts the Ma stamp on the rest ROW — the marker is not card-only', () => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00')) // Sunday
    setup()
    expect(screen.getAllByText('Ma')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Csütörtök · Pull · ma/ })).toBeNull()
  })

  // The three ranks are the point of the redesign: with nothing logged (mock mode has no
  // persisted instances) every training day is honestly „Jön" except today.
  it('mock mode has no done days, so the week reads Ma + Jön and never Megvolt', () => {
    vi.setSystemTime(new Date('2026-07-16T12:00:00')) // Thursday
    setup()
    expect(screen.queryByText('Megvolt')).toBeNull()
    expect(screen.queryByText('Részben')).toBeNull()
    expect(screen.getAllByText('Jön').length).toBeGreaterThan(0)
  })
})

// --- The two dest tiles ---

test('the Melyik izmod hol tart tile carries the rollover forecast and opens the week page', async () => {
  const user = userEvent.setup()
  setup()
  const tile = screen.getByRole('button', { name: 'Melyik izmod hol tart' })
  // nextRolloverChips: the groups that actually climb on Monday (sage tone).
  expect(tile).toHaveTextContent(/izom kap többet hétfőtől|Hétfőtől minden izom tart/)
  await user.click(tile)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04/week')
})

test('the Edzéstervek tile opens the moved library', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzéstervek' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/konyvtar')
})

test('the landing no longer carries the +Új chip — Új blokk lives on the konyvtar page', () => {
  setup()
  expect(screen.queryByRole('button', { name: 'Új' })).toBeNull()
})

// --- The quiet close row → the EXISTING MesoCloseSheet ---

test('the quiet close row opens the shared MesoCloseSheet', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzésterv lezárása' }))
  // The sheet's own heading (MesoCloseSheet, mezo-meyc.2) — the builder's surface, reused.
  expect(await screen.findByRole('heading', { name: 'Futam lezárása' })).toBeInTheDocument()
  expect(screen.getByText(/Hypertrophy 04 · Tavasz futam lezárul/)).toBeInTheDocument()
})

// --- The kalauz anchor must have a home on EVERY state of this page ---

test('the kalauz anchor sits on the dest row, which always renders', () => {
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter>
        <MesoTervPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(container.querySelector('[data-kalauz-anchor="mesociklus-mosaic"]')).not.toBeNull()
})

// Loading skeleton (mezo-f2z; re-shaped T9 fix round 1) — real mode shows the
// layout-aware MesoTervSkeleton (role="status"), which mirrors THIS page's own
// poster → day-rows → dest-tiles anatomy, not the deleted library's page-header/
// card-list shape (`MesocycleSkeleton` — still correct, but now only for
// MesoKonyvtarPage) — while the meso/today queries are unresolved (workoutPending,
// which drives `mesocycles`); mock seeds → no skeleton.
describe('MesoTervPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the meso + today queries are unresolved', async () => {
    // workoutPending = mesoPending || todayPending — both must never resolve.
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/workouts/today`, () => new Promise(() => {})),
    )
    setup()
    const status = await screen.findByRole('status')
    expect(status).toBeInTheDocument()
    // The T5 skeleton-test idiom (TrainTodayPage.test.tsx): read every `.sk` placeholder
    // and check the SHAPE, not just presence — the poster block, the day-card rows, and
    // the dest tiles, in the real page's own document order.
    const sk = Array.from(status.querySelectorAll('.sk')) as HTMLElement[]
    // the poster (`.pl-poster`) — one full-width 285px placeholder, derived in
    // MesoTervSkeleton.tsx next to the real `.pl-poster` CSS it mirrors (285 since the
    // surfaces slice restored the prototype's own `22px 20px 26px` padding, mezo-fsz2r).
    expect(sk.filter((el) => el.style.width === '100%' && el.style.height === '285px')).toHaveLength(1)
    // the day-card rows (`.pl-day`) — 5 reserved 126px placeholders.
    expect(sk.filter((el) => el.style.width === '100%' && el.style.height === '126px')).toHaveLength(5)
    // the two dest tiles (`.pl-dests`/`.pl-dest`) — 115px each.
    expect(sk.filter((el) => el.style.width === '100%' && el.style.height === '115px')).toHaveLength(2)
    // Order matters — poster → day rows → dest tiles, matching the real document order.
    const order = sk
      .map((el) => el.style.height)
      .filter((h) => ['285px', '126px', '115px'].includes(h))
    expect(order).toEqual(['285px', '126px', '126px', '126px', '126px', '126px', '115px', '115px'])
  })
})

describe('MesoTervPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    setup()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// --- No active block: the page says so honestly and keeps the doorway ---

describe('no active block', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders the honest line + the Edzéstervek doorway (and still anchors the kalauz)', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => Response.json([])))
    const { container } = render(
      <QueryWrapper>
        <MemoryRouter>
          <MesoTervPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryWrapper>,
    )
    expect(await screen.findByText(/Még nincs mesociklusod/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edzéstervek' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Melyik izmod hol tart' })).toBeNull()
    expect(container.querySelector('[data-kalauz-anchor="mesociklus-mosaic"]')).not.toBeNull()
  })
})
