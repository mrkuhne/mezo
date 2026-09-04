import type { components } from '@/data/_client/api.gen'
import type { Ingredient, Nutrients, PantryMacrosVM, RecipeIngredientLine } from '@/data/types'

type Macros = { kcal: number; p: number; c: number; f: number }

/**
 * Whole-number rounding, matching the backend `RecipeMapper.setScale(0, HALF_UP)`.
 * For these non-negative macros JS `Math.round` matches Java `RoundingMode.HALF_UP`.
 */
export function roundMacro(n: number): number {
  return Math.round(n)
}

/**
 * One ingredient line's macro contribution. factor = amount / per (per defaults to 1 for
 * discrete units so amount/1 = amount). IDENTICAL to the backend RecipeMapper formula.
 */
export function lineContribution(amount: number, per: number, src: PantryMacrosVM): Macros {
  // `?? 0` at the boundary since mezo-6omv: a missing definition macro contributes nothing to a
  // recipe line's total — but the underlying null on `src` is NOT rewritten anywhere.
  const factor = amount / (per || 1)
  return {
    kcal: roundMacro((src.kcal ?? 0) * factor),
    p: roundMacro((src.p ?? 0) * factor),
    c: roundMacro((src.c ?? 0) * factor),
    f: roundMacro((src.f ?? 0) * factor),
  }
}

/** Fill a line's snapshot name + contribution from its source ingredient (zeros if missing). */
export function enrichLine(line: RecipeIngredientLine, ing: Ingredient | undefined): RecipeIngredientLine {
  if (!ing) return { ...line, name: line.refId, contribution: { kcal: 0, p: 0, c: 0, f: 0 }, nutrients: { ...NO_NUTRIENTS } }
  return {
    ...line,
    name: ing.name,
    contribution: lineContribution(line.amount, ing.per, ing.macros),
    nutrients: lineNutrients(line.amount, ing.per, factsOf(ing)),
  }
}

/**
 * Rescale a line's server-frozen contribution to a different amount. Used only when the live pantry
 * row cannot be resolved: the backend scales that line from its OWN frozen snapshot and never reads
 * the pantry, so falling back to 0 would erase from the preview a line the server still counts.
 * Lossy — the frozen contribution is already whole-number rounded — but far closer than zero.
 */
export function rescaleFrozen(
  contribution: Macros | undefined, amount: number, originalAmount: number,
): Macros {
  if (!contribution || !originalAmount) return { kcal: 0, p: 0, c: 0, f: 0 }
  const factor = amount / originalAmount
  return {
    kcal: roundMacro(contribution.kcal * factor),
    p: roundMacro(contribution.p * factor),
    c: roundMacro(contribution.c * factor),
    f: roundMacro(contribution.f * factor),
  }
}

