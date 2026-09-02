import { render, screen, waitFor, within } from '@testing-library/react'
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
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'

// Same lookup as MusclePriorityPicker.test.tsx — locates a tier row by its coarse-muscle group.
function tierRow(group: string) {
  const label = BUDGET_GROUP_LABELS[group] ?? group
  return screen.getByRole('group', { name: `${label} prioritás` })
}

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
    expect(screen.getByText(/Heti szetek · izmonként/)).toBeInTheDocument()
  })

  it('shows an honest not-found line for an unknown template', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    setupPage('b20f0000-0000-4000-8000-0000000000ff')
    expect(screen.getByText(/nem található/i)).toBeInTheDocument()
  })

  it('the Fókusz picker shows the template\'s existing musclePriorities map (mezo-3m5m)', async () => {
    // MOCK_TPL ("Upper/Lower Power") carries musclePriorities: { back: 'emphasize' } (train.ts).
    setupPage(MOCK_TPL)

    await screen.findByRole('heading', { level: 1, name: 'Upper/Lower Power' })
    await userEvent.click(screen.getByText('Fókusz'))
    expect(within(tierRow('back')).getByRole('button', { name: 'Emphasize' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(tierRow('quad')).getByRole('button', { name: 'Grow' })).toHaveAttribute('aria-pressed', 'true')
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

  it('the whole-template PUT carries the existing musclePriorities map through an unrelated day edit (mezo-3m5m; this editor has no per-field PATCH, so a builder that drops the field silently resets it to all-Grow)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([
          {
            id: REAL_TPL,
            title: 'Hypertrophy 04 · Tavasz',
            shortTitle: 'Hypertrophy 04',
            goal: 'Felsőtest hypertrophy · izomtömeg építés',
            musclePriorities: { back: 'emphasize' },
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
    let putBody: { musclePriorities?: Record<string, string> | null } | null = null
    server.use(
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        putBody = (await request.json()) as typeof putBody
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...putBody })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' })
    await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
    await user.click(screen.getAllByRole('button', { name: /· Munkaszett növelése$/ })[0])

    await waitFor(() => expect(putBody).not.toBeNull())
    expect(putBody!.musclePriorities).toEqual({ back: 'emphasize' })
  })

  it('a Fókusz tier change after an unrefetched day edit persists through the same full-upsert path, carrying the EDITED days and the merged musclePriorities map (mezo-3m5m)', async () => {
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
            musclePriorities: { back: 'emphasize' },
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
    const puts: {
      title?: string
      goalPreset?: string | null
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

    await screen.findByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' })
    // 1) Day edit: bump the working-set count — updates local `days` state and
    // fires a background PUT the test never awaits the GET-refetch of.
    await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
    await user.click(screen.getAllByRole('button', { name: /· Munkaszett növelése$/ })[0])

    // 2) Tier change: glute -> Maintain, fired before any refetch could land (GET is static above).
    await user.click(screen.getByText('Fókusz'))
    await user.click(within(tierRow('glute')).getByRole('button', { name: 'Maintain' }))

    await waitFor(() => expect(puts).toHaveLength(2))
    const tierChangePut = puts[1]
    // The existing 'back: emphasize' tier survives the merge alongside the new 'glute: maintain'.
    expect(tierChangePut.musclePriorities).toEqual({ back: 'emphasize', glute: 'maintain' })
    // Every other field rides along untouched (full-replace body).
    expect(tierChangePut.title).toBe('Hypertrophy 04 · Tavasz')
    // The tier-change PUT must carry the bumped working-set count from step 1 —
    // not the pre-edit value 4 that the (unrefetched) query cache still holds.
    expect(tierChangePut.days![0].exercises![0].workingSets).toBe(5)
  })

  it('two rapid Fókusz picks on different groups both persist, no clobber, aria-pressed flips immediately (mezo-3m5m final review, fix 2)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([
          {
            id: REAL_TPL,
            title: 'Hypertrophy 04 · Tavasz',
            shortTitle: 'Hypertrophy 04',
            goal: 'Felsőtest hypertrophy · izomtömeg építés',
            musclePriorities: null,
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
    const puts: { musclePriorities?: Record<string, string> | null }[] = []
    server.use(
      // Deliberate delay: updateTemplate is invalidate-only, so the second pick below must
      // fire before any refetch could land — this pins the local-state fix rather than a
      // race that happens to resolve fast enough in CI.
      http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as (typeof puts)[number]
        await new Promise((resolve) => setTimeout(resolve, 30))
        puts.push(body)
        return HttpResponse.json({ id: String(params.id), runCount: 1, phaseCurve: [], days: [], ...body })
      }),
    )
    const user = userEvent.setup()
    setupPage(REAL_TPL)

    await screen.findByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' })
    await user.click(screen.getByText('Fókusz'))

    // Two rapid picks on different groups, back to back — no wait for the first PUT
    // (still in flight, delayed above) in between. The picker's `value` used to come
    // straight from the query-cache prop, which lags in real mode; two quick picks would
    // both build off the SAME stale map and the second onChange would full-replace away
    // the first pick.
    await user.click(within(tierRow('back')).getByRole('button', { name: 'Emphasize' }))
    await user.click(within(tierRow('shoulder')).getByRole('button', { name: 'Maintain' }))

    // aria-pressed reflects both picks immediately, off local state — no refetch awaited above.
    expect(within(tierRow('back')).getByRole('button', { name: 'Emphasize' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(tierRow('shoulder')).getByRole('button', { name: 'Maintain' })).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => expect(puts).toHaveLength(2))
    // The second PUT is built from the LOCALLY merged map, so it carries BOTH picks — a
    // stale-cache-sourced merge would have dropped the first ('back') key here.
    expect(puts[1].musclePriorities).toEqual({ back: 'emphasize', shoulder: 'maintain' })
  })
})
