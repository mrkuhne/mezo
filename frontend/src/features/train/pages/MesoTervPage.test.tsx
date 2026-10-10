import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
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

// --- The hero (Folyadék F3, mezo-n4wf5.3; prototype vilagos/edzes.js `terv()`) ---
// The landing IS the running plan: no library sections. Every number is derived from mocks[0]
// (meso-hyp-04: week 3 of 6, phaseCurve MEV MEV MAV MAV MRV Deload) through logic/mesoBands.ts +
// the volume arc, never hard-coded against the prototype's illustrative copy.
const hero = () => document.querySelector('.fo-hero') as HTMLElement

test('the hero names the plan and its phase, and says where you are as a verdict', () => {
  setup()
  expect(hero().querySelector('.fo-hero-lbl')).toHaveTextContent('Hypertrophy 04 · Tavasz · Emelkedés')
  expect(hero().querySelector('.fo-hero-verdict')).toHaveTextContent('A 6 hétből a 3. héten jársz.')
})

test('the weeks stand as vessels: past full, this week ringed with done / planned, the pihenőhét hatched', () => {
  setup()
  const tubes = within(hero()).getByRole('group', { name: 'A terv hetei: heti szettszám' })
  const vials = [...tubes.querySelectorAll('.fo-vial')]
  expect(vials).toHaveLength(6)
  expect(vials.map((v) => v.className.replace('fo-vial', '').trim())).toEqual(['', '', 'now', 'ghost', 'ghost', 'ghost hatch'])
  // the arc's per-week totals (mock arc of meso-hyp-04); this week reads „done / planned" — mock mode has
  // no completed instance, so 0 of the week's 88
  expect(vials.map((v) => v.querySelector('b')?.textContent)).toEqual(['60', '74', '0/88', '92', '92', '46'])
  expect(vials[2].querySelector('small')?.textContent).toBe('3. hétmost')
  expect(vials[4].querySelector('small')?.textContent).toBe('5. hétcsúcs')
  expect(vials[5].querySelector('small')?.textContent).toBe('6. hétpihenő')
  expect(hero().querySelector('.ep-ft')).toHaveTextContent('heti szettszám')
  // no progress ring anywhere (bible rule 4)
  expect(document.querySelector('.pl-ring, circle')).toBeNull()
})

test('the phase reads in the owner\'s words (meso-hyp-04 week 3 = MAV -> Emelkedés)', () => {
  setup()
  expect(hero()).toHaveTextContent('Emelkedés')
  expect(hero()).not.toHaveTextContent(/rámpa|MAV/i)
})

// A REAL deload fixture (T9 fix round 1 — the earlier version of this test rendered
// week 3, MAV, and only asserted "not deload text", which would pass even if the pill
// rendered nothing at all). meso-hyp-04's own shape (id b6f3a0e2…, real-mode handler
// default) at currentWeek 6 lands squarely on its phaseCurve's `Deload` entry.
describe('a Deload week', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('makes the hero POSITIVELY say Pihenőhét — never the engine word', async () => {
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
    await screen.findByRole('button', { name: 'A terv oldala' })
    expect(hero().querySelector('.fo-hero-lbl')).toHaveTextContent('Hypertrophy 04 · Tavasz · Pihenőhét')
    expect(hero()).toHaveTextContent('1 edzésnapra osztva — és ez a hét maga a pihenőhét.')
    expect(hero()).not.toHaveTextContent(/deload/i)
  })
})

test('the hero carries ONE support line: what the week weighs and when the pihenőhét lands', () => {
  setup()
  // set total = sum of runBands(meso).current over its 8 tracked groups
  // (14+16+12+10+10+12+10+12 = 96) — the same math mesoBands.test.ts pins; 5 training
  // days (Szo = volleyball, Vas = rest are off-days); the Deload is week 6 → 3 weeks out.
  expect(hero().querySelector('.fo-hero-sub')).toHaveTextContent('96 szett, 5 edzésnapra osztva — 3 hét múlva jön a pihenőhét.')
})

test('the hero\'s one button opens the plan\'s own page', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(within(hero()).getByRole('button', { name: 'A terv oldala' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04')
})

// Before the first workout there is no volume arc: the vessels stand at the plan's own phase curve and carry
// NO numbers (prototype `terv.elso`).
describe('before the first workout', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('draws the plain vessels with the note, and no set counts', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () => new HttpResponse(null, { status: 404 })),
    )
    setup()
    const tubes = await screen.findByRole('group', { name: 'A terv hetei: a terv íve' })
    expect(await screen.findByText('A hetek szettszáma az első edzésed után jelenik meg — addig a terv íve látszik.')).toBeInTheDocument()
    expect(tubes.querySelectorAll('.fo-vial')).toHaveLength(6)
    expect(tubes.querySelectorAll('.fo-vial > b')).toHaveLength(0)
    expect(hero().querySelector('.ep-ft')).toHaveTextContent('a terv íve')
  })
})

// --- „A heted" day cards ---

test('every training day is a button with its FULL weekday name and its type', () => {
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

test('a day row carries its facts (szett / perc / gyakorlat) from dayTileData as one line', () => {
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
    expect(monday).toHaveClass('ep-dc', 'row')
    expect(monday.querySelector('em')?.textContent).toBe('16 szett · ~70 perc · 5 gyakorlat')
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
    // owner decision 2026-10-10: today is the ONE full card — the body, three boxed facts, the muscle chips
    expect(thursday).toHaveClass('ep-dc', 'now')
    expect(document.querySelectorAll('.ep-dc.now')).toHaveLength(1)
    expect(within(thursday).getByRole('img', { name: 'Pull nap — érintett izmok' })).toBeInTheDocument()
    expect([...thursday.querySelectorAll('.f3 i')].map((i) => i.textContent)).toEqual(['16szett', '70perc', '5gyakorlat'])
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

// --- The two doorway rows ---

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

test('the kalauz anchor sits on the Terveid card', () => {
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
    const status = await screen.findByRole('status', { name: 'Betöltés…' })
    // The kit's skeleton in the shape of the page (prototype `terv('tolt')`): the hero vessel, the week
    // list in two blocks, the cards.
    expect(status).toHaveClass('fo-sk')
    expect([...status.querySelectorAll('i')].map((el) => (el as HTMLElement).style.height)).toEqual(['330px', '170px', '170px', '120px'])
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
    expect(await screen.findByText('Még nincs edzésterved.')).toBeInTheDocument()
    expect(screen.getByText('Még nincs edzésterved — itt fognak élni a terveid.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/mesociklus/i)
    await userEvent.click(screen.getByRole('button', { name: 'Edzéstervek' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/konyvtar')
    expect(screen.queryByRole('button', { name: 'Melyik izmod hol tart' })).toBeNull()
    expect(container.querySelector('[data-kalauz-anchor="mesociklus-mosaic"]')).not.toBeNull()
  })
})
