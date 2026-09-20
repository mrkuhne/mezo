import { addDays, huMonthDay, localDateString } from '@/shared/lib/dates'
import type { DiagnosisConfidence, DiagnosisEvidence } from '@/data/types'

/** strong|moderate|weak → the chip word the prototype uses. */
export function strengthLabel(s: DiagnosisConfidence): string {
  return s === 'strong' ? 'erős' : s === 'moderate' ? 'mérsékelt' : 'gyenge'
}

/** The verdict card's confidence chip — '◆ mérsékelt bizonyosság'. */
export function confidenceLine(c: DiagnosisConfidence): string {
  return `◆ ${strengthLabel(c)} bizonyosság`
}

/** ISO instant → 'ma 06:12' for today, else 'Aug 12'. */
export function generatedLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const sameDay = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) {
    return `ma ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return huMonthDay(iso.slice(0, 10))
}

/** The hero sub — 'Aug 17 – 30 · az utolsó 14 nap adatából', derived from generatedAt. */
export function windowLine(generatedAt: string, windowDays: number): string {
  const to = new Date(generatedAt)
  const from = new Date(to)
  from.setDate(to.getDate() - (windowDays - 1))
  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${huMonthDay(isoOf(from))} – ${to.getDate()} · az utolsó ${windowDays} nap adatából`
}

/**
 * The hero sub for an anchored (weight) row — 'Szep 14–20 · 5 mérés · a hét még nyitott'.
 * The mérés count comes ONLY from the WEIGHT_DELTA_KG evidence item's coverageDays — if that
 * evidence is absent the segment is omitted rather than invented. The last segment appears
 * only while the anchored week has not yet fully elapsed (anchorStart+6 ≥ today).
 */
export function anchoredWindowLine(anchorStart: string, evidence: DiagnosisEvidence[], now: Date = new Date()): string {
  const end = addDays(anchorStart, 6)
  const sameMonth = anchorStart.slice(5, 7) === end.slice(5, 7)
  const range = sameMonth
    ? `${huMonthDay(anchorStart)}–${Number(end.slice(8, 10))}`
    : `${huMonthDay(anchorStart)}–${huMonthDay(end)}`
  const weighInRow = evidence.find((e) => e.metricKey === 'WEIGHT_DELTA_KG')
  const countSeg = weighInRow?.coverageDays != null ? ` · ${weighInRow.coverageDays} mérés` : ''
  const openSeg = end >= localDateString(now) ? ' · a hét még nyitott' : ''
  return `${range}${countSeg}${openSeg}`
}

/** Signed delta → '↑ 0,32' / '↓ 1,2' with the Hungarian decimal comma; null-safe. */
export function deltaLabel(delta: number | undefined): string | null {
  if (delta === undefined || delta === 0) return null
  const arrow = delta > 0 ? '↑' : '↓'
  return `${arrow} ${String(Math.abs(delta)).replace('.', ',')}`
}
