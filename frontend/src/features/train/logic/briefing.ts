// ============================================================
// Mezo · briefing (mezo-mgu2r) — the pure rules behind the Eligazítás, the pre-start phase of
// /train/session: the honest duration band, which challenges come pre-ticked, and which
// decisions the Indulás tap sends. Spec: docs/superpowers/specs/2026-09-28-workout-briefing-design.md.
// ============================================================
import type { Challenge } from '@/data/types'

const round5 = (x: number) => Math.round(x / 5) * 5

/** The estimate as a band (±10%, 5-minute steps, at least 5 minutes wide) — a single minute
 *  would promise a precision the estimator does not have. null = nothing honest to say. */
export function durationRange(minutes: number): [number, number] | null {
  if (!(minutes > 0)) return null
  const lo = round5(minutes * 0.9)
  return [lo, Math.max(round5(minutes * 1.1), lo + 5)]
}

/** The owner-approved pre-tick rule: whatever is already accepted, the deterministic overload
 *  challenge (it IS today's recommended load), and the low-risk LLM ones at ≥70% confidence. */
export function preTicked(challenges: Challenge[], accepted: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(challenges.map((c) => [
    c.id,
    !!accepted[c.id] || c.type === 'overload' || (c.risk === 'low' && c.confidence != null && c.confidence >= 0.7),
  ]))
}

const RESOLVED = new Set(['hit', 'miss', 'inconclusive'])

/** What Indulás sends: accept every newly ticked offer, undo every accepted one the owner
 *  unticked. Unticked offers stay offers (never dismissed); resolved rows are left alone. */
export function briefingDecisions(
  challenges: Challenge[], ticked: Record<string, boolean>, accepted: Record<string, boolean>,
): { accept: string[]; undo: string[] } {
  const accept: string[] = []
  const undo: string[] = []
  for (const c of challenges) {
    if (c.status && RESOLVED.has(c.status)) continue
    if (ticked[c.id] && !accepted[c.id]) accept.push(c.id)
    else if (!ticked[c.id] && accepted[c.id] && c.status === 'accepted') undo.push(c.id)
  }
  return { accept, undo }
}
