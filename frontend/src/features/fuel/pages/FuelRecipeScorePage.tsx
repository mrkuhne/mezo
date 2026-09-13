// ============================================================
// Mezo · Fuel recept-értékelés (mezo-jb84)
//
// A recept „miért jó" pontszáma a Titán felületen — UGYANAZ a `FuelScoreSurface`, amit a logolt
// étkezés értékelése is rendere. Élesben ez volt a hiba: a recept pontszáma még a RÉGI
// `RecipeScoreSheet`-et nyitotta, miközben az étkezésé már a Titán oldalt — két bőr ugyanarra a
// `MealBreakdown` envelope-ra. Az owner döntése szerint egy recept megnyitása ugyanolyan mély,
// mint egy logolt ételé; ez az oldal zárja be ezt a rést.
//
// EZ NEM EGY ÚJ PONTOZÁS. A bontás a `useRecipeBreakdown`-tól jön (lusta envelope + coach-próza);
// a számokat ez a lap nem számolja újra és nem írja át.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { useFeedback, useRecipeBreakdown, useRecipes } from '@/data/hooks'
import { huInt } from '@/shared/lib/huNum'
import { FuelScoreSurface } from '@/features/fuel/components/FuelScoreSurface'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { roleRubricLabel } from '@/features/fuel/logic/recipeRole'

export function FuelRecipeScorePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes } = useRecipes()
  const recipe = recipes.find(r => r.id === id)
  const { breakdown, pending } = useRecipeBreakdown(id ?? '')

  // A chipek CSAK akkor jelennek meg, ha van coach-próza, amire szavazni lehet (mezo-76f6).
  // A hook feltétel nélkül fut, hogy a sorrendje sose függjön a betöltés állapotától.
  const hasProse = !!breakdown?.summary
  const feedback = useFeedback('recipe_breakdown', hasProse && recipe ? [recipe.id] : [])

  const back = () => navigate(`/fuel/recipes/${id}`, { replace: true })

  if (!recipe) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel/recipes')} aria-label="Vissza a receptekhez">‹</button>
          <span><small>AI ÉRTÉKELÉS</small><strong>Recept</strong></span>
        </div>
        <p className="fmx-nodata">Ez a recept nincs meg.</p>
      </div>
    )
  }

  // Ugyanaz a szabály, mint az étkezésnél: bontás nélkül nincs mit megmutatni — és nem
  // találunk ki helyette semmit.
  if (!breakdown) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={back} aria-label="Vissza a recepthez">‹</button>
          <span><small>AI ÉRTÉKELÉS</small><strong>{recipe.name}</strong></span>
        </div>
        <p className="fmx-nodata">
          {pending ? 'Az értékelés készül…' : 'Ehhez a recepthez még nincs értékelés.'}
        </p>
      </div>
    )
  }

  const scorePct = Math.round(breakdown.dimensions.reduce((a, d) => a + d.score * d.weight, 0) * 100)

  return (
    <div className="fmx-page">
      <div className="fmx-subhead">
        <button type="button" onClick={back} aria-label="Vissza a recepthez">‹</button>
        <span>
          <small>AI ÉRTÉKELÉS</small>
          <strong>{recipe.name}</strong>
        </span>
        <b className="fmx-subhead-end">{huInt(recipe.macros.kcal)} kcal / adag</b>
      </div>

      <FuelScoreSurface
        breakdown={breakdown}
        scorePct={scorePct}
        tagline={breakdown.tagline}
        summary={breakdown.summary}
        improve={breakdown.improve}
        feedback={hasProse ? (
          <div className="fmx-score-fb">
            <FeedbackChips
              key={recipe.id}
              value={feedback.get(recipe.id)}
              onVote={(v, reason) => feedback.vote(recipe.id, v, reason)}
              label="a Mezo olvasatáról"
            />
          </div>
        ) : null}
        note={<>
          A recept pontszáma a SABLONRA szól, egy adagra vetítve — nem arra, amit végül megettél.
          {recipe.role !== 'standard' && <> A mérce ehhez a szerephez igazodik: {roleRubricLabel(recipe.role)}.</>}
          {' '}Amit belőle logolsz, a saját étkezés-értékelését kapja.
        </>}
      />
    </div>
  )
}
