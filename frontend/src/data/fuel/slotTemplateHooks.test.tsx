import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useSlotTemplates, useSlotTemplateActions, useSlotTemplateEvaluation } from '@/data/fuel/slotTemplateHooks'
import type { SlotTemplate } from '@/data/types'

afterEach(() => vi.unstubAllEnvs())

const SAMPLE: SlotTemplate = {
  dayType: 'training_am',
  slots: [
    { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchor: { type: 'wake', offsetMin: 30 }, budgetPct: 25 },
    { label: 'Edzés előtt', slotKind: 'snack', role: 'pre_workout', anchor: { type: 'training_start', offsetMin: -45 }, budgetPct: 15 },
  ],
}

describe('useSlotTemplates (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('starts empty, putTemplate adds it, deleteTemplate empties it', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ read: useSlotTemplates(), act: useSlotTemplateActions() }),
      { wrapper },
    )
    expect(result.current.read.templates).toEqual([])

    await act(() => result.current.act.putTemplate(SAMPLE))
    await waitFor(() => expect(result.current.read.templates).toEqual([SAMPLE]))

    await act(() => result.current.act.deleteTemplate(SAMPLE.dayType))
    await waitFor(() => expect(result.current.read.templates).toEqual([]))
  })
})

describe('useSlotTemplates (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts empty, then loads the server list (fixed anchor mapped from wire)', async () => {
    server.use(
      http.get(`${API_BASE}/api/fuel/slot-templates`, () =>
        HttpResponse.json({
          templates: [
            {
              dayType: 'rest',
              slots: [
                { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchorType: 'fixed', time: '07:30', budgetPct: 30 },
              ],
            },
          ],
        })),
    )
    const { result } = renderHook(() => useSlotTemplates(), { wrapper: makeHookWrapper() })
    expect(result.current.templates).toEqual([])
    await waitFor(() => expect(result.current.templates).toEqual([
      {
        dayType: 'rest',
        slots: [
          { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchor: { type: 'fixed', time: '07:30' }, budgetPct: 30 },
        ],
      },
    ]))
  })

  it('putTemplate PUTs the flattened wire body and invalidates the list', async () => {
    let putBody: unknown
    server.use(
      http.put(`${API_BASE}/api/fuel/slot-templates/:dayType`, async ({ params, request }) => {
        putBody = await request.json()
        return HttpResponse.json({ dayType: params.dayType, ...(putBody as object) })
      }),
      http.get(`${API_BASE}/api/fuel/slot-templates`, () =>
        HttpResponse.json({ templates: [{
          dayType: 'training_am',
          slots: [
            { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchorType: 'wake', offsetMin: 30, budgetPct: 25 },
            { label: 'Edzés előtt', slotKind: 'snack', role: 'pre_workout', anchorType: 'training_start', offsetMin: -45, budgetPct: 15 },
          ],
        }] })),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ read: useSlotTemplates(), act: useSlotTemplateActions() }),
      { wrapper },
    )
    await act(() => result.current.act.putTemplate(SAMPLE))
    expect(putBody).toEqual({
      slots: [
        { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', budgetPct: 25, anchorType: 'wake', offsetMin: 30 },
        { label: 'Edzés előtt', slotKind: 'snack', role: 'pre_workout', budgetPct: 15, anchorType: 'training_start', offsetMin: -45 },
      ],
    })
    await waitFor(() => expect(result.current.read.templates).toEqual([SAMPLE]))
  })

  it('deleteTemplate DELETEs the dayType and invalidates the list', async () => {
    let deletedDayType: string | undefined
    server.use(
      http.delete(`${API_BASE}/api/fuel/slot-templates/:dayType`, ({ params }) => {
        deletedDayType = params.dayType as string
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(`${API_BASE}/api/fuel/slot-templates`, () => HttpResponse.json({ templates: [] })),
    )
    const { result } = renderHook(() => useSlotTemplateActions(), { wrapper: makeHookWrapper() })
    await act(() => result.current.deleteTemplate('training_am'))
    expect(deletedDayType).toBe('training_am')
  })
})

describe('useSlotTemplateEvaluation (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('resolves the canned verdict after the demo delay — stateless (no cache write)', async () => {
    const { result } = renderHook(() => useSlotTemplateEvaluation(), { wrapper: makeHookWrapper() })
    expect(result.current.pending).toBe(false)

    let verdict: unknown
    act(() => {
      void result.current.evaluate({
        dayType: 'rest',
        rows: SAMPLE.slots,
        resolvedTimes: [{ label: 'Reggeli', time: '07:00' }],
        budget: { kcal: 2200, p: 160, c: 220, f: 70 },
        balanceKcal: -300,
        blocks: [],
      }).then(v => { verdict = v })
    })
    await waitFor(() => expect(result.current.pending).toBe(true))
    await waitFor(() => expect(verdict).toEqual({
      verdict: 'ok',
      summary: 'A felosztás illik a célodhoz — a fehérje-elosztás és az edzés körüli időzítés rendben van.',
      suggestions: [],
    }))
    await waitFor(() => expect(result.current.pending).toBe(false))
  })
})

describe('useSlotTemplateEvaluation (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('POSTs the flattened wire body (dayType + toWireSlot slots + resolvedTimes/budget/balance/blocks) and returns the server verdict', async () => {
    let body: unknown
    server.use(
      http.post(`${API_BASE}/api/fuel/slot-templates/evaluate`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          verdict: 'adjust',
          summary: 'Igazíts a fehérje-elosztáson.',
          suggestions: [{ slotLabel: 'Ebéd', text: 'Emeld a fehérjét 10g-mal.' }],
        })
      }),
    )
    const { result } = renderHook(() => useSlotTemplateEvaluation(), { wrapper: makeHookWrapper() })

    let verdict: unknown
    await act(async () => {
      verdict = await result.current.evaluate({
        dayType: 'training_am',
        rows: SAMPLE.slots,
        resolvedTimes: [
          { label: 'Reggeli', time: '07:00' },
          { label: 'Edzés előtt', time: '07:15' },
        ],
        budget: { kcal: 2400, p: 180, c: 260, f: 75 },
        balanceKcal: -250,
        blocks: [{ kind: 'gym', time: '08:00', durationMin: 60, label: 'Gym' }],
      })
    })

    expect(body).toEqual({
      dayType: 'training_am',
      slots: [
        { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', budgetPct: 25, anchorType: 'wake', offsetMin: 30 },
        { label: 'Edzés előtt', slotKind: 'snack', role: 'pre_workout', budgetPct: 15, anchorType: 'training_start', offsetMin: -45 },
      ],
      resolvedTimes: [
        { label: 'Reggeli', time: '07:00' },
        { label: 'Edzés előtt', time: '07:15' },
      ],
      budget: { kcal: 2400, p: 180, c: 260, f: 75 },
      balanceKcal: -250,
      blocks: [{ kind: 'gym', time: '08:00', durationMin: 60 }],
    })
    expect(verdict).toEqual({
      verdict: 'adjust',
      summary: 'Igazíts a fehérje-elosztáson.',
      suggestions: [{ slotLabel: 'Ebéd', text: 'Emeld a fehérjét 10g-mal.' }],
    })
  })
})
