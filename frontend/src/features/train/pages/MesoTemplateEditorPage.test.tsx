import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { MesoTemplateEditorPage } from '@/features/train/pages/MesoTemplateEditorPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// mesoTemplatesMock[1] — the never-run "Upper/Lower Power" blueprint.
const MOCK_TPL = 'b20f0000-0000-4000-8000-000000000000'
// The MSW meso-template fixture (real mode): one Pull day with a single exercise.
const REAL_TPL = 'a10e0000-0000-4000-8000-000000000000'

// The static real-mode template list used by the tests that must NOT see a refetch land
// (updateTemplate is invalidate-only, so a static GET mirrors the real race).
const REAL_TPL_FIXTURE = {
  id: REAL_TPL,
  title: 'Hypertrophy 04 · Tavasz',
  shortTitle: 'Hypertrophy 04',
  goal: 'Felsőtest hypertrophy · izomtömeg építés',
  goalPreset: 'strength',
  musclePriorities: { back: 'emphasize' },
  weeks: 6,
  split: 'Pull / Push / Legs · 5×/hét',
  style: 'RP · 6 hét',
  phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  runCount: 1,
  days: [
    {
      day: 'Csü',
      type: 'Pull',
      muscle: 'back+bicep',
      exerciseCount: 1,
      exercises: [
        {
          id: 'c1f3a0e2-0000-4000-8000-000000000002',
          name: 'Chest Supported Row',
          muscle: 'back-mid',
          warmupSets: 2,
          workingSets: 4,
          repMin: 8,
          repMax: 10,
          targetRIR: 1,
          type: 'compound',
        },
      ],
    },
    { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
  ],
}

afterEach(() => vi.unstubAllEnvs())

// Standalone render (real mode) — no AppLayout chrome, just the route. Returns the RTL
// render result so callers that need to unmount (the debounce-flush test) can.
function setupPage(id: string) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/templates/${id}`]}>
        <Routes>
          <Route path="/train/mesocycles/templates/:id" element={<MesoTemplateEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** Opens the first day tile and sets its single exercise's working-set count to `sets`. */
async function editWorkingSets(user: ReturnType<typeof userEvent.setup>, sets: string) {
  const tile = (await screen.findAllByRole('button', { name: /· szerkesztés$/ }))[0]
  await user.click(tile)
  // fireEvent, not user.type: the field is a clamped number input, so typing into a
  // non-empty one appends ("4" + "5" -> 45 -> clamped to the max).
  fireEvent.change(await screen.findByRole('spinbutton', { name: 'Munkaszettek' }), { target: { value: sets } })
}

describe('MesoTemplateEditorPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('is a full-screen sibling route rendering the template on the unified MesoWeekEditor', async () => {
    // through the real route table so the registration is covered too
    const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/templates/${MOCK_TPL}`] })
    const { container } = render(
      <QueryWrapper>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryWrapper>,
    )
    expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toHaveValue('Upper/Lower Power')
    // the Mozaik scaffold, not the pre-redesign DS page shell
    expect(container.querySelector('.mz-page')).not.toBeNull()
    expect(screen.getByText('A heted · koppints egy napra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upper A · szerkesztés$/ })).toBeInTheDocument()
  })

  it('the template editor renders the unified editor, not the old page head', async () => {
    setupPage(MOCK_TPL)
    expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toBeInTheDocument()
    expect(screen.getByText('Sablon · mentve')).toBeInTheDocument()
    expect(screen.getByText('A heted · koppints egy napra')).toBeInTheDocument()
    // the retired chrome: the DS page head and the <details> tier picker
    expect(document.querySelector('.pghead-np')).toBeNull()
    expect(screen.queryByText('Fókusz')).not.toBeInTheDocument()
  })

  it('shows an honest not-found line for an unknown template', () => {
    setupPage('b20f0000-0000-4000-8000-0000000000ff')
    expect(screen.getByText(/nem található/i)).toBeInTheDocument()
  })

  it('opens a day on its own editor page and renames it in place', async () => {
    const user = userEvent.setup()
    setupPage(MOCK_TPL)
    const tile = (await screen.findAllByRole('button', { name: /· szerkesztés$/ }))[0]
    await user.click(tile)
    const nameField = await screen.findByRole('textbox', { name: /nap neve$/ })
    await user.clear(nameField)
    await user.type(nameField, 'Húzónap')
    expect(nameField).toHaveValue('Húzónap')
    // back out of the day page — PageHead's back button is labelled "Vissza"
    await user.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toBeInTheDocument()
    // the renamed day is what the week strip now shows
    expect(screen.getByRole('button', { name: /Húzónap · szerkesztés$/ })).toBeInTheDocument()
  })
})

