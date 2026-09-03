// ============================================================
// Mezo · WorkoutReviewPage — the revisit of a COMPLETED workout
// (/train/review/:workoutId — spec 2026-07-15 done-day review, option B;
// visual redesign mezo-w943; context report mezo-d20.8.2.1, spec 2026-08-31).
//
// The `closed` mode used to be a colour swap of the closing report. It is now
// the revisit's own surface: everything this page adds on top of the shared
// shell is CONTEXT — the comparison against the previous instance of the same
// template day, the reference top set per exercise, and the stepping along that
// same chain. All of it rides existing endpoints; no contract changed.
// ============================================================
import { useState } from 'react'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges, useMedals, useTemplateDayChain, useWorkoutDetail, useWorkoutNote } from '@/data/hooks'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { deriveSummaryStats } from '@/features/train/logic/summaryStats'
import type { SummarySetChip } from '@/features/train/logic/summaryStats'
import { deriveComparison } from '@/features/train/logic/workoutComparison'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

/** The API rows a report needs, in the shape summaryStats consumes. */
function toSummaryExercises(detail: WorkoutDetailResponse): SummaryExercise[] {
  return detail.exercises.map((e) => ({
    id: e.exerciseId,
    name: e.name,
    muscle: e.muscle,
    plannedSets: e.warmupSets + e.workingSets,
    // rir is honestly nullable (Finding 1): the API contract gives `rir: null` on every
    // warmup set — mapping it to 0 fabricated a fake worst-case RIR that dragged the Ø RIR
    // average toward zero and disagreed with the same workout's in-memory `complete`-phase
    // average (which only ever holds real RIRs). summaryStats.deriveSummaryStats averages
    // only non-null rirs.
    sets: e.sets.map((s) => ({
      weight: Number(s.weightKg ?? 0),
      reps: s.reps ?? 0,
      rir: s.rir ?? null,
      note: s.note,
      warmup: s.kind === 'warmup',
    })),
    skipped: e.skipped,
    repMin: e.repMin,
    repMax: e.repMax,
  }))
}

export function WorkoutReviewPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNav('/train')
  const { detail, pending, error } = useWorkoutDetail(workoutId ?? null)
  const { challenges } = useChallenges(detail?.templateSessionId ?? null, detail?.date ?? '')
  const { data: allMedals } = useMedals()

  // The chain this instance sits on. A custom workout has no templateSessionId and therefore
  // no chain — the comparison tile and the stepping simply do not render for it.
  const { prev, next } = useTemplateDayChain(detail?.templateSessionId, detail?.date ?? null)
  const { detail: prevDetail } = useWorkoutDetail(prev?.id ?? null)
  // Closing-note editing state (mezo-d20.8.2.2) — above the early returns, as hooks must be.
  const { saveNote } = useWorkoutNote()
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  if (pending) return <ScreenSkeleton />
  if (error || !detail) {
    return (
      <div style={{ padding: 24 }}>
        <GhostState lines={3} message="Ez az edzés nem található." ctaLabel="← Vissza az edzésekhez" onCta={() => navigate('/train')} />
      </div>
    )
  }

  const exercises = toSummaryExercises(detail)
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

  // The comparison exists only when the reference's detail has actually arrived. A half-loaded
  // reference would render a tile full of deltas against zero — the loudest possible lie.
  const refStats = prevDetail && prev
    ? deriveSummaryStats(toSummaryExercises(prevDetail), allMedals.filter((m) => m.workoutSessionId === prevDetail.id))
    : null
  const comparison = refStats && prev
    ? deriveComparison(deriveSummaryStats(exercises, medals), refStats, detail.date, huMonthDay(prev.date), prev.date)
    : null
  // Matched by NAME, not id: the same movement carries a fresh instance id in every workout.
  const prevTopByName: Record<string, SummarySetChip> = {}
  for (const e of refStats?.exercises ?? []) {
    if (e.topChip) prevTopByName[e.name] = e.topChip
  }

  const stepping = prev || next ? (
    <div className="wr-stepnav">
      <button type="button" disabled={!prev} onClick={() => prev && navigate(`/train/review/${prev.id}`)}>
        <small>← Előző {detail.title}</small>
        <b>{prev ? huMonthDay(prev.date) : 'nincs korábbi'}</b>
      </button>
      <button type="button" className="nx" disabled={!next} onClick={() => next && navigate(`/train/review/${next.id}`)}>
        <small>Következő {detail.title} →</small>
        <b>{next ? huMonthDay(next.date) : 'ez a legutóbbi'}</b>
      </button>
    </div>
  ) : null

  return (
    <WorkoutSummary
      title={detail.title}
      eyebrow={`Lezárva · ${huMonthDayDow(detail.date)}`}
      mode="closed"
      exercises={exercises}
      challenges={challengeRows}
      medals={medals}
      durationMin={detail.durationEst ?? null}
      comparison={comparison}
      prevTopByName={prevTopByName}
      footer={stepping}
      // The closing note (mezo-d20.8.2.2). This page is the ONLY one that offers editing:
      // revisiting is its whole job, so filling a gap here is a deliberate intent — which is
      // also why an absent note still offers `＋ Jegyzet` rather than rendering nothing.
      note={detail.note ?? null}
      draftNote={noteDraft}
      onDraftNote={setNoteDraft}
      noteEditing={noteEditing}
      onEditNote={() => { setNoteDraft(detail.note ?? ''); setNoteEditing(true) }}
      onNoteSave={() => { saveNote(detail.id, noteDraft); setNoteEditing(false) }}
      onNoteCancel={() => setNoteEditing(false)}
      onExit={goBack}
    />
  )
}
