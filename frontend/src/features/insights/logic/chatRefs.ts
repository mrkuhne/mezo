import type { ChatRef } from '@/data/types'

// ============================================================
// Design 2.0 chat refs (mezo-d20.5.2) — the "Hivatkozott · L3"
// footer speaks HUMAN labels instead of raw wire ids (the audit's
// gap 7: "refs are inert — raw ids, no label lookup"). The wire
// carries only {kind, id}, so the mapping is strictly honest:
//   · kind → its Hungarian artifact name (unknown kinds verbatim)
//   · id   → a human date ONLY when the id literally contains a
//            valid ISO date; otherwise the raw id, unchanged.
// Nothing is fabricated — no invented titles, no guessed names.
// ============================================================

const KIND_LABELS: Record<string, string> = {
  Workout: 'Edzés',
  PR: 'PR',
  Pattern: 'Minta',
  Sleep: 'Alvás',
  SleepLog: 'Alvás',
  Checkin: 'Check-in',
  CheckIn: 'Check-in',
  Journal: 'Napló',
  Meal: 'Étkezés',
  Run: 'Futás',
}

const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/

/** The id's human label: a hu-HU short date when the id carries a REAL ISO date
 *  (`w-2026-05-21` → `máj. 21.`), the raw id otherwise — honest fallback. */
function labelFromId(id: string): string {
  const m = ISO_DATE.exec(id)
  if (!m) return id
  const [, y, mo, d] = m
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  // reject date-shaped junk (month 13, day 40): Date silently rolls over, so verify round-trip
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return id
  }
  return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The carried label wins when the producer knew a human name (mezo-b3pp.33 — today GraphNode
 *  refs, whose uuid `labelFromId` can never humanise); otherwise the id-derived label, which is
 *  also what pre-mezo-b3pp.33 rows fall back to. Still nothing fabricated. */
export function chatRefDisplay(ref: ChatRef): { kind: string; label: string } {
  return { kind: KIND_LABELS[ref.kind] ?? ref.kind, label: ref.label?.trim() || labelFromId(ref.id) }
}
