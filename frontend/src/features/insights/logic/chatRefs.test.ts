import { describe, expect, test } from 'vitest'
import { chatRefDisplay } from '@/features/insights/logic/chatRefs'

// Design 2.0 (mezo-d20.5.2): the "Hivatkozott · L3" footer speaks human labels, not raw ids —
// the audit's gap 7 fix. The mapping is HONEST: only what the data itself carries is shown.
// A kind gets its Hungarian name; an id yields a human date ONLY when it literally contains an
// ISO date; anything else falls back to the raw id — no fabricated titles.
describe('chatRefDisplay (mezo-d20.5.2)', () => {
  test('maps the known artifact kinds to their Hungarian labels', () => {
    expect(chatRefDisplay({ kind: 'Workout', id: 'w-2026-05-21' }).kind).toBe('Edzés')
    expect(chatRefDisplay({ kind: 'PR', id: 'pr-2026-03-04' }).kind).toBe('PR')
    expect(chatRefDisplay({ kind: 'Pattern', id: 'p-medication-appetite' }).kind).toBe('Minta')
    expect(chatRefDisplay({ kind: 'SleepLog', id: 'sleep-2026-05-21' }).kind).toBe('Alvás')
    expect(chatRefDisplay({ kind: 'Sleep', id: '2026-07-02' }).kind).toBe('Alvás')
  })

  test('keeps an unknown kind verbatim — no guessing', () => {
    expect(chatRefDisplay({ kind: 'Widget', id: 'x-1' }).kind).toBe('Widget')
  })

  test('derives a human date label when the id carries an ISO date', () => {
    expect(chatRefDisplay({ kind: 'Workout', id: 'w-2026-05-21' }).label).toBe('máj. 21.')
    expect(chatRefDisplay({ kind: 'Sleep', id: '2026-07-02' }).label).toBe('júl. 2.')
  })

  test('falls back to the raw id when there is no date to derive — honest, never invented', () => {
    expect(chatRefDisplay({ kind: 'Pattern', id: 'p-medication-appetite' }).label).toBe('p-medication-appetite')
  })

  test('an id that only LOOKS date-ish stays raw (invalid month)', () => {
    expect(chatRefDisplay({ kind: 'Workout', id: 'w-2026-13-40' }).label).toBe('w-2026-13-40')
  })
})
