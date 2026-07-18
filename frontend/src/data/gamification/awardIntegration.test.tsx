import { act, renderHook, waitFor } from '@testing-library/react'
import { useGamification } from '@/data/gamification/gamificationHooks'
import { useWeight } from '@/data/me/weightHooks'
import { useActivityActions } from '@/data/activity/activityHooks'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('mock logWeight feeds account XP and the daily streak', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(() => ({ w: useWeight(), g: useGamification() }), { wrapper })
  const before = result.current.g.profile.totalXp // 3140
  act(() => result.current.w.logWeight({ date: '2026-07-18', weightKg: 76.4 }))
  await waitFor(() => expect(result.current.g.profile.totalXp).toBe(before + 10))
  expect(result.current.g.profile.streakDays).toBe(7) // seed 6 + first log today
  expect(result.current.g.profile.coins).toBe(240 + 50) // 7-day milestone
})

test('mock logActivity awards the entry xpAwarded (15)', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(
    () => ({ a: useActivityActions('2026-07-18'), g: useGamification() }),
    { wrapper },
  )
  const before = result.current.g.profile.totalXp
  await act(() => result.current.a.logActivity('Olvastam 30 percet'))
  await waitFor(() => expect(result.current.g.profile.totalXp).toBe(before + 15))
})
