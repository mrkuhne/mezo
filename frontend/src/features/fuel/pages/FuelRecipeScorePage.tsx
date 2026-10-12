// ============================================================
// Mezo · Fuel recept-értékelés (mezo-jb84; Folyadék F5, mezo-n4wf5.5)
//
// A recept „miért jó" pontszáma UGYANAZON a `FuelScoreSurface`-en, amit a logolt étkezés értékelése is renderel — egy
// recept megnyitása ugyanolyan mély, mint egy logolt ételé (owner).
//
// EZ NEM EGY ÚJ PONTOZÁS. A bontás a `useRecipeBreakdown`-tól jön (lusta envelope + Mezo prózája); a számokat ez a lap
// nem számolja újra és nem írja át.
//
// FOLYADÉK (prototípus `vilagos/fuel.js` `recScore`): a hős felirata „Recept · sablon · 1 adag · N kcal" — a kcal EGY
// ADAGRA vetítve (a régi fejléc az EGÉSZ recept kcal-ját írta „/ adag" felirattal: az hiba volt, itt nem másoljuk).
// Arcok: a recept nincs meg · az értékelés készül · még nincs értékelés · kész.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { useFeedback, useRecipeBreakdown, useRecipes } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { FuelScoreSurface } from '@/features/fuel/components/FuelScoreSurface'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { roleRubricLabel } from '@/features/fuel/logic/recipeRole'
import { Btn, Card, Empty, FrameBack, Page, useFrameTitle } from '@/shared/ui/folyadek'

export function FuelRecipeScorePage() {
  const M = useM()
  const S = M.fuelEtkezes.score
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes } = useRecipes()
  const recipe = recipes.find(r => r.id === id)
  const { breakdown, pending } = useRecipeBreakdown(id ?? '')

  // A visszajelzés CSAK akkor jelenik meg, ha van próza, amire szavazni lehet (mezo-76f6).
  // A hook feltétel nélkül fut, hogy a sorrendje sose függjön a betöltés állapotától.
  const hasProse = !!breakdown?.summary
  const feedback = useFeedback('recipe_breakdown', hasProse && recipe ? [recipe.id] : [])

  useFrameTitle({ title: S.title, eyebrow: recipe ? recipe.name : S.recipe })
  const back = () => navigate(`/fuel/recipes/${id}`, { replace: true })

  if (!recipe) {
    return (
      <Page className="fe-page">
        <FrameBack className="fo-backpill" history fallback="/fuel/recipes">‹ {M.kit.back}</FrameBack>
        <Card><Empty icon="t-book" actions={<Btn sm onClick={() => navigate('/fuel/recipes')}>{S.backToRecipes}</Btn>}>{S.recipeGone}</Empty></Card>
      </Page>
    )
  }

  // Ugyanaz a szabály, mint az étkezésnél: bontás nélkül nincs mit megmutatni — és nem találunk ki helyette semmit.
  if (!breakdown) {
    return (
      <Page className="fe-page">
        <FrameBack className="fo-backpill" onBack={back}>‹ {M.kit.back}</FrameBack>
        <Card>
          <Empty icon="t-score" actions={<Btn sm onClick={back}>{S.backToRecipe}</Btn>}>
            {pending ? S.ratingOnWay : S.noRatingRecipe}
          </Empty>
        </Card>
      </Page>
    )
  }

  const scorePct = Math.round(breakdown.dimensions.reduce((a, d) => a + d.score * d.weight, 0) * 100)
  // EGY adag kcal-ja: a recept makrói az egész receptre szólnak.
  const perServing = Math.round(recipe.macros.kcal / Math.max(1, recipe.servings))

  return (
    <Page className="fe-page">
      <FrameBack className="fo-backpill" onBack={back}>‹ {M.kit.back}</FrameBack>
      <FuelScoreSurface
        breakdown={breakdown}
        scorePct={scorePct}
        label={S.recipeLabel(fmtGrouped(perServing))}
        tagline={breakdown.tagline}
        summary={breakdown.summary}
        improve={breakdown.improve}
        detail={{ label: S.recipeDetails, onClick: back }}
        feedback={hasProse ? (
          <FeedbackChips
            key={recipe.id}
            value={feedback.get(recipe.id)}
            onVote={(v, reason) => feedback.vote(recipe.id, v, reason)}
            label={S.feedbackLabel}
          />
        ) : null}
        note={recipe.role !== 'standard' ? S.noteRecipeRole(roleRubricLabel(recipe.role)) : S.noteRecipe}
      />
    </Page>
  )
}
