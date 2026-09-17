import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ExerciseStoryPage } from '@/features/train/pages/ExerciseStoryPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The exercise story (Train parity P2 Task 5, mezo-lf3cv) — `/train/exercises/:key`, the
// route Task 4's catalogue cards were already pointing at. Real-mode view throughout:
// the MSW fixtures carry a logged, catalog-linked, VIEWER-AUTHORED row (Chest Supported
// Row, with an e1RM series that has a hole in it), a never-logged row authored by someone
// else (Lateral Raise · „Közös · Anna", read-only), and a bodyweight row (Box Jump).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

const ROW = 'f1e3a0e2-0000-4000-8000-000000000070' // Chest Supported Row — logged
const FRESH = 'f1e3a0e2-0000-4000-8000-000000000073' // Lateral Raise — never logged
const PLYO = 'f1e3a0e2-0000-4000-8000-000000000072' // Box Jump — logged, bodyweight

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

const renderStory = (key: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/exercises/${key}`]}>
        <Routes>
          <Route path="/train/exercises/:key" element={<ExerciseStoryPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

const section = (container: HTMLElement, heading: string) => {
  const h = Array.from(container.querySelectorAll('.pl-h3')).find((el) => el.textContent?.startsWith(heading))
  return h!.nextElementSibling as HTMLElement
}

// ── the hero ──────────────────────────────────────────────────────────────────────────

test('the hero carries the muscle eyebrow, the name and the three real foot facts', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const hero = container.querySelector('.pl-dhero.gy-hero') as HTMLElement
  expect(within(hero).getByText('Hát (közép)')).toBeInTheDocument()
  // 21 sessions · 6 of them produced an e1RM point. That is an ELIGIBILITY shortfall, not
  // the wire's window (the cap is 52 and the series is nowhere near it), so the middle fact
  // is the absolute date the row actually carries — „az utolsó 6" would be a falsehood: the
  // missing 15 sessions are scattered through the history, not cut off the front.
  // · 182 450 kg → tonnes
  expect(hero.querySelector('.pl-poster-foot')!.textContent).toBe('21 alkalomÁpr 21 óta182,4 t összsúly')
})

test('a series the wire actually CAPPED says „ebből az utolsó N látszik", not an „óta" date', async () => {
  // 61 sessions and a FULL 52-point series: the server did drop the oldest points, so the
  // oldest date the row carries is the WINDOW's start and must not be passed off as a start.
  const capped = Array.from({ length: 52 }, (_, i) => ({
    date: new Date(Date.UTC(2025, 8, 3 + i * 7)).toISOString().slice(0, 10),
    e1rm: 100 + i * 0.4,
  }))
  server.use(
    http.get(`${API_BASE}/api/train/exercise-records`, () =>
      HttpResponse.json([{
        catalogId: ROW, name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
        totalVolume: 231800, totalSets: 305, totalReps: 2440, sessionCount: 61,
        repRecords: [], recentTopSets: [], e1rmSeries: capped,
      }])),
  )
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  expect(container.querySelector('.pl-poster-foot')!.textContent).toContain('ebből az utolsó 52 látszik')
})

test('the hero shows the authorship stamp — the first renderer in the app for it', async () => {
  renderStory(ROW)
  expect(await screen.findByText('Saját')).toBeInTheDocument()
})

test('a row someone ELSE authored is stamped „Közös · {név}"', async () => {
  renderStory(FRESH)
  expect(await screen.findByText('Közös · Anna')).toBeInTheDocument()
})

test('a never-logged exercise gets the prototype’s empty-state prose and NO record cards', async () => {
  const { container } = renderStory(FRESH)
  await screen.findByText('Lateral Raise')
  expect(screen.getByText(/Ezzel a gyakorlattal még nincs naplózott alkalmad/)).toBeInTheDocument()
  expect(container.querySelector('.gy-rec')).toBeNull()
  expect(container.querySelector('.gy-next')).toBeNull()
  expect(screen.queryByText('Az erőd íve')).toBeNull()
})

test('a bodyweight row says ISMÉTLÉS instead of faking 0 t of volume', async () => {
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  expect(container.querySelector('.pl-poster-foot')!.textContent).toBe('6 alkalomMáj 26 óta186 ismétlés')
})

test('a series that covers every session keeps the absolute „óta" date — with its YEAR', async () => {
  // sessionCount === the point count, so the oldest point really is the first session; and
  // that point is a year old, which „Szep 3" alone would read as a fortnight ago.
  server.use(
    http.get(`${API_BASE}/api/train/exercise-records`, () =>
      HttpResponse.json([{
        catalogId: ROW, name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
        totalVolume: 12000, totalSets: 9, totalReps: 90, sessionCount: 3,
        repRecords: [], recentTopSets: [],
        e1rmSeries: [
          { date: '2025-09-03', e1rm: 100 },
          { date: '2026-03-03', e1rm: 110 },
          { date: '2026-09-01', e1rm: 120 },
        ],
      }])),
  )
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  expect(container.querySelector('.pl-poster-foot')!.textContent).toContain('2025. Szep 3 óta')
})

// ── Rekordjaid ────────────────────────────────────────────────────────────────────────

test('the three record cards carry the real figures', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const cards = Array.from(container.querySelectorAll('.gy-rec'))
  expect(cards).toHaveLength(3)
  expect(cards[0].textContent).toContain('133,3')
  // the record estimate beat the best estimate that stood before the session that set it
  expect(cards[0].textContent).toContain('+2,1 kg a korábbi csúcsod óta')
  expect(cards[0].textContent).toContain('Becslés, nem mérés')
  expect(cards[1].textContent).toContain('102,5')
  expect(cards[1].textContent).toContain('kg × 9')
  expect(cards[1].textContent).toContain('Jún 2')
  expect(cards[2].textContent).toContain('4 920')
  expect(cards[2].textContent).toContain('Máj 26 a csúcs')
})

test('an absent figure is an EM DASH, never a 0', async () => {
  // Box Jump: no bestSet, no bestE1rm, no bestSessionVolume — a logged plyo row.
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  const cards = Array.from(container.querySelectorAll('.gy-rec strong'))
  expect(cards.map((c) => c.textContent)).toEqual(['—', '—', '—'])
  expect(container.textContent).not.toContain('0 kg')
})

test('a live-backend bodyweight record (weightKg 0) is an em dash on the 1RM card too', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercises`, () =>
      HttpResponse.json([
        { id: ROW, slug: 'dead-hang', name: 'Dead Hang', muscle: 'back-wide', type: 'plyo', stim: 0.5, fatigue: 0.3, editable: false, mediaEditable: false, authoredByMe: false, authorName: null },
      ])),
    http.get(`${API_BASE}/api/train/exercise-records`, () =>
      HttpResponse.json([{
        catalogId: ROW, name: 'Dead Hang', muscle: 'back-wide', type: 'plyo',
        bestSet: { weightKg: 0, reps: 35, date: '2026-06-02' },
        bestE1rm: { value: 0, set: { weightKg: 0, reps: 35, date: '2026-06-02' } },
        totalVolume: 0, totalSets: 2, totalReps: 65, sessionCount: 1,
        repRecords: [], recentTopSets: [],
      }])),
  )
  const { container } = renderStory(ROW)
  await screen.findByText('Dead Hang')
  const cards = Array.from(container.querySelectorAll('.gy-rec strong'))
  expect(cards[0].textContent).toBe('—')
  expect(cards[1].textContent).toBe('35 ismétlés')
})

