// ============================================================
// Mezo · mealShare (mezo-l2gp0) — a Mai kártya arány-gyűrűinek tiszta matekja.
//
// P/Ch/Zs gyűrű: a makró részesedése az étkezés SAJÁT, grammokból számolt (Atwater 4/4/9)
// energiájából — a részletlap arány-gyűrűinek szemantikája, kártya-léptékben. A napi célhoz
// mért per-étkezés ív a gyakorlatban üresnek látszott (owner, v1 elvetve).
// Rost gyűrű: a NAPI rost-adagból fedezett rész — a rostnak nincs energia-aránya.
//
// Őszinte-null: ha bármely makró hiányzik, EGYIK arány sem számolható (csonka összetételre
// nem állítunk tényt); a csupa-0 összetétel 0/0 → null. A hívó a grammot ettől még mutatja.
// ============================================================

export interface MacroShares { p: number | null; c: number | null; f: number | null }

const NONE: MacroShares = { p: null, c: null, f: null }

/** Egész százalék (0–100) makrónként az étkezés makró-energiájából; null-hármas, ha nem számolható. */
export function macroEnergyShares(row: {
  proteinG: number | null; carbsG: number | null; fatG: number | null
}): MacroShares {
  const { proteinG, carbsG, fatG } = row
  if (proteinG == null || carbsG == null || fatG == null) return NONE
  const p = proteinG * 4
  const c = carbsG * 4
  const f = fatG * 9
  const total = p + c + f
  if (total <= 0) return NONE
  return {
    p: Math.round((p / total) * 100),
    c: Math.round((c / total) * 100),
    f: Math.round((f / total) * 100),
  }
}

/** A napi rost-adagból fedezett rész egész százalékban, 100-ra vágva; őszinte-null. */
export function fiberSharePct(fiberG: number | null, targetG: number): number | null {
  if (fiberG == null || targetG <= 0) return null
  return Math.min(100, Math.round((fiberG / targetG) * 100))
}
