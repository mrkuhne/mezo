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

// Asserts Phase-1 mock meso data, so pin mock mode explicitly.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const MESO_ID = 'meso-hyp-04'

function setup(day = 'Csü', mesoId = MESO_ID) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${mesoId}/days/${encodeURIComponent(day)}`],
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

test('the day opens on a body-map hero naming the day, its type and its working-set numeral', () => {
  setup()
  expect(screen.getByText('Pull nap')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Pull nap — érintett izmok' })).toBeInTheDocument()
  // Csü · Pull: 16 working sets in the mock fixture — the ONE dominant poster numeral.
  const numeral = document.querySelector('.pl-dhero-number')!
  expect(numeral.textContent).toBe('16szett')
})

test('the minutes and the week-share ride along as pills — the share is a bar + words, never a bare percent', () => {
  setup()
  const pills = document.querySelector('.pl-dhero-pills')!
  expect(pills.textContent).toMatch(/\d+ perc/)
  expect(pills.textContent).toContain('5 gyakorlat')
  // Csü carries 16 of the week's 75 planned sets (16+12+19+16+12) → 21%.
  const share = document.querySelector('.pl-share')!
  expect(share.textContent).toBe('a heted 21%-a')
  // The graphic, not just the words: a mini bar sized off the same percentage.
  const bar = share.querySelector('i')!
  expect(bar.style.getPropertyValue('--w')).toBe('21%')
})

test('per-muscle rows break the day down, each with its own bar to the shared 8-set marker', () => {
  setup()
  const rows = document.querySelector('.pl-mrows')!
  expect(rows.textContent).toContain('Hát')
  expect(rows.textContent).toContain('Bicepsz')
  expect(document.querySelectorAll('.pl-mrow-bar u').length).toBeGreaterThan(0)
})

test('the exercise view cells summarize each row read-only', () => {
  setup()
  const cells = document.querySelectorAll('.pl-ex')
  expect(cells.length).toBe(5) // Csü · Pull has 5 exercises in the mock fixture
  const first = cells[0]
  expect(first.textContent).toContain('Chest Supported Row')
  expect(first.textContent).toContain('4 × 8–10') // szett × ismétlés
  expect(first.textContent).toContain('RIR')
  expect(first.textContent).toContain('bemelegítő')
})

test('the page shows ONE day — this day\'s exercises, not another day\'s', () => {
  setup()
  expect(screen.getAllByText('Chest Supported Row').length).toBe(1) // Csü, ONE cell — no duplicate editor list
  expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument() // Hét
  // A single day means no tab strip to switch with.
  expect(screen.queryByRole('button', { name: /^Hét · Push$/ })).not.toBeInTheDocument()
})

// ── The welded pre-Titanium editor is GONE (Train parity P1 Task 4, mezo-e1ii9) ──────
// The matrix (docs/design_2.0/2026-09-16-train-parity-matrix.md §3) measured an ENTIRE
// second, pre-Titanium screen scrolling below the Titanium day page. These pin its
// absence marker by marker — if any of them comes back, the page grew a second screen
// again.
test('none of the pre-Titanium editor markers survive anywhere on the page', () => {
  setup()
  const text = document.body.textContent ?? ''
  for (const marker of ['⠿', '🔥', '🌿', 'Grow', 'Maintain', 'Emphasize', 'Heti szetek', 'jelzés', 'Csúcshét', 'időbecslés', 'Struktúra']) {
    expect(text).not.toContain(marker)
  }
})

test('the page ends at the exercise cells — no duplicate list, no editor chrome below them', () => {
  setup()
  // The read-only cells are the ONLY exercise list: the editor's accordion rows are gone.
  expect(document.querySelectorAll('.pl-ex').length).toBe(5)
  expect(document.querySelector('.mz-editor, .ex-accordion, .ex-card')).toBeNull()
  // …and the last thing on the page is the day's own tail, not an editor.
  const body = document.querySelector('.pl-dayfoot')!
  expect(body).toBeInTheDocument()
  expect(body.nextElementSibling).toBeNull()
})

test('the day\'s editing lives one route down — the tail carries the only add-CTA and a quiet edit link', async () => {
  const router = setup()
  // ONE add-CTA (the prototype\'s end-of-screen `.pl-add`), not the old duplicate pair.
  const add = screen.getAllByRole('button', { name: /Gyakorlat hozzáadása/ })
  expect(add.length).toBe(1)
  await userEvent.click(add[0])
  expect(router.state.location.pathname).toBe(`/train/mesocycles/${MESO_ID}/days/Cs%C3%BC/edit`)
  expect(router.state.location.search).toBe('?add=1')
})

test('„A nap szerkesztése" opens the day\'s editor route', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: 'A nap szerkesztése' }))
  expect(router.state.location.pathname).toBe(`/train/mesocycles/${MESO_ID}/days/Cs%C3%BC/edit`)
  expect(router.state.location.search).toBe('')
})

test('back lands on the run page', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/train/mesocycles/${MESO_ID}`))
})

