// ============================================================
// Mezo · GymPage (Gym) — mesocycle week-by-week gym breakdown.
// Viewable per day; today's day is startable. Thin TrainSection shell
// ⇒ this view owns its own .pghead-np (over `Edzés · Gym`, h1 = current
// title — meso short title, or the static "Gym" ghost-state title).
// Napiv coral vocabulary: --wash-gym/--tag-gym accents.
// Ported from prototype train-views.jsx (GymPage + sub-components).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useWeekMuscleLog, useWeekWorkouts } from '@/data/hooks'
import type { GymScheduleSlot } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import { selectGymRows, weekZoneRows } from '@/features/train/logic/weekZone'
import { GymStat } from '@/features/train/components/GymStat'
import { PhaseDots } from '@/features/train/components/PhaseDots'
import { GymDayCard } from '@/features/train/components/GymDayCard'
import { ZoneMiniGrid } from '@/features/train/components/ZoneMiniGrid'
import { GymScheduleSheet } from '@/features/train/sheets/GymScheduleSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { MuscleWeekSheet } from '@/features/train/sheets/MuscleWeekSheet'
import GymSkeleton from '@/features/train/pages/GymSkeleton'

export function GymPage() {
  const { activeMeso, gymSlots, saveGymSchedule, workoutPending, sport } = useTrain()
  // Direct-start flow (mezo-bxpg): map each template day to its completed instance of the
  // current Mon–Sun week (any date) — a day-card tap for an already-done day routes straight
  // to its review instead of restarting. listWorkouts returns completed instances only; empty in mock.
  const { workouts: weekWorkouts } = useWeekWorkouts()
  // Live zone rows (mezo-oyhy.7): this week's completed instance details, feeding the
  // meta-card's ZoneMiniGrid + live Szetek/Gym napok stats. Called unconditionally at the
  // top, before the workoutPending/!activeMeso early returns, for hook-order stability.
  const weekLog = useWeekMuscleLog()
  const navigate = useNavigate()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [muscleOpen, setMuscleOpen] = useState(false)
  // Optimistic local copy of a schedule save; null = render the hook's (query-backed) slots.
  // Real mode also invalidates + refetches; the override keeps mock edits visible in-session.
  const [gymOverride, setGymOverride] = useState<GymScheduleSlot[] | null>(null)

  // Loading skeleton (real mode): while the meso/today queries (workoutPending) are
  // unresolved, render the layout-matched skeleton before the empty-state. Placed
  // after the hook calls so the hook order is render-stable.
  if (workoutPending) return <GymSkeleton />

  // T0 clean slate: no active meso in real mode -> ghost (meso writes land in T1).
  // Placed after the hook calls so the hook order is render-stable.
  if (!activeMeso) {
    return (
      <>
        <div className="page-header">
          <div>
            <Eyebrow brand>Edzés · Gym</Eyebrow>
            <PageTitle style={{ marginTop: 4 }}>Gym</PageTitle>
          </div>
        </div>
        <div style={{ padding: '0 24px 12px' }}>
          <GhostState
            lines={4}
            message="Nincs aktív mesociklus — a volumen- és fázisadatok itt jelennek majd meg."
            ctaLabel="+ Tervezz mesociklust"
            onCta={() => navigate('/train/mesocycles/new')}
          />
        </div>
      </>
    )
  }

  const days = activeMeso.days ?? []
  const gymDays = days.filter((d) => d.exerciseCount > 0)
  const totalSets = gymDays.reduce((acc, d) => acc + d.exercises.reduce((b, e) => b + e.workingSets, 0), 0)
  // Live zone rows (mezo-oyhy.7): done sets from the week's completed instances
  // + the weekly plan on the optimal-zone scale, one mini bar per muscle group.
  const zoneRows = selectGymRows(weekZoneRows({ plannedDays: days, completed: weekLog.details }))
  const doneWorkingSets = weekLog.details.reduce(
    (acc, w) => acc + w.exercises.reduce(
      (b, e) => b + e.sets.filter((s) => !s.skipped && (s.kind ?? 'working') === 'working').length, 0), 0)
  const doneGymDays = weekLog.completedSummaries.filter((s) => s.origin === 'meso').length

  // Current phase for the active week (Week 3 ⇒ phaseCurve[2] ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const [splitHead, splitTail] = activeMeso.split.split(' · ')

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Edzés · Gym</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>{activeMeso.shortTitle}</PageTitle>
        </div>
      </div>

      {/* Three labelled actions do not fit beside a 36px h1 at DS type sizes — at
          `.page-header` widths they wrapped into a column and collided with the
          title. They get their own scrollable row under the head instead; the
          header's top-right slot stays empty rather than half-full. */}
      <div className="pgactrow">
        <button type="button" onClick={() => setCustomOpen(true)} className="pgact">
          <Icon name="plus" size={14} /> Saját
        </button>
        {/* Always available (mezo-4t43): the planner sets times at plan time, this chip
            is the mid-cycle editor. Mock save no-ops → the local override keeps it visible. */}
        <button type="button" onClick={() => setScheduleOpen(true)} className="pgact">
          <Icon name="today" size={14} /> Időpontok
        </button>
        <button
          type="button"
          onClick={() => navigate(`/train/mesocycles/${activeMeso.id}/overview`)}
          className="pgact"
          aria-label={`Mezociklus áttekintő · W${activeMeso.currentWeek}/${activeMeso.weeks}`}
        >
          📈 W{activeMeso.currentWeek}/{activeMeso.weeks} →
        </button>
      </div>

      {/* Meso meta — the card is a button since mezo-ly27: tap → MuscleWeekSheet */}
      <div style={{ padding: '0 24px 12px' }}>
        <button
          type="button"
          className="card np-press"
          onClick={() => setMuscleOpen(true)}
          aria-label="Heti izomterhelés — részletek"
          style={{ padding: 16, width: '100%', textAlign: 'left', display: 'block' }}
        >
          {/* 2×2, not 1×4: at phone widths four cells give each ~85px, which wraps
              "Pull / Push / Legs" onto three lines and breaks "Gym napok" in half. */}
          <div className="statstrip statstrip-2">
            <GymStat label="Fázis" val={currentPhase} sub={`hét ${activeMeso.currentWeek}`} color="var(--tag-gym)" />
            <GymStat label="Split" val={splitHead} sub={splitTail ?? ''} color="var(--text-primary)" />
            <GymStat label="Szetek" val={`${doneWorkingSets}/${totalSets}`} sub="kész / heti terv" color="var(--cat-physiology)" />
            <GymStat label="Gym napok" val={`${doneGymDays}/${gymDays.length}`} sub="kész / hét" color="var(--cat-preference)" />
          </div>
          {zoneRows.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <ZoneMiniGrid rows={zoneRows} />
            </div>
          )}
          <div
            className="row gap-md mt-md"
            style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}
          >
            <Icon name="train" size={14} color="var(--tag-gym)" />
            <span className="label-mono text-tertiary" style={{ flex: 1 }}>
              {activeMeso.startDate} → {activeMeso.endDate} · {activeMeso.style}
            </span>
            <PhaseDots phases={activeMeso.phaseCurve} current={activeMeso.currentWeek - 1} />
          </div>
        </button>
        <div className="eyebrow text-tertiary" style={{ textAlign: 'center', marginTop: 8 }}>
          tap → heti izomterhelés
        </div>
      </div>

      {/* Day-by-day */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Heti split</span>
          <span className="label-mono text-tertiary">tap → részletek</span>
        </div>
        <div className="col gap-sm">
          {days.map((d) => (
            <GymDayCard
              key={d.day}
              day={d}
              onOpen={() => {
                // Direct-start flow (spec D6, mezo-bxpg): a day already completed this
                // Mon–Sun week (by template id, any date — pull-forward safe) routes
                // straight to its review; otherwise a day with exercises starts the
                // session (pinning the template on a non-today, real-mode day via
                // ?day=); a rest day (no exercises) is a no-op — GymDayCard already
                // gates the tap so onOpen never fires for those. Shared with
                // TrainTodayPage's weekly row via gymDayTarget (mezo-bxpg — Finding 1).
                const target = gymDayTarget(d, weekWorkouts)
                if (target) navigate(target)
              }}
            />
          ))}
        </div>
      </div>

      {scheduleOpen && (
        <GymScheduleSheet
          slots={gymOverride ?? gymSlots}
          onSave={(next) => {
            setGymOverride(next)
            saveGymSchedule(next)
          }}
          onClose={() => setScheduleOpen(false)}
        />
      )}
      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {muscleOpen && (
        <MuscleWeekSheet
          meso={activeMeso}
          sportSlots={sport.schedule?.volleyball.sessions ?? []}
          onClose={() => setMuscleOpen(false)}
        />
      )}
    </>
  )
}
