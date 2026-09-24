import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FRESH_PULSE_MS, useChangedKeys } from '@/features/today/logic/useChangedKeys'

type Props = { snap: Record<string, string> | null; reset: string }

const setup = (initial: Props) =>
  renderHook(({ snap, reset }: Props) => useChangedKeys(snap, reset), { initialProps: initial })

const ids = (s: ReadonlySet<string>) => [...s].sort()

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useChangedKeys (A napom pulse, mezo-yjzhw.6)', () => {
  test('the first snapshot is the baseline: nothing reported', () => {
    const { result } = setup({ snap: { a: '1', b: '2' }, reset: 'd1' })
    expect(result.current.size).toBe(0)
  })

  test('a value change reports only that id, then clears after the pulse', () => {
    const { result, rerender } = setup({ snap: { a: '1', b: '2' }, reset: 'd1' })
    rerender({ snap: { a: '1', b: '3' }, reset: 'd1' })
    expect(ids(result.current)).toEqual(['b'])
    act(() => { vi.advanceTimersByTime(FRESH_PULSE_MS - 1) })
    expect(ids(result.current)).toEqual(['b'])
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.size).toBe(0)
  })

  test('an equal snapshot (a refetch with the same values) reports nothing', () => {
    const { result, rerender } = setup({ snap: { a: '1' }, reset: 'd1' })
    rerender({ snap: { a: '1' }, reset: 'd1' })
    expect(result.current.size).toBe(0)
  })

  test('the next change replaces the set, and its own timer clears it', () => {
    const { result, rerender } = setup({ snap: { a: '1', b: '2' }, reset: 'd1' })
    rerender({ snap: { a: '2', b: '2' }, reset: 'd1' })
    expect(ids(result.current)).toEqual(['a'])
    act(() => { vi.advanceTimersByTime(1000) })
    rerender({ snap: { a: '2', b: '5' }, reset: 'd1' })
    expect(ids(result.current)).toEqual(['b'])
    // the first change's timer must not cut the second pulse short
    act(() => { vi.advanceTimersByTime(FRESH_PULSE_MS - 1) })
    expect(ids(result.current)).toEqual(['b'])
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.size).toBe(0)
  })

  test('a resetKey change (another date) is a fresh baseline: nothing reported', () => {
    const { result, rerender } = setup({ snap: { a: '1' }, reset: 'd1' })
    rerender({ snap: { a: '9' }, reset: 'd2' })
    expect(result.current.size).toBe(0)
    rerender({ snap: { a: '10' }, reset: 'd2' })
    expect(ids(result.current)).toEqual(['a'])
  })

  test('a null snapshot (loading, a past day) forgets the baseline and clears the set', () => {
    const { result, rerender } = setup({ snap: { a: '1' }, reset: 'd1' })
    rerender({ snap: { a: '2' }, reset: 'd1' })
    expect(ids(result.current)).toEqual(['a'])
    rerender({ snap: null, reset: 'd1' })
    expect(result.current.size).toBe(0)
    rerender({ snap: { a: '3' }, reset: 'd1' })
    expect(result.current.size).toBe(0)
  })

  test('a key with no previous value is not a change', () => {
    const { result, rerender } = setup({ snap: { a: '1' }, reset: 'd1' })
    rerender({ snap: { a: '1', center: '2' }, reset: 'd1' })
    expect(result.current.size).toBe(0)
  })
})
