// ============================================================
// Mezo · RecipeScoreSheet (mezo-d20.8.3.1 — F7.3 recept-mozaik)
// The recipe detail's full score breakdown, moved OFF the page into a sheet: the
// Pontszám tile opens this. One surface, two callers — the body is the SAME
// ScoreBreakdownBody the MealScoreSheet renders; only the header differs (recipe
// name + n szempont · megbízhatóság + the role rubric line for non-standard roles).
// ============================================================
import type { Recipe, MealBreakdown } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { ScoreBreakdownBody } from '@/features/fuel/components/ScoreBreakdownBody'
import { roleRubricLabel } from '@/features/fuel/logic/recipeRole'

export function RecipeScoreSheet({ recipe, breakdown, onClose }: {
  recipe: Recipe
  breakdown: MealBreakdown
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="recipe-score-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div className="col">
              <Eyebrow brand>Pontszám · részletek</Eyebrow>
              <div id="recipe-score-title" style={{ marginTop: 4 }}>
                <Display size="md">{recipe.name}</Display>
              </div>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {breakdown.dimensions.length} szempont · megbízh. {Math.round(breakdown.confidence * 100)}%
                {recipe.role !== 'standard' && <> · {roleRubricLabel(recipe.role)} mérce</>}
              </span>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <ScoreBreakdownBody breakdown={breakdown} />

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