/** Whole-recipe macros = sum of line contributions (each already enriched). */
export function computeRecipeMacros(lines: RecipeIngredientLine[]): Macros {
  const sum = lines.reduce<Macros>(
    (acc, l) => {
      const c = l.contribution ?? { kcal: 0, p: 0, c: 0, f: 0 }
      return { kcal: acc.kcal + c.kcal, p: acc.p + c.p, c: acc.c + c.c, f: acc.f + c.f }
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
  return { kcal: roundMacro(sum.kcal), p: roundMacro(sum.p), c: roundMacro(sum.c), f: roundMacro(sum.f) }
}

/**
 * Whole-recipe macros with per-line amount substitutions (mezo-ormb). The key is the line's ARRAY
 * INDEX, which equals the backend's `lineOrder` (RecipeService assigns it from the loop index and
 * `@OrderBy("lineOrder")` preserves it) — so a recipe listing the same pantry item twice is
 * disambiguated. Round per line, then sum: identical to `RecipeMapper.rollupWithOverrides`.
 * An empty `overrides` reproduces `computeRecipeMacros` exactly.
 */
export function computeRecipeMacrosWithOverrides(
  lines: RecipeIngredientLine[],
  ingredients: Ingredient[],
  overrides: Record<number, number>,
): Macros {
  const zero: Macros = { kcal: 0, p: 0, c: 0, f: 0 }
  const sum = lines.reduce<Macros>(
    (acc, line, i) => {
      const ing = ingredients.find(x => x.id === line.refId)
      const amount = overrides[i]
      // UNTOUCHED line: keep the contribution the server already computed from the recipe's FROZEN
      // per-line snapshot. Recomputing it from the live pantry row would silently disagree with what
      // the backend stores whenever that row drifted since the recipe was saved. Only when the line
      // carries no contribution (bare fixtures / drafts) do we derive one from the live source.
      // OVERRIDDEN line: rescaled from the live pantry row when one resolves; with no resolvable
      // source the backend still scales this line from its OWN frozen snapshot (it never reads the
      // pantry), so falling back to 0 would erase a line the server still counts — rescale the
      // frozen contribution instead.
      const c =
        amount === undefined
          ? (line.contribution ?? (ing ? lineContribution(line.amount, ing.per, ing.macros) : zero))
          : (ing ? lineContribution(amount, ing.per, ing.macros) : rescaleFrozen(line.contribution, amount, line.amount))
      return { kcal: acc.kcal + c.kcal, p: acc.p + c.p, c: acc.c + c.c, f: acc.f + c.f }
    },
    { ...zero },
  )
  return { kcal: roundMacro(sum.kcal), p: roundMacro(sum.p), c: roundMacro(sum.c), f: roundMacro(sum.f) }
}

/**
 * Wire `nutrients` (every field OPTIONAL — `number | null | undefined`) → domain `Nutrients`
 * (every field always present, `number | null`). `null`/absent on the wire is never turned into
 * 0 — that is the entire point of this normalizer: an ingredient/line/recipe the backend has no
 * fact for stays honestly `null`, not a fabricated zero.
 *
 * Lives here (not in recipeApi.ts, where the brief first sketched it) because recipeApi.ts already
 * imports `fromBreakdown` from mealApi.ts — a second, reverse import of this helper from recipeApi
 * into mealApi would close a cycle between the two API modules. Both import it from here instead.
 */
export function toNutrients(n: components['schemas']['Nutrients'] | undefined): Nutrients {
  return {
    fiberG: n?.fiberG ?? null,
    sugarG: n?.sugarG ?? null,
    saltG: n?.saltG ?? null,
    saturatedFatG: n?.saturatedFatG ?? null,
  }
}

export const NO_NUTRIENTS: Nutrients = { fiberG: null, sugarG: null, saltG: null, saturatedFatG: null }

/**
 * Structural shape shared by every "optional facts" source that carries the four
 * nutrition-quality fields but is otherwise a different domain type (`Ingredient`,
 * `PantryLookupItem`, `PantryScrapeDraft`, …) — typed narrowly here so `factsOf` accepts any
 * of them without coupling to one concrete type.
 */
export interface NutrientFactSource {
  fiberG?: number | null
  sugarG?: number | null
  saltG?: number | null
  saturatedFatG?: number | null
}

/**
 * One optional-facts source → `Nutrients`, the ONE place this literal is built (mezo-m6uv review:
 * `enrichLine`/`computeRecipeNutrientsWithOverrides` here, LogFlowPage's pantry-arm line, and
 * ImportItemSheet's preview all built the identical `?? null` literal independently). `?? null`
 * on every field — a missing fact never becomes a fabricated 0, and a missing SOURCE (`undefined`)
 * never becomes a fabricated value either.
 */
export function factsOf(src: NutrientFactSource | undefined | null): Nutrients {
  return {
    fiberG: src?.fiberG ?? null,
    sugarG: src?.sugarG ?? null,
    saltG: src?.saltG ?? null,
    saturatedFatG: src?.saturatedFatG ?? null,
  }
}

const NUTRIENT_KEYS = ['fiberG', 'sugarG', 'saltG', 'saturatedFatG'] as const

/**
 * Grams to THREE decimals — mirrors `RecipeMapper.scaledGram` (BigDecimal setScale(3, HALF_UP)).
 * Storage/summation precision, NOT display: `formatGram` does the one-decimal rounding at the edge.
 * Rounding per line at one decimal turned a true 0.04 g salt contribution into 0.1 g and compounded
 * across lines. The `+ EPSILON` guards the float representation (0.0155 * 1000 is 15.499999999999998,
 * which would round DOWN); `null` stays null so "no data" never becomes a fake 0.
 */
export function roundGram(n: number | null | undefined): number | null {
  return n == null ? null : Math.round(n * 1000 + Number.EPSILON) / 1000
}

/** One line's nutrient facts at `amount`, from a per-`per`-basis source. */
export function lineNutrients(amount: number, per: number, src: Nutrients): Nutrients {
  const factor = amount / (per || 1)
  return {
    fiberG: roundGram(src.fiberG == null ? null : src.fiberG * factor),
    sugarG: roundGram(src.sugarG == null ? null : src.sugarG * factor),
    saltG: roundGram(src.saltG == null ? null : src.saltG * factor),
    saturatedFatG: roundGram(src.saturatedFatG == null ? null : src.saturatedFatG * factor),
  }
}

/** Multiply every present fact (e.g. whole-recipe → per adag). */
export function scaleNutrients(n: Nutrients, mult: number): Nutrients {
  return lineNutrients(mult, 1, n)
}

/** Null-preserving Σ — null only when EVERY input was null for that field (cf. RecipeMapper.addNullable). */
export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = { ...NO_NUTRIENTS }
  for (const n of list) {
    for (const k of NUTRIENT_KEYS) {
      const v = n[k]
      if (v != null) out[k] = (out[k] ?? 0) + v
    }
  }
  for (const k of NUTRIENT_KEYS) out[k] = roundGram(out[k])
  return out
}

/** Rescale a frozen nutrient contribution to a different amount — the `rescaleFrozen` sibling. */
export function rescaleFrozenNutrients(
  n: Nutrients | undefined, amount: number, originalAmount: number,
): Nutrients {
  if (!n || !originalAmount) return { ...NO_NUTRIENTS }
  return lineNutrients(amount, originalAmount, n)
}

/** Whole-recipe nutrients = null-preserving Σ of the line facts. */
export function computeRecipeNutrients(lines: RecipeIngredientLine[]): Nutrients {
  return sumNutrients(lines.map(l => l.nutrients ?? NO_NUTRIENTS))
}

/**
 * Whole-recipe nutrients with per-line amount substitutions — the nutrient twin of
 * `computeRecipeMacrosWithOverrides`, branching identically: an UNTOUCHED line keeps the
 * server-frozen facts, falling back to a live-ingredient computation only when the line itself
 * carries no frozen facts (bare fixtures / unsaved drafts — mirrors the macro twin's
 * `line.contribution ?? (ing ? lineContribution(...) : zero)`); an OVERRIDDEN line is rescaled
 * from the live pantry row when one resolves, else from its own frozen facts (the backend also
 * scales its own snapshot, never the pantry).
 */
export function computeRecipeNutrientsWithOverrides(
  lines: RecipeIngredientLine[], ingredients: Ingredient[], overrides: Record<number, number>,
): Nutrients {
  return sumNutrients(lines.map((line, i) => {
    const ing = ingredients.find(x => x.id === line.refId)
    const amount = overrides[i]
    return amount === undefined
      ? (line.nutrients ?? (ing ? lineNutrients(line.amount, ing.per, factsOf(ing)) : NO_NUTRIENTS))
      : (ing ? lineNutrients(amount, ing.per, factsOf(ing)) : rescaleFrozenNutrients(line.nutrients, amount, line.amount))
  }))
}
