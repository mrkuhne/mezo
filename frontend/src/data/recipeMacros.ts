import type { Ingredient, RecipeIngredientLine } from './types'

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