test('a day the block does not have says so instead of an empty editor', () => {
  setup('Vasárnap')
  expect(screen.getByText('Ez a nap nincs a tervedben.')).toBeInTheDocument()
})

// ── Real mode ────────────────────────────────────────────────────────────────
// The regression this pins: in real mode the block list is a fetch, and the page used to
// render „Ez a nap nincs a tervedben." for the whole in-flight window — a valid deep link
// (or a shared URL opened cold) flashed as a dead one before resolving.
describe('MesoDayPage (real mode)', () => {
  const REAL_MESO_ID = 'b6f3a0e2-0000-4000-8000-000000000001'

  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a skeleton holds the page while the block is in flight — never a „nincs a tervedben" flash', async () => {
    setup('Csü', REAL_MESO_ID)
    expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
    expect(screen.queryByText('Ez a nap nincs a tervedben.')).not.toBeInTheDocument()
    expect(screen.queryByText('Ez a mesociklus nem található.')).not.toBeInTheDocument()

    expect(await screen.findByText('Pull nap')).toBeInTheDocument()
    expect(screen.getAllByText('Chest Supported Row').length).toBe(1)
    expect(screen.queryByRole('status', { name: 'Betöltés…' })).not.toBeInTheDocument()
  })

  test('a RESOLVED block without the day is still a dead link, and says so', async () => {
    setup('Vas', REAL_MESO_ID)
    expect(await screen.findByText('Ez a nap nincs a tervedben.')).toBeInTheDocument()
  })

  test('an unknown block id resolves to the not-found ghost, not an endless skeleton', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])))
    setup('Csü', REAL_MESO_ID)
    expect(await screen.findByText('Ez a mesociklus nem található.')).toBeInTheDocument()
  })

  // The honest-words contract: 0 kg is a real "no weight tracked here" answer (bodyweight
  // work), not a placeholder dash, and a plank-style hold (repMin AND repMax both 0) reads
  // as a hold, not a nonsense "0–0" rep range. Neither exercise exists in the shared mock
  // fixture, so this fixture is local to this test (mirrors MesoExercises.test.tsx's own
  // real-mode PUT fixture pattern).
  test('a bodyweight exercise reads "saját testsúly" and a hold reads "tartás"', async () => {
    const CUSTOM_MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000cc'
    const DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000dd'
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([
          {
            id: CUSTOM_MESO_ID, title: 'Test blokk', shortTitle: 'Test', status: 'active',
            startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
            split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
            days: [{
              id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 2, current: true,
              exercises: [
                {
                  id: 'ex-bw', name: 'Pull-Up', muscle: 'back-wide', warmupSets: 1, workingSets: 3,
                  repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', anchorWeightKg: 0,
                },
                {
                  id: 'ex-plank', name: 'Plank', muscle: 'core', warmupSets: 0, workingSets: 3,
                  repMin: 0, repMax: 0, targetRIR: 0, type: 'isolation', anchorWeightKg: null,
                },
              ],
            }],
          },
        ]),
      ),
    )
    setup('Csü', CUSTOM_MESO_ID)
    expect(await screen.findByText('saját testsúly')).toBeInTheDocument()
    const holdCell = document.querySelectorAll('.pl-ex')[1]
    expect(holdCell.textContent).toContain('3 × tartás')
    // The day's tail is the page's last word — the editor no longer scrolls below it.
    expect(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Heti szetek')
  })
})

// ── the ⓘ explain layer (mezo-b516k, Task 2) ──────────────────────────────────────────
// The button beside the heading, the prototype's copy word for word. The aria-label is
// the prototype's own `"<title> — mit jelent?"`.

test('ⓘ beside „Mit terhel ez a nap" explains the eight-set marking, word for word', async () => {
  const user = userEvent.setup()
  setup()
  const btn = screen.getByRole('button', { name: 'Miért nyolcnál a jelölés? — mit jelent?' })
  expect(btn.closest('h3')?.textContent).toBe('Mit terhel ez a nap')
  await user.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Miért nyolcnál a jelölés?' })).getByText(
      'Egy izomra egy edzésen belül nagyjából nyolc szett fölött már nem hoz többet a munka. Nem tiltás — csak egy jelölés, hogy lásd, hol jársz.',
    ),
  ).toBeInTheDocument()
})

test('ⓘ beside „A nap gyakorlatai" explains when an edit starts counting, word for word', async () => {
  const user = userEvent.setup()
  setup()
  const btn = screen.getByRole('button', { name: 'Mikortól él a változtatás? — mit jelent?' })
  expect(btn.closest('h3')?.textContent).toBe('A nap gyakorlatai')
  await user.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Mikortól él a változtatás?' })).getByText(
      'Amit itt átírsz, a következő edzésedtől számít. A most futó edzésedet nem írja át — azt végigviszed úgy, ahogy elkezdted.',
    ),
  ).toBeInTheDocument()
})
