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
import { useTrain, useWeekWorkouts } from '@/data/hooks'
import { isMockMode } from '@/data/_client/mode'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import type { MesoDay } from '@/data/types'
import { GymStat } from '@/features/train/components/GymStat'
import { PhaseDots } from '@/features/train/components/PhaseDots'
import { GymDayCard } from '@/features/train/components/GymDayCard'
import { GymDaySheet } from '@/features/train/sheets/GymDaySheet'
import { GymScheduleSheet } from '@/features/train/sheets/GymScheduleSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import GymSkeleton from '@/features/train/pages/GymSkeleton'

export function GymPage() {
  const { activeMeso, gymSlots, saveGymSchedule, workoutPending, todaySession } = useTrain()
  // Cross-day start (mezo-p7rp): map each template day to its completed instance of the
  // current Mon–Sun week (any date) — drives the sheet's review state (D5). listWorkouts
  // returns completed instances only; empty in mock.
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const [openDay, setOpenDay] = useState<MesoDay | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

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

      {/* Meso meta */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            <GymStat label="Fázis" val={currentPhase} sub={`hét ${activeMeso.currentWeek}`} color="var(--tag-gym)" />
            <GymStat label="Split" val={splitHead} sub={splitTail ?? ''} color="var(--text-primary)" />
            <GymStat label="Szetek" val={totalSets} sub="heti összesen" color="var(--cat-physiology)" />
            <GymStat label="Gym napok" val={gymDays.length} sub="hét" color="var(--cat-preference)" />
          </div>
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
    </>
  )
}
