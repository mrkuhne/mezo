import { useSearchParams } from 'react-router-dom'
import { isMockMode } from '@/data/_client/mode'
import { useMedication } from '@/data/fuel/medicationHooks'
import { useFuelTimeline } from '@/data/fuel/timelineHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useSleep } from '@/data/me/sleepHooks'
import { useWeight } from '@/data/me/weightHooks'
import { huMonthDay, huMonthDayDow, huWeekdayFull, localDateString } from '@/shared/lib/dates'
import { todayIdx } from '@/data/train/runningAgenda'
import { isSportSlotSkipped } from '@/features/train/logic/weekAgenda'
import {
  today,
  user,
  briefing,
  briefingVariants,
  volleyballSessions,
  workoutPrediction,
  volleyballNote,
} from '@/data/today/today'
import type {
  Briefing,
  DayState,
  QuickStatItem,
  TodayMeta,
  TodayScenario,
  UserMeta,
  VolleyballSession,
  WorkoutPlan,
  WorkoutPrediction,
} from '@/data/types'

export function useTodayScenario(): TodayScenario {
  const [params] = useSearchParams()
  const day = params.get('day')
  const dayState: DayState = day === 'good' || day === 'rough' ? day : 'medium'
  // The medCycleDay base is the derived medication cycle in BOTH modes. It is 0 when there is no
  // medication / no dose (mezo-lwmq: the owner tracks no medication, so this is the normal state) —
  // the honest zero. The ?medCycleDay= URL override stays TOP priority, as a dev switch.
  const { cycle } = useMedication()
  const rawDay = parseInt(params.get('medCycleDay') ?? '', 10)
  const medCycleDay = Number.isFinite(rawDay) ? Math.min(7, Math.max(1, rawDay)) : cycle.cycleDay
  const niggle = params.get('niggle') !== 'off'
  const vulnerable = params.get('vulnerable') === 'on'
  const ritualRaw = params.get('ritual')
  const ritual: TodayScenario['ritual'] =
    ritualRaw === 'waiting' || ritualRaw === 'open' || ritualRaw === 'done' ? ritualRaw : null
  return { dayState, medCycleDay, niggle, vulnerable, anchorMode: dayState === 'rough', ritual }
}

export function resolveBriefing(dayState: DayState): Briefing {
  const variant = briefingVariants[dayState]
  return variant ? { ...briefing, ...variant } : briefing
}

type TodayData = {
  today: TodayMeta
  user: UserMeta
  /** Mock: Train's own Phase-1 static plan (`data/train/train.ts`'s `workout`, byte-identical
   * to the retired Today-local duplicate — deduped by `estimateSessionMinutes` needing the
   * recipe-shaped `LoggedWorkoutExercise[]`, `mezo-oyhy.3`). Real: today's planned Train
   * session; null (rest day / no meso) hides the teaser. */
  workout: WorkoutPlan | null
  /** The teaser eyebrow time — the real gym slot for today, or null (eyebrow renders without a time). */
  workoutTime: string | null
  /** Today's gym session is already finished (mezo-v84m). The SAME server truth the Train tab's
   * „Kész · N szett" hero reads — `/today`'s `completedWorkout` — so the two tabs can never
   * disagree about whether the day is over. Mock mode persists no instances → always false. */
  workoutDone: boolean
  /** The finished instance's logged set count (skip markers excluded, exactly as Train counts
   * them), or null while nothing is finished. `workoutDone` is the gate — a 0-set finish is
   * still a finish. */
  workoutDoneSets: number | null
  /** Today's gym session is started but NOT finished (mezo-6kap) — Train's `● Folyamatban`
   * state, from `/today`'s `openWorkout`. Mutually exclusive with `workoutDone`: a completed
   * instance always wins, so the hero can never offer a resume for a day that is over. */
  workoutInProgress: boolean
  /** The open instance's logged set count so far (skip markers excluded), or null when nothing
   * is in progress. Zero is a real answer — started, nothing logged yet. */
  workoutOpenSets: number | null
  /** The sport kinds logged TODAY (`volleyball`/`cross`/`trx`), matched by date (mezo-6kap).
   * A mixed day (TRX at noon, röpi in the evening) must flip each sport hero independently, so
   * this is a list, not a flag. Empty in mock mode — it persists no sessions. */
  loggedSportKinds: string[]
  /** Demo prediction line in mock mode; null in real mode (predictions are a later epic). */
  prediction: WorkoutPrediction | null
  volleyballSessions: VolleyballSession[]
  /** Demo "Stacked day" AI note in mock mode; null in real mode (proactive-epic prose). */
  volleyballNote: string | null
}

