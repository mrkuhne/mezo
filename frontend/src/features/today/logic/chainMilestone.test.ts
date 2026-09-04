import { describe, expect, test } from 'vitest'
import { daypartMilestone } from '@/features/today/logic/chainMilestone'
import type { HabitCatalog, HabitItem } from '@/data/types'

const catalog = {
  chains: [
    { id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true, defs: [] },
    { id: 'c-m2', chainKey: 'MORNING_EXTRA', title: 'Reggeli extra', daypart: 'MORNING', position: 2, isActive: true, defs: [] },
    { id: 'c-e', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 3, isActive: true, defs: [] },
    { id: 'c-d', chainKey: 'MIDDAY', title: 'Napközbeni rutin', daypart: 'DAY', position: 4, isActive: true, defs: [] },
  ],
} as unknown as HabitCatalog

const row = (key: string, chain: string, status: HabitItem['status']): HabitItem =>
  ({ key, chain, status } as HabitItem)

describe('daypartMilestone', () => {
  test('the last open row of the daypart earns the label', () => {
    const habits = [row('a', 'MORNING', 'done'), row('b', 'MORNING', 'pending')]
    expect(daypartMilestone(catalog, habits, 'MORNING')).toBe('Tökéletes reggel')
    expect(daypartMilestone(catalog, [row('x', 'EVENING', 'pending')], 'EVENING')).toBe('Tökéletes este')
  })

  test('a second open row in the same daypart withholds it — even from another chain', () => {
    const habits = [
      row('a', 'MORNING', 'pending'),
      row('b', 'MORNING_EXTRA', 'pending'),
    ]
    expect(daypartMilestone(catalog, habits, 'MORNING')).toBeNull()
  })

  test('a missed row is not done — the daypart earns no milestone', () => {
    const habits = [row('a', 'MORNING', 'missed'), row('b', 'MORNING', 'pending')]
    expect(daypartMilestone(catalog, habits, 'MORNING')).toBeNull()
  })

  test('a user-created DAY daypart gets its own plain sentence', () => {
    expect(daypartMilestone(catalog, [row('w', 'MIDDAY', 'pending')], 'MIDDAY')).toBe('Napközbeni rutin kész')
  })

  test('an unknown chain key names nothing', () => {
    expect(daypartMilestone(catalog, [row('w', 'NOPE', 'pending')], 'NOPE')).toBeNull()
  })
})
