// ============================================================
// Mezo · dayOrbTone — a DayOrb tónus-tengelyének napi pontja, tisztán (mezo-x5va).
// A `DayEvaluationEngine.evaluate` csak lezárt napra (`closed && doneCount >= 2`) ad
// alap-pontot; MA sosem lezárt, tehát a válasz `score`-ja mindig null a mai napra. Ez a
// modul a válasz saját `dimensions[]`-éből számol egy MENET KÖZBENI pontot ugyanazzal a
// képlettel — a `weight` mezők a backendtől MÁR a KÉSZ dimenziókra renormalizálva jönnek
// (a nem-KÉSZ dimenziók súlya 0), tehát elég összegezni.
// Pure: nincs `Date`, nincs olvasás, nincs React — a `dayOrbFill.ts` fegyelmét követi.
// Spec: bd mezo-x5va
// ============================================================
import type { NormalizedDayDimension } from '@/data/hooks'

/** A `DayEvaluationEngine`-nel egyező „tanulom" kapu: 2 KÉSZ dimenzió alatt nincs pont. */
const MIN_DONE_DIMENSIONS = 2

/** `dimensions` — a `GET /api/me/day/{date}/evaluation` válasz dimenziói (KÉSZ/FOLYAMATBAN/
 *  NINCS ADAT keverve, a súlyok a KÉSZ dimenziókra renormalizálva). `closedScore` — a válasz
 *  saját `score` mezője, ha a nap már lezárt.
 *
 *  Lezárt nap: a `closedScore` nyer — ez az engine hiteles, végleges pontja.
 *  Nyitott nap (MA): a `closedScore` null, ezért a KÉSZ dimenziók súlyozott összegéből
 *  számolunk egy menet közbeni becslést — ugyanaz a képlet, amit az engine lezáráskor
 *  futtatna, csak a nap még tart. 2 KÉSZ dimenzió alatt (a `doneCount >= 2` kapu tükre)
 *  nincs elég adat egy becsléshez: `null`. */
export function provisionalDayScore(
  dimensions: readonly NormalizedDayDimension[],
  closedScore: number | null,
): number | null {
  if (closedScore !== null) return closedScore

  const done = dimensions.filter((d) => d.status === 'DONE')
  if (done.length < MIN_DONE_DIMENSIONS) return null

  const sum = done.reduce((acc, d) => acc + d.weight * (d.score ?? 0), 0)
  return Math.round(sum)
}
