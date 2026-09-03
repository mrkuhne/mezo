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

  test('maps the full backend ref-kind vocabulary (mezo-vdf4)', () => {
    expect(chatRefDisplay({ kind: 'Weight', id: 'x-1' }).kind).toBe('Súly')
    expect(chatRefDisplay({ kind: 'FuelDay', id: 'x-1' }).kind).toBe('Fuel nap')
    expect(chatRefDisplay({ kind: 'TrainingPlan', id: 'x-1' }).kind).toBe('Edzésterv')
    expect(chatRefDisplay({ kind: 'Memory', id: 'x-1' }).kind).toBe('Emlék')
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

  test('kind renders the Hungarian "Összefüggés" — no English word in the HU footer', () => {
    expect(
      chatRefDisplay({ kind: 'GraphNode', id: '9f2c1a3e-1111-4b2b-8b1a-000000000004', label: 'Késői evés' }).kind,
    ).toBe('Összefüggés')
  })
})

// mezo-z4h4: BriefingRef (the Mezo-messages page's ref type) often carries a BARE ISO date as
// its label — the page's own honest fallback when it had no real title. chatRefDisplay must
// humanise that the same way it humanises an id-carried date, while any OTHER label (a real
// title, or a label with extra context glued onto a date) stays verbatim — nothing invented.
describe('chatRefDisplay — bare ISO-date label humanised (mezo-z4h4)', () => {
  test('a label that is ENTIRELY a valid ISO date is humanised like an id', () => {
    expect(chatRefDisplay({ kind: 'FuelDay', id: 'x-1', label: '2026-08-27' }).label).toBe('aug. 27.')
  })

  test('a label that is ENTIRELY a valid ISO date, with surrounding whitespace, is still humanised', () => {
    expect(chatRefDisplay({ kind: 'FuelDay', id: 'x-1', label: '  2026-08-27  ' }).label).toBe('aug. 27.')
  })

  test('a real title stays verbatim — not date-shaped', () => {
    expect(chatRefDisplay({ kind: 'GraphNode', id: 'x-1', label: 'Késői evés' }).label).toBe('Késői evés')
  })

  test('a label with extra context beyond the date stays verbatim — not ENTIRELY a date', () => {
    expect(chatRefDisplay({ kind: 'Practice', id: 'x-1', label: '2026-08-27 · reggel' }).label).toBe(
      '2026-08-27 · reggel',
    )
  })
})
