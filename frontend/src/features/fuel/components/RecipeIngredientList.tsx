// ============================================================
// Mezo · RecipeIngredientList
// Ingredient rows + a "Honnan jönnek" source-summary footer
// (distinct SourceBadges across the resolved ingredients).
// ============================================================
import type { PantrySourceKey } from '@/data/pantrySources'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { RecipeIngredientRow, type RecipeIngredientItem } from '@/features/fuel/components/RecipeIngredientRow'

export function RecipeIngredientList({ items }: { items: RecipeIngredientItem[] }) {
  const sources = [...new Set(
    items.map(it => it.ingredient?.source).filter((s): s is PantrySourceKey => Boolean(s)),
  )]

  return (
    <>
      <div className="col gap-sm" style={{ marginBottom: 14 }}>
        {items.map((it, i) => <RecipeIngredientRow key={i} item={it} />)}
      </div>

      <div className="card notch-4" style={{ padding: 12, background: 'var(--surface-1)' }}>
        <Eyebrow className="text-tertiary">Honnan jönnek</Eyebrow>
        <div className="row gap-sm mt-sm flex-wrap">
          {sources.map(s => (
            <SourceBadge key={s} source={s} size="lg" />
          ))}
        </div>
      </div>
    </>
  )
}
