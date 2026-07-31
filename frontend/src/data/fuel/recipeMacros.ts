import type { Ingredient, RecipeIngredientLine } from '@/data/types'

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
export function lineContribution(amount: number, per: number, src: Macros): Macros {
  const factor = amount / (per || 1)
  return {
    kcal: roundMacro(src.kcal * factor),
    p: roundMacro(src.p * factor),
    c: roundMacro(src.c * factor),
    f: roundMacro(src.f * factor),
  }
}

/** Fill a line's snapshot name + contribution from its source ingredient (zeros if missing). */
export function enrichLine(line: RecipeIngredientLine, ing: Ingredient | undefined): RecipeIngredientLine {
  if (!ing) return { ...line, name: line.refId, contribution: { kcal: 0, p: 0, c: 0, f: 0 } }
  return { ...line, name: ing.name, contribution: lineContribution(line.amount, ing.per, ing.macros) }
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
