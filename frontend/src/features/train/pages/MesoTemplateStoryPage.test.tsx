// ============================================================
// Mezo · MesoTemplateStoryPage tests — one template, read-first, at /train/templates/:id
// (Train Titanium T10 Task 3, mezo-88iwa.11; Folyadék look mezo-n4wf5.3).
//
// Fixtures (data/train/train.ts): b20f… „Upper/Lower Power" — 5 weeks, 4 training days
// (Sze/Szo/Vas rest), never run; a10e… „Hypertrophy 04 · Tavasz" — the active run
// meso-hyp-04 carries its templateId, so its runs list has a live row.
// ============================================================
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoTemplateStoryPage } from '@/features/train/pages/MesoTemplateStoryPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const POWER = 'b20f0000-0000-4000-8000-000000000000'
const HYP = 'a10e0000-0000-4000-8000-000000000000'

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

/** The template's name is the TITLE BAR's since Folyadék (`useFrameTitle`); the probe stands in
 *  for the bar and prints what the page handed it. */
function TitleProbe() {
  const { title, eyebrow } = useFrame()
  return <div data-testid="frame-title" data-eyebrow={eyebrow}>{title}</div>
}

function setup(id: string = POWER) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/templates/${id}`]}>
        <FrameProvider>
          <TitleProbe />
          <Routes>
            <Route path="/train/templates/:id" element={<MesoTemplateStoryPage />} />
            <Route path="*" element={null} />
          </Routes>
        </FrameProvider>
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** The card under a numbered section heading. */
const section = (container: HTMLElement, heading: string) => {
  const h = [...container.querySelectorAll('.fo-sec')].find((el) => el.querySelector('span')?.textContent === heading)
  return h!.nextElementSibling as HTMLElement
}

describe('MesoTemplateStoryPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  // --- the hero ---------------------------------------------------------------

  test('the hero carries the split label, weeks × days as its verdict, and the muscles; the name goes to the title bar', () => {
    const { container } = setup()
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Upper/Lower Power')
    expect(screen.getByTestId('frame-title')).toHaveAttribute('data-eyebrow', 'Sablonjaid')
    expect(screen.getByText('Sablon · Upper / Lower')).toHaveClass('fo-hero-lbl')
    expect(screen.getByText('5 hét, hetente 4 edzésnap.')).toHaveClass('fo-hero-verdict')
    const hero = container.querySelector('.fo-hero')!
    // the top muscles as chips with their names (at most five)
    const chips = hero.querySelectorAll('.fo-tags .ex-mchp')
    expect(chips.length).toBeGreaterThan(3)
    expect(chips.length).toBeLessThanOrEqual(5)
    expect(hero).toHaveTextContent('8 izomcsoport')
    expect(hero.textContent).toMatch(/~\d+ perc egy edzés/)
  })

  test('the hero draws the week as seven tubes: a training day filled to its sets, an off day hatched with the moon', () => {
    const { container } = setup()
    const tubes = [...container.querySelectorAll('.fo-hero .fo-tubes .fo-vial')]
    expect(tubes.map((t) => t.querySelector('small')!.textContent)).toEqual(['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'])
    expect(tubes.map((t) => t.classList.contains('hatch'))).toEqual([false, false, true, false, false, true, true])
    // Monday: 4 + 4 + 3 working sets; a rest day reads „–" and holds no liquid
    expect(tubes[0].querySelector('b')!.textContent).toBe('11')
    expect(tubes[0].querySelector('.fo-tube em')!.textContent).toBe('Upper')
    expect(tubes[2].querySelector('b')!.textContent).toBe('–')
    expect(tubes[2].querySelector('.fo-tube .l')).toBeNull()
    expect(tubes[2].querySelector('use')!.getAttribute('href')).toBe('#t-moon')
  })

  test('the old-model mark follows isLegacyPlan, not a guess', () => {
    // POWER carries `goalPreset: 'strength'` — a preset that is present and not hypertrophy,
    // which is exactly what isLegacyPlan calls the old model; the retired MesoTemplateCard
    // marked this same template, so the signal survives its deletion.
    setup(POWER)
    expect(screen.getByTestId('template-legacy')).toHaveTextContent('régi modell')
  })

  test('a current-model sablon carries no old-model mark', () => {
    // HYP is hypertrophy-preset with a Deload-closed curve — nothing to flag, nothing shown.
    setup(HYP)
    expect(screen.queryByTestId('template-legacy')).toBeNull()
  })

  test('the back pill returns to Sablonjaid', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/templates')
  })

  // --- „A hét felépítése" ------------------------------------------------------

  test('every training day is a card that spells out EVERY exercise of the fixture', () => {
    const { container } = setup()
    expect(screen.getByText('A hét felépítése')).toBeInTheDocument()
    const cards = [...container.querySelectorAll('.er-tday:not(.muted)')]
    expect(cards).toHaveLength(4) // Hét · Kedd · Csü · Pén
    // the whole week sits in ONE card under section 1
    expect(new Set(cards.map((c) => c.closest('.fo-card'))).size).toBe(1)
    expect(section(container, 'A hét felépítése')).toContainElement(cards[0] as HTMLElement)

    const byDay = Object.fromEntries(cards.map((c) => [c.querySelector('.dh b')!.textContent!.split(' · ')[0], c]))
    expect(byDay['Hét']!.querySelector('.dh b')).toHaveTextContent('Hét · Upper A')
    // the day's facts in one line
    expect(byDay['Hét']!.querySelector('.dh span')!.textContent).toMatch(/^3 gyakorlat · 11 szett · ~\d+ perc$/)
    // all three exercises of the Monday fixture, with their szett×ismétlés targets
    const monday = [...byDay['Hét']!.querySelectorAll('.ex')].map((e) => e.textContent)
    expect(monday).toHaveLength(3)
    expect(monday[0]).toContain('Barbell Bench Press')
    expect(monday[0]).toContain('4×5–7')
    expect(monday[1]).toContain('Chest Supported Row')
    expect(monday[1]).toContain('4×6–8')
    expect(monday[2]).toContain('Overhead Press')
    expect(monday[2]).toContain('3×6–8')
    // no anchorWeightKg field at all on the fixture row → the missing-value dash, never
    // a bodyweight guess (mezo-88iwa.11 fix round: this used to read "saját testsúly")
    expect(monday[0]).toContain('—')
    expect(monday[0]).not.toContain('saját testsúly')
    // anchorWeightKg: 0 → the real bodyweight words
    expect(monday[1]).toContain('saját testsúly')
    // anchorWeightKg: 42.5 → the formatted kg value
    expect(monday[2]).toContain('42,5 kg')
    // the whole week's exercises, spelled out: 3 + 3 + 3 + 3
    expect(container.querySelectorAll('.er-tday .ex')).toHaveLength(12)
    // each exercise line leads with its muscle chip
    expect(container.querySelectorAll('.er-tday .ex .ex-mchp')).toHaveLength(12)
  })

  test('rest days stay visible as quiet rows — a week is also its off days', () => {
    const { container } = setup()
    const quiet = [...container.querySelectorAll('.er-tday.muted')]
      .map((r) => r.textContent)
      .filter((t) => t?.includes('Pihenő'))
    expect(quiet).toHaveLength(3) // Sze · Szo · Vas
    expect(quiet[0]).toContain('Sze')
  })

  // --- the hero's graphic is the week, not a body map (Folyadék, mezo-n4wf5.3) ---

  test('the hero no longer carries the body map — the old skin is gone from the page', () => {
    const { container } = setup()
    expect(container.querySelector('.body-map, [class*="pl-l"], [class*="pl-d"], .pl-row, .glass, .mz-play')).toBeNull()
    expect(screen.queryByRole('img', { name: /érintett izmok/ })).toBeNull()
    expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual([
      '1A hét felépítése', '2Heti szettek izmonként', '3Futamok ebből a sablonból', '4A sablon kezelése',
    ])
  })

  // --- the week-sets explainer (fix round 1, mezo-88iwa.11; moved behind the ⓘ in
  //     mezo-b516k Task 2 — the prototype keeps it there, and printing it here as well
  //     would say the same sentence twice on one screen) --------------------------

  test('the week-sets explainer restates the rule in plain Hungarian, behind the ⓘ', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Mit jelent a szám? — mit jelent?' }))
    expect(
      screen.getByText(
        'Ennyi munkaszettet kap az izom egy héten, ha ebből a sablonból indítasz. A futam első hete indul ennyivel — onnan hétről hétre emelkedhet.',
      ),
    ).toBeInTheDocument()
  })

  // --- „Heti szettek izmonként" ------------------------------------------------

  test('the weekly load bars carry the summed sets per muscle, biggest first', () => {
    const { container } = setup()
    expect(screen.getByText('Heti szettek izmonként')).toBeInTheDocument()
    const rows = [...section(container, 'Heti szettek izmonként').querySelectorAll('.ex-mus')].map((r) => ({
      label: r.querySelector('.l')!.textContent,
      sets: r.querySelector('.v')!.textContent!.replace(' szett', ''),
      width: (r.querySelector('.fo-level i') as HTMLElement).style.width,
    }))
    // three muscles tie at 7 (the week's biggest → full levels), alphabetically by group
    expect(rows[0]).toEqual({ label: 'Hát', sets: '7', width: '100%' })    // row 4 + pulldown 3
    expect(rows[1]).toEqual({ label: 'Mell', sets: '7', width: '100%' })   // bench 4 + incline DB 3
    expect(rows[2]).toEqual({ label: 'Comb', sets: '7', width: '100%' })   // squat 4 + leg press 3
    // every row leads with the muscle chip
    expect(section(container, 'Heti szettek izmonként').querySelectorAll('.ex-mus .ex-mchp')).toHaveLength(rows.length)
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.sets]))
    expect(byLabel['Vádli']).toBe('6')  // 3 + 3
    expect(byLabel['Váll']).toBe('3')
    expect(byLabel['Farizom']).toBe('4')
    expect(byLabel['Hamstring']).toBe('3')
    expect(byLabel['Bicepsz']).toBe('3')
  })

  // --- „Futamok ebből a sablonból" ---------------------------------------------

  test('a template nothing ever ran from says so in one line', () => {
    setup()
    expect(screen.getByText('Futamok ebből a sablonból')).toBeInTheDocument()
    expect(screen.getByText('Még nem indult futam ebből.')).toBeInTheDocument()
  })

  test('the running run is a row that opens the Terv landing', async () => {
    const user = userEvent.setup()
    setup(HYP)
    const row = screen.getByRole('button', { name: 'Most fut · Hypertrophy 04 · Tavasz' })
    expect(row).toHaveTextContent('Most fut — 3. hét a 6-ból')
    // the run's weeks as capsules: two done, the third half
    const caps = [...row.querySelectorAll('.fo-caps i')]
    expect(caps.map((c) => c.className)).toEqual(['f', 'f', 'h', '', '', ''])
    await user.click(row)
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles')
  })

  test('a closed run from this template opens its frozen report', async () => {
    const user = userEvent.setup()
    // No fixture closed run carries a templateId, so serve a small real-mode pair instead:
    // one archived run stamped with this template's id.
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([{
          id: POWER, title: 'Erő blokk', shortTitle: null, goal: null, weeks: 6,
          split: 'Upper / Lower · 4×/hét', style: null, phaseCurve: [], notes: null,
          volumePerMuscle: null, days: [], runCount: 1,
        }]),
      ),
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([{
          id: 'meso-closed-1', title: 'Erő blokk · Tél', shortTitle: 'Erő blokk',
          status: 'archived', goal: '', startDate: '2026-01-05', endDate: '2026-02-16',
          weeks: 6, currentWeek: 6, split: 'Upper / Lower · 4×/hét', style: 'Linear · 6 hét',
          phaseCurve: [], templateId: POWER, closedAt: '2026-02-16T18:00:00Z', hasReport: true,
        }]),
      ),
    )
    setup()
    const row = await screen.findByRole('button', { name: 'Lezárt futam · Erő blokk · Tél' })
    await user.click(row)
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-closed-1/report')
  })

  // --- the CTAs ----------------------------------------------------------------

  test('„Futam indítása ebből" opens the ONE shared start sheet', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Futam indítása ebből' }))
    expect(await screen.findByRole('heading', { name: 'Mikor kezdjük?' })).toBeInTheDocument()
    // the sheet names the template it will stamp a run from (the title bar says it too)
    expect(screen.getAllByText('Upper/Lower Power').length).toBeGreaterThan(1)
    // the button stands on the hero's liquid row, with its promise under it
    expect(document.querySelector('.fo-hero-acts')).toContainElement(screen.getByRole('button', { name: 'Futam indítása ebből' }))
    expect(screen.getByText('A sablon marad, a terv a tiéd lesz')).toBeInTheDocument()
  })

  test('„Szerkesztés" opens the raw day-plan editor', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    expect(screen.getByTestId('loc')).toHaveTextContent(`/train/mesocycles/templates/${POWER}`)
  })

  test('the lifecycle pair survived the reface: a copy lands in its own editor', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Másolat készítése' }))
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toMatch(/^\/train\/mesocycles\/templates\/.+/),
    )
    expect(screen.getByTestId('loc').textContent).not.toContain(POWER)
  })

  test('Törlés is a two-tap confirm — the first tap only arms it', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Sablon törlése/ }))
    expect(screen.getByText('Biztos? Törlés')).toBeInTheDocument()
    expect(screen.getByTestId('loc')).toHaveTextContent(`/train/templates/${POWER}`)

    await user.click(screen.getByRole('button', { name: /Biztos\? Törlés/ }))
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/train/templates'))
  })

  test('the armed Törlés carries destructive tone and a Mégsem escape that disarms it', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Sablon törlése/ }))
    // inline two-step confirm: the same row, now asking, in the destructive tone
    expect(screen.getByText('Biztos? Törlés')).toHaveClass('er-bad')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Mégsem' }))
    expect(screen.queryByText('Biztos? Törlés')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mégsem' })).toBeNull()
    expect(screen.getByText('Sablon törlése')).toBeInTheDocument()
    // Mégsem never fires the delete — still on the template's own page.
    expect(screen.getByTestId('loc')).toHaveTextContent(`/train/templates/${POWER}`)
  })

  test('arming Törlés then tapping anything else on the page disarms it too', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Sablon törlése/ }))
    expect(screen.getByText('Biztos? Törlés')).toBeInTheDocument()

    // A tap on an unrelated, inert part of the page — not the armed row itself.
    await user.click(screen.getByText('Heti szettek izmonként'))
    expect(screen.queryByText('Biztos? Törlés')).toBeNull()
    expect(screen.getByText('Sablon törlése')).toBeInTheDocument()
  })

  // --- a dead link --------------------------------------------------------------

  test('an unknown template id is an honest not-found, not an empty page', () => {
    setup('nincs-ilyen-sablon')
    expect(screen.getByText('Ez a sablon nem található.').closest('.fo-ev')).not.toBeNull()
    expect(screen.queryByText('A hét felépítése')).toBeNull()
  })
})

describe('MesoTemplateStoryPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('shows a skeleton while the template list is unresolved — never a dead-link claim', async () => {
    server.use(http.get(`${API_BASE}/api/train/meso-templates`, () => new Promise(() => {})))
    setup()
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Ez a sablon nem található.')).toBeNull()
  })

  it('a resolved list without this template IS the dead link', async () => {
    server.use(http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([])))
    setup()
    expect(await screen.findByText('Ez a sablon nem található.')).toBeInTheDocument()
  })

  // --- honest empty training day (fix round 1, mezo-88iwa.11) ------------------

  it('a TRAINING day with no exercises yet is its own honest row, never „Pihenő"', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([{
          id: POWER, title: 'Upper/Lower Power', shortTitle: 'Power Block', goal: null,
          goalPreset: null, musclePriorities: null, weeks: 5,
          split: 'Upper / Lower · 4×/hét', style: null, phaseCurve: [], notes: null,
          volumePerMuscle: null, runCount: 0,
          days: [
            {
              day: 'Csü', type: 'Pull', muscle: 'back+bicep', exerciseCount: 1,
              exercises: [{
                id: 'p1', name: 'Chest Supported Row', muscle: 'back-mid',
                warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound',
              }],
            },
            // A training day, planned but not yet filled in — honest, not a rest day.
            { day: 'Pén', type: 'Push', muscle: 'chest+tricep', exerciseCount: 0, exercises: [] },
            { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
          ],
        }]),
      ),
    )
    setup()
    // the hero's edzésnap count still matches trainingDayCount — Csü + Pén, not Vas
    expect(await screen.findByText('5 hét, hetente 2 edzésnap.')).toBeInTheDocument()

    const emptyDayRow = screen.getByText('Push · még nincs gyakorlat').closest('.er-tday')!
    expect(emptyDayRow).toHaveClass('muted')
    expect(emptyDayRow).not.toHaveTextContent('Pihenő')

    const restRow = screen.getByText('Pihenő').closest('.er-tday')!
    expect(restRow).toHaveTextContent('Vas')
  })

  // --- in-flight guards (fix round 1, mezo-88iwa.11) ----------------------------

  it('Másolat and the armed Törlés both disable while their own mutation is in flight', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([{
          id: POWER, title: 'Upper/Lower Power', shortTitle: 'Power Block', goal: null,
          goalPreset: null, musclePriorities: null, weeks: 5,
          split: 'Upper / Lower · 4×/hét', style: null, phaseCurve: [], notes: null,
          volumePerMuscle: null, runCount: 0, days: [],
        }]),
      ),
      http.post(`${API_BASE}/api/train/meso-templates`, () => new Promise(() => {})),
      http.delete(`${API_BASE}/api/train/meso-templates/:id`, () => new Promise(() => {})),
    )
    setup()

    const duplicateBtn = await screen.findByRole('button', { name: 'Másolat készítése' })
    await user.click(duplicateBtn)
    await waitFor(() => expect(duplicateBtn).toBeDisabled())

    await user.click(screen.getByRole('button', { name: /Sablon törlése/ }))
    const confirmBtn = screen.getByRole('button', { name: /Biztos\? Törlés/ })
    await user.click(confirmBtn)
    await waitFor(() => expect(confirmBtn).toBeDisabled())
  })
})

// ── the ⓘ explain layer (mezo-b516k, Task 2) ──────────────────────────────────────────
// A text link under the levels, the prototype's copy word for word. The aria-label is
// the prototype's own `"<title> — mit jelent?"`.

describe('MesoTemplateStoryPage · the ⓘ explain layer', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('„Mit jelent a szám?" under the weekly levels explains the number, word for word', async () => {
    const user = userEvent.setup()
    const { container } = setup()
    const btn = await screen.findByRole('button', { name: 'Mit jelent a szám? — mit jelent?' })
    expect(section(container, 'Heti szettek izmonként')).toContainElement(btn)
    expect(btn).toHaveTextContent('Mit jelent a szám?')
    await user.click(btn)
    expect(
      within(screen.getByRole('dialog', { name: 'Mit jelent a szám?' })).getByText(
        'Ennyi munkaszettet kap az izom egy héten, ha ebből a sablonból indítasz. A futam első hete indul ennyivel — onnan hétről hétre emelkedhet.',
      ),
    ).toBeInTheDocument()
  })

  // The explanation moved BEHIND the button (the prototype keeps it there) — the static
  // paragraph that used to print it went with it, so the sentence is said exactly once.
  test('the explanation no longer prints as a static paragraph on the page', async () => {
    const { container } = setup()
    await screen.findByRole('button', { name: 'Mit jelent a szám? — mit jelent?' })
    expect(container.textContent).not.toContain('Ennyi munkaszettet kap az izom egy héten')
  })
})
