import { isMockMode } from '@/data/_client/mode'
import type { ClayIconName } from '@/shared/ui/clay'
import { useActivities } from '@/data/activity/activityHooks'
import { useFuelDay } from '@/data/fuel/fuelHooks'
import { useIntentionDay } from '@/data/intention/intentionHooks'
import { useSleep } from '@/data/me/sleepHooks'
import { useWeight } from '@/data/me/weightHooks'
import { useCheckins } from '@/data/today/checkinHooks'
import { useCompanionFeed } from '@/data/today/feedHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useRunning } from '@/data/train/runningHooks'
import { useDayWorkouts } from '@/data/train/workoutDetailHooks'
import { todayIdx } from '@/data/train/runningAgenda'
import { isSportSlotSkipped } from '@/features/train/logic/weekAgenda'
import { SPORT_TITLES, sportOf, type SportKind } from '@/features/train/logic/sportKinds'

// The story's own sport names: volleyball keeps the ritual's long-standing „Röplabda”.
const sportLabel = (k: SportKind) => (k === 'volleyball' ? 'Röplabda' : SPORT_TITLES[k])

// `icon` is a clay symbol name, not an emoji (mezo-d20.8.1.1). The choice of glyph was always
// a presentation decision this hook happened to carry; naming a ClayIconName makes that explicit
// and lets the compiler catch a symbol that doesn't exist in the sprite.
export interface RecapEvent { icon: ClayIconName; label: string; meta: string; done: boolean }

export interface DayRecap {
  events: RecapEvent[]
  checkinsDone: number
  thinDay: boolean
  closingNote: string | null
}

const JOURNAL_TRUNCATE = 40

/**
 * The Napzárás act-2 "day story" composition (R3, mezo-ilsj) — a PURE derivation over
 * domain reads. One date-scoped fetch joined in mezo-z9kft (the day's performed workouts);
 * every other read is already warm from Today/Train. Mirrors the `useToday` composition
 * precedent (data/today/todayHooks.ts) — composing other domains' hooks is sanctioned in
 * the data layer.
 *
 * `date` only reaches the date-SCOPED reads (activities/intention/fuel/day workouts, and the
 * date filter over the logged sport/run lists). The other hooks
 * (checkins/train/sleep/weight/companion-feed) are date-less by design — they always read
 * "today" internally — which is fine here because the ritual only ever runs for today.
 */
