import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useMesoPlanGenerate } from '@/data/train/mesoPlanHooks'

const input = { daysOfWeek: ['Hét', 'Sze', 'Pén', 'Szo'], weeks: 6, priorities: { back: 'emphasize' }, goalText: 'röpi' }

describe('useMesoPlanGenerate', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('mock mode: answers synchronously with a 7-day deterministic proposal, llmUsed false', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useMesoPlanGenerate(), { wrapper: makeHookWrapper() })
    let p!: Awaited<ReturnType<typeof result.current.generate>>
    await act(async () => { p = await result.current.generate(input) })
    expect(p.llmUsed).toBe(false)
    expect(p.template.days).toHaveLength(7)
    expect(p.days).toHaveLength(7)
    expect(p.days.every((d) => typeof d.id === 'string')).toBe(true)
    expect(p.template.split).toBe('Upper / Lower · 4×/hét')
    const backSets = p.template.days.flatMap((d) => d.exercises ?? []).filter((e) => (e.muscle ?? '').startsWith('back')).reduce((s, e) => s + e.workingSets, 0)
    expect(backSets).toBe(12)
  })

  it('real mode: posts the request and maps the response', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let posted: unknown = null
    server.use(http.post(`${API_BASE}/api/train/meso-plans/generate`, async ({ request }) => {
      posted = await request.json()
      return HttpResponse.json({
        template: { title: 'Hypertrophy · Ősz', weeks: 6, phaseCurve: ['MEV', 'Deload'], split: 'Upper / Lower · 4×/hét', goalPreset: 'hypertrophy', days: [{ day: 'Hét', type: 'Upper', exercises: [] }] },
        rationale: 'teszt', llmUsed: true,
      })
    }))
    const { result } = renderHook(() => useMesoPlanGenerate(), { wrapper: makeHookWrapper() })
    let p!: Awaited<ReturnType<typeof result.current.generate>>
    await act(async () => { p = await result.current.generate(input) })
    expect(posted).toMatchObject({ daysOfWeek: input.daysOfWeek, weeks: 6, priorities: { back: 'emphasize' }, goalText: 'röpi' })
    expect(p.llmUsed).toBe(true)
    expect(p.rationale).toBe('teszt')
    await waitFor(() => expect(result.current.generating).toBe(false))
  })
})
