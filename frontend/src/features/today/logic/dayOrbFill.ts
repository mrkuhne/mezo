// ============================================================
// Mezo · dayOrbFill — a fejléc DayOrb-jának két tengelye, tisztán (mezo-idz2).
// MAGASSÁG: hány napi jel van már rögzítve, a nap ALKALMAZANDÓ jeleihez képest.
// SZÍN: a napi pontból számolt telítettség — külön tengely, sosem keveredik a magassággal.
// Pure: nincs `Date`, nincs olvasás, nincs React. A hívó (useDayOrbFill) dönti el,
// mi számít „jelen lévőnek"; ez a modul csak a számtant tartja.
// Spec: docs/superpowers/specs/2026-09-03-napi-orb-fejlec-design.md
// ============================================================

/** A hét napi jel jelen/hiány állapota. Minden mező: „ma rögzítve van-e". */
export interface DayOrbSignals {
  sleep: boolean
  weight: boolean
  fuel: boolean
  gym: boolean
  sport: boolean
  checkin: boolean
  journal: boolean
}

/** A nap terve — csak a két feltételes jelre. */
export interface DayOrbPlan {
  gymPlanned: boolean
  sportPlanned: boolean
}

export interface DayOrbFill {
  /** Hány alkalmazandó jel van rögzítve. */
  present: number
  /** Hány jel tartozik ehhez a naphoz (5–7). */
  denominator: number
  /** `present / denominator`, kerekített egész százalék. */
  pct: number
  /** 0…1 — a kitöltés színének telítettsége. */
  intensity: number
}

/** Napi pont híján (COMPANION_SWITCH ki, vagy <2 subscore = „tanulom") az orb
 *  se nem dicsér, se nem büntet: középen szól. */
export const NEUTRAL_INTENSITY = 0.5

const INTENSITY_FLOOR = 45
const INTENSITY_CEIL = 92

/** Az öt feltétlen jel — minden napon a nevezőben van. */
const ALWAYS: readonly (keyof DayOrbSignals)[] = ['sleep', 'weight', 'fuel', 'checkin', 'journal']

/** Az edzés és a sport akkor tartozik a naphoz, ha a TERV szerint jár VAGY ha ma
 *  tényleg logoltál ilyet. A második ág azért kell, hogy egy spontán séta egy nem
 *  tervezett napon a nevezőbe ÉS a számlálóba is belépjen — így sosem ronthat. */
function conditionalApplies(planned: boolean, logged: boolean): boolean {
  return planned || logged
}

export function dayOrbFill(
  signals: DayOrbSignals,
  plan: DayOrbPlan,
  score: number | null,
): DayOrbFill {
  let denominator = ALWAYS.length
  let present = ALWAYS.reduce((n, key) => (signals[key] ? n + 1 : n), 0)

  if (conditionalApplies(plan.gymPlanned, signals.gym)) {
    denominator += 1
    if (signals.gym) present += 1
  }
  if (conditionalApplies(plan.sportPlanned, signals.sport)) {
    denominator += 1
    if (signals.sport) present += 1
  }

  return {
    present,
    denominator,
    pct: Math.round((present / denominator) * 100),
    intensity: intensityFor(score),
  }
}

function intensityFor(score: number | null): number {
  if (score === null) return NEUTRAL_INTENSITY
  if (score <= INTENSITY_FLOOR) return 0
  if (score >= INTENSITY_CEIL) return 1
  return (score - INTENSITY_FLOOR) / (INTENSITY_CEIL - INTENSITY_FLOOR)
}
