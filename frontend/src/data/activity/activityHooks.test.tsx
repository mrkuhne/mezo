import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useActivities, useActivityActions } from '@/data/hooks'
import type { ActivityWriteResult } from '@/data/activity/activityApi'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-11'

describe('useActivities (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the 3-entry seed synchronously', () => {
    const { result } = renderHook(() => useActivities(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data).toHaveLength(3)
    expect(result.current.data[0].id).toBe('act1')
    expect(result.current.data[2].skillKey).toBeNull()
  })
})

describe('useActivityActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('logActivity prepends an AI-categorized entry', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useActivities(DATE), { wrapper })
    const actions = renderHook(() => useActivityActions(DATE), { wrapper })
    expect(list.result.current.data).toHaveLength(3)

    await act(async () => {
      await actions.result.current.logActivity('Meditáltam 10 percet')
    })

    await waitFor(() => expect(list.result.current.data).toHaveLength(4))
    expect(list.result.current.data[0].text).toBe('Meditáltam 10 percet')
    expect(list.result.current.data[0].categorizedBy).toBe('AI')
    expect(list.result.current.data[0].skillKey).toBe('learning')
  })

  test('categorize sets skillKey + USER on the uncategorized seed entry', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useActivities(DATE), { wrapper })
    const actions = renderHook(() => useActivityActions(DATE), { wrapper })

    await act(async () => {
      await actions.result.current.categorize('act3', 'productivity')
    })

    await waitFor(() =>
      expect(list.result.current.data.find((e) => e.id === 'act3')?.skillKey).toBe('productivity'),
    )
    const entry = list.result.current.data.find((e) => e.id === 'act3')!
    expect(entry.categorizedBy).toBe('USER')
    expect(entry.xpAwarded).toBe(10) // was 0 → e.xpAwarded || 10
  })
})

describe('useActivities (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('resolves the empty day from the default handler', async () => {
    const { result } = renderHook(() => useActivities(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toEqual([])
  })
})

describe('useActivityActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('logActivity resolves a write result with the AI-categorized entry', async () => {
    const { result } = renderHook(() => useActivityActions(DATE), { wrapper: makeHookWrapper() })
    let res: ActivityWriteResult | undefined
    await act(async () => {
      res = await result.current.logActivity('Olvastam 10 percet')
    })
    expect(res!.entry.text).toBe('Olvastam 10 percet')
    expect(res!.entry.skillKey).toBe('learning')
    expect(res!.entry.categorizedBy).toBe('AI')
    expect(res!.completedQuest).toBeNull()
    expect(res!.levelUps).toEqual([])
  })
})
