import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useWeight } from '@/data/me/weightHooks'
import { useSleep } from '@/data/hooks'
import { usePeople } from '@/data/hooks'
import { people } from '@/data/me/people'
import { QueryWrapper } from '@/test/queryWrapper'

// Assert the Phase-1 mock dataset/behavior, so pin mock mode explicitly.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('useWeight.logWeight appends a mapped WeightEntry to the log', async () => {
  const { result } = renderHook(() => useWeight(), { wrapper: QueryWrapper })
  await waitFor(() => expect(result.current.weightLog.length).toBeGreaterThan(0))
  const before = result.current.weightLog.length
  act(() => {
    result.current.logWeight({ date: '2026-06-08', weightKg: 71.9, note: 'teszt' })
  })
  await waitFor(() => expect(result.current.weightLog.length).toBe(before + 1))
  const last = result.current.weightLog[result.current.weightLog.length - 1]
  expect(last).toMatchObject({ date: '2026-06-08', value: 71.9, note: 'teszt' })
})

test('useSleep.logSleep appends a mapped SleepEntry', async () => {
  const { result } = renderHook(() => useSleep(), { wrapper: QueryWrapper })
  await waitFor(() => expect(result.current.sleepLog.length).toBeGreaterThan(0))
  const before = result.current.sleepLog.length
  act(() => {
    result.current.logSleep({
      date: '2026-06-08', bedtime: '23:00', wakeup: '06:30',
      durationH: 7.5, quality: 8, awakenings: 1, note: 'jó',
    })
  })
  await waitFor(() => expect(result.current.sleepLog.length).toBe(before + 1))
  expect(result.current.lastNight).toMatchObject({ duration: 7.5, quality: 8, awakenings: 1, notes: 'jó' })
})

test('usePeople.logMention prepends an enriched Mention', () => {
  const { result } = renderHook(() => usePeople())
  const before = result.current.mentions.length
  const target = people[0]
  act(() => {
    result.current.logMention({ personId: target.id, tone: 'positive', text: 'jó beszélgetés' })
  })
  expect(result.current.mentions.length).toBe(before + 1)
  expect(result.current.mentions[0]).toMatchObject({
    person_id: target.id, personName: target.name, tone: 'positive',
    excerpt: 'jó beszélgetés', source: 'chip',
  })
})
