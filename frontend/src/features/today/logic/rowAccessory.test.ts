import { describe, expect, test } from 'vitest'
import { rowAccessory } from '@/features/today/logic/rowAccessory'
import type { TodayItem } from '@/features/today/logic/todayItems'
import type { HabitItem } from '@/data/types'

const habit = (mode: HabitItem['mode']): HabitItem => ({
  key: 'pushups', chain: 'MORNING', position: 0, title: '50 fekvőtámasz', why: '',
  anchorCopy: 'napfény után', mode, status: 'pending', xp: 8,
})

const item = (action: TodayItem['action']): TodayItem => ({
  id: 'x', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '💪',
  tag: 'REGGELI RUTIN', title: '50 fekvőtámasz', subtitle: null, time: null, xp: 8,
  group: 'Reggeli rutin', action, linkUrl: null,
})

describe('rowAccessory', () => {
  test('MANUAL szokás → pipáló karika', () => {
    expect(rowAccessory(item({ kind: 'habit', habit: habit('MANUAL'), label: 'Pipa' }))).toBe('tick')
  })

  test('nem-MANUAL (DERIVED) szokás → szöveggomb', () => {
    expect(rowAccessory(item({ kind: 'habit', habit: habit('DERIVED'), label: 'Logolás' }))).toBe('button')
  })

  test('nav / checkin / quest akció → szöveggomb', () => {
    expect(rowAccessory(item({ kind: 'nav', to: '/fuel', label: 'Logold' }))).toBe('button')
    expect(rowAccessory(item({ kind: 'checkin', slotIdx: 0, label: 'Koppints' }))).toBe('button')
  })

  test('akció nélküli sor → semmi', () => {
    expect(rowAccessory(item(null))).toBe('none')
  })

  test('a döntés SOSEM a címke szövegéből jön', () => {
    // Ugyanaz a „Pipa" címke egy DERIVED szokáson NEM ad karikát.
    expect(rowAccessory(item({ kind: 'habit', habit: habit('DERIVED'), label: 'Pipa' }))).toBe('button')
  })
})
