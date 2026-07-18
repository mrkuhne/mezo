import { DAILY_CAPS, XP_VALUES, xpForEvent } from '@/data/gamification/xpValues'

test('flat XP values match the spec table', () => {
  expect(XP_VALUES.MEAL).toBe(10)
  expect(XP_VALUES.MEDICATION).toBe(5)
  expect(XP_VALUES.GYM).toBe(40)
  expect(XP_VALUES.RUN).toBe(30)
})

test('xpForEvent returns 0 once the daily cap is reached', () => {
  expect(xpForEvent('WEIGHT', 0)).toBe(10)
  expect(xpForEvent('WEIGHT', DAILY_CAPS.WEIGHT)).toBe(0)
  expect(xpForEvent('MEAL', 4)).toBe(10)
  expect(xpForEvent('MEAL', 5)).toBe(0)
})

test('xpOverride wins for QUEST/ACTIVITY style events but caps still apply', () => {
  expect(xpForEvent('ACTIVITY', 0, 15)).toBe(15)
  expect(xpForEvent('QUEST', 0, 25)).toBe(25)
  expect(xpForEvent('ACTIVITY', DAILY_CAPS.ACTIVITY, 15)).toBe(0)
})
