import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { useMesoTemplates } from '@/data/train/mesoTemplateHooks'
import { mesoTemplatesMock } from '@/data/train/train'

afterEach(() => vi.unstubAllEnvs())

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
})
