// ============================================================
// Mezo · MesoWeekDays — „A heted": the plan's week as a list (mezo-me75u.5; Folyadék F3
// mezo-n4wf5.3, prototype vilagos/edzes.js `dayCards`). Rendered by BOTH surfaces that show
// this week — the Terv landing (MesoTervPage) and the plan's own page (MesocycleBuilderPage) —
// because two copies of the same week drift.
//
// The week is shown WHOLE, off days included: a week is also its rest and sport days, and
// hiding them misreads the split. OWNER DECISION 2026-10-10: only TODAY is a full day card;
// every other training day is one row (`MesoDayCard` draws both); an off day is a quiet row
// with its glyph.
//
// The done-state lookup lives here, once: `doneByDay` over the week's completed instances
// (weekMuscleLogHooks — the same cached reads the Terhelés tab makes). Today is never marked
// done even when a session is already logged; the day is still open and „Ma" is the list's
// loudest state. A plan that has not started (`upcoming`) has no today and nothing done:
// every training day is a „Jön" row.
// ============================================================
import { useWeekMuscleLog } from '@/data/train/weekMuscleLogHooks'
import type { Mesocycle, MesoDay } from '@/data/types'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { Bub, St } from '@/shared/ui/folyadek'
import { MesoDayCard } from '@/features/train/components/MesoDayCard'
import { doneByDay } from '@/features/train/logic/mesoWeekDone'
import { isOffDay } from '@/features/train/logic/offDay'
import { todayDayToken } from '@/features/train/logic/mesoDates'
import { useRecovery } from '@/data/train/recoveryHooks'
import { weekDateIso } from '@/features/train/logic/weekAgenda'
import { kimeloAgendaParts, recoveryIcon } from '@/features/train/logic/skipCopy'

/** The day IF the plan actually trains on it — rest (`muscle: ''`), sport
 *  (`muscle: 'sport'`) and an empty exercise list are all off days. Returns the day
 *  rather than a boolean so the off-day branch can still read the ORIGINAL row (the
 *  sport row needs its `type` to name itself). */
export function trainingDay(day: MesoDay | undefined): MesoDay | null {
  return day && !isOffDay(day) && day.exercises.length > 0 ? day : null
}

export function MesoWeekDays({ meso, onOpenDay, upcoming = false }: {
  meso: Mesocycle
  onOpenDay: (dayToken: string) => void
  /** Kept for the callers' signature (the entrance stagger is the kit's now). */
  firstDelayMs?: number
  /** The plan has not started: this is not the current week, so no day is today, done or protected. */
  upcoming?: boolean
}) {
  const { details } = useWeekMuscleLog()
  const doneDays = upcoming ? new Map() as ReturnType<typeof doneByDay> : doneByDay(details)
  const today = todayDayToken()
  // Kímélő mód S2 (mezo-q4xt2.2, prototype `dayCard` kmday): a protected training or sport day
  // from today on that is not already done reads as a muted row — „Kímélő mód · {session} kimarad" with the
  // period's category icon. Rest days stay rest days; a done day keeps its card.
  const { recovery } = useRecovery()
  const protectedDates = new Set(upcoming ? [] : recovery.protectedDates)
  const todayIndex = DAY_ORDER.indexOf(today)

  return (
    <div className="ep-dcs">
      {DAY_ORDER.map((token, i) => {
        const day = meso.days?.find((d) => d.day === token)
        const training = trainingDay(day)
        const isToday = !upcoming && token === today
        const name = DAY_LABELS[token] ?? token
        const sport = day?.muscle === 'sport'
        const done = isToday ? null : (doneDays.get(token) ?? null)

        // Today onwards only (prototype `dayCard`: `i >= today`) — a past day keeps its own row.
        if ((training || sport) && !done && i >= todayIndex && protectedDates.has(weekDateIso(i))) {
          const line = kimeloAgendaParts(training ? training.type : (day?.type ?? 'sport'))
          return (
            <div key={token} className="ep-dc quiet km">
              <Bub icon={recoveryIcon(recovery.period?.category)} size={34} />
              <span className="g">
                <small>{name}{isToday ? ' · ma' : ''}</small>
                <strong>{line.bold}{line.rest}</strong>
              </span>
            </div>
          )
        }

        if (!training) {
          return (
            <div key={token} className="ep-dc quiet">
              <Bub icon={sport ? 't-volley' : 't-moon'} size={34} />
              <span className="g">
                <small>{name}</small>
                <strong>{sport ? (day?.type ?? 'sportnap') : 'pihenőnap'}</strong>
              </span>
              {/* the live list marks today on an off day too (the prototype's sample week has none) */}
              {isToday && <St tone="plan">Ma</St>}
            </div>
          )
        }

        return (
          <MesoDayCard key={token} day={training} name={name} isToday={isToday} done={done} onOpen={() => onOpenDay(token)} />
        )
      })}
    </div>
  )
}
