/**
 * Gram display for the nutrition facts (mezo-m6uv): Hungarian decimal comma, at most one decimal,
 * no trailing `,0`, and an em-dash for "no data" — a missing fact is never printed as 0.
 * Storage keeps three decimals, so a real value can be smaller than the display step: a positive
 * value that would round to 0 prints as `<0,1` rather than `0`, because "0" reads as "none" and
 * that is the same lie as printing 0 for a null. A genuine 0 still prints as `0`.
 * The `+ EPSILON` guards floating-point drift that can occur during arithmetic.
 */
export function formatGram(v: number | null | undefined): string {
  if (v == null) return '—'
  const rounded = Math.round(v * 10 + Number.EPSILON) / 10
  if (rounded === 0 && v > 0) return '<0,1'
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace('.', ',')
}
