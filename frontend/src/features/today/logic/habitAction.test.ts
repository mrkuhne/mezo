import { describe, expect, test } from 'vitest'
import { habitAction } from '@/features/today/logic/habitAction'
import { mockHabitDay } from '@/data/habit/habitMock'

const byKey = (k: string) => mockHabitDay.find((h) => h.key === k)!

describe('habitAction', () => {
  test('manual habits are checkable', () => {
    expect(habitAction({ ...byKey('morning_sunlight'), status: 'pending' })).toEqual({ kind: 'check' })
  })
  test('derived habits tap through to their logging surface', () => {
    expect(habitAction({ ...byKey('wake_on_time'), status: 'pending' })).toEqual({ kind: 'nav', to: '/me/sleep' })
    expect(habitAction({ ...byKey('morning_weigh_in'), status: 'pending' })).toEqual({ kind: 'nav', to: '/me/weight' })
    expect(habitAction({ ...byKey('morning_coffee'), status: 'pending' })).toEqual({ kind: 'nav', to: '/fuel/stack' })
    expect(habitAction({ ...byKey('morning_workout'), status: 'pending' })).toEqual({ kind: 'nav', to: '/train' })
    expect(habitAction({ ...byKey('protein_breakfast'), status: 'pending' })).toEqual({ kind: 'meal-sheet' })
    expect(habitAction({ ...byKey('caffeine_cutoff'), status: 'pending' })).toEqual({ kind: 'none' })
  })
  test('done/missed habits have no action', () => {
    expect(habitAction(byKey('wake_on_time'))).toEqual({ kind: 'none' }) // seed status: done
  })
})
