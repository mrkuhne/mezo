// ============================================================
// Mezo · useDayOrbFill — a fejléc DayOrb-jának EGYETLEN olvasási pontja (mezo-idz2).
// A hét napi jelet a shellben MÁR FUTÓ lekérdezésekből olvassa (a MezoThreadProvider
// useNeeds-e minden chrome-os route-on mountol), plusz két új olvasás: súly + napló.
// A `useDayFace` / MezoThreadProvider precedens: a fejléc és a Nap hub nem drift-elhet
// szét két külön olvasáson — ha bárhol máshol is kell a töltöttség, EZT hívd.
// A tónus külön forrásból jön (useMeWeek napi pont), hogy a „milyen jó a nap"-nak
// egyetlen definíciója legyen: ugyanaz, amit a nap-oldal mutat.
// Spec: docs/superpowers/specs/2026-09-03-napi-orb-fejlec-design.md
// ============================================================
import { useMemo } from 'react'
import {
  useCheckins, useFuelDay, useJournalNotes, useMeWeek, useRunning, useSleep, useTrain, useWeight,
} from '@/data/hooks'
import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { dayOrbFill, type DayOrbPlan, type DayOrbSignals } from '@/features/today/logic/dayOrbFill'

export interface DayOrbState {
  pct: number
  intensity: number
  present: number
  denominator: number
  /** Kész `aria-label` — az állapotot szavakban is közli, nem csak színben. */
  label: string
}

export function useDayOrbFill(): DayOrbState {
  const now = useMinuteTick()
  const todayIso = localDateString(now)
  const yesterdayIso = addDays(todayIso, -1)

  const { fuel } = useFuelDay(todayIso)
  const { sleepLog } = useSleep()
  const { weightLog } = useWeight()
  const { checkins } = useCheckins()
  const { data: journalToday } = useJournalNotes(todayIso, todayIso)
  const train = useTrain()
  const { runSessions } = useRunning()
  const { week } = useMeWeek(mondayOf(todayIso))

  const gymDoneDates = train.gymDoneDates
  const completedTodayWorkout = train.completedTodayWorkout
  const sportSessions = train.sport.sessions
  const gymWeeklyTimes = train.gymSchedule?.weeklyTimes
  const sportScheduleSessions = train.sport.schedule?.volleyball.sessions

  return useMemo(() => {
    // A `lastNight` mező a teljes napló utolsó eleme, NEM tegnap éjszakáé — ezért a
    // needsInputs.ts:93 idiómát másoljuk: ma VAGY tegnap dátumú sor számít. (A
    // SleepEntry.date hol a lefekvés, hol az ébredés napját nevezi meg.)
    const sleep = sleepLog.some((e) => e.date === todayIso || e.date === yesterdayIso)

    const weight = weightLog.some((w) => w.date === todayIso)
    const fuelLogged = fuel.meals.length > 0
    const checkin = checkins.some((c) => c.state === 'done')
    const journal = journalToday.some((n) => n.occurredOn === todayIso)

    const gym = gymDoneDates.includes(todayIso) || completedTodayWorkout?.date === todayIso

    // A sport-sessionök `date` mezője HU display string; az ISO nap az `isoDate`-ben van.
    // A futás ugyanebbe a jelbe olvad (a felhasználó egy tételként gondol rá).
    const sport = sportSessions.some((s) => s.isoDate === todayIso)
      || runSessions.some((r) => r.date === todayIso)

    const signals: DayOrbSignals = { sleep, weight, fuel: fuelLogged, gym, sport, checkin, journal }

    // A nevezőhöz a `deriveBlocks` gym-ága NEM jó: az `d.time`-ot is megköveteli, tehát egy
    // time-slot nélküli meso-nap pihenőnapnak látszana. Itt csak az számít, hogy a nap
    // TERVE szerint jár-e edzés — az időpont nem.
    const plan: DayOrbPlan = {
      gymPlanned: Boolean(gymWeeklyTimes?.some((d) => d.today && d.active)),
      sportPlanned: Boolean(sportScheduleSessions?.some((s) => s.today)),
    }

    const score = week?.days.find((d) => d.date === todayIso)?.score ?? null
    const fill = dayOrbFill(signals, plan, score)

    return {
      ...fill,
      label: fill.present === 0
        ? 'A mai napod · még nincs adat'
        : `A mai napod · ${fill.present} a ${fill.denominator} jelből megvan`,
    }
  }, [
    todayIso, yesterdayIso, sleepLog, weightLog, fuel.meals, checkins, journalToday,
    gymDoneDates, completedTodayWorkout, sportSessions, runSessions,
    gymWeeklyTimes, sportScheduleSessions, week,
  ])
}
