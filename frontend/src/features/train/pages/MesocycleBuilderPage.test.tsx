import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const REAL_MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000cc'
const realMeso = (status: 'active' | 'planned' | 'archived') => ({
  id: REAL_MESO_ID, title: 'Lifecycle blokk', shortTitle: 'Lifecycle', status,
  startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
  split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
})

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// The real router (createMemoryRouter + app routes) rather than a hand-built Routes tree:
// the day mosaic navigates to a sibling route, and the encoded day token in the resulting
// URL is exactly what this page promises the day page (mezo-d20.15).
function setup(id = 'meso-hyp-04') {
  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${id}`] })
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

// Folyadék F3 (prototype vilagos/edzes.js `run()`): the plan's name and its status line ride the frame's
// title bar; the phase reads in the owner's words („Emelkedés", never „Rámpa").
test('the title bar says where the run stands: week, phase and the end date', () => {
  setup()
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()
  expect(screen.getByText('Aktív · 3/6 hét · Emelkedés · vége Jún 12')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/Rámpa|rámpázik|Mezociklus|blokk íve/)
})

test('the hero draws the plan\'s arc as a liquid surface with „most" and the peak marked', () => {
  setup()
  expect(hero().querySelector('.fo-hero-lbl')).toHaveTextContent('A terv íve · Pull / Push / Legs · 5×/hét')
  // phaseCurve MEV MEV MAV MAV MRV Deload → week 5 is the peak, week 6 the pihenőhét
  expect(hero().querySelector('.fo-hero-verdict')).toHaveTextContent('Az 5. hét a csúcs, a 6. a pihenőhét.')
  expect(hero().querySelector('.fo-hero-sub')).toHaveTextContent('Most a 3. héten jársz: 88 szett.')
  const arc = within(hero()).getByRole('img', { name: 'A terv íve: heti szettszám, 60, 74, 88, 92, 92, 46' })
  expect(arc.querySelector('svg.fo-area')).not.toBeNull()
  expect(arc.querySelector('.fo-area-now text')?.textContent).toBe('most · 88')
  expect(arc.querySelector('.fo-area-pr text')?.textContent).toBe('csúcs · 92')
  // one axis label per week
  expect([...arc.querySelectorAll('svg > text')].map((t) => t.textContent)).toEqual(['1.', '2.', '3.', '4.', '5.', '6. hét'])
})

test("Mezo's note explains the volume change, signed by Mezo", () => {
  setup()
  // activeMeso.volumeRecompute.changes[0] is the 'back' (Hát) row.
  const note = screen.getByText(/^Hát:/)
  expect(note.closest('.fo-msg')).not.toBeNull()
  expect(screen.getByText('Mezo jegyzete')).toBeInTheDocument()
})

test('„Hol tartasz": the week row navigates, the rollover forecast does not', async () => {
  const router = setup()
  expect(screen.getByText(/^\d+ szett · \d+ emelkedik · \d+ tart$/)).toBeInTheDocument()
  // five little vessels beside the row — the plan's five loudest muscles
  expect(document.querySelectorAll('.ep-mini i')).toHaveLength(5)
  expect(screen.getByText('Hétfőn jön')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Hétfőn jön/ })).not.toBeInTheDocument()
  expect(screen.getByText('A heti váltás hajnalban magától lefut.')).toBeInTheDocument()
  // the forecast chips: five muscles, then „+N" (meso-hyp-04 tracks 8 groups)
  const chips = [...document.querySelectorAll('.ep-roll > span')]
  expect(chips).toHaveLength(6)
  expect(chips[5].textContent).toBe('+3')
  expect(chips[0].querySelector('.ex-mchp')).not.toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /^Heti vizsgálat\d+ szett/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/train/mesocycles/meso-hyp-04/week'))
})

test('the hero\'s button opens the week review too', async () => {
  const router = setup()
  await userEvent.click(within(hero()).getByRole('button', { name: 'Heti vizsgálat' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/train/mesocycles/meso-hyp-04/week'))
})

// U5 (mezo-me75u.5): the page renders the SAME `MesoWeekDays` list the Terv landing does,
// so the week is shown WHOLE — a training day is a button (today a full card, the rest rows), an off
// day is a quiet row (not a button). What the old assertion protected still holds: you cannot tap into
// a rest or sport day, because it never became a card.
test('the week shows training days as cards — a Rest or sport day is not tappable', () => {
  setup()
  expect(screen.getByRole('button', { name: /^Hétfő · Push/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Csütörtök · Pull/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Vasárnap/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Szombat/ })).not.toBeInTheDocument()
  expect(screen.getByText('pihenőnap')).toBeInTheDocument()
})

test('tapping a day card opens that day on its own route, with the token URL-encoded', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: /^Hétfő · Push/ }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/train/mesocycles/meso-hyp-04/days/H%C3%A9t'),
  )
})

test('the in-cycle Fókusz picker is gone — tiers are a planning-time decision', () => {
  setup()
  expect(screen.queryByText('Fókusz')).not.toBeInTheDocument()
})

test('Edzésterv lezárása opens the close sheet instead of closing straight away', async () => {
  const user = userEvent.setup()
  const calls: string[] = []
  server.use(
    http.post(`${API_BASE}/api/train/mesocycles/:id/close`, ({ params }) => {
      calls.push(`close:${params.id}`)
      return HttpResponse.json({ id: params.id })
    }),
  )
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzésterv lezárása' }))
  expect(await screen.findByRole('heading', { name: 'Futam lezárása' })).toBeInTheDocument()
  expect(calls).toEqual([]) // nothing closed until the sheet is confirmed
})

// The MSW-driven cases pin real mode through a NESTED describe's beforeEach (the
// PatternsPage/ChatPage house idiom) rather than an inline stub inside each test — this
// file's own beforeEach pins MOCK mode, and an inline per-test override of the opposite
// mode is what made the sibling close-sheet test flaky under the real-mode suite (CI #198).
describe('MesocycleBuilderPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('the close sheet POSTs the close endpoint and lands on the run report', async () => {
    const calls: string[] = []
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([realMeso('active')]),
      ),
      http.post(`${API_BASE}/api/train/mesocycles/:id/close`, ({ params }) => {
        calls.push(`close:${params.id}`)
        return HttpResponse.json({ id: params.id, status: 'archived' })
      }),
    )
    const router = setup(REAL_MESO_ID)
    await userEvent.click(await screen.findByRole('button', { name: 'Edzésterv lezárása' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Lezárás' }))
    await waitFor(() => expect(calls).toEqual([`close:${REAL_MESO_ID}`]))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/train/mesocycles/${REAL_MESO_ID}/report`),
    )
  })

  test('an archived run has no builder — it lands on its report', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('archived')])),
    )
    const router = setup(REAL_MESO_ID)
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/train/mesocycles/${REAL_MESO_ID}/report`),
    )
  })

  test('Aktiválás POSTs the activate endpoint', async () => {
    const calls: string[] = []
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([realMeso('planned')]),
      ),
      http.post(`${API_BASE}/api/train/mesocycles/:id/activate`, ({ params }) => {
        calls.push(`activate:${params.id}`)
        return HttpResponse.json({ id: params.id })
      }),
    )
    setup(REAL_MESO_ID)
    await screen.findByRole('button', { name: /Aktiválás/ })
    // the planned face (prototype `run.tervezett`): the verdict, the plain vessels (no numbers), the dated button
    expect(screen.getByText('Ez a terv még nem indult el.')).toBeInTheDocument()
    expect(screen.getByText('Tervezett · 6 hét · indul Jún 1')).toBeInTheDocument()
    const tubes = screen.getByRole('group', { name: 'A terv hetei: a terv íve' })
    expect(tubes.querySelectorAll('.fo-vial.ghost')).toHaveLength(6)
    expect(tubes.querySelectorAll('.fo-vial > b')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Aktiválás · Jún 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edzésterv lezárása' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Aktiválás/ }))
    await waitFor(() => expect(calls).toEqual([`activate:${REAL_MESO_ID}`]))
  })

  // Before the first workout the run has no volume arc: the hero falls back to the plain vessels at the plan's
  // phase curve, with the note (prototype `run.elso`).
  test('an active run without an arc draws the plain vessels and the note', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('active')])),
      http.get(`${API_BASE}/api/train/mesocycles/:id/volume-arc`, () => new HttpResponse(null, { status: 404 })),
    )
    setup(REAL_MESO_ID)
    expect(await screen.findByText('A hetek szettszáma az első edzésed után jelenik meg — addig a terv íve látszik.')).toBeInTheDocument()
    const tubes = screen.getByRole('group', { name: 'A terv hetei: a terv íve' })
    expect(tubes.querySelectorAll('.fo-vial')).toHaveLength(6)
    expect(tubes.querySelector('.fo-vial.now small')?.textContent).toBe('1. hétmost')
    expect(document.querySelector('svg.fo-area')).toBeNull()
    expect(screen.getByText('Most az 1. héten jársz.')).toBeInTheDocument()
  })

  test('an unknown id says the plan is not found, in an empty vessel', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])))
    const router = setup(REAL_MESO_ID)
    expect(await screen.findByText('Ez az edzésterv nem található.')).toBeInTheDocument()
    expect(document.querySelector('.fo-ev')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Edzéstervek' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/train/mesocycles'))
  })
})