test('EVERY em-dashed card paints NO rail, no fill and no caption', async () => {
  // Box Jump has no bestE1rm, no bestSet and no bestSessionVolume — all three cards are an
  // em dash. A full bar under one would paint a record that is not there, and the caption
  // would be captioning nothing (card 3 used to render a bare „—" under its own em dash).
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  const cards = Array.from(container.querySelectorAll('.gy-rec'))
  expect(cards).toHaveLength(3)
  for (const card of cards) {
    expect(card.querySelector('strong')!.textContent).toBe('—')
    expect(card.querySelector('.gy-rec-bar')).toBeNull()
    expect(card.querySelector('.gy-rec-bar b')).toBeNull()
    expect(card.querySelector('small')).toBeNull()
  }
  expect(container.querySelector('.gy-recs')!.textContent).not.toContain('Becslés, nem mérés')
})

test('a best with an EMPTY series gets an unfilled rail, not a 100% „you are at your peak"', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercise-records`, () =>
      HttpResponse.json([{
        catalogId: ROW, name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
        bestE1rm: { value: 133.3, set: { weightKg: 102.5, reps: 9, date: '2026-06-02' } },
        totalVolume: 4000, totalSets: 8, totalReps: 60, sessionCount: 2,
        repRecords: [], recentTopSets: [],
      }])),
  )
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const card = container.querySelectorAll('.gy-rec')[0]
  expect(card.textContent).toContain('133,3')
  expect(card.querySelector('.gy-rec-bar')).not.toBeNull()   // the figure is there…
  expect(card.querySelector('.gy-rec-bar b')).toBeNull()      // …the comparison is not
})

// ── Következő cél ─────────────────────────────────────────────────────────────────────

test('„Következő cél" is DERIVED from the best set and phrased as a target', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const next = container.querySelector('.gy-next')!
  expect(next.textContent).toContain('Következő cél: 102,5 kg × 10')
  expect(next.textContent).toContain('ugyanaz a súly, egy ismétléssel több')
  // never a prediction
  expect(next.textContent).not.toMatch(/várható|jóslat|előrejelz/i)
})

test('no best set → no target line at all (nothing is invented)', async () => {
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  expect(container.querySelector('.gy-next')).toBeNull()
})

// ── Az erőd íve ───────────────────────────────────────────────────────────────────────

test('the curve draws the wire’s series and BREAKS at its gap', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  // the fixture's series skips 2026-05-05 in a weekly cadence
  expect(container.querySelectorAll('polyline.gy-curve-was')).toHaveLength(2)
  expect(container.querySelector('.gy-curve-will')).toBeNull()
  expect(screen.getByText('becslés, nem mérés')).toBeInTheDocument()
})

test('a logged exercise with no series gets the honest empty line, not a flat one', async () => {
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  expect(screen.getByText(/még nincs becsülhető maximumod/)).toBeInTheDocument()
  expect(container.querySelector('polyline')).toBeNull()
})

// ── Medáljaid ─────────────────────────────────────────────────────────────────────────

test('only THIS exercise’s medals are listed', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const rows = Array.from(section(container, 'Medáljaid').querySelectorAll('.gy-medal'))
  expect(rows).toHaveLength(1)
  expect(rows[0].textContent).toContain('Súly-rekord')
  expect(rows[0].textContent).toContain('102,5 kg × 9')
  // the fixture's other two medals (Hip Thrust, Leg Press) stay on their own exercises
  expect(container.textContent).not.toContain('Cél teljesítve')
})

test('no medal on this exercise is an honest sentence, not an empty box', async () => {
  const { container } = renderStory(FRESH)
  await screen.findByText('Lateral Raise')
  expect(screen.getByText('Ezen a gyakorlaton még nincs medálod.')).toBeInTheDocument()
  expect(container.querySelector('.gy-medal')).toBeNull()
})

// ── Hol szerepel ──────────────────────────────────────────────────────────────────────

test('„Hol szerepel" lists the running plan’s day and the shelf’s template, each a door', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const used = await screen.findByText('A futó tervedben · Csü')
  expect(used).toBeInTheDocument()
  expect(screen.getByText('Sablon a polcodon')).toBeInTheDocument()

  await userEvent.click(within(section(container, 'Hol szerepel')).getByText('Pull').closest('button')!)
  expect(screen.getByTestId('loc').textContent).toBe('/train/mesocycles/b6f3a0e2-0000-4000-8000-000000000001/days/Cs%C3%BC')
})

test('a template row routes to the template’s own page', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  await screen.findByText('Sablon a polcodon')
  await userEvent.click(within(section(container, 'Hol szerepel')).getByText('Hypertrophy 04 · Tavasz').closest('button')!)
  expect(screen.getByTestId('loc').textContent).toBe('/train/templates/a10e0000-0000-4000-8000-000000000000')
})

test('an exercise no plan mentions says so', async () => {
  renderStory(FRESH)
  await screen.findByText('Lateral Raise')
  expect(await screen.findByText('Ez a gyakorlat most egyetlen tervedben és sablonodban sem szerepel.')).toBeInTheDocument()
})

// ── the three rescued capabilities ────────────────────────────────────────────────────

test('an editable row offers edit/delete — the CatalogExerciseSheet in EDIT mode', async () => {
  renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  await userEvent.click(screen.getByText('Szerkesztés').closest('button')!)
  // the sheet seeds from the row it edits and hosts the destructive path
  expect(await screen.findByDisplayValue('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlat törlése' })).toBeInTheDocument()
})

test('a media-editable row offers the demo-video sheet, and says whether one is attached', async () => {
  renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  expect(screen.getByText('Csere vagy eltávolítás')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Demó videó').closest('button')!)
  expect(await screen.findByDisplayValue('https://youtu.be/GZTvxN5fPBc')).toBeInTheDocument()
})

test('a row the viewer may NOT author offers neither — no affordance that would 403', async () => {
  const { container } = renderStory(FRESH)
  await screen.findByText('Lateral Raise')
  expect(screen.queryByText('Szerkesztés')).toBeNull()
  expect(screen.queryByText('Demó videó')).toBeNull()
  expect(Array.from(container.querySelectorAll('.pl-h3')).some((h) => h.textContent === 'Gyakorlat kezelése')).toBe(false)
})

test('a media-only row offers the video but not the edit', async () => {
  // Box Jump: editable false, mediaEditable true, no video yet.
  renderStory(PLYO)
  await screen.findByText('Box Jump')
  expect(screen.queryByText('Szerkesztés')).toBeNull()
  expect(screen.getByText('Még nincs videó — tegyél fel egyet')).toBeInTheDocument()
})

// ── the frame ─────────────────────────────────────────────────────────────────────────

test('the back pill says ‹ Gyakorlatok', async () => {
  renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  expect(screen.getByRole('button', { name: 'Vissza' }).textContent).toBe('‹ Gyakorlatok')
})

test('an unknown key is a ghost, not a blank screen', async () => {
  renderStory('nincs-ilyen')
  expect(await screen.findByText('Ez a gyakorlat nincs a tárban.')).toBeInTheDocument()
})
