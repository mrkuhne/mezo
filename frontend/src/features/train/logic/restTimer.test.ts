import { restSecondsFor, fmtMMSS } from '@/features/train/logic/restTimer'

test('compound rests 150s, everything else 90s', () => {
  expect(restSecondsFor('compound')).toBe(150)
  expect(restSecondsFor('isolation')).toBe(90)
  expect(restSecondsFor('plyo')).toBe(90)
  expect(restSecondsFor('anything')).toBe(90)
})

test('fmtMMSS formats mm:ss with zero-padded seconds and clamps at zero', () => {
  expect(fmtMMSS(150)).toBe('2:30')
  expect(fmtMMSS(90)).toBe('1:30')
  expect(fmtMMSS(61)).toBe('1:01')
  expect(fmtMMSS(5)).toBe('0:05')
  expect(fmtMMSS(0)).toBe('0:00')
  expect(fmtMMSS(-3)).toBe('0:00')
})
