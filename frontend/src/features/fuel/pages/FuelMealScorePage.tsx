// ============================================================
// Mezo · FuelMealScorePage — az étkezés értékelése SAJÁT oldalon
// (Fuel Titanium S1b, mezo-33k6; Folyadék F5, mezo-n4wf5.5).
//
// EZ NEM EGY ÚJ PONTOZÓ FELÜLET: a `meal.breakdown` envelope-ot rendereli a közös `FuelScoreSurface`-en (a recept
// értékelése ugyanazt a felületet használja). Ezért:
//   • a súly / Σ aritmetika a KÖZÖS `logic/scoreArithmetic.ts`-ből jön;
//   • Mezo olvasata on demand (mezo-mr4n): a `summary` a verdictből, különben az envelope-ból; a `useFeedback`
//     FELTÉTEL NÉLKÜL mountol (a hook-sorrend nem függhet az adattól), a visszajelzés csak akkor jelenik meg, ha van
//     miről szavazni.
//
// FOLYADÉK (prototípus `vilagos/fuel.js` `score(id)`): címsor „Mezo értékelése", fölötte az étkezés neve; a hős felirata
// az étkezés helye és ideje; a hős gombja vissza az étkezés részleteihez. Arcok: nincs meg (közös az étkezés lapjával) ·
// még nincs értékelés · a szöveg készül · kész.
// ============================================================
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFeedback, useFuelDay, useMealCoachFor } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import type { FuelMeal } from '@/data/types'
import { breakdownTotalPct } from '@/features/fuel/logic/scoreArithmetic'
import { hhmmFromLoggedAt } from '@/features/fuel/logic/buildDayPlan'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { FuelScoreSurface } from '@/features/fuel/components/FuelScoreSurface'
import { MealNotFound, useMealPlaceLabel } from '@/features/fuel/pages/FuelMealDetailPage'
import { Btn, Card, Empty, FrameBack, Page, useFrameTitle } from '@/shared/ui/folyadek'

export function FuelMealScorePage() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  const day = search.get('d')
  const { fuel } = useFuelDay(day ?? undefined)
  const meal = fuel.meals.find(x => x.id === id) ?? null
  if (!meal) return <MealNotFound />
  return <MealScore meal={meal} day={day} />
}

function MealScore({ meal, day }: { meal: FuelMeal; day: string | null }) {
  const M = useM()
  const S = M.fuelEtkezes.score
  const navigate = useNavigate()
  // Mezo olvasata on demand (mezo-mr4n) — a determinisztikus test alatta azonnal renderel.
  const { verdict, isPending: coachPending } = useMealCoachFor(meal.id)
  const b = meal.breakdown
  const summary = verdict?.summary ?? b?.summary ?? null
  // EGY useFeedback, FELTÉTEL NÉLKÜL mountolva (mezo-76f6): a hook-sorrend nem függhet attól, van-e breakdown vagy próza.
  const feedback = useFeedback('meal_coach', summary ? [meal.id] : [])

  const name = mealDisplayName(meal) ?? M.fuelEtkezes.meal.fallbackTitle
  const place = useMealPlaceLabel(meal, day)
  useFrameTitle({ title: S.title, eyebrow: name })
  // Back returns where the user came from; this route is only where a direct link goes.
  const backTo = `/fuel/etkezes/${meal.id}${day ? `?d=${day}` : ''}`
  const back = <FrameBack className="fo-backpill" history fallback={backTo}>‹ {M.kit.back}</FrameBack>

  // Breakdown nélkül nincs mit megmutatni — és nem gyártunk hozzá pontszámot.
  if (!b) {
    return (
      <Page className="fe-page">
        {back}
        <Card><Empty icon="t-score" actions={<Btn sm onClick={() => navigate(backTo)}>{S.back}</Btn>}>{S.noRatingMeal}</Empty></Card>
      </Page>
    )
  }

  const scorePct = meal.score != null ? Math.round(meal.score * 100) : breakdownTotalPct(b)
  const time = hhmmFromLoggedAt(meal.loggedAt, '')

  return (
    <Page className="fe-page">
      {back}
      <FuelScoreSurface
        breakdown={b}
        scorePct={scorePct}
        label={[place, time].filter(Boolean).join(' · ')}
        tagline={verdict?.tagline ?? b.tagline}
        summary={summary}
        coachPending={coachPending}
        improve={verdict?.improve?.length ? verdict.improve : b.improve}
        detail={{ label: S.mealDetails, onClick: () => navigate(backTo) }}
        feedback={summary ? (
          /* Csendes visszajelzés Mezo SAJÁT prózájára (mezo-76f6) — a számokra nem szavazunk. */
          <FeedbackChips
            key={meal.id}
            value={feedback.get(meal.id)}
            onVote={(v, reason) => feedback.vote(meal.id, v, reason)}
            label={S.feedbackLabel}
          />
        ) : null}
        note={S.noteMeal}
      />
    </Page>
  )
}
