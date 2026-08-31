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

// mezo-b3pp.33: GraphNode refs carry an optional backend-supplied label (the traversal's node
// title) — a uuid id can never be humanised by labelFromId, so the carried label must win.
describe('chatRefDisplay — carried label (mezo-b3pp.33)', () => {
  test('uses the carried label when the ref has one', () => {
    expect(
      chatRefDisplay({ kind: 'GraphNode', id: '9f2c1a3e-1111-4b2b-8b1a-000000000001', label: 'Késői evés' }).label,
    ).toBe('Késői evés')
  })

  test('falls back to the id-derived label when there is none — unchanged behaviour', () => {
    expect(chatRefDisplay({ kind: 'Workout', id: 'w-2026-05-21' }).label).toBe('máj. 21.')
  })

  test('falls back to the raw id when the label is null and the id carries no date', () => {
    const id = '9f2c1a3e-1111-4b2b-8b1a-000000000002'
    expect(chatRefDisplay({ kind: 'GraphNode', id, label: null }).label).toBe(id)
  })

  test('falls back when the label is empty/whitespace-only — never a blank chip', () => {
    const id = '9f2c1a3e-1111-4b2b-8b1a-000000000003'
    expect(chatRefDisplay({ kind: 'GraphNode', id, label: '   ' }).label).toBe(id)
  })
})
