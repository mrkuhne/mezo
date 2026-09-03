/**
 * The unified log flow's AmountField guard (design 2.0 §7 — "every line amount is a typeable
 * input … invalid/≤0 input keeps the previous value"). Shared by the ± steppers and the typed
 * input so both paths enforce the same floor.
 */

/** Typed-input parse: a non-finite or ≤0 value keeps `previous` instead of collapsing to 0/NaN. */
export function parseAmountInput(raw: string, previous: number): number {
  const n = Number(raw.replace(',', '.').trim())
  return Number.isFinite(n) && n > 0 ? n : previous
}

/** Stepper bump — never below `min` (1, matching the legacy LogMealSheet floor). */
export function stepAmount(previous: number, delta: number, min = 1): number {
  return Math.max(min, previous + delta)
}