// The Today composition (T slice, mezo-t16y.3): mock returns the byte-identical Phase-1
// statics; real composes EXISTING real reads (Train's today session + active meso + schedules,
// the real date) — no new backend. Demo-only copy (prediction, AI note) is null in real mode,
// and the consuming components hide those surfaces (honest-surface rule).
export function useToday(): TodayData {
  const mock = isMockMode()
  const train = useTrain()
  if (mock) {
    return {
      today,
      user,
      workout: train.workout,
      workoutTime: today.workoutTime,
      // Mock keeps no persisted instances (`useTrain`'s completedTodayWorkout/todaySession are
      // null in mock) and logs no sport sessions, so the mock day hero stays byte-identical to
      // Phase 1: always the „Indítsuk" / „Logold" CTA.
      workoutDone: false,
      workoutDoneSets: null,
      workoutInProgress: false,
      workoutOpenSets: null,
      loggedSportKinds: [],
      prediction: workoutPrediction,
      volleyballSessions,
      volleyballNote,
    }
  }
  const now = new Date()
  const meso = train.activeMeso
  const gymToday = train.gymSchedule?.weeklyTimes.find((d) => d.active && d.today)
  // The day's done-state (mezo-v84m) — read from the same `completedTodayWorkout` the Train
  // tab's hero gates on, counted the same way (skip markers are not logged sets).
  const doneWorkout = train.completedTodayWorkout
  // …and its in-progress state (mezo-6kap), with Train's own precedence: a completed instance
  // wins, so a stale open instance can never turn a finished day back into a resume.
  const openWorkout = doneWorkout ? null : train.todaySession?.openWorkout ?? null
  // Sport done-state (mezo-6kap): `toSportSession` maps the API's ISO date to the HU display
  // date, so today's key is built the same way. Kind-keyed, not a flag — a mixed day flips
  // each sport hero on its own.
  const todayDisplayDate = huMonthDayDow(localDateString(now))
  const todayIso = localDateString(now)
  // A skip_sport_slot advice action (mezo-cq06) hides today's dated occurrence of a recurring
  // sport slot from the hero the same way `buildWeekAgenda` already hides it from the week
  // agenda — only entries actually flagged `today` can match (a future weekday's session has no
  // ISO date to compare here), matched on today's weekday index + the slot's own time.
  const volleyballSessionsReal = (train.sport.schedule?.volleyball.sessions ?? []).filter(
    (s) => !(s.today && isSportSlotSkipped(train.sportSlotSkips, todayIdx(now), s.time, todayIso)),
  )
  return {
    today: {
      dayLabel: huWeekdayFull(now),
      dateLabel: huMonthDay(localDateString(now)),
      workoutType: train.workout?.title ?? '',
      workoutTime: gymToday?.time ?? '',
      mesoPhase: meso?.phaseCurve?.[meso.currentWeek - 1] ?? '',
    },
    // Only the meso-derived fields go real here; the identity statics (name/handle/...) are
    // not rendered by Today — the useProfile decision belongs to Slice E.
    user: {
      ...user,
      weekInMeso: meso?.currentWeek ?? 0,
      dayInWeek: ((now.getDay() + 6) % 7) + 1,
      mesoLabel: meso?.title ?? '',
    },
    workout: train.workout,
    workoutTime: gymToday?.time ?? null,
    workoutDone: Boolean(doneWorkout),
    workoutDoneSets: doneWorkout ? doneWorkout.sets.filter((s) => !s.skipped).length : null,
    workoutInProgress: Boolean(openWorkout),
    workoutOpenSets: openWorkout ? openWorkout.sets.filter((s) => !s.skipped).length : null,
    loggedSportKinds: train.sport.sessions.filter((s) => s.date === todayDisplayDate).map((s) => s.sport),
    prediction: null,
    volleyballSessions: volleyballSessionsReal,
    volleyballNote: null,
  }
}

const MOCK_QUICK_STATS: QuickStatItem[] = [
  { label: 'Alvás', value: '7.2', unit: 'h' },
  { label: 'Súly', value: '78.6', unit: 'kg' },
  { label: 'HRV', value: '64', unit: 'ms' },
]

// The "Most" quick-stats row: real mode derives sleep (last night) and weight (latest entry)
// from the real biometrics reads; the HRV cell has NO data source → dropped in real mode
// (strip philosophy), never a fabricated number.
export function useQuickStats(): QuickStatItem[] {
  const mock = isMockMode()
  const { sleepLog } = useSleep()
  const { weightLog } = useWeight()
  if (mock) return MOCK_QUICK_STATS
  const lastSleep = sleepLog[sleepLog.length - 1]
  const lastWeight = weightLog[weightLog.length - 1]
  return [
    {
      label: 'Alvás',
      value: lastSleep?.duration != null ? lastSleep.duration.toFixed(1) : '—',
      unit: 'h',
    },
    {
      label: 'Súly',
      value: lastWeight ? lastWeight.value.toFixed(1) : '—',
      unit: 'kg',
    },
  ]
}

// Today's fuel preview — the 3-slot window from the now-slot + the next supplement stack.
// Composes the same dual-mode plan as the Fuel "Mai" timeline (mock seed vs. real buildDayPlan),
// so Today and Fuel never diverge; the {visible, nextStack} shape is unchanged (mezo-9ys).
export function useFuelPreview() {
  const { plan } = useFuelTimeline()
  const slots = plan.slots
  const nowIdx = slots.findIndex(s => s.state === 'now')
  const start = Math.max(0, nowIdx)
  const visible = slots.slice(start, start + 3)
  const nextStack = slots.find(s => s.state !== 'done' && (s.items ?? []).some(it => !it.done))
  // The full composed plan rides along for the three-islands facts (protein/energy,
  // mezo-euze) — additive, the {visible, nextStack} shape above is untouched.
  return { visible, nextStack, plan }
}
