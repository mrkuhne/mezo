import { Link } from 'react-router-dom'
import { useGoal, useGoalSuggestions } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { Bub, Chev } from '@/shared/ui/folyadek'

// The Fuel-side signal of an open diet suggestion (slice 4; Folyadék F5, mezo-n4wf5.5 — prototype
// vilagos/fuel.js `mai.javaslat`, the amber `.fu-kms` strip under the tabs): the decision lives on the Cél
// page — this strip only signals + deep-links. Renders nothing when quiet. The Cél goal page is the WEIGHT
// goal at /me/goals/weight (the life-goals hub owns the bare /me/goals path).
// It is a real LINK (the shared `Strip` is a button), so it wears the strip's classes itself.
export function DietSuggestionBanner() {
  const M = useM()
  const { goalId } = useGoal()
  const { suggestions } = useGoalSuggestions(goalId)
  if (!suggestions.length) return null
  return (
    <Link to="/me/goals/weight" className="fx-kms warn fa-diet">
      <Bub icon="t-ring" size={30} color="var(--fo-warn)" />
      <span><b>{M.fuelMai.diet.waiting}</b></span>
      <Chev />
    </Link>
  )
}
