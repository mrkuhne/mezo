// ============================================================
// Mezo · tierLabel — the Hungarian volume-tier vocabulary shared by every
// Train surface that names a muscle's mesocycle tier (mezo-88iwa.10, T9
// Titanium terv core). Was a page-local English map on MesoWeekPage
// (`emphasize`/`grow`/`maintain` → `Emphasize`/`Grow`/`Maintain`) and inline,
// duplicated English copy on MesoMusclePage's hero line — hoisted here so
// both pages (and the `pl-` Titanium tiles this slice adds) render the same
// three Hungarian words, same shape as logic/medalLabels.ts.
// ============================================================

export const TIER_LABEL: Record<'maintain' | 'grow' | 'emphasize', string> = {
  maintain: 'Tartás',
  grow: 'Építés',
  emphasize: 'Hangsúly',
}

/**
 * Tier → Hungarian label. Unknown or absent tiers fall back to `'grow'`'s
 * label ('Építés') — the wire's own sparse default for a missing/unrecognized
 * tier value.
 */
export function tierLabel(tier: string | null | undefined): string {
  return TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? TIER_LABEL.grow
}
