import { render, screen, waitFor } from '@testing-library/react'
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

afterEach(() => vi.unstubAllEnvs())

// Standalone render (real mode) — no AppLayout chrome, just the route.
function setupPage(id: string) {
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/templates/${id}`]}>
        <Routes>
          <Route path="/train/mesocycles/templates/:id" element={<MesoTemplateEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('MesoTemplateEditorPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('is a full-screen sibling route rendering the template on the shared MesoEditor', async () => {
    // through the real route table so the registration is covered too
    const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/templates/${MOCK_TPL}`] })
    render(
      <QueryWrapper>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryWrapper>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Upper/Lower Power' })).toBeInTheDocument()
    // the shared editor: day tabs + its weekly set-budget card
    expect(screen.getByRole('button', { name: /Hét/ })).toBeInTheDocument()
    expect(screen.getByText('Upper A')).toBeInTheDocument()
    expect(screen.getByText(/Heti szet-büdzsé/)).toBeInTheDocument()
  })

  it('shows an honest not-found line for an unknown template', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    setupPage('b20f0000-0000-4000-8000-0000000000ff')
    expect(screen.getByText(/nem található/i)).toBeInTheDocument()
  })

  it('the Cél dropdown shows the template\'s preset', async () => {
    setupPage(MOCK_TPL)

    await screen.findByRole('heading', { level: 1, name: 'Upper/Lower Power' })
    const select = screen.getByRole('combobox', { name: 'Cél' })
    expect(select).toHaveValue('strength')
  })
})

describe('MesoTemplateEditorPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('persists an exercise change through updateTemplate (background PUT of the whole template)', async () => {
    let putId: string | null = null
    let putBody: { title?: string; weeks?: number; days?: { exercises?: { workingSets?: number }[] }[] } | null = null
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        putId = String(params.id)
        putBody = (await request.json()) as typeof putBody
        return HttpResponse.json({ id: putId, runCount: 1, phaseCurve: [], days: [], ...putBody })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    // wait for the template to land, then expand its single exercise row
    await screen.findByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' })
    await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
    await user.click(screen.getAllByRole('button', { name: /· Munkaszett növelése$/ })[0])

    await waitFor(() => expect(putBody).not.toBeNull())
    expect(putId).toBe(REAL_TPL)
    // the whole template travels (title/weeks kept), with the bumped working-set count
    expect(putBody!.title).toBe('Hypertrophy 04 · Tavasz')
    expect(putBody!.weeks).toBe(6)
    expect(putBody!.days![0].exercises![0].workingSets).toBe(5) // fixture 4 -> +1
  })

  it('the Cél dropdown persists a preset change via the same full-upsert path, other fields surviving', async () => {
    let putBody: { title?: string; goalPreset?: string | null } | null = null
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([
          {
            id: REAL_TPL,
            title: 'Hypertrophy 04 · Tavasz',
            shortTitle: 'Hypertrophy 04',
            goal: 'Felsőtest hypertrophy · izomtömeg építés',
            goalPreset: 'strength',
            weeks: 6,
            split: 'Pull / Push / Legs · 5×/hét',
            style: 'RP · 6 hét',
            phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
            runCount: 1,
            days: [
              { day: 'Csü', type: 'Pull', muscle: 'back+bicep', exerciseCount: 0, exercises: [] },
              { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
            ],
          },
        ]),
      ),
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        putBody = (await request.json()) as typeof putBody
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...putBody })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' })
    const select = screen.getByRole('combobox', { name: 'Cél' })
    expect(select).toHaveValue('strength')

    await user.selectOptions(select, 'hypertrophy')

    await waitFor(() => expect(putBody).not.toBeNull())
    expect(putBody!.goalPreset).toBe('hypertrophy')
    expect(putBody!.title).toBe('Hypertrophy 04 · Tavasz') // full-replace: unrelated fields survive
  })

  it('a goal change after an unrefetched day edit carries the EDITED days, not the stale query-cache copy (mezo-dq60)', async () => {
    // GET stays static (mirrors the real race: the day-edit PUT lands, but the
    // invalidated query hasn't refetched yet) so `template.days` in the query
    // cache never reflects the bumped working-set count below.
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([
          {
            id: REAL_TPL,
            title: 'Hypertrophy 04 · Tavasz',
            shortTitle: 'Hypertrophy 04',
            goal: 'Felsőtest hypertrophy · izomtömeg építés',
            goalPreset: 'strength',
            weeks: 6,
            split: 'Pull / Push / Legs · 5×/hét',
            style: 'RP · 6 hét',
            phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
            runCount: 1,
            days: [
              {
                day: 'Csü', type: 'Pull', muscle: 'back+bicep', exerciseCount: 1,
                exercises: [
                  { id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
                    muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
                ],
              },
              { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
            ],
          },
        ]),
      ),
    )
    const puts: { title?: string; goalPreset?: string | null; days?: { exercises?: { workingSets?: number }[] }[] }[] = []
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' })
    // 1) Day edit: bump the working-set count — updates local `days` state and
    // fires a background PUT the test never awaits the GET-refetch of.
    await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
    await user.click(screen.getAllByRole('button', { name: /· Munkaszett növelése$/ })[0])

    // 2) Goal change, fired before any refetch could land (GET is static above).
    const select = screen.getByRole('combobox', { name: 'Cél' })
    expect(select).toHaveValue('strength')
    await user.selectOptions(select, 'hypertrophy')

    await waitFor(() => expect(puts).toHaveLength(2))
    const goalChangePut = puts[1]
    expect(goalChangePut.goalPreset).toBe('hypertrophy')
    // The goal-change PUT must carry the bumped working-set count from step 1 —
    // not the pre-edit value 4 that the (unrefetched) query cache still holds.
    expect(goalChangePut.days![0].exercises![0].workingSets).toBe(5)
  })
})
