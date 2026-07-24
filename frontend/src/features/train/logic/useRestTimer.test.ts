import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useRestTimer } from '@/features/train/logic/useRestTimer'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('start -> running with the full duration', () => {
  const { result } = renderHook(() => useRestTimer())
  expect(result.current.status).toBe('idle')
  act(() => result.current.start(90))
  expect(result.current.status).toBe('running')
  expect(result.current.remaining).toBe(90)
  expect(result.current.total).toBe(90)
})

test('the 500ms tick counts remaining down', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(90))
  act(() => vi.advanceTimersByTime(3000))
  expect(result.current.remaining).toBe(87)
})

test('pause freezes remaining; resume continues from the frozen value', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(90))
  act(() => vi.advanceTimersByTime(10_000))
  act(() => result.current.pause())
  expect(result.current.status).toBe('paused')
  expect(result.current.remaining).toBe(80)
  act(() => vi.advanceTimersByTime(60_000)) // time passes while paused…
  expect(result.current.remaining).toBe(80) // …remaining is frozen
  act(() => result.current.resume())
  act(() => vi.advanceTimersByTime(5000))
  expect(result.current.status).toBe('running')
  expect(result.current.remaining).toBe(75)
})

test('skip returns to idle immediately', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(90))
  act(() => result.current.skip())
  expect(result.current.status).toBe('idle')
  expect(result.current.remaining).toBe(0)
  expect(result.current.total).toBe(0)
})

test('natural expiry self-clears to idle', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(2))
  act(() => vi.advanceTimersByTime(2500))
  expect(result.current.status).toBe('idle')
})

test('pause after the deadline (before the tick lands) ends the rest', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(1))
  act(() => vi.setSystemTime(Date.now() + 5000)) // clock past endsAt, no tick yet
  act(() => result.current.pause())
  expect(result.current.status).toBe('idle')
})
