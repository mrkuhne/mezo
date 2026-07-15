// ============================================================
// Mezo · WorkoutReviewPage — read-only review of a COMPLETED workout
// (/train/review/:workoutId — spec 2026-07-15 done-day review, option B).
// Data: GET /api/train/workouts/{id} + the day's challenges (server
// outcomes). Renders the shared WorkoutSummary in 'closed' mode.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges, useWorkoutDetail } from '@/data/hooks'
import { huMonthDayDow } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'

export function WorkoutReviewPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const { detail, pending, error } = useWorkoutDetail(workoutId ?? null)
  const { challenges } = useChallenges(detail?.templateSessionId ?? null, detail?.date ?? '')

  if (pending) return <ScreenSkeleton />
  if (error || !detail) {
    return (
      <div style={{ padding: 24 }}>
        <GhostState lines={3} message="Ez az edzés nem található." ctaLabel="← Vissza az edzésekhez" onCta={() => navigate('/train')} />
      </div>
    )
  }

  const exercises: SummaryExercise[] = detail.exercises.map((e) => ({
    id: e.exerciseId,
    name: e.name,
    plannedSets: e.warmupSets + e.workingSets,
    sets: e.sets.map((s) => ({ weight: Number(s.weightKg ?? 0), reps: s.reps ?? 0, rir: s.rir ?? 0 })),
    skipped: e.skipped,
  }))
  // Server-resolved outcomes; anything not hit/miss/inconclusive reads as skipped.
  const challengeRows: SummaryChallenge[] = challenges.map((c) => ({
    id: c.id,
    typeLabel: c.typeLabel,
    exercise: c.exercise,
    target: c.target,
    state: c.status === 'hit' || c.status === 'miss' || c.status === 'inconclusive' ? c.status : 'skipped',
    detail: c.outcome ?? undefined,
  }))

  return (
    <WorkoutSummary
      title={detail.title}
      eyebrow={`Lezárva · ${huMonthDayDow(detail.date)}`}
      mode="closed"
      showSetLines
      exercises={exercises}
      challenges={challengeRows}
      onExit={() => navigate('/train')}
    />
  )
}
