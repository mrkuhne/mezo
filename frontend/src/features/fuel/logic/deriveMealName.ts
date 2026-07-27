// Max chars of the auto-derived meal name before it is truncated with an ellipsis (mezo-u68c).
export const MAX_DERIVED_NAME_LEN = 64

/**
 * A display name derived from a meal's line names: the names joined with ", ", accumulating whole
 * names up to MAX_DERIVED_NAME_LEN, then "…" if more remain. A single recipe line yields the recipe
 * name; pantry items yield the joined item names. Empty input → "". Pure/deterministic — shared by
 * the LogMealSheet default and the buildDayPlan display fallback so one rule holds everywhere.
 */
export function deriveMealName(names: string[]): string {
  const clean = names.map(n => (n ?? '').trim()).filter(n => n.length > 0)
  if (clean.length === 0) return ''
  const parts: string[] = []
  let len = 0
  for (const name of clean) {
    const add = parts.length === 0 ? name.length : 2 + name.length // ", " + name
    if (parts.length > 0 && len + add > MAX_DERIVED_NAME_LEN) {
      return parts.join(', ') + '…'
    }
    parts.push(name)
    len += add
  }
  return parts.join(', ')
}
