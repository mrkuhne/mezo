// ============================================================
// Mezo · WorkoutReviewPage — read-only review of a COMPLETED workout
// (/train/review/:workoutId — spec 2026-07-15 done-day review, option B;
// visual redesign mezo-w943). Data: GET /api/train/workouts/{id}, the day's
// challenges (server outcomes) and the medal cabinet filtered to this
// workout (workoutSessionId). Renders the shared WorkoutSummary in
// 'closed' mode.
// ============================================================
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges, useMedals, useWorkoutDetail } from '@/data/hooks'
import { huMonthDayDow } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'

export function WorkoutReviewPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNav('/train')
  const { detail, pending, error } = useWorkoutDetail(workoutId ?? null)
  const { challenges } = useChallenges(detail?.templateSessionId ?? null, detail?.date ?? '')
  const { data: allMedals } = useMedals()

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
    muscle: e.muscle,
    plannedSets: e.warmupSets + e.workingSets,
    // rir is honestly nullable (Finding 1): the API contract gives `rir: null` on every
    // warmup set — mapping it to 0 fabricated a fake worst-case RIR that dragged the Ø RIR
    // average toward zero and disagreed with the same workout's in-memory `complete`-phase
    // average (which only ever holds real RIRs). summaryStats.deriveSummaryStats averages
    // only non-null rirs.
    sets: e.sets.map((s) => ({ weight: Number(s.weightKg ?? 0), reps: s.reps ?? 0, rir: s.rir ?? null })),
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
  // The medal cabinet scoped to this workout — empty filter → no medal section.
  const medals = allMedals.filter((m) => m.workoutSessionId === detail.id)

  return (
    <WorkoutSummary
      title={detail.title}
      eyebrow={`Lezárva · ${huMonthDayDow(detail.date)}`}
      mode="closed"
      exercises={exercises}
      challenges={challengeRows}
      medals={medals}
      durationMin={detail.durationEst ?? null}
      onExit={goBack}
    />
  )
}
