import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { makeHookWrapperWithClient } from '@/test/queryWrapper'
import { API_BASE, setToken } from '@/data/_client/api'
import { useAdviceActions } from '@/data/today/adviceHooks'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

const APPLY_RESPONSE = { id: 'card1', appliedActionKey: 'skip_sport_slot', appliedAt: '2026-09-05T10:00:00Z' }

test('real mode: a successful skip_sport_slot apply invalidates the sport-slot-skips query (mezo-d58h.5 review fix)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  server.use(http.post(`${API_BASE}/api/proactive/advice/:id/apply`, () => HttpResponse.json(APPLY_RESPONSE)))
  const { wrapper, client } = makeHookWrapperWithClient()
  // Seed cached data under keys a successful apply must touch — asserted on the QUERY CLIENT
  // afterward (isInvalidated), not on any re-render.
  client.setQueryData(['train', 'sportSlotSkips', '2026-09-07'], [])
  client.setQueryData(['companionFeed', '2026-09-08'], [])

  const { result } = renderHook(() => useAdviceActions(), { wrapper })
  result.current.apply('card1', 'skip_sport_slot')

  await waitFor(() => expect(result.current.pending).toBe(false))
  expect(client.getQueryState(['train', 'sportSlotSkips', '2026-09-07'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['companionFeed', '2026-09-08'])?.isInvalidated).toBe(true)
})

test('real mode: a successful shift_sleep_anchor apply invalidates sleepGoal/habitDay/fuelDay but NOT the sport-slot-skips query (mezo-d58h.5 review fix)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  server.use(http.post(`${API_BASE}/api/proactive/advice/:id/apply`, () =>
    HttpResponse.json({ ...APPLY_RESPONSE, appliedActionKey: 'shift_sleep_anchor' })))
  const { wrapper, client } = makeHookWrapperWithClient()
  client.setQueryData(['train', 'sportSlotSkips', '2026-09-07'], [])
  client.setQueryData(['companionFeed', '2026-09-08'], [])
  client.setQueryData(['sleepGoal'], {})
  client.setQueryData(['habitDay'], {})
  client.setQueryData(['fuelDay'], {})

  const { result } = renderHook(() => useAdviceActions(), { wrapper })
  result.current.apply('card1', 'shift_sleep_anchor')

  await waitFor(() => expect(result.current.pending).toBe(false))
  // The companion feed is ALWAYS invalidated (every action re-fetches the card's own `applied`
  // stamp from server truth) — only the EXTRA, action-specific key is action-scoped.
  expect(client.getQueryState(['companionFeed', '2026-09-08'])?.isInvalidated).toBe(true)
  // This is the action a user can actually apply in round 1 (the only key `forCard` offers) — it
  // mutates `sleep_goal`, so it must invalidate everything `useSleepGoalActions` itself
  // invalidates (sleepHooks.ts), which in turn cascades into every surface reading `sleepGoal`.
  expect(client.getQueryState(['sleepGoal'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['habitDay'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['fuelDay'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['train', 'sportSlotSkips', '2026-09-07'])?.isInvalidated).toBe(false)
})

test('real mode: a successful lighten_tomorrow apply invalidates the workoutToday query (mezo-d58h.5)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  server.use(http.post(`${API_BASE}/api/proactive/advice/:id/apply`, () =>
    HttpResponse.json({ ...APPLY_RESPONSE, appliedActionKey: 'lighten_tomorrow' })))
  const { wrapper, client } = makeHookWrapperWithClient()
  // Seed both the plain today context and a pinned-day session — the prefix match
  // (`['train','workoutToday']`) must invalidate both, matching every other workoutToday writer.
  client.setQueryData(['train', 'workoutToday', null], {})
  client.setQueryData(['train', 'workoutToday', '2026-09-08'], {})
  client.setQueryData(['companionFeed', '2026-09-08'], [])

  const { result } = renderHook(() => useAdviceActions(), { wrapper })
  result.current.apply('card1', 'lighten_tomorrow')

  await waitFor(() => expect(result.current.pending).toBe(false))
  expect(client.getQueryState(['train', 'workoutToday', null])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['train', 'workoutToday', '2026-09-08'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['companionFeed', '2026-09-08'])?.isInvalidated).toBe(true)
})

test('mock mode: apply is a no-op and invalidates nothing', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { wrapper, client } = makeHookWrapperWithClient()
  client.setQueryData(['train', 'sportSlotSkips', '2026-09-07'], [])

  const { result } = renderHook(() => useAdviceActions(), { wrapper })
  result.current.apply('card1', 'skip_sport_slot')

  await waitFor(() => expect(result.current.pending).toBe(false))
  expect(client.getQueryState(['train', 'sportSlotSkips', '2026-09-07'])?.isInvalidated).toBe(false)
})
