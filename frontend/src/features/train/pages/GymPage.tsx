// ============================================================
// Mezo · GymPage (Gym) — mesocycle week-by-week gym breakdown.
// Viewable per day; today's day is startable. Thin TrainSection shell
// ⇒ this view owns its own .pghead-np (over `Edzés · Gym`, h1 = current
// title — meso short title, or the static "Gym" ghost-state title).
// Napiv coral vocabulary: --wash-gym/--tag-gym accents.
// Ported from prototype train-views.jsx (GymPage + sub-components).
// ============================================================
import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useWeekWorkouts } from '@/data/hooks'
import { isMockMode } from '@/data/_client/mode'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import type { MesoDay } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { muscleRegionGroups, muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'
import { GymStat } from '@/features/train/components/GymStat'
import { PhaseDots } from '@/features/train/components/PhaseDots'
import { GymDayCard } from '@/features/train/components/GymDayCard'
import { GymDaySheet } from '@/features/train/sheets/GymDaySheet'
import { GymScheduleSheet } from '@/features/train/sheets/GymScheduleSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { MuscleWeekSheet } from '@/features/train/sheets/MuscleWeekSheet'
import GymSkeleton from '@/features/train/pages/GymSkeleton'

export function GymPage() {
  const { activeMeso, gymSlots, saveGymSchedule, workoutPending, todaySession, sport } = useTrain()
  // Cross-day start (mezo-p7rp): map each template day to its completed instance of the
  // current Mon–Sun week (any date) — drives the sheet's review state (D5). listWorkouts
  // returns completed instances only; empty in mock.
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const [openDay, setOpenDay] = useState<MesoDay | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [muscleOpen, setMuscleOpen] = useState(false)

  // Loading skeleton (real mode): while the meso/today queries (workoutPending) are
  // unresolved, render the layout-matched skeleton before the empty-state. Placed
  // after the hook calls so the hook order is render-stable.
  if (workoutPending) return <GymSkeleton />

  // T0 clean slate: no active meso in real mode -> ghost (meso writes land in T1).
  // Placed after the hook calls so the hook order is render-stable.
  if (!activeMeso) {
    return (
      <>
        <div className="pghead-np">
          <div>
            <div className="over">Edzés · Gym</div>
            <h1>Gym</h1>
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
  // Region-grouped per-muscle weekly breakdown for the meta-card grid (mezo-ly27).
  const muscleGroups = muscleRegionGroups(muscleWeekFromMeso(days))

  // Current phase for the active week (Week 3 ⇒ phaseCurve[2] ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const [splitHead, splitTail] = activeMeso.split.split(' · ')

  return (
    <>
      {/* Header */}
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Gym</div>
          <h1>{activeMeso.shortTitle}</h1>
        </div>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="pgact-np np-press"
            style={{ background: 'var(--wash-gym)', color: 'var(--tag-gym)' }}
          >
            <Icon name="plus" size={12} /> Saját
          </button>
          {/* saveGymSchedule is a no-op in mock mode (trainHooks) — hide the
              editor entry there, mirroring SportPage's mock-mode gating. */}
          {!isMockMode() && (
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="pgact-np np-press"
              style={{ background: 'var(--wash-gym)', color: 'var(--tag-gym)' }}
            >
              <Icon name="today" size={12} /> Időpontok
            </button>
          )}
          <span className="label-mono" style={{ fontSize: 9 }}>
            W{activeMeso.currentWeek} / {activeMeso.weeks}
          </span>
        </div>
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
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            <GymStat label="Fázis" val={currentPhase} sub={`hét ${activeMeso.currentWeek}`} color="var(--tag-gym)" />
            <GymStat label="Split" val={splitHead} sub={splitTail ?? ''} color="var(--text-primary)" />
            <GymStat label="Szetek" val={totalSets} sub="heti összesen" color="var(--cat-physiology)" />
            <GymStat label="Gym napok" val={gymDays.length} sub="hét" color="var(--cat-preference)" />
          </div>
          {/* Region-grouped muscle grid (mezo-ly27) — every trained muscle, working sets. */}
          {muscleGroups.length > 0 && (
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)',
              display: 'grid', gridTemplateColumns: '44px 1fr', rowGap: 8, columnGap: 8, alignItems: 'baseline',
            }}>
              {muscleGroups.map((g) => (
                <Fragment key={g.region}>
                  <span className="label-mono" style={{ fontSize: 8.5, fontWeight: 800, color: muscleColor(g.rows[0].muscle).deep }}>
                    {g.label}
                  </span>
                  <span className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {g.rows.map((r) => {
                      const fam = muscleColor(r.muscle)
                      return (
                        <span key={r.muscle} style={{
                          fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                          background: fam.wash, color: fam.deep, whiteSpace: 'nowrap',
                        }}>
                          {MUSCLE_LABELS[r.muscle] ?? r.muscle} {r.workingSets}
                        </span>
                      )
                    })}
                  </span>
                </Fragment>
              ))}
            </div>
          )}
          <div
            className="row gap-md mt-md"
            style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}
          >
            <Icon name="train" size={11} color="var(--tag-gym)" />
            <span className="label-mono text-tertiary" style={{ fontSize: 10, flex: 1 }}>
              {activeMeso.startDate} → {activeMeso.endDate} · {activeMeso.style}
            </span>
            <PhaseDots phases={activeMeso.phaseCurve} current={activeMeso.currentWeek - 1} />
          </div>
        </button>
        <div className="label-mono text-tertiary" style={{ fontSize: 9, textAlign: 'center', marginTop: 8 }}>
          tap → heti izomterhelés
        </div>
      </div>

      {/* Day-by-day */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Heti split</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>tap → részletek</span>
        </div>
        <div className="col gap-sm">
          {days.map((d) => (
            <GymDayCard key={d.day} day={d} onOpen={() => setOpenDay(d)} />
          ))}
        </div>
      </div>

      {openDay && (
        <GymDaySheet
          day={openDay}
          completedThisWeek={(() => {
            const done = weekWorkouts.find((w) => w.templateSessionId && w.templateSessionId === openDay.id)
            return done ? { id: done.id, date: done.date } : null
          })()}
          openTemplateSessionId={todaySession?.openWorkout?.templateSessionId ?? null}
          openWorkoutTitle={
            days.find((d) => d.id && d.id === todaySession?.openWorkout?.templateSessionId)?.type ?? null
          }
          onClose={() => setOpenDay(null)}
        />
      )}
      {scheduleOpen && (
        <GymScheduleSheet
          slots={gymSlots}
          onSave={saveGymSchedule}
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
