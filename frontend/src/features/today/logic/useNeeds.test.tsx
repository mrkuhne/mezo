import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useNeeds } from '@/features/today/logic/useNeeds'

describe('useNeeds (mock mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-17T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('resolves all 6 rings with finite 0..100 values, not all zero', async () => {
    const now = new Date()
    const { result } = renderHook(() => useNeeds(now), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.isPending).toBe(false))

    expect(result.current.states).toHaveLength(6)
    const keys = result.current.states.map((s) => s.key)
    expect(keys).toEqual(['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend'])

    for (const state of result.current.states) {
      expect(Number.isFinite(state.pct)).toBe(true)
      expect(state.pct).toBeGreaterThanOrEqual(0)
      expect(state.pct).toBeLessThanOrEqual(100)
    }
    // The mock fuel/habit seeds carry real logged meals/ticks, so at least one ring
    // must be above 0 — a fully-zeroed set would mean the adapter dropped every event.
    expect(result.current.states.some((s) => s.pct > 0)).toBe(true)
  })
})
