import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { useMesoTemplates } from '@/data/train/mesoTemplateHooks'
import { mesoTemplatesMock, mesocycles } from '@/data/train/train'
import type { Mesocycle } from '@/data/types'

afterEach(() => vi.unstubAllEnvs())

// Exposes the QueryClient so the rerun-materialization tests can assert BOTH cache
// writes (a new template AND the meso's stamped templateId) — makeHookWrapper() hides
// its client, so a fresh one is wired up here instead (the runningHooks.test.ts idiom:
// createElement keeps this file plain .ts, no JSX).
function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

describe('useMesoTemplates', () => {
  it('mock mode: serves the static fixtures synchronously', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    expect(result.current.templates).toEqual(mesoTemplatesMock)
    expect(result.current.pending).toBe(false)
  })

  it('real mode: lists templates from MSW', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.templates.length).toBeGreaterThan(0))
    expect(result.current.templates[0].title).toBe('Hypertrophy 04 · Tavasz')
    expect(result.current.templates[0].runCount).toBe(1)
    // Backend invariant (muscle is always a string, '' on rest days; exercises always an
    // array) survives the response -> domain boundary cast untouched.
    const rest = result.current.templates[0].days.find((d) => d.type === 'Rest')
    expect(rest?.muscle).toBe('')
    expect(rest?.exercises).toEqual([])
  })

  it('real mode: startTemplate POSTs the start body and returns a mapped run', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let posted: { startDate?: string; status?: string } | null = null
    server.use(
      http.post(`${API_BASE}/api/train/meso-templates/:id/start`, async ({ params, request }) => {
        posted = (await request.json()) as typeof posted
        return HttpResponse.json({
          id: 'f6f3a0e2-0000-4000-8000-000000000099',
          templateId: String(params.id),
          title: 'Hypertrophy 04 · Tavasz',
          shortTitle: 'Hypertrophy 04',
          status: posted!.status,
          startDate: posted!.startDate,
          endDate: '2026-07-27',
          weeks: 6,
          currentWeek: 0,
          split: 's',
          style: 's',
          phaseCurve: ['MEV'],
        })
      }),
    )
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    let run: Awaited<ReturnType<typeof result.current.startTemplate>> | undefined
    await act(async () => {
      run = await result.current.startTemplate('a10e0000-0000-4000-8000-000000000000', {
        startDate: '2026-06-16',
        status: 'planned',
      })
    })
    expect(posted).toEqual({ startDate: '2026-06-16', status: 'planned' })
    expect(run!.templateId).toBe('a10e0000-0000-4000-8000-000000000000')
    expect(run!.startDate).toBe('Jún 16') // ISO -> HU display, same boundary cast as useTrain
  })

  it('mock mode: createTemplate + startTemplate no-op the network but update the client-owned caches', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    let created: Awaited<ReturnType<typeof result.current.createTemplate>> | undefined
    await act(async () => {
      created = await result.current.createTemplate({
        title: 'Mock Block',
        weeks: 4,
        phaseCurve: ['MEV'],
        days: [
          {
            day: 'Hét',
            type: 'Push',
            exercises: [
              { name: 'Bench', warmupSets: 1, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
            ],
          },
        ],
      })
    })
    expect(created!.runCount).toBe(0)
    expect(created!.days[0].exercises[0].id).toBeTruthy() // synthesized id, mirrors the backend invariant
    await waitFor(() => expect(result.current.templates.some((t) => t.id === created!.id)).toBe(true))

    await act(async () => {
      await result.current.startTemplate(created!.id, { startDate: '2026-06-16', status: 'active' })
    })
    await waitFor(() => expect(result.current.templates.find((t) => t.id === created!.id)?.runCount).toBe(1))
  })

  it('real mode: rerun POSTs to the mesocycle rerun endpoint and returns its response', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let hitId: string | null = null
    server.use(
      http.post(`${API_BASE}/api/train/mesocycles/:id/rerun`, ({ params }) => {
        hitId = String(params.id)
        return HttpResponse.json({ templateId: 'a10e0000-0000-4000-8000-000000000000' })
      }),
    )
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    let res: Awaited<ReturnType<typeof result.current.rerun>> | undefined
    await act(async () => {
      res = await result.current.rerun('meso-rec-03')
    })
    expect(hitId).toBe('meso-rec-03') // POSTed to the right mesocycle's rerun URL
    expect(res!.templateId).toBe('a10e0000-0000-4000-8000-000000000000')
  })

  it('mock mode: rerun on a template-linked meso returns its own templateId (no materialization)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { qc, wrapper } = wrap()
    const { result } = renderHook(() => useMesoTemplates(), { wrapper })
    const before = result.current.templates.length
    let res: Awaited<ReturnType<typeof result.current.rerun>> | undefined
    await act(async () => {
      // meso-hyp-04 is fixture-linked to the a10e0000... template (mezo-meyc.1 fix)
      res = await result.current.rerun('meso-hyp-04')
    })
    expect(res!.templateId).toBe('a10e0000-0000-4000-8000-000000000000')
    expect(result.current.templates).toHaveLength(before) // nothing materialized
    const mesos = qc.getQueryData<Mesocycle[]>(['train', 'mesocycles']) ?? mesocycles
    expect(mesos.find((m) => m.id === 'meso-hyp-04')?.templateId).toBe('a10e0000-0000-4000-8000-000000000000')
  })

  it('goalPreset survives the template hydrate round-trip (real mode GET)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([
          {
            id: 'a10e0000-0000-4000-8000-000000000000',
            title: 'Hypertrophy 04 · Tavasz',
            shortTitle: 'Hypertrophy 04',
            goal: 'Felsőtest hypertrophy · izomtömeg építés',
            goalPreset: 'strength',
            weeks: 6,
            split: 'Pull / Push / Legs · 5×/hét',
            style: 'RP · 6 hét',
            phaseCurve: ['MEV'],
            runCount: 1,
            days: [],
          },
        ]),
      ),
    )
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.templates.length).toBeGreaterThan(0))
    expect(result.current.templates[0].goalPreset).toBe('strength')
  })

  it('goalPreset survives the template save round-trip (mock createTemplate/updateTemplate)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    let created: Awaited<ReturnType<typeof result.current.createTemplate>> | undefined
    await act(async () => {
      created = await result.current.createTemplate({
        title: 'Mock Block',
        goalPreset: 'strength',
        weeks: 4,
        phaseCurve: ['MEV'],
        days: [],
      })
    })
    expect(created!.goalPreset).toBe('strength')

    let updated: Awaited<ReturnType<typeof result.current.updateTemplate>> | undefined
    await act(async () => {
      updated = await result.current.updateTemplate(created!.id, {
        title: 'Mock Block',
        goalPreset: 'strength',
        weeks: 4,
        phaseCurve: ['MEV'],
        days: [],
      })
    })
    expect(updated!.goalPreset).toBe('strength')
  })

  it('musclePriorities survives the template hydrate round-trip (real mode GET)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/train/meso-templates`, () =>
        HttpResponse.json([
          {
            id: 'a10e0000-0000-4000-8000-000000000000',
            title: 'Hypertrophy 04 · Tavasz',
            shortTitle: 'Hypertrophy 04',
            goal: 'Felsőtest hypertrophy · izomtömeg építés',
            musclePriorities: { back: 'emphasize' },
            weeks: 6,
            split: 'Pull / Push / Legs · 5×/hét',
            style: 'RP · 6 hét',
            phaseCurve: ['MEV'],
            runCount: 1,
            days: [],
          },
        ]),
      ),
    )
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.templates.length).toBeGreaterThan(0))
    expect(result.current.templates[0].musclePriorities).toEqual({ back: 'emphasize' })
  })

  it('musclePriorities survives the template save round-trip (mock createTemplate/updateTemplate)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    let created: Awaited<ReturnType<typeof result.current.createTemplate>> | undefined
    await act(async () => {
      created = await result.current.createTemplate({
        title: 'Mock Block',
        musclePriorities: { back: 'emphasize' },
        weeks: 4,
        phaseCurve: ['MEV'],
        days: [],
      })
    })
    expect(created!.musclePriorities).toEqual({ back: 'emphasize' })

    let updated: Awaited<ReturnType<typeof result.current.updateTemplate>> | undefined
    await act(async () => {
      updated = await result.current.updateTemplate(created!.id, {
        title: 'Mock Block',
        musclePriorities: { back: 'emphasize' },
        weeks: 4,
        phaseCurve: ['MEV'],
        days: [],
      })
    })
    expect(updated!.musclePriorities).toEqual({ back: 'emphasize' })
  })

  it('musclePriorities is stamped onto the run by mock startTemplate', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useMesoTemplates(), { wrapper: makeHookWrapper() })
    // mesoTemplatesMock[1] ("Upper/Lower Power") carries musclePriorities: { back: 'emphasize' }
    // (mezo-3m5m demo fixture) — starting it must carry that map onto the new run, not
    // silently reset it to all-Grow (the mezo-gbo7 stamp-path defect class re-armed).
    let run: Awaited<ReturnType<typeof result.current.startTemplate>> | undefined
    await act(async () => {
      run = await result.current.startTemplate('b20f0000-0000-4000-8000-000000000000', {
        startDate: '2026-06-16',
        status: 'planned',
      })
    })
    expect(run!.musclePriorities).toEqual({ back: 'emphasize' })
  })

  it('mock mode: rerun on a legacy (untemplated) meso materializes a fresh template and stamps the meso', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { qc, wrapper } = wrap()
    const { result } = renderHook(() => useMesoTemplates(), { wrapper })
    const legacy = mesocycles.find((m) => m.id === 'meso-rec-03')!
    expect(legacy.templateId).toBeUndefined() // the fixture stays untemplated (legacy run)
    let res: Awaited<ReturnType<typeof result.current.rerun>> | undefined
    await act(async () => {
      res = await result.current.rerun('meso-rec-03')
    })
    await waitFor(() => expect(result.current.templates.some((t) => t.id === res!.templateId)).toBe(true))
    const materialized = result.current.templates.find((t) => t.id === res!.templateId)
    expect(materialized?.title).toBe(legacy.title)
    expect(materialized?.runCount).toBe(1)
    const mesos = qc.getQueryData<Mesocycle[]>(['train', 'mesocycles']) ?? mesocycles
    expect(mesos.find((m) => m.id === 'meso-rec-03')?.templateId).toBe(res!.templateId)
  })
})
