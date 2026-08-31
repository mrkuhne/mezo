import { describe, expect, test } from 'vitest'
import { feedDayLabel } from './feedDayLabel'

describe('feedDayLabel', () => {
  const now = new Date('2026-08-30T20:00:00Z')

  test('same calendar day -> MA', () => {
    expect(feedDayLabel('2026-08-30T08:10:00Z', now)).toBe('MA')
  })

  test('one day earlier -> TEGNAP', () => {
    expect(feedDayLabel('2026-08-29T19:30:00Z', now)).toBe('TEGNAP')
  })

  test('older days -> a localized short date', () => {
    expect(feedDayLabel('2026-08-24T18:00:00Z', now)).not.toBe('MA')
    expect(feedDayLabel('2026-08-24T18:00:00Z', now)).not.toBe('TEGNAP')
  })
})
