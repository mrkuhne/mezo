import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useSlotTemplates, useSlotTemplateActions } from '@/data/fuel/slotTemplateHooks'
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
