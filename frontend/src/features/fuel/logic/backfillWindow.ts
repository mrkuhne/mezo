// ============================================================
// Mezo · backfillWindow — a pótlási ablak EGYETLEN szabálya (Fuel Titanium S1d, mezo-33k6).
//
// A 7 napos pótlás terméki szabály (mezo-1j3z): egy hét utólagos logolás, nem nyílt főkönyv.
// A szabály három felületen élt egymás mellett másolatban — /fuel/log stepperje, a /fuel/log/uj
// `?d=` deep linkje, és S1d-vel a Mai lapozója —, így egy elmozduló korlát csendben szétcsúszott
// volna: a Mai olyan napra tudott volna lapozni, ahova a naplózó már nem engedett be.
// Ezért EGY hely mondja ki: `MAX_BACKFILL_DAYS`, a `?d=` parse-olása (`backfillOffset`) és a
// lapozó alsó kapuja (`earliestBackfillDate`).
//
// Őszinte fallback, változatlanul: ami kívül esik az ablakon — vagy nem parse-olható — az MA,
// sosem csúszik el csendben egy rossz napra.
//
// Pure: nincs React, nincs `@/data/*`, nincs ambiens idő — a MAI napot a hívó adja be (az
// oldalak egyszer rögzítik, hogy egy éjfél utáni re-render ne mozdítsa el a szerkesztett napot).
// ============================================================
import { addDays } from '@/shared/lib/dates'

/** Egy hét pótlás — a korlát, amit a naplózó és a Mai lapozója KÖZÖSEN hordoz. */
export const MAX_BACKFILL_DAYS = 7

/**
 * A `?d=` paraméter napeltolása MÁHOZ képest, az ablakba clampelve: `1..MAX_BACKFILL_DAYS`.
 * Minden más (hiányzó, jövőbeli, túl régi, értelmezhetetlen érték) → `0`, azaz MA.
 */
export function backfillOffset(d: string | null | undefined, today: string): number {
  if (!d) return 0
  const diff = Math.round((+new Date(today) - +new Date(d)) / 86_400_000)
  return Number.isFinite(diff) && diff >= 1 && diff <= MAX_BACKFILL_DAYS ? diff : 0
}

/** A `?d=`-ből kiolvasott, ablakba clampelt NAP (ISO) — a fallback mindig a mai nap. */
export function backfillDate(d: string | null | undefined, today: string): string {
  return addDays(today, -backfillOffset(d, today))
}

/** A lapozó alsó kapuja: a legkorábbi nap, amire a naplózó még beenged. */
export function earliestBackfillDate(today: string): string {
  return addDays(today, -MAX_BACKFILL_DAYS)
}
