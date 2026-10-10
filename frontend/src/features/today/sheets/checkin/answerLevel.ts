// Check-in · an answer as a LEVEL (Folyadék, prototype vilagos/nap.js `ckLev` / `ckTone`): every
// answer is a small vessel filled to the value given on the 10 scale. Pain fills to its intensity
// (a „yes" without one sits at the middle) in the warn colour; „Nem", a skipped or a not-asked
// item stays empty. Shared by the Check-in page's capsules and the sheet's summary rows.
import type { CheckinItemId, CheckinValues } from '@/data/types'

/** The fill of an answer, 0–100. */
export function answerLevel(id: CheckinItemId, values: CheckinValues): number {
  const v = values[id]
  if (v === null || v === undefined) return 0
  if (id === 'pain') {
    const p = values.pain
    return p ? (p.intensity || 5) * 10 : 0
  }
  if (id === 'craving') return (values.craving?.value ?? 0) * 10
  return typeof v === 'number' ? v * 10 : 0
}

/** The liquid of an answer: a reported pain is the warn colour, everything else the domain's. */
export function answerTone(id: CheckinItemId, values: CheckinValues): string {
  return id === 'pain' && values.pain ? 'var(--fo-warn)' : 'var(--dom)'
}
