// ============================================================
// Learned-expenditure part 2 FE data layer (mezo-3n2so, Task 8) — history, the weekly-summary
// card, live day statuses, and the day-mark mutation that re-chains the learned base.
//
// Mock mode proves the seed is internally consistent (a card is there, marking COMPLETE on a
// suspicious day both moves the applied base by the documented −40 kcal AND flips the day's
// status in `useIntakeDays`, and dismissing the card empties it). Real mode proves the wiring:
// a 204 answers `null`, and the mark mutation issues the exact PUT the backend contract expects.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import {
  useExpenditureHistory, useExpenditureWeeklyCard, useIntakeDays, useIntakeDayMark,
  useDismissWeeklyCard,
} from '@/data/fuel/expenditureHooks'
import { intakeDaysSeed, todayIso } from '@/data/fuel/expenditureLearningSeed'
import type { IntakeDayMarkResult } from '@/data/fuel/expenditureApi'
import { addDays } from '@/shared/lib/dates'

afterEach(() => vi.unstubAllEnvs())

describe('learned-expenditure hooks (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the 12-week history with the learning switch on', () => {
    const { result } = renderHook(() => useExpenditureHistory(), { wrapper: makeHookWrapper() })
    expect(result.current.data).not.toBeNull()
    expect(result.current.data?.learningEnabled).toBe(true)
    expect(result.current.data?.weeks.length).toBeGreaterThan(0)
  })

  it('serves a weekly-summary card', () => {
    const { result } = renderHook(() => useExpenditureWeeklyCard(), { wrapper: makeHookWrapper() })
    expect(result.current.card).not.toBeNull()
    expect(result.current.card?.stepKcal).toBe(60)
    expect(result.current.card?.excludedDays).toHaveLength(2)
  })

  it('marking a suspicious day COMPLETE moves the applied base by −40 kcal and flips its status', async () => {
    const suspicious = intakeDaysSeed().find((d) => d.status === 'suspicious' && d.date !== todayIso())
    if (!suspicious) throw new Error('seed must carry an unmarked suspicious day before today')
    const from = intakeDaysSeed()[0].date
    const to = todayIso()
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ days: useIntakeDays(from, to), mark: useIntakeDayMark() }), { wrapper })
    await waitFor(() => expect(result.current.days.days.length).toBeGreaterThan(0))

    let outcome: IntakeDayMarkResult | undefined
    await act(async () => { outcome = await result.current.mark.setMark(suspicious.date, 'complete') })
    expect(outcome).toBeDefined()
    expect(outcome).toMatchObject({
      appliedBaseAfterKcal: (outcome!.appliedBaseBeforeKcal ?? 0) - 40,
      recomputed: true,
    })

    await waitFor(() => {
      const day = result.current.days.days.find((d) => d.date === suspicious.date)
      expect(day?.status).toBe('confirmed_complete')
    })
  })

  it("marking TODAY doesn't recompute — before equals after", async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ days: useIntakeDays(addDays(todayIso(), -13), todayIso()), mark: useIntakeDayMark() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.days.days.length).toBeGreaterThan(0))
    let outcome: IntakeDayMarkResult | undefined
    await act(async () => { outcome = await result.current.mark.setMark(todayIso(), 'incomplete') })
    expect(outcome).toBeDefined()
    expect(outcome!.recomputed).toBe(false)
    expect(outcome!.appliedBaseAfterKcal).toBe(outcome!.appliedBaseBeforeKcal)
  })

  it('dismissing the weekly card empties it', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ card: useExpenditureWeeklyCard(), dismiss: useDismissWeeklyCard() }), { wrapper })
    expect(result.current.card.card).not.toBeNull()
    await act(() => result.current.dismiss.dismiss(result.current.card.card!.weekStart))
    await waitFor(() => expect(result.current.card.card).toBeNull())
  })
})

describe('learned-expenditure hooks (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('a 204 weekly-card answers null', async () => {
    server.use(http.get(`${API_BASE}/api/goals/expenditure/weekly-card`, () => new HttpResponse(null, { status: 204 })))
    const { result } = renderHook(() => useExpenditureWeeklyCard(), { wrapper: makeHookWrapper() })
    expect(result.current.card).toBeNull()
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.card).toBeNull()
  })

  it('a 200 history answers the payload', async () => {
    server.use(http.get(`${API_BASE}/api/goals/expenditure/weeks`, () => HttpResponse.json({
      learningEnabled: true,
      weeks: [{
        weekStart: '2026-09-14', status: 'updated', confidence: 'medium', formulaBaseKcal: 2400,
        posteriorBaseKcal: 2450, posteriorSdKcal: 165, appliedBaseKcal: 2420, stepKcal: -20,
        usableDays: 6, weighInDays: 4,
      }],
    })))
    const { result } = renderHook(() => useExpenditureHistory(), { wrapper: makeHookWrapper() })
    expect(result.current.data).toBeNull()
    await waitFor(() => expect(result.current.data?.weeks).toHaveLength(1))
  })

  it('setMark PUTs /api/goals/expenditure/days/{date}/mark with the status body', async () => {
    let putPath = ''
    let putBody: unknown
    server.use(
      http.put(`${API_BASE}/api/goals/expenditure/days/2026-09-23/mark`, async ({ request }) => {
        putPath = new URL(request.url).pathname
        putBody = await request.json()
        return HttpResponse.json({
          day: { date: '2026-09-23', kcal: 1180, status: 'confirmed_complete', mark: 'complete' },
          appliedBaseBeforeKcal: 2480, appliedBaseAfterKcal: 2440, recomputed: true,
        })
      }),
    )
    const { result } = renderHook(() => useIntakeDayMark(), { wrapper: makeHookWrapper() })
    let outcome: IntakeDayMarkResult | undefined
    await act(async () => { outcome = await result.current.setMark('2026-09-23', 'complete') })
    expect(putPath).toBe('/api/goals/expenditure/days/2026-09-23/mark')
    expect(putBody).toEqual({ status: 'complete' })
    expect(outcome).toMatchObject({ appliedBaseAfterKcal: 2440, recomputed: true })
  })
})
