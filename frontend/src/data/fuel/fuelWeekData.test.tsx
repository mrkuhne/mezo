import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useFuelWeek, useReplanScenarios, useStackRecommendations } from '@/data/hooks'
import { makeHookWrapper } from '@/test/queryWrapper'

// Mock-mode seed parity. useFuelWeek became a composed dual-mode hook (Fuel P4) — its real
// branch is covered in fuelWeekHooks.test.tsx; useStackRecommendations stays mode-aware
// (mock seed vs honest-empty []), so pinning mock mode keeps these seed assertions stable.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('useFuelWeek returns 7 reta days, gym schedule, supplement matrix, patterns', () => {
  const { result } = renderHook(() => useFuelWeek(), { wrapper: makeHookWrapper() })
  expect(result.current.retaWeek).toHaveLength(7)
  expect(result.current.retaWeek[2].label).toBe('Stable')
  expect(result.current.gymSchedule).toHaveLength(7)
  expect(result.current.weeklySupplements.length).toBeGreaterThan(0)
  expect(result.current.patterns.length).toBe(4)
})

test('useReplanScenarios returns scenarios with cascades', () => {
  const { result } = renderHook(() => useReplanScenarios())
  expect(result.current.scenarios.length).toBeGreaterThan(0)
  expect(result.current.scenarios[0].cascades.length).toBeGreaterThan(0)
})

test('useStackRecommendations returns 3 recommendations', () => {
  const { result } = renderHook(() => useStackRecommendations())
  expect(result.current.recommendations).toHaveLength(3)
})
