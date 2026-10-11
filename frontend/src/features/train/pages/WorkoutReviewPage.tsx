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
// Folyadék (mezo-n4wf5.4, prototype vilagos/edzes.js `review`): the look lives in WorkoutSummary /
// ExerciseReview; this page owns the loading and not-found faces and the stepping pair.
// ============================================================
import { useState, type ReactNode } from 'react'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges, useMedals, useTemplateDayChain, useWorkoutDetail, useWorkoutNote } from '@/data/hooks'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import { Btn, Card, EmptyTank, FrameBack, Page, Skel, useFrameTitle } from '@/shared/ui/folyadek'
import { actualMinutes } from '@/features/train/logic/actualDuration'
import { deriveSummaryStats } from '@/features/train/logic/summaryStats'
import type { SummarySetChip } from '@/features/train/logic/summaryStats'
import { deriveComparison } from '@/features/train/logic/workoutComparison'
import { questRows } from '@/features/train/logic/workoutReviewDerive'
import { WorkoutSummary, type SummaryExercise } from '@/features/train/components/WorkoutSummary'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

/** The API rows a report needs, in the shape summaryStats consumes. */
function toSummaryExercises(detail: WorkoutDetailResponse): SummaryExercise[] {
  return detail.exercises.map((e) => ({
    id: e.exerciseId,
    name: e.name,
    muscle: e.muscle,
    // The PLAN is the working sets only (mezo-i8ahy): warm-up slots are prescribed but
    // never shown and never logged any more, so counting them here would mark every
    // finished workout "partial" with the warm-up ramp as its missing sets. The logged
    // rows below are left exactly as recorded — a workout from before that ruling really
    // did have its warm-ups logged, and its report should keep saying so.
    plannedSets: e.workingSets,
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

/** The title bar of the two faces that have no workout yet (loading, not found). */
function ReviewFrame({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  useFrameTitle({ title: 'Összegzés', eyebrow: 'Edzés' })
  return (
    <Page className="eo-page">
      <FrameBack className="fo-backpill" onBack={onBack}>Vissza</FrameBack>
      {children}
    </Page>
  )
}

export function WorkoutReviewPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNav('/train')
  const { detail, pending, error } = useWorkoutDetail(workoutId ?? null)
  const { challenges } = useChallenges(detail?.templateSessionId ?? null, detail?.date ?? '')
  const { data: allMedals } = useMedals()

  // The chain this instance sits on. A custom workout has no templateSessionId and therefore
  // no chain — the comparison and the stepping simply do not render for it.
  const { prev, next } = useTemplateDayChain(detail?.templateSessionId, detail?.date ?? null)
  const { detail: prevDetail } = useWorkoutDetail(prev?.id ?? null)
  // Closing-note editing state (mezo-d20.8.2.2) — above the early returns, as hooks must be.
  const { saveNote } = useWorkoutNote()
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  if (pending) return <ReviewFrame onBack={goBack}><Skel blocks={[330, 220, 200]} label="Összegzés betöltése…" /></ReviewFrame>
  if (error || !detail) {
    return (
      <ReviewFrame onBack={goBack}>
        <Card>
          <EmptyTank icon="t-journal" actions={<Btn sm onClick={() => navigate('/train')}>Vissza az edzésekhez</Btn>}>
            Ez az edzés nem található.
          </EmptyTank>
        </Card>
      </ReviewFrame>
    )
  }

  const exercises = toSummaryExercises(detail)
  // Server-resolved outcomes; a quest never taken reads „nem vállaltad", an accepted one the
  // server never judged „nem értékelhető" (logic/workoutReviewDerive).
  const quests = questRows(challenges).rows
  // The medal cabinet scoped to this workout — empty filter → no medal section.
  const medals = allMedals.filter((m) => m.workoutSessionId === detail.id)

  // The comparison exists only when the reference's detail has actually arrived. A half-loaded
  // reference would render deltas against zero — the loudest possible lie.
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

  // The ends of the chain are disabled, never hidden.
  const stepping = prev || next ? (
    <div className="eo-stepnav">
      <button type="button" disabled={!prev} onClick={() => prev && navigate(`/train/review/${prev.id}`)}>
        <small>‹&nbsp;Előző {detail.title}</small>
        <b>{prev ? huMonthDay(prev.date) : 'nincs korábbi'}</b>
      </button>
      <button type="button" disabled={!next} onClick={() => next && navigate(`/train/review/${next.id}`)}>
        <small>Következő {detail.title}&nbsp;›</small>
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
      challenges={quests}
      medals={medals}
      durationMin={detail.durationEst ?? null}
      actualMin={actualMinutes(detail)}
      comparison={comparison}
      reference={comparison ? refStats : null}
      prevTopByName={prevTopByName}
      footer={stepping}
      // The closing note (mezo-d20.8.2.2). This page is the ONLY one that offers editing:
      // revisiting is its whole job, so filling a gap here is a deliberate intent — which is
      // also why an absent note still offers „+ Jegyzet" rather than rendering nothing.
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
