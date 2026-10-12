import { useGoal, useGoalSuggestions } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { Strip } from '@/features/fuel/components/folyadek'

// The Fuel-side signal of an open diet suggestion (slice 4; Folyadék F5, mezo-n4wf5.5 — prototype
// vilagos/fuel.js `mai.javaslat`, the amber `.fu-kms` strip under the tabs): the decision lives on the Cél
// page — this strip only signals + deep-links. Renders nothing when quiet. The Cél goal page is the WEIGHT
// goal at /me/goals/weight (the life-goals hub owns the bare /me/goals path).
// It is a real LINK: the shared `Strip` with `to`.
export function DietSuggestionBanner() {
  const M = useM()
  const { goalId } = useGoal()
  const { suggestions } = useGoalSuggestions(goalId)
  if (!suggestions.length) return null
  return (
    <Strip icon="t-ring" warn to="/me/goals/weight" className="fa-diet"><b>{M.fuelMai.diet.waiting}</b></Strip>
  )
}
