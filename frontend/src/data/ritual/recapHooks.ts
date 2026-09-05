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
import { todayIdx } from '@/data/train/runningAgenda'
import { isSportSlotSkipped } from '@/features/train/logic/weekAgenda'

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
 * already-fetched domain reads, ZERO new fetches. Mirrors the `useToday` composition
 * precedent (data/today/todayHooks.ts) — composing other domains' hooks is sanctioned in
 * the data layer.
 *
 * `date` only reaches the date-SCOPED reads (activities/intention/fuel). The other hooks
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
  const { lastNight } = useSleep()
  const { weightLog } = useWeight()
  // The evening companion-feed message replaces the retired heartbeat's "closing" note (companion-
  // feed, mezo-gst9) — same honest-absence contract: mock mode's feed is always [], real mode is
  // absent until the evening cron (or its miss-recovery) has produced today's row.
  const eveningMessage = useCompanionFeed().find((m) => m.kind === 'evening')

  const events: RecapEvent[] = []

  // Training — real done-state comes from the resolved completedTodayWorkout; mock mode has
  // NO true completion signal (the Phase-1 statics never mark a workout done), so mock always
  // reports done:false rather than fabricate a finished state.
  if (train.workout) {
    events.push({
      icon: 'i-edzes',
      label: train.workout.title,
      meta: '✓',
      done: mock ? false : Boolean(train.completedTodayWorkout),
    })
  } else {
    // Rest day (no plan) — fall back to a volleyball session flagged "today" in the weekly
    // schedule (the TodayPage `volleyballSessions.find(s => s.today)` precedent). This is a
    // SCHEDULE flag, not an attendance record, so it is honestly reported as not-done.
    // A skip_sport_slot advice action (mezo-cq06) hides today's dated occurrence — the ritual
    // only ever runs for today (see docstring above), so `date` IS today's ISO date here.
    const todaySport = train.sport.schedule?.volleyball.sessions.find(
      (s) => s.today && !isSportSlotSkipped(train.sportSlotSkips, todayIdx(), s.time, date),
    )
    if (todaySport) {
      events.push({ icon: 'i-sport', label: 'Röplabda', meta: todaySport.time, done: false })
    }
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
