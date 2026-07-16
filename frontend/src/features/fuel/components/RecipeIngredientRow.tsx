// ============================================================
// Mezo · RecipeIngredientRow
// One ingredient line: category-colored left border, scaled macros,
// SourceBadge + italic note. Macros scale by amount/per when unit is grams.
// ============================================================
import type { Ingredient } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'

export interface RecipeIngredientItem {
  refId: string
  amount: number
  unit: string
  note?: string
  ingredient?: Ingredient
}

export function RecipeIngredientRow({ item }: { item: RecipeIngredientItem }) {
  const { categoryMeta } = usePantry()
  const ing = item.ingredient
  if (!ing) return null
  const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'

  // Scaled macros for this amount (gram-based ingredients scale by amount/per).
  const ratio = item.unit === 'g' ? item.amount / ing.per : 1
  const m = {
    kcal: Math.round(ing.macros.kcal * ratio),
    p: +(ing.macros.p * ratio).toFixed(1),
    c: +(ing.macros.c * ratio).toFixed(1),
    f: +(ing.macros.f * ratio).toFixed(1),
  }

  return (
    <div className="card" style={{
      padding: '10px 12px',
      borderLeft: '2px solid ' + catColor,
    }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{ing.name}</span>
            <SourceBadge source={ing.source} />
          </div>
          {item.note && (
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 3, fontStyle: 'italic' }}>{item.note}</span>
          )}
          <div className="row gap-md mt-xs" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>kcal <span style={{ color: 'var(--text-primary)' }}>{m.kcal}</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>P <span style={{ color: 'var(--text-primary)' }}>{m.p}</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>C <span style={{ color: 'var(--text-primary)' }}>{m.c}</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>F <span style={{ color: 'var(--text-primary)' }}>{m.f}</span></span>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, color: catColor, fontWeight: 600, lineHeight: 1 }}>
            {item.amount}{item.unit === 'g' ? 'g' : item.unit === 'db' ? 'db' : item.unit}
          </span>
          <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
            {ing.brand}
          </span>
        </div>
      </div>
    </div>
  )
}
