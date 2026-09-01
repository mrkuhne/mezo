// ============================================================
// Mezo · Recept-műhely pure state logic (mezo-92pb)
// Everything the workshop chat page needs that has NO side effects — resolving a line's
// live macros against the pantry, rolling up draft totals, proportional serving-scaling,
// which lines to gold-flash after a turn, and the save-gate mapping to RecipeInput.
// Kept separate from workshopApi.ts (the wire boundary) so these can be unit-tested without
// any network/mock plumbing, mirroring recipeMacros.ts's split from recipeApi.ts.
// ============================================================
import { lineContribution, roundMacro } from '@/data/fuel/recipeMacros'
import type { PickableIngredient } from '@/data/fuel/pantryPickables'
import type { Recipe, RecipeInput, RecipeRole, WorkshopDraft, WorkshopGoal, WorkshopLine } from '@/data/types'

type Macros = { kcal: number; p: number; c: number; f: number }

/**
 * One line's current macro contribution, or `null` when it cannot be honestly computed —
 * NEVER a fabricated zero (mirrors the `factsOf`/`toNutrients` null-preserving convention).
 * Pantry: resolved live against `pool` via the shared `lineContribution` formula (same one
 * the recipe editor and the backend use) so a workshop preview never disagrees with a saved
 * recipe's macros. An unresolvable pantry ref (deleted/renamed pantry row) is `null`, not 0 —
 * the UI renders an honest dash rather than lying about a macro it doesn't have.
 * Estimate: the line already carries its own totals in `est` (AI/user-authored, no pantry
 * source to resolve against).
 */
export function lineMacros(line: WorkshopLine, pool: PickableIngredient[]): Macros | null {
  if (line.source === 'pantry') {
    const ing = pool.find(p => p.id === line.refId)
    if (!ing) return null
    return lineContribution(line.amount, ing.per, ing.macros)
  }
  return line.est ?? null
}

/** Whole-draft totals — Σ of every line's non-null `lineMacros` (unresolved lines contribute
 *  nothing, they are not silently zeroed into the sum either way). */
export function draftTotals(draft: WorkshopDraft, pool: PickableIngredient[]): Macros {
  return draft.lines.reduce<Macros>(
    (acc, line) => {
      const m = lineMacros(line, pool)
      if (!m) return acc
      return { kcal: acc.kcal + m.kcal, p: acc.p + m.p, c: acc.c + m.c, f: acc.f + m.f }
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
}

const MIN_SERVINGS = 1
const MAX_SERVINGS = 12
const AMOUNT_ROUNDING = 5

/**
 * Rescale every line's amount proportionally to a new serving count (clamped 1..12), rounding
 * amounts to the nearest 5 g/units — a workshop draft is an eyeballed preview, not a precision
 * scale. An estimate line's frozen `est` totals are rescaled alongside its amount (from the
 * line's OWN before/after amount ratio, mirroring `rescaleFrozen`'s frozen-snapshot rationale —
 * there is no live pantry row to recompute an estimate line from) so `draftTotals` stays
 * consistent with the new amounts to within rounding.
 */
export function scaleServings(draft: WorkshopDraft, next: number): WorkshopDraft {
  const servings = Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(next)))
  const factor = servings / draft.servings
  const lines = draft.lines.map((line): WorkshopLine => {
    const amount = Math.round((line.amount * factor) / AMOUNT_ROUNDING) * AMOUNT_ROUNDING
    if (line.source === 'estimate' && line.est) {
      const estFactor = line.amount ? amount / line.amount : factor
      return {
        ...line,
        amount,
        est: {
          kcal: roundMacro(line.est.kcal * estFactor),
          p: roundMacro(line.est.p * estFactor),
          c: roundMacro(line.est.c * estFactor),
          f: roundMacro(line.est.f * estFactor),
        },
      }
    }
    return { ...line, amount }
  })
  return { ...draft, servings, lines }
}

/** A line's identity across turns — the pantry ref when resolved, else a name-derived key for
 *  estimate lines (which have no stable ref). Exported so the PAGE can match a row against
 *  `diffLineKeys`' output with the very same rule (a private mirror there would drift). */
export function lineKey(line: WorkshopLine): string {
  return line.refId ?? `est:${line.name}`
}

/**
 * Keys of the lines the gold-flash animation should highlight after a turn: lines that are new
 * (no line with that key existed in `prev`) or whose amount changed — NOT every line, so an
 * untouched line the model merely echoed back doesn't flash. `prev === null` (the first turn)
 * flags every line as added.
 */
export function diffLineKeys(prev: WorkshopDraft | null, next: WorkshopDraft): string[] {
  const prevByKey = new Map((prev?.lines ?? []).map(l => [lineKey(l), l]))
  const out: string[] = []
  for (const line of next.lines) {
    const key = lineKey(line)
    const before = prevByKey.get(key)
    if (!before || before.amount !== line.amount) out.push(key)
  }
  return out
}

/** A saved Recipe reopened in the workshop — every line is necessarily a resolved pantry ref
 *  (a saved recipe never carries an estimate line), so this always round-trips cleanly. */
export function recipeToDraft(r: Recipe): WorkshopDraft {
  return {
    name: r.name,
    category: r.category,
    servings: r.servings,
    steps: [],
    lines: r.ingredients.map((i): WorkshopLine => ({
      source: 'pantry',
      refId: i.refId,
      name: i.name ?? i.refId,
      amount: i.amount,
      unit: i.unit,
    })),
  }
}

/**
 * The save gate (spec: a recipe can only be persisted once every line resolves to a real
 * pantry row): `null` while ANY line is still `estimate`, forcing the user back to the chat
 * to pin it down or swap it for a pantry match. Once clean, maps 1:1 onto `RecipeRequest`
 * (pantry `refId` → `pantryItemId`, base fields carried through verbatim from the editor shell).
 */
export function draftToInput(
  draft: WorkshopDraft,
  base: { slot?: string | null; tags: string[]; starred: boolean; prepMins?: number | null; cookMins?: number | null },
  role: RecipeRole,
): RecipeInput | null {
  if (draft.lines.some(l => l.source === 'estimate')) return null
  return {
    name: draft.name,
    slot: base.slot,
    category: draft.category,
    servings: draft.servings,
    prepMins: base.prepMins,
    cookMins: base.cookMins,
    tags: base.tags,
    starred: base.starred,
    role,
    ingredients: draft.lines.map(l => ({
      // Safe: the `some('estimate')` guard above already ruled every line pantry, and a
      // pantry line always carries a resolved refId (recipeToDraft/workshopApi never emit one without).
      pantryItemId: l.refId as string,
      amount: l.amount,
      unit: l.unit,
    })),
  }
}

/** Which scoring rubric a saved recipe targets — the workshop goal retargets pre/post-workout
 *  through 1:1 (mirrors `RecipeRole`'s existing values); every other goal saves as `standard`. */
export function goalRole(goal: WorkshopGoal | null): RecipeRole {
  return goal === 'pre_workout' || goal === 'post_workout' ? goal : 'standard'
}
