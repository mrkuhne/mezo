// ============================================================
// Mezo · dayOrbTone — a DayOrb tónus-tengelyének napi pontja, tisztán (mezo-x5va).
// A `DayEvaluationEngine.evaluate` csak lezárt napra (`closed && doneCount >= 2`) ad
// alap-pontot; MA sosem lezárt, tehát a válasz `score`-ja mindig null a mai napra. Ez a
// modul a válasz saját `dimensions[]`-éből számol egy MENET KÖZBENI pontot ugyanazzal a
// képlettel — a `weight` mezők a backendtől MÁR a KÉSZ dimenziókra renormalizálva jönnek
// (a nem-KÉSZ dimenziók súlya 0), tehát elég összegezni.
//
// A `doneCount >= 2` kapu az engine-ben (`DayEvaluationEngine.java:100-102`) KIZÁRJA a
// `rhythm` dimenziót a számlálásból — az extrinsic, más napok base-score-jainak átlaga,
// tehát önmagában semmit nem mond ERRŐL a napról; egy `logging` (ami majdnem minden lezárt
// napon KÉSZ) + `rhythm` páros így nem nyithatná ki a kaput egy egyébként adat nélküli
// napra. A SÚLYOZOTT ÖSSZEGBE viszont az engine BELESZÁMÍTJA a `rhythm`-et, ha a kapu már
// nyitva van (`DayEvaluationEngine.java:107-110` — a szűrés csak `DONE.equals(status)`, nincs
// rhythm-kizárás) — a kapu és az összeg tehát KÉT KÜLÖN feltétel, ez a modul mindkettőt
// külön tükrözi, nem egyet.
// Pure: nincs `Date`, nincs olvasás, nincs React — a `dayOrbFill.ts` fegyelmét követi.
// Spec: bd mezo-x5va
// ============================================================
import type { NormalizedDayDimension } from '@/data/hooks'
import type { DayDimensionKey } from '@/features/me/logic/weekDay'

/** A `DayEvaluationEngine`-nel egyező „tanulom" kapu: 2 KÉSZ, INTRINSIC dimenzió alatt
 *  nincs pont. */
const MIN_DONE_DIMENSIONS = 2

/** Az egyetlen EXTRINSIC dimenzió — lásd a fenti fejléc-megjegyzést. Csak a KAPUBÓL marad ki,
 *  az összegből nem. */
const EXTRINSIC_DIMENSION: DayDimensionKey = 'rhythm'

/** `dimensions` — a `GET /api/me/day/{date}/evaluation` válasz dimenziói (KÉSZ/FOLYAMATBAN/
 *  NINCS ADAT keverve, a súlyok a KÉSZ dimenziókra renormalizálva). `closedScore` — a válasz
 *  saját `score` mezője, ha a nap már lezárt.
 *
 *  Lezárt nap: a `closedScore` nyer — ez az engine hiteles, végleges pontja.
 *  Nyitott nap (MA): a `closedScore` null, ezért a KÉSZ dimenziók súlyozott összegéből
 *  számolunk egy menet közbeni becslést — ugyanaz a képlet, amit az engine lezáráskor
 *  futtatna, csak a nap még tart. A kapu (2+ KÉSZ, `rhythm`-en kívüli dimenzió) alatt nincs
 *  elég adat egy becsléshez: `null`. */
export function provisionalDayScore(
  dimensions: readonly NormalizedDayDimension[],
  closedScore: number | null,
): number | null {
  if (closedScore !== null) return closedScore

  const done = dimensions.filter((d) => d.status === 'DONE')
  const intrinsicDoneCount = done.filter((d) => d.id !== EXTRINSIC_DIMENSION).length
  if (intrinsicDoneCount < MIN_DONE_DIMENSIONS) return null

  const sum = done.reduce((acc, d) => acc + d.weight * (d.score ?? 0), 0)
  return Math.round(sum)
}
