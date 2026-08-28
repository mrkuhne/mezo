import { expect, test } from 'vitest'
import { humanizeCron } from '@/features/insights/logic/humanizeCron'

// A memória-konnektorok emberi cron-ideje (mezo-d20.5.7, spec §5 "humán cron-idők"):
// a nyers Spring-cront NÉZET-oldalon fordítjuk le; ami nem érthető, az őszintén nyersen marad.

test('daily night cron → "minden éjjel HH:MM"', () => {
  expect(humanizeCron('0 20 2 * * *')).toBe('minden éjjel 02:20')
  expect(humanizeCron('0 40 2 * * *')).toBe('minden éjjel 02:40')
  expect(humanizeCron('0 30 2 * * ?')).toBe('minden éjjel 02:30')
})

test('daily daytime cron → "minden nap HH:MM"', () => {
  expect(humanizeCron('0 0 14 * * *')).toBe('minden nap 14:00')
})

test('weekly cron → Hungarian day name + HH:MM', () => {
  expect(humanizeCron('0 0 3 * * SUN')).toBe('vasárnap 03:00')
  expect(humanizeCron('0 15 4 * * MON')).toBe('hétfő 04:15')
  expect(humanizeCron('0 0 3 * * 0')).toBe('vasárnap 03:00')
})

test('honest fallback: an unparseable cron stays the raw string', () => {
  expect(humanizeCron('0 20 2 1 * *')).toBe('0 20 2 1 * *') // day-of-month bound
  expect(humanizeCron('*/5 * * * * *')).toBe('*/5 * * * * *') // stepped seconds
  expect(humanizeCron('nonsense')).toBe('nonsense')
  expect(humanizeCron('0 0 3 * * MON-FRI')).toBe('0 0 3 * * MON-FRI') // range dow
})