describe('MesoTemplateEditorPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('persists an exercise change through updateTemplate (background PUT of the whole template)', async () => {
    const puts: { id: string; body: Record<string, unknown> }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>
        puts.push({ id: String(params.id), body })
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    await editWorkingSets(user, '5')

    await waitFor(() => expect(puts.length).toBeGreaterThan(0))
    const last = puts[puts.length - 1]
    expect(last.id).toBe(REAL_TPL)
    // the whole template travels (title/weeks kept), with the new working-set count
    const body = last.body as { title: string; weeks: number; days: { exercises: { workingSets: number }[] }[] }
    expect(body.title).toBe('Hypertrophy 04 · Tavasz')
    expect(body.weeks).toBe(6)
    expect(body.days[0].exercises[0].workingSets).toBe(5)
  })

  it('the whole-template PUT carries the existing musclePriorities map and goalPreset through an unrelated day edit (mezo-3m5m; this editor has no per-field PATCH, so a builder that drops either field silently resets it)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([REAL_TPL_FIXTURE])),
    )
    const puts: { musclePriorities?: Record<string, string> | null; goalPreset?: string | null }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    await editWorkingSets(user, '5')

    await waitFor(() => expect(puts.length).toBeGreaterThan(0))
    // The tier picker is gone from this page (it moved into the wizard interview), but the
    // map it wrote must still ride along every write here. goalPreset is the module doc's
    // other named silent-data-loss risk — a day edit must not reset it either.
    expect(puts[puts.length - 1].musclePriorities).toEqual({ back: 'emphasize' })
    expect(puts[puts.length - 1].goalPreset).toBe('strength')
  })

  it('a rename after an unrefetched day edit persists through the same full-upsert path, carrying the EDITED days and the musclePriorities map (mezo-3m5m)', async () => {
    // GET stays static (mirrors the real race: the day-edit PUT lands, but the invalidated
    // query hasn't refetched yet) so `template.days` in the query cache never reflects the
    // working-set change below.
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([REAL_TPL_FIXTURE])),
    )
    const puts: {
      title?: string
      musclePriorities?: Record<string, string> | null
      days?: { exercises?: { workingSets?: number }[] }[]
    }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    // 1) Day edit: set the working-set count — updates local `days` and fires a background
    // PUT whose GET-refetch this test never awaits.
    await editWorkingSets(user, '5')
    await waitFor(() => expect(puts.length).toBeGreaterThan(0))
    await user.click(screen.getByRole('button', { name: 'Vissza' }))

    // 2) Rename, fired before any refetch could land (GET is static above).
    const nameField = await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    await user.type(nameField, '!')

    await waitFor(() => expect(puts[puts.length - 1].title).toBe('Hypertrophy 04 · Tavasz!'))
    const renamePut = puts[puts.length - 1]
    // The rename PUT must carry the working-set count from step 1 — not the pre-edit
    // value 4 that the (unrefetched) query cache still holds.
    expect(renamePut.days![0].exercises![0].workingSets).toBe(5)
    // …and the tier map still rides along.
    expect(renamePut.musclePriorities).toEqual({ back: 'emphasize' })
  })

  it('seeds the buffered name field from the fetched title', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([{ ...REAL_TPL_FIXTURE, title: 'Kívülről átnevezve' }])),
    )
    setupPage(REAL_TPL)
    expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toHaveValue('Kívülről átnevezve')
  })

  it('debounces the rename PUT: typing several characters fires exactly one write, carrying the final title (mezo-yty6)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([REAL_TPL_FIXTURE])),
    )
    const puts: { title?: string }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    const nameField = await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    await user.type(nameField, 'XYZ')
    // The local field is authoritative immediately — no wait needed for the UI.
    expect(nameField).toHaveValue('Hypertrophy 04 · TavaszXYZ')
    // No PUT yet: the write is debounced, not sent per keystroke.
    expect(puts.length).toBe(0)

    await waitFor(() => expect(puts.length).toBeGreaterThan(0))
    // Exactly one PUT, carrying the final (fully-typed) title — not one per keystroke.
    expect(puts.length).toBe(1)
    expect(puts[0].title).toBe('Hypertrophy 04 · TavaszXYZ')
  })

  it('flushes a pending debounced rename on unmount, so navigating away right after typing does not drop the edit (mezo-yty6)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([REAL_TPL_FIXTURE])),
    )
    const puts: { title?: string }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    const { unmount } = setupPage(REAL_TPL)

    const nameField = await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    await user.type(nameField, '!')
    // Unmount immediately, well inside the debounce window — the pending write must still
    // fire rather than being silently lost.
    unmount()

    await waitFor(() => expect(puts.length).toBeGreaterThan(0))
    expect(puts[0].title).toBe('Hypertrophy 04 · Tavasz!')
  })

  // mezo-yty6 final review, C1: the redesign replaced ExerciseCard's stepper buttons with
  // free-text number inputs, so an un-debounced exercise handler PUT the whole document once
  // per typed character — and every full write regenerates the exercise ids server-side.
  it('debounces exercise edits: typing several characters into a numeric field fires exactly one PUT, carrying the final value (mezo-yty6)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([REAL_TPL_FIXTURE])),
    )
    const puts: { days?: { exercises?: { anchorWeightKg?: number | null }[] }[] }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    const tile = (await screen.findAllByRole('button', { name: /· szerkesztés$/ }))[0]
    await user.click(tile)
    // Three keystrokes into the empty (placeholder "auto") starting-weight field: pre-fix
    // that was three full-document PUTs (1 → 12 → 125), each regenerating the exercise ids.
    const weight = await screen.findByRole('spinbutton', { name: 'Kiinduló súly (kg)' })
    await user.type(weight, '125')
    // The local field is authoritative immediately — no wait needed for the UI.
    expect(weight).toHaveValue(125)
    // Not one PUT per character.
    expect(puts.length).toBe(0)

    await waitFor(() => expect(puts.length).toBeGreaterThan(0))
    expect(puts.length).toBe(1)
    expect(puts[0].days![0].exercises![0].anchorWeightKg).toBe(125)
  })

  it('flushes a pending debounced exercise edit on unmount, so navigating away right after typing does not drop it (mezo-yty6)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([REAL_TPL_FIXTURE])),
    )
    const puts: { days?: { exercises?: { workingSets?: number }[] }[] }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    const { unmount } = setupPage(REAL_TPL)

    await screen.findByRole('textbox', { name: 'Mezociklus neve' })
    await editWorkingSets(user, '7')
    // Unmount well inside the debounce window — the pending write must still fire.
    unmount()

    await waitFor(() => expect(puts.length).toBeGreaterThan(0))
    expect(puts[0].days![0].exercises![0].workingSets).toBe(7)
  })
})
