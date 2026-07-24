import { describe, expect, test } from 'vitest'
import { habitAction } from '@/features/today/logic/habitAction'
import { mockHabitDay } from '@/data/habit/habitMock'

const byKey = (k: string) => mockHabitDay.find((h) => h.key === k)!

describe('habitAction', () => {
  test('manual habits are checkable', () => {
    expect(habitAction({ ...byKey('morning_sunlight'), status: 'pending' })).toEqual({ kind: 'check' })
  })
  test('sleep-derived habits open the sleep sheet inline', () => {
    expect(habitAction({ ...byKey('wake_on_time'), status: 'pending' })).toEqual({ kind: 'sleep-sheet' })
    expect(habitAction({ ...byKey('bed_on_time'), status: 'pending' })).toEqual({ kind: 'sleep-sheet' })
  })
  test('derived habits tap through to their logging surface', () => {
    expect(habitAction({ ...byKey('morning_weigh_in'), status: 'pending' })).toEqual({ kind: 'nav', to: '/me/weight' })
    expect(habitAction({ ...byKey('morning_coffee'), status: 'pending' })).toEqual({ kind: 'nav', to: '/fuel/stack' })
    expect(habitAction({ ...byKey('morning_workout'), status: 'pending' })).toEqual({ kind: 'nav', to: '/train' })
    expect(habitAction({ ...byKey('protein_breakfast'), status: 'pending' })).toEqual({ kind: 'meal-sheet' })
    expect(habitAction({ ...byKey('caffeine_cutoff'), status: 'pending' })).toEqual({ kind: 'none' })
  })
  test('intention habits open their own surfaces', () => {
    expect(habitAction({ ...byKey('morning_sunlight'), mode: 'DERIVED', key: 'daily_intention', status: 'pending' }))
      .toEqual({ kind: 'intention-sheet' })
    expect(habitAction({ ...byKey('morning_sunlight'), mode: 'DERIVED', key: 'intention_reflect', status: 'pending' }))
      .toEqual({ kind: 'intention-reflect' })
  })
  test('done/missed habits have no action', () => {
    expect(habitAction(byKey('wake_on_time'))).toEqual({ kind: 'none' }) // seed status: done
  })
  test('evening_ritual navigates to /ritual', () => {
    expect(habitAction({ ...byKey('morning_sunlight'), mode: 'DERIVED', key: 'evening_ritual', status: 'pending' }))
      .toEqual({ kind: 'nav', to: '/ritual' })
  })
})
