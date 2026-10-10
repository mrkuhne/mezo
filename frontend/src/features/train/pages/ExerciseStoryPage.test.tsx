import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ExerciseStoryPage } from '@/features/train/pages/ExerciseStoryPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The exercise story (Train parity P2 Task 5, mezo-lf3cv; Folyadék look mezo-n4wf5.3) — `/train/exercises/:key`, the
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

/** The exercise's name is the TITLE BAR's since Folyadék (the page hands it over with
 *  `useFrameTitle`); the probe stands in for the bar and prints what the page handed it. */
function TitleProbe() {
  const { title, eyebrow } = useFrame()
  return <div data-testid="frame-title" data-eyebrow={eyebrow}>{title}</div>
}

const renderStory = (key: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/exercises/${key}`]}>
        <FrameProvider>
          <TitleProbe />
          <Routes>
            <Route path="/train/exercises/:key" element={<ExerciseStoryPage />} />
          </Routes>
        </FrameProvider>
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

/** The card under a numbered section heading. */
const section = (container: HTMLElement, heading: string) => {
  const h = Array.from(container.querySelectorAll('.fo-sec')).find((el) => el.querySelector('span')?.textContent === heading)
  return h!.nextElementSibling as HTMLElement
}
const heroOf = (container: HTMLElement) => container.querySelector('.fo-hero') as HTMLElement
const records = (container: HTMLElement) => Array.from(section(container, 'Rekordjaid').querySelectorAll<HTMLElement>('.fo-row'))

// ── the hero ──────────────────────────────────────────────────────────────────────────

test('the hero carries the muscle label and the three real facts; the name goes to the title bar', async () => {
  const { container } = renderStory(ROW)
  expect(await screen.findByText('Chest Supported Row')).toHaveAttribute('data-testid', 'frame-title')
  expect(screen.getByTestId('frame-title')).toHaveAttribute('data-eyebrow', 'Gyakorlatok')
  const hero = heroOf(container)
  expect(hero.querySelector('.fo-hero-lbl')!.textContent).toBe('Hát (közép) · Saját')
  expect(hero.querySelector('.fo-hero-left .ex-mchp')).not.toBeNull()
  // 21 sessions · 6 of them produced an e1RM point. That is an ELIGIBILITY shortfall, not
  // the wire's window (the cap is 52 and the series is nowhere near it), so the middle fact
  // is the absolute date the row actually carries — „az utolsó 6" would be a falsehood: the
  // missing 15 sessions are scattered through the history, not cut off the front.
  // · 182 450 kg → tonnes
  expect(hero.querySelector('.fo-hero-sub')!.textContent)
    .toBe('Ugyanaz a súly, egy ismétléssel több. · 21 alkalom · Ápr 21 óta · 182,4 t összsúly')
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
  expect(heroOf(container).querySelector('.fo-hero-sub')!.textContent).toContain(' · ebből az utolsó 52 látszik · ')
})

test('the hero shows the authorship stamp — the first renderer in the app for it', async () => {
  renderStory(ROW)
  expect(await screen.findByText('Hát (közép) · Saját')).toHaveClass('fo-hero-lbl')
})

test('a row someone ELSE authored is stamped „Közös · {név}"', async () => {
  renderStory(FRESH)
  expect(await screen.findByText(/ · Közös · Anna$/)).toHaveClass('fo-hero-lbl')
})

test('a never-logged exercise gets the prototype’s empty-state prose and NO record cards', async () => {
  const { container } = renderStory(FRESH)
  await screen.findByText('Lateral Raise')
  expect(screen.getByText('Ezzel a gyakorlattal még nincs naplózott alkalmad.')).toHaveClass('fo-hero-verdict')
  expect(screen.getByText('Az első edzés után itt gyűlnek a rekordjaid.')).toBeInTheDocument()
  // the empty vessel instead of a curve, no record rows, no target, no info link
  expect(heroOf(container).querySelector('.fo-ev')).not.toBeNull()
  expect(heroOf(container).querySelector('svg.fo-area')).toBeNull()
  expect(screen.queryByText('Rekordjaid')).toBeNull()
  expect(container.textContent).not.toContain('Következő cél')
  expect(screen.queryByRole('button', { name: /Mit mutat a vonal/ })).toBeNull()
  // the sections renumber: Medáljaid is the first
  expect(Array.from(container.querySelectorAll('.fo-sec')).map((h) => h.textContent)).toEqual(['1Medáljaid', '2Hol szerepel'])
})

test('a bodyweight row says ISMÉTLÉS instead of faking 0 t of volume', async () => {
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  expect(heroOf(container).querySelector('.fo-hero-sub')!.textContent).toBe('6 alkalom · Máj 26 óta · 186 ismétlés')
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
  expect(heroOf(container).querySelector('.fo-hero-sub')!.textContent).toContain('2025. Szep 3 óta')
})

// ── Rekordjaid ────────────────────────────────────────────────────────────────────────

test('the three record rows carry the real figures', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const cards = records(container)
  expect(cards).toHaveLength(3)
  expect(cards.map((c) => c.querySelector('strong')!.textContent)).toEqual(['Becsült 1RM', 'Legjobb szett', 'Legtöbb volumen'])
  expect(cards[0].querySelector('.v')!.textContent).toBe('133,3 kg')
  // where the latest estimate stands against the best one: a level in the row
  expect(cards[0].querySelector('.er-rowbar .fo-level')).not.toBeNull()
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
  expect(records(container).map((c) => c.querySelector('.v')!.textContent)).toEqual(['—', '—', '—'])
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
  const cards = records(container).map((c) => c.querySelector('.v')!)
  expect(cards[0].textContent).toBe('—')
  expect(cards[1].textContent).toBe('35 ismétlés')
})

test('EVERY em-dashed row paints NO level and no caption', async () => {
  // Box Jump has no bestE1rm, no bestSet and no bestSessionVolume — all three cards are an
  // em dash. A full bar under one would paint a record that is not there, and the caption
  // would be captioning nothing (card 3 used to render a bare „—" under its own em dash).
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  const cards = records(container)
  expect(cards).toHaveLength(3)
  for (const card of cards) {
    expect(card.querySelector('.v')!.textContent).toBe('—')
    expect(card.querySelector('.fo-level')).toBeNull()
    expect(card.querySelector('small')).toBeNull()
  }
  expect(section(container, 'Rekordjaid').querySelector('.fo-row')!.textContent).not.toContain('Becslés, nem mérés')
})

test('a best with an EMPTY series gets NO level, not a 100% „you are at your peak"', async () => {
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
  const card = records(container)[0]
  expect(card.querySelector('.v')!.textContent).toBe('133,3 kg')   // the figure is there…
  expect(card.querySelector('.fo-level')).toBeNull()               // …the comparison is not
})

// ── Következő cél ─────────────────────────────────────────────────────────────────────

test('„Következő cél" is DERIVED from the best set and phrased as a target', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  // the hero's verdict IS the target; its note opens the support line
  const hero = heroOf(container)
  expect(hero.querySelector('.fo-hero-verdict')!.textContent).toBe('Következő cél: 102,5 kg × 10.')
  expect(hero.querySelector('.fo-hero-sub')!.textContent).toMatch(/^Ugyanaz a súly, egy ismétléssel több\. · /)
  // never a prediction
  expect(hero.textContent).not.toMatch(/várható|jóslat|előrejelz/i)
})

test('no best set → no target line at all (nothing is invented)', async () => {
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  expect(container.textContent).not.toContain('Következő cél')
  // the verdict falls back to a plain fact of the record itself
  expect(heroOf(container).querySelector('.fo-hero-verdict')!.textContent).toBe('6 naplózott alkalom.')
})

// ── Az erőd íve ───────────────────────────────────────────────────────────────────────

test('the curve is the liquid area of the wire’s series, in the hero, and its label names the gap', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const hero = heroOf(container)
  expect(hero.querySelector('svg.fo-area')).not.toBeNull()
  expect(hero.querySelectorAll('.fo-area-now')).toHaveLength(1)
  // the fixture's series skips 2026-05-05 in a weekly cadence
  expect(within(hero).getByRole('img').getAttribute('aria-label')).toMatch(/1 kihagyott időszakkal/)
  // nothing projected
  expect(hero.querySelector('[stroke-dasharray="3 4"]')).toBeNull()
  expect(screen.getByText('becslés, nem mérés')).toBeInTheDocument()
  expect(hero.querySelector('.fo-big')!.textContent).toMatch(/kg most$/)
})

test('a logged exercise with no series gets the honest empty line, not a flat one', async () => {
  const { container } = renderStory(PLYO)
  await screen.findByText('Box Jump')
  expect(screen.getByText(/még nincs becsülhető maximumod/)).toBeInTheDocument()
  expect(container.querySelector('svg.fo-area')).toBeNull()
})

// ── Medáljaid ─────────────────────────────────────────────────────────────────────────

test('only THIS exercise’s medals are listed', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const rows = Array.from(section(container, 'Medáljaid').querySelectorAll('.er-medal'))
  expect(rows).toHaveLength(1)
  // here the row is titled by the medal's kind, with its date and the beaten record under it
  expect(rows[0].querySelector('strong')!.textContent).toBe('Súly-rekord REKORD')
  expect(rows[0].querySelector('small')!.textContent).toMatch(/^Jún 2Előző: /)
  expect(rows[0].querySelector('.ex-rc')).not.toBeNull()
  expect(rows[0].textContent).toContain('102,5 kg × 9')
  // the fixture's other two medals (Hip Thrust, Leg Press) stay on their own exercises
  expect(container.textContent).not.toContain('Cél teljesítve')
})

test('no medal on this exercise is an honest sentence, not an empty box', async () => {
  const { container } = renderStory(FRESH)
  await screen.findByText('Lateral Raise')
  expect(screen.getByText('Ezen a gyakorlaton még nincs medálod.')).toBeInTheDocument()
  expect(container.querySelector('.er-medal')).toBeNull()
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
  expect(Array.from(container.querySelectorAll('.fo-sec')).some((h) => h.textContent?.includes('Gyakorlat kezelése'))).toBe(false)
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
  // Drawn by the page only where no title bar is mounted (as here); in the app the bar draws it.
  const back = screen.getByRole('button', { name: 'Vissza' })
  expect(back.textContent).toBe('‹ Gyakorlatok')
  expect(back).toHaveClass('er-back')
})

// ── the Folyadék structure (mezo-n4wf5.3, prototype vilagos/edzes.js `exercise()`) ─────

test('folyadék: hero → Rekordjaid → Medáljaid → Hol szerepel → Gyakorlat kezelése, kit rows with their glyphs, no old skin', async () => {
  const { container } = renderStory(ROW)
  await screen.findByText('Chest Supported Row')
  const used = await screen.findByText('A futó tervedben · Csü')
  expect(Array.from(container.querySelectorAll('.fo-sec')).map((h) => h.textContent))
    .toEqual(['1Rekordjaid', '2Medáljaid', '3Hol szerepel', '4Gyakorlat kezelése'])
  const icon = (el: Element) => el.querySelector('use')?.getAttribute('href')
  expect(records(container).map(icon)).toEqual(['#t-ring', '#t-weight', '#t-protocol'])
  expect(icon(used.closest('button')!)).toBe('#t-peak')
  expect(icon(screen.getByText('Sablon a polcodon').closest('button')!)).toBe('#t-stack')
  expect(icon(screen.getByText('Szerkesztés').closest('button')!)).toBe('#t-note')
  expect(icon(screen.getByText('Demó videó').closest('button')!)).toBe('#t-camera')
  // every row lives in a white card; glass, halo and the Titanium classes are gone
  for (const row of Array.from(container.querySelectorAll('.fo-row'))) expect(row.closest('.fo-card')).not.toBeNull()
  expect(container.querySelector('.glass, [class*="gyx-"], [class*="gy-rec"], [class*="gy-curve"], [class*="uv-"], .pl-h3, .pl-row')).toBeNull()
  // removed as invented: no technique sheet, no alternatives
  expect(container.textContent).not.toMatch(/Technika|Alternatív/i)
})

test('an unknown key is a ghost, not a blank screen', async () => {
  renderStory('nincs-ilyen')
  expect(await screen.findByText('Ez a gyakorlat nincs a tárban.')).toBeInTheDocument()
})

// ── the explain layer (mezo-b516k, Task 2) ────────────────────────────────────────────
// A text link in the card / on the hero's liquid row, the copy word for word. The aria-label
// is `"<title> — mit jelent?"`.

test('„Mi számít rekordnak?" under the record rows explains what counts as a record, word for word', async () => {
  const user = userEvent.setup()
  const { container } = renderStory(ROW)
  const btn = await screen.findByRole('button', { name: 'Mi számít rekordnak? — mit jelent?' })
  expect(section(container, 'Rekordjaid')).toContainElement(btn)
  expect(btn).toHaveTextContent('Mi számít rekordnak?')
  await user.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Mi számít rekordnak?' })).getByText(
      'A legjobb szett a legnagyobb súly a hozzá tartozó ismétléssel. A becsült maximum egy képletből jön a szettjeidből — becslés, nem mérés. A volumen egy alkalom összes megmozgatott súlya.',
    ),
  ).toBeInTheDocument()
})

test('„Mit mutat a vonal?" on the hero explains the strength curve — and promises nothing the curve does not draw', async () => {
  const user = userEvent.setup()
  const { container } = renderStory(ROW)
  const btn = await screen.findByRole('button', { name: 'Mit mutat a vonal? — mit jelent?' })
  expect(container.querySelector('.fo-hero-acts')).toContainElement(btn)
  await user.click(btn)
  const dialog = screen.getByRole('dialog', { name: 'Mit mutat a vonal?' })
  expect(
    within(dialog).getByText('A becsült egyismétléses maximumod alakulása alkalomról alkalomra. Becslés, nem mérés.'),
  ).toBeInTheDocument()
  // no projected branch exists, and the area does not break — the copy claims neither
  expect(dialog.textContent).not.toMatch(/szaggatott|várakozás|megszakad/)
})
