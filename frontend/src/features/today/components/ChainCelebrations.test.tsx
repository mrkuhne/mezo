import { render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

let off: (() => void) | null = null
const listen = () => {
  const seen: ToastMessage[] = []
  off = onToast((t) => seen.push(t))
  return seen
}
afterEach(() => { off?.(); off = null; vi.restoreAllMocks() })

test('fires one toast per chain that completes, independently', () => {
  const seen = listen()
  const { rerender } = render(
    <ChainCelebrations chains={[
      { id: 'a', done: 1, total: 2, text: 'A kész' },
      { id: 'b', done: 0, total: 3, text: 'B kész' },
    ]}
    />,
  )
  expect(seen).toEqual([])
  rerender(
    <ChainCelebrations chains={[
      { id: 'a', done: 2, total: 2, text: 'A kész' },
      { id: 'b', done: 0, total: 3, text: 'B kész' },
    ]}
    />,
  )
  expect(seen).toEqual([{ kind: 'success', text: 'A kész' }])
  rerender(
    <ChainCelebrations chains={[
      { id: 'a', done: 2, total: 2, text: 'A kész' },
      { id: 'b', done: 3, total: 3, text: 'B kész' },
    ]}
    />,
  )
  expect(seen).toEqual([{ kind: 'success', text: 'A kész' }, { kind: 'success', text: 'B kész' }])
})

test('an empty chains list fires nothing', () => {
  const seen = listen()
  render(<ChainCelebrations chains={[]} />)
  expect(seen).toEqual([])
})

test('a chain with total 0 (no defs) never celebrates', () => {
  const seen = listen()
  render(<ChainCelebrations chains={[{ id: 'x', done: 0, total: 0, text: 'X kész' }]} />)
  expect(seen).toEqual([])
})
