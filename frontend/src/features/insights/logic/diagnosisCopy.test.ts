import { describe, expect, test } from 'vitest'
import { confidenceLine, deltaLabel, generatedLabel, strengthLabel, windowLine } from './diagnosisCopy'

describe('diagnosisCopy', () => {
  test('strength + confidence labels', () => {
    expect(strengthLabel('strong')).toBe('erős')
    expect(strengthLabel('weak')).toBe('gyenge')
    expect(confidenceLine('moderate')).toBe('◆ mérsékelt bizonyosság')
  })

  test('generatedLabel: today → ma HH:MM, otherwise Hungarian month-day', () => {
    const now = new Date(2026, 7, 31, 12, 0)
    expect(generatedLabel('2026-08-31T06:12:00', now)).toBe('ma 06:12')
    expect(generatedLabel('2026-08-12T06:12:00', now)).toBe('Aug 12')
  })

  test('windowLine derives the from-date from the window length', () => {
    expect(windowLine('2026-08-30T06:12:00', 14)).toBe('Aug 17 – 30 · az utolsó 14 nap adatából')
  })

  test('deltaLabel: signed arrow + Hungarian comma, null on absent/zero', () => {
    expect(deltaLabel(-1.2)).toBe('↓ 1,2')
    expect(deltaLabel(0.32)).toBe('↑ 0,32')
    expect(deltaLabel(0)).toBeNull()
    expect(deltaLabel(undefined)).toBeNull()
  })
})
