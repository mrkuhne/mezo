import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useStickyTab } from '@/lib/useStickyTab'

// Note: the global test setup (src/test/setup.ts) clears sessionStorage after
// every test, so each case starts from a clean slate.

type Seg = 'week' | 'log' | 'blocks'

test('defaults to the fallback when nothing has been remembered', () => {
  const { result } = renderHook(() => useStickyTab<Seg>('t.default', 'week'))
  expect(result.current[0]).toBe('week')
})

test('remembers the last value across a remount (same key, fresh instance)', () => {
  const first = renderHook(() => useStickyTab<Seg>('t.shared', 'week'))
  act(() => first.result.current[1]('blocks'))
  expect(first.result.current[0]).toBe('blocks')
  first.unmount() // simulate navigating away (the view unmounts)

  // Re-mount as a brand-new hook instance — simulates breadcrumb-back to the view.
  const second = renderHook(() => useStickyTab<Seg>('t.shared', 'week'))
  expect(second.result.current[0]).toBe('blocks') // restored, not the fallback
})

test('different keys are independent', () => {
  const a = renderHook(() => useStickyTab<Seg>('t.a', 'week'))
  act(() => a.result.current[1]('blocks'))
  const b = renderHook(() => useStickyTab<Seg>('t.b', 'week'))
  expect(b.result.current[0]).toBe('week')
})
