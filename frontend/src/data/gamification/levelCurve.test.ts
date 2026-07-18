import { levelFromTotalXp, xpToNext } from '@/data/gamification/levelCurve'

test('xpToNext grows linearly from 80 by 40 per level', () => {
  expect(xpToNext(1)).toBe(80)
  expect(xpToNext(2)).toBe(120)
  expect(xpToNext(12)).toBe(520)
})

test('levelFromTotalXp walks the cumulative thresholds', () => {
  expect(levelFromTotalXp(0)).toEqual({ level: 1, xpInLevel: 0, xpForNext: 80 })
  expect(levelFromTotalXp(79)).toEqual({ level: 1, xpInLevel: 79, xpForNext: 80 })
  expect(levelFromTotalXp(80)).toEqual({ level: 2, xpInLevel: 0, xpForNext: 120 })
  expect(levelFromTotalXp(560)).toEqual({ level: 5, xpInLevel: 0, xpForNext: 240 })
  expect(levelFromTotalXp(3140)).toEqual({ level: 12, xpInLevel: 60, xpForNext: 520 })
})
