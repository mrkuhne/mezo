import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UNDO_MS, useForgetUndo } from '@/features/insights/hooks/useForgetUndo'

describe('useForgetUndo', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('undo inside the window sends nothing', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'f:1', label: 'x', computed: false, commit }))
    expect(result.current.isHidden('f:1')).toBe(true)
    act(() => { vi.advanceTimersByTime(UNDO_MS - 1) })
    act(() => result.current.undo())
    act(() => { vi.advanceTimersByTime(UNDO_MS * 2) })
    expect(commit).not.toHaveBeenCalled()
    expect(result.current.isHidden('f:1')).toBe(false)
  })

  it('expiry sends exactly one commit', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'f:1', label: 'x', computed: false, commit }))
    act(() => { vi.advanceTimersByTime(UNDO_MS) })
    act(() => { vi.advanceTimersByTime(UNDO_MS) })
    expect(commit).toHaveBeenCalledTimes(1)
    expect(result.current.pending).toBeNull()
  })

  it('a second forget commits the first immediately', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'f:1', label: 'a', computed: false, commit: first }))
    act(() => result.current.start({ key: 'f:2', label: 'b', computed: false, commit: second }))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(result.current.isHidden('f:2')).toBe(true)
  })

  it('unmount commits a pending forget (leaving is not an undo)', () => {
    const commit = vi.fn()
    const { result, unmount } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'e:event:munka', label: 'Munka', computed: true, commit }))
    unmount()
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
