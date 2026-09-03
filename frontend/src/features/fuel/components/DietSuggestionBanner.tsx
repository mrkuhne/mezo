import { Link } from 'react-router-dom'
import { useGoal, useGoalSuggestions } from '@/data/hooks'

// Slim Fuel-side surface for an open diet suggestion (slice 4): the decision lives on
// the Cél page — this banner only signals + deep-links. Renders nothing when quiet.
// The Cél goal-recept page is the WEIGHT goal at /me/goals/weight (the life-goals hub
// now owns the bare /me/goals path — verified against src/app/router.tsx, not guessed).
export function DietSuggestionBanner() {
  const { goalId } = useGoal()
  const { suggestions } = useGoalSuggestions(goalId)
  if (!suggestions.length) return null
  return (
    <Link
      to="/me/goals/weight"
      className="card row"
      style={{
        alignItems: 'center', gap: 7, padding: '8px 11px', marginBottom: 8,
        textDecoration: 'none',
        background: 'color-mix(in srgb, var(--warning) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
        Diéta-javaslat vár a Cél oldalon
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
    </Link>
  )
}
