// ============================================================
// Mezo · MesoWeekDays — „A heted": the running plan's week, as the list the owner
// approved for U5 (mezo-me75u.5). Rendered by BOTH surfaces that show this week —
// the Terv landing (MesoTervPage) and the run's own page (MesocycleBuilderPage) —
// because two copies of the same week drift, and the owner's whole complaint about
// the old list was that it had no system.
//
// The week is shown WHOLE, off days included: a week is also its rest and sport
// days, and hiding them misreads the split (the MesoTemplateStoryPage rule). A
// training day is a `MesoDayCard`; an off day is a slim row speaking the same
// vocabulary one rank quieter.
//
// The done-state lookup lives here, once: `doneByDay` over the week's completed
// instances (weekMuscleLogHooks — the same cached reads the Terhelés tab makes).
// Today is never marked done even when a session is already logged; the day is
// still open and „Ma" is the list's loudest state.
// ============================================================
import type { CSSProperties } from 'react'
import { useWeekMuscleLog } from '@/data/train/weekMuscleLogHooks'
import type { Mesocycle, MesoDay } from '@/data/types'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { Icon3D } from '@/shared/ui/clay'
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

export function MesoWeekDays({ meso, onOpenDay, firstDelayMs = 110 }: {
  meso: Mesocycle
  onOpenDay: (dayToken: string) => void
  /** Entrance stagger start, so each page keeps its own choreography. */
  firstDelayMs?: number
}) {
  const { details } = useWeekMuscleLog()
  const doneDays = doneByDay(details)
  const today = todayDayToken()
  // Kímélő mód S2 (mezo-q4xt2.2, prototype `dayCard` kmday): a protected training or sport day
  // that is not already done reads as a muted row — „Kímélő mód · {session} kimarad" with the
  // period's category icon. Rest days stay rest days; a done day keeps its card.
  const { recovery } = useRecovery()
  const protectedDates = new Set(recovery.protectedDates)

  return (
    <div className="pl-days">
      {DAY_ORDER.map((token, i) => {
        const day = meso.days?.find((d) => d.day === token)
        const training = trainingDay(day)
        const isToday = token === today
        const name = DAY_LABELS[token] ?? token
        const delayMs = firstDelayMs + i * 20
        const sport = day?.muscle === 'sport'
        const done = isToday ? null : (doneDays.get(token) ?? null)

        if ((training || sport) && !done && protectedDates.has(weekDateIso(i))) {
          const line = kimeloAgendaParts(training ? training.type : (day?.type ?? 'sport'))
          return (
            <div key={token} className="tv-dayrest is-km rise" style={{ '--d': `${delayMs}ms` } as CSSProperties}>
              <span className="tv-day-tag">{name}</span>
              <em><b>{line.bold}</b>{line.rest}</em>
              {isToday && (
                <span className="tv-day-stamp is-today">
                  <Icon3D name="t-play" size={17} />
                  Ma
                </span>
              )}
              <Icon3D name={recoveryIcon(recovery.period?.category)} size={24} />
            </div>
          )
        }

        if (!training) {
          return (
            <div key={token} className="tv-dayrest rise" style={{ '--d': `${delayMs}ms` } as CSSProperties}>
              <span className="tv-day-tag">{name}</span>
              <em>{sport ? (day?.type ?? 'sportnap') : 'pihenőnap'}</em>
              {isToday && (
                <span className="tv-day-stamp is-today">
                  <Icon3D name="t-play" size={17} />
                  Ma
                </span>
              )}
              <Icon3D name={sport ? 't-volley' : 't-moon'} size={24} />
            </div>
          )
        }

        return (
          <MesoDayCard
            key={token}
            day={training}
            name={name}
            isToday={isToday}
            done={done}
            delayMs={delayMs}
            onOpen={() => onOpenDay(token)}
          />
        )
      })}
    </div>
  )
}
