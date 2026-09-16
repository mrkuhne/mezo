// ============================================================
// Mezo · MesoTemplateStoryPage tests — one template, read-first, at /train/templates/:id
// (Train Titanium T10 Task 3, mezo-88iwa.11).
//
// Fixtures (data/train/train.ts): b20f… „Upper/Lower Power" — 5 weeks, 4 training days
// (Sze/Szo/Vas rest), never run; a10e… „Hypertrophy 04 · Tavasz" — the active run
// meso-hyp-04 carries its templateId, so its runs list has a live row.
// ============================================================
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoTemplateStoryPage } from '@/features/train/pages/MesoTemplateStoryPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const POWER = 'b20f0000-0000-4000-8000-000000000000'
const HYP = 'a10e0000-0000-4000-8000-000000000000'

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

function setup(id: string = POWER) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/templates/${id}`]}>
        <Routes>
          <Route path="/train/templates/:id" element={<MesoTemplateStoryPage />} />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('MesoTemplateStoryPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  // --- the hero ---------------------------------------------------------------

  test('the hero carries the name, the split eyebrow, weeks × days and the muscles', () => {
    const { container } = setup()
    expect(screen.getByRole('heading', { name: 'Upper/Lower Power' })).toBeInTheDocument()
    expect(screen.getByText('Sablon · Upper / Lower')).toBeInTheDocument()
    expect(screen.getByText('5 hét, hetente 4 edzésnap.')).toBeInTheDocument()
    const hero = container.querySelector('.pl-lhero')!
    expect(hero.querySelectorAll('.pl-lib-mus i').length).toBeGreaterThan(3)
    // the back pill is docked INSIDE the hero (the `.pl-lhero > .mz-backbtn` rule)
    expect(screen.getByRole('button', { name: 'Vissza' }).parentElement).toBe(hero)
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
    const cards = [...container.querySelectorAll('.pl-lib-card.is-open')]
    expect(cards).toHaveLength(4) // Hét · Kedd · Csü · Pén

    const byDay = Object.fromEntries(cards.map((c) => [c.querySelector('strong')!.textContent, c]))
    expect(byDay['Hét']).toHaveTextContent('Upper A')
    // all three exercises of the Monday fixture, with their szett×ismétlés targets
    const monday = [...byDay['Hét']!.querySelectorAll('.pl-tpl-ex')].map((e) => e.textContent)
    expect(monday).toHaveLength(3)
    expect(monday[0]).toContain('Barbell Bench Press')
    expect(monday[0]).toContain('4×5–7')
    expect(monday[1]).toContain('Chest Supported Row')
    expect(monday[1]).toContain('4×6–8')
    expect(monday[2]).toContain('Overhead Press')
    expect(monday[2]).toContain('3×6–8')
    // no anchor weight in the fixture → honest words, not a dash
    expect(monday[0]).toContain('saját testsúly')
    // the whole week's exercises, spelled out: 3 + 3 + 3 + 3
    expect(container.querySelectorAll('.pl-tpl-ex')).toHaveLength(12)
  })

  test('rest days stay visible as quiet rows — a week is also its off days', () => {
    const { container } = setup()
    const quiet = [...container.querySelectorAll('.pl-row.is-quiet')]
      .map((r) => r.textContent)
      .filter((t) => t?.includes('Pihenő'))
    expect(quiet).toHaveLength(3) // Sze · Szo · Vas
    expect(quiet[0]).toContain('Sze')
  })

  // --- the hero's body map (fix round 1, mezo-88iwa.11) ------------------------

  test('the hero carries the body map, highlighted by the template\'s own muscles', () => {
    const { container } = setup()
    expect(container.querySelector('.pl-lhero-map')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /érintett izmok/ })).toBeInTheDocument()
  })

  // --- the week-sets explainer (fix round 1, mezo-88iwa.11) --------------------

  test('the week-sets explainer restates the rule in plain Hungarian', () => {
    setup()
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
    const rows = [...container.querySelectorAll('.pl-wload-row')].map((r) => ({
      label: r.querySelector('small')!.textContent,
      sets: r.querySelector('b')!.textContent,
      width: (r.querySelector('i') as HTMLElement).style.getPropertyValue('--w'),
    }))
    // three muscles tie at 7 (the week's biggest → full-width bars), alphabetically by group
    expect(rows[0]).toEqual({ label: 'Hát', sets: '7', width: '100%' })    // row 4 + pulldown 3
    expect(rows[1]).toEqual({ label: 'Mell', sets: '7', width: '100%' })   // bench 4 + incline DB 3
    expect(rows[2]).toEqual({ label: 'Comb', sets: '7', width: '100%' })   // squat 4 + leg press 3
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
    expect(screen.getByText('— Még nem indult futam ebből.')).toBeInTheDocument()
  })

  test('the running run is a row that opens the Terv landing', async () => {
    const user = userEvent.setup()
    setup(HYP)
    const row = screen.getByRole('button', { name: 'Most fut · Hypertrophy 04 · Tavasz' })
    expect(row).toHaveTextContent('Most fut — 3. hét a 6-ból')
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
    // the sheet names the template it will stamp a run from (the hero says it too)
    expect(screen.getAllByText('Upper/Lower Power').length).toBeGreaterThan(1)
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
    const { container } = setup()
    await user.click(screen.getByRole('button', { name: /Sablon törlése/ }))
    const armedRow = container.querySelector('.pl-row.is-danger')
    expect(armedRow).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mégsem' }))
    expect(container.querySelector('.pl-row.is-danger')).toBeNull()
    expect(screen.getByText('Sablon törlése')).toBeInTheDocument()
    // Mégsem never fires the delete — still on the template's own page.
    expect(screen.getByTestId('loc')).toHaveTextContent(`/train/templates/${POWER}`)
  })

  test('arming Törlés then tapping anything else on the page disarms it too', async () => {
    const user = userEvent.setup()
    const { container } = setup()
    await user.click(screen.getByRole('button', { name: /Sablon törlése/ }))
    expect(container.querySelector('.pl-row.is-danger')).toBeInTheDocument()

    // A tap on an unrelated, inert part of the page — not the armed row itself.
    await user.click(screen.getByText('Heti szettek izmonként'))
    expect(container.querySelector('.pl-row.is-danger')).toBeNull()
    expect(screen.getByText('Sablon törlése')).toBeInTheDocument()
  })

  // --- a dead link --------------------------------------------------------------

  test('an unknown template id is an honest not-found, not an empty page', () => {
    setup('nincs-ilyen-sablon')
    expect(screen.getByText('Ez a sablon nem található.')).toBeInTheDocument()
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

    const emptyDayRow = screen.getByText('Push · még nincs gyakorlat').closest('.pl-row')!
    expect(emptyDayRow).toHaveClass('is-quiet')
    expect(emptyDayRow).not.toHaveTextContent('Pihenő')

    const restRow = screen.getByText('Pihenő').closest('.pl-row')!
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
