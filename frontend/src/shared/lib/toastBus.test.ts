import { afterEach, expect, test, vi } from 'vitest'
import { emitToast, isRewardToast, onToast, type ToastMessage } from '@/shared/lib/toastBus'

let off: (() => void) | null = null
afterEach(() => { off?.(); off = null; vi.restoreAllMocks() })

const listen = () => {
  const seen: ToastMessage[] = []
  off = onToast((t) => seen.push(t))
  return seen
}

test('a simple toast megy át változatlanul', () => {
  const seen = listen()
  emitToast({ kind: 'success', text: 'Mentve' })
  expect(seen).toEqual([{ kind: 'success', text: 'Mentve' }])
})

test('a reward toast minden mezője átmegy', () => {
  const seen = listen()
  emitToast({
    kind: 'reward',
    eyebrow: 'Szokás · 2 / 3',
    title: 'Napi szándék',
    meter: { label: 'Mentális', delta: 15 },
    levelUp: { label: 'Mentális', from: 3, to: 4 },
  })
  expect(seen[0]).toMatchObject({
    kind: 'reward', eyebrow: 'Szokás · 2 / 3', title: 'Napi szándék',
    meter: { label: 'Mentális', delta: 15 }, levelUp: { label: 'Mentális', from: 3, to: 4 },
  })
})

test('isRewardToast a kind alapján szűr', () => {
  expect(isRewardToast({ kind: 'reward', eyebrow: 'Küldetés', title: 'Vízivás' })).toBe(true)
  expect(isRewardToast({ kind: 'success', text: 'Mentve' })).toBe(false)
  expect(isRewardToast({ kind: 'error', text: 'Hiba' })).toBe(false)
})
