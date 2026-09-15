// ============================================================
// Mezo · scoreArithmetic (Fuel Titanium S1b, mezo-33k6) — a score-envelope HÁROM száma,
// EGY helyen. Eddig a JSX-ben laktak: a súlyozott Σ a ScoreBreakdownBody `totalOf`-jában
// (nem exportált), a súly-százalék és a megszerzett pont a DimensionCard fejlécében és a
// ScoreLedger sorában, külön-külön kiszámolva.
//
// Miért kell egy modul egy szorzásnak: az AI értékelés MOST KÉT felületen jelenik meg —
// a régi MealScoreSheet és az új FuelMealScorePage —, és ugyanabból az envelope-ból
// ugyanazokat a számokat KELL mondaniuk. Egy másolt `Math.round(d.weight * 100)` pont az,
// amiből később két egymásnak ellentmondó súly lesz.
//
// Pure: nincs React, nincs formázás (a hu1/huInt a hívó dolga), semmi fabrikálás — csak az
// envelope saját mezői.
// ============================================================
import type { MealBreakdown, MealDimension } from '@/data/types'

/** A dimenzió súlya százalékban, ahogy mindkét felület kiírja (22% stb.). */
export function dimWeightPct(dim: MealDimension): number {
  return Math.round(dim.weight * 100)
}

/** A dimenzió MEGSZERZETT pontja a 100-as skálán (súly × alpontszám). Kerekítés nélkül:
 *  a formázás (hu1) a hívóé — egy 6%-os súlyú sávon a korai kerekítés látszik. */
export function dimContributionPts(dim: MealDimension): number {
  return dim.weight * dim.score * 100
}

/** A dimenzió ELÉRHETŐ pontja a 100-as skálán — a sáv üres része épp ennyi hely. */
export function dimAvailablePts(dim: MealDimension): number {
  return dim.weight * 100
}

/**
 * Az envelope súlyozott összege a 100-as skálán. Csak az ÉLŐ (weight > 0) dimenziók
 * számítanak — egy degradált dimenzió súlya már 0, tehát matematikailag no-op, a szűrő a
 * SZÁNDÉKOT dokumentálja és a ledger renderjét tükrözi, nem csak az aritmetikáját.
 * `scorePct` (a mentett, determinisztikus pontszám) mindig elsőbbséget kap: a felület a
 * tárolt számot mondja, nem egy újraszámolt közelítést.
 */
export function breakdownTotalPct(b: MealBreakdown, scorePct?: number): number {
  return scorePct ?? Math.round(
    b.dimensions.filter(d => d.weight > 0).reduce((s, d) => s + dimContributionPts(d), 0),
  )
}