export function useDayRecap(date: string): DayRecap {
  const mock = isMockMode()
  const { checkins } = useCheckins()
  const { data: activities } = useActivities(date)
  const { data: intentionDay } = useIntentionDay(date)
  const { fuel } = useFuelDay(date)
  const train = useTrain()
  const { workouts: dayWorkouts } = useDayWorkouts(date)
  const { runSessions } = useRunning()
  const { lastNight } = useSleep()
  const { weightLog } = useWeight()
  // The evening companion-feed message replaces the retired heartbeat's "closing" note (companion-
  // feed, mezo-gst9) — same honest-absence contract: mock mode's feed is always [], real mode is
  // absent until the evening cron (or its miss-recovery) has produced today's row.
  const eveningMessage = useCompanionFeed().find((m) => m.kind === 'evening')

  const events: RecapEvent[] = []

  // Training — what was DONE on the day, not which plan day it is (mezo-z9kft). The old
  // single row was today's weekday PLAN with a week-scoped done flag, so yesterday's plan
  // finished today vanished (or read not-done), and logged sport/runs never appeared at all
  // (the volleyball row was a schedule-only rest-day fallback).
  //   1. Gym: every workout performed on `date` (meso or custom), plus the /today
  //      completion when it is dated `date` (the useDayOrbFill idiom) — done rows.
  //   2. Nothing performed yet: the resolved plan (today's, or the open instance's) is a
  //      not-done row — unless that plan was already completed on another day this week.
  //      Mock mode has NO completion signal, so its static plan always lands here.
  //   3. Every sport session and run logged on `date` — done rows.
  //   4. A scheduled sport slot today with no logged session of that kind — a not-done row
  //      (schedule flag, not attendance; a skip_sport_slot advice hides it, mezo-cq06).
  const performed = dayWorkouts.filter((w) => w.status === 'completed')
  for (const w of performed) {
    events.push({ icon: 'i-edzes', label: w.title, meta: '✓', done: true })
  }
  const completed = mock ? null : train.completedTodayWorkout
  if (completed?.date === date && train.workout && !performed.some((w) => w.id === completed.id)) {
    events.push({ icon: 'i-edzes', label: train.workout.title, meta: '✓', done: true })
  } else if (performed.length === 0 && train.workout && !completed) {
    events.push({ icon: 'i-edzes', label: train.workout.title, meta: '✓', done: false })
  }

  const loggedSport = train.sport.sessions.filter((s) => s.isoDate === date)
  for (const s of loggedSport) {
    const k = sportOf(s as { sport?: SportKind })
    events.push({ icon: 'i-sport', label: sportLabel(k), meta: `${s.duration} perc`, done: true })
  }
  const plannedSport = train.sport.schedule?.volleyball.sessions.find(
    (s) => s.today
      && !isSportSlotSkipped(train.sportSlotSkips, todayIdx(), s.time, date)
      && !loggedSport.some((l) => sportOf(l as { sport?: SportKind }) === sportOf(s)),
  )
  if (plannedSport) {
    events.push({ icon: 'i-sport', label: sportLabel(sportOf(plannedSport)), meta: plannedSport.time, done: false })
  }

  for (const r of runSessions.filter((run) => run.date === date)) {
    events.push({ icon: 'i-futas', label: 'Futás', meta: r.durationMin ? `${r.durationMin} perc` : '✓', done: true })
  }

  // Fuel — meals aggregate to a single event. Supplements are intentionally SKIPPED: discovery
  // showed `useFuelDay().fuel.supplements` is the static demo list from data/fuel/fuel.ts in BOTH
  // modes (fuelHooks.ts never swaps it for a real read) — deriving an event from it would show
  // fabricated data in real mode, so the honest-absence rule wins over the design spec's
  // aspirational "supplements n/m" beat.
  const mealsLogged = fuel.meals.length
  events.push({
    icon: 'i-fuel',
    label: `${mealsLogged} étkezés`,
    meta: `${fuel.consumed.p} g fehérje`,
    done: mealsLogged > 0,
  })

  // Biometrics — weight only counts when TODAY actually has a logged entry (no falling back to
  // a stale historical row); sleep uses "last night" unconditionally since useSleep is already a
  // date-less, always-latest read.
  const todayWeight = weightLog.filter((w) => w.date === date).at(-1)
  if (todayWeight) {
    events.push({ icon: 'i-suly', label: 'Súlymérés', meta: `${todayWeight.value} kg`, done: true })
  }
  if (lastNight) {
    events.push({ icon: 'i-alvas', label: 'Alvás', meta: `${lastNight.duration} óra`, done: true })
  }

  // Journal — each logged activity entry is its own event; it already happened, so always done.
  for (const entry of activities) {
    const label = entry.text.length > JOURNAL_TRUNCATE
      ? `${entry.text.slice(0, JOURNAL_TRUNCATE)}…`
      : entry.text
    events.push({
      icon: 'i-naplo',
      label,
      meta: entry.xpAwarded > 0 ? `+${entry.xpAwarded} XP` : '',
      done: true,
    })
  }

  // Intention foci — `done` tracks the day's single holistic reflection field, not per-focus
  // state (there is no per-focus completion signal).
  const reflectionSet = intentionDay.reflection != null
  for (const focus of intentionDay.foci) {
    events.push({ icon: 'i-cel', label: focus.text, meta: reflectionSet ? '✓' : '', done: reflectionSet })
  }

  const checkinsDone = checkins.filter((c) => c.state === 'done').length
  const thinDay = events.filter((e) => e.done).length < 2 && checkinsDone < 2
  const closingNote = eveningMessage ? eveningMessage.body.map((p) => p.text).join(' ') : null

  return { events, checkinsDone, thinDay, closingNote }
}
