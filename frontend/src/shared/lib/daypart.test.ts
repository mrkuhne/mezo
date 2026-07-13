import { daypartForHour, daypartNow } from '@/shared/lib/daypart'

test('bands follow spec §3.4: reggel 04-11, delutan 12-17, este 18-03', () => {
  expect(daypartForHour(4)).toBe('reggel')
  expect(daypartForHour(11)).toBe('reggel')
  expect(daypartForHour(12)).toBe('delutan')
  expect(daypartForHour(17)).toBe('delutan')
  expect(daypartForHour(18)).toBe('este')
  expect(daypartForHour(23)).toBe('este')
  expect(daypartForHour(0)).toBe('este')
  expect(daypartForHour(3)).toBe('este')
})
test('daypartNow reads the hour from the given date', () => {
  expect(daypartNow(new Date('2026-07-13T06:30:00'))).toBe('reggel')
  expect(daypartNow(new Date('2026-07-13T14:00:00'))).toBe('delutan')
  expect(daypartNow(new Date('2026-07-13T21:00:00'))).toBe('este')
})
