import { expect, test } from 'vitest'
import { PERK_MILESTONES, nearestMilestone, perkHint } from '@/features/me/logic/perkMilestones'

test('milestones are 5/10/15/20', () => { expect(PERK_MILESTONES).toEqual([5, 10, 15, 20]) })
test('perkHint fires only one level before a milestone', () => {
  expect(perkHint(4)).toBe(5); expect(perkHint(9)).toBe(10); expect(perkHint(3)).toBeNull(); expect(perkHint(5)).toBeNull(); expect(perkHint(20)).toBeNull()
})
test('nearestMilestone picks the smallest positive distance, first on ties', () => {
  expect(nearestMilestone([{ name: 'Lát', level: 4 }, { name: 'Comb', level: 9 }])).toEqual({ name: 'Lát', level: 5 })
  expect(nearestMilestone([{ name: 'Mell', level: 7 }, { name: 'Far', level: 8 }])).toEqual({ name: 'Far', level: 10 })
  expect(nearestMilestone([])).toBeNull()
  expect(nearestMilestone([{ name: 'X', level: 20 }])).toBeNull()
})
