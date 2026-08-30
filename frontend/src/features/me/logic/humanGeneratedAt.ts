// ============================================================
// Heti · `generatedAt` ember-nyelven (mezo-d20.6.10)
// The prototype prints the stamp as „hétfő 06:15" — a weekday and a clock, not
// an ISO string. Real reviews can be older than a week, so the ladder falls back
// to a dated form rather than naming a weekday seven days out of date.
// ============================================================
import { huMonthDay, localDateString } from '@/shared/lib/dates'

const HU_DOW_LOWER = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat']

function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function daysBack(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** `null` for an absent/unparseable stamp — the caller then prints nothing at all
 *  (an unreadable timestamp is not worth a placeholder). */
export function humanGeneratedAt(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  const atIso = localDateString(at)
  const back = daysBack(atIso, localDateString(now))
  if (back === 0) return `ma ${clock(at)}`
  if (back === 1) return `tegnap ${clock(at)}`
  if (back > 1 && back < 7) return `${HU_DOW_LOWER[at.getDay()]} ${clock(at)}`
  return `${huMonthDay(atIso).toLowerCase()}. ${clock(at)}`
}
