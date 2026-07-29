import { renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useChainCelebration } from '@/features/today/logic/useChainCelebration'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

let off: (() => void) | null = null
const listen = () => {
  const seen: ToastMessage[] = []
  off = onToast((t) => seen.push(t))
  return seen
}
afterEach(() => { off?.(); off = null; vi.restoreAllMocks() })

test('celebrates the edge into completion', () => {
  const seen = listen()
  const { rerender } = renderHook(({ c }) => useChainCelebration(c, '🌅 Tökéletes reggel'),
    { initialProps: { c: false } })
  expect(seen).toEqual([])
  rerender({ c: true })
  expect(seen).toEqual([{ kind: 'success', text: '🌅 Tökéletes reggel' }])
})

test('a dep change while STILL complete does not re-celebrate (the wasComplete edge guard)', () => {
  const seen = listen()
  const { rerender } = renderHook(({ c, t }) => useChainCelebration(c, t),
    { initialProps: { c: true, t: '🌅 Tökéletes reggel' } })
  expect(seen).toHaveLength(1)
  // The effect re-runs (its `text` dep changed) but the chain never left completion.
  rerender({ c: true, t: '🌙 Tökéletes este' })
  expect(seen).toHaveLength(1)
})

test('a fresh completion after falling out of it celebrates again', () => {
  const seen = listen()
  const { rerender } = renderHook(({ c }) => useChainCelebration(c, '🌙 Tökéletes este'),
    { initialProps: { c: true } })
  rerender({ c: false })
  rerender({ c: true })
  expect(seen).toHaveLength(2)
})

test('an incomplete chain never celebrates', () => {
  const seen = listen()
  const { rerender } = renderHook(({ c }) => useChainCelebration(c, '🌅 Tökéletes reggel'),
    { initialProps: { c: false } })
  rerender({ c: false })
  expect(seen).toEqual([])
})
