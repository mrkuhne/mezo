import type { Ingredient, RecipeIngredientLine } from '@/data/types'

export type NovaGroup = 1 | 2 | 3 | 4
export const NOVA_META: Record<NovaGroup, { label: string; desc: string; color: string }> = {
  1: { label: 'NOVA 1', desc: 'Feldolgozatlan / minimálisan feldolgozott', color: 'var(--cat-response)' }, // theme-aware since mezo-0xh.30
  2: { label: 'NOVA 2', desc: 'Kulináris alapanyag (olaj, méz, só)', color: 'var(--coral)' },
  3: { label: 'NOVA 3', desc: 'Feldolgozott (kultúrált, sütött, fermentált)', color: 'var(--warning)' },
  4: { label: 'NOVA 4', desc: 'Ultra-feldolgozott (ipari rekonstrukció)', color: 'var(--cat-tendency)' },
}

// MicroPanel status → color (ported from meal-score.jsx:14-18)
export const STATUS_COLOR: Record<'good' | 'ok' | 'low', string> = {
  good: 'var(--coral)',
  ok: 'var(--text-secondary)',
  low: 'var(--warning)',
}

/** Dominant NOVA = the max NOVA group across the recipe's ingredient lines (1 when none). */
export function deriveNovaDominant(lines: RecipeIngredientLine[], pool: Ingredient[]): NovaGroup {
  let max = 1 as NovaGroup
  for (const l of lines) {
    const ing = pool.find(i => i.id === l.refId)
    if (ing && ing.nova > max) max = ing.nova
  }
  return max
}
