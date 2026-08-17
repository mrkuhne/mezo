// ============================================================
// Mezo · needsInputs — the app-data → NeedsInputs adapter (mezo-dhzk, Task 2).
// Pure, no I/O: turns a snapshot of the app's existing data hooks (`RawNeedsData`) into the
// per-ring `NeedEvent[]` the needs.ts decay/refill engine consumes. Every field is read
// defensively — a missing/empty source degrades to an empty event list, never a throw, since
// the engine still needs SOME answer even before every hook has resolved (useNeeds.ts composes
// this with all-but-sleepGoal treated as "pending → empty" rather than blocking the render).
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-2-brief.md
// ============================================================
import type { ActivityEntry, CheckinSlot, FuelDay, FuelMeal, HabitItem, IntentionDay, RitualDay, SleepEntry } from '@/data/types'
import { NEEDS_TUNING, type NeedEvent, type NeedKey } from '@/features/today/logic/needs'

export interface RawNeedsData {
  /** The instant this snapshot was built — anchors "today" event synthesis (the water ring's
   *  today-span end). Not part of the brief's literal interface list, but required for a pure
   *  function to place "wake → now" events deterministically; threaded through by useNeeds.ts. */
  now: Date
  todayIso: string
  yesterdayIso: string
  wakeTime: string // 'HH:mm' from SleepGoal
  bedTime: string // 'HH:mm' from SleepGoal
  fuelToday: FuelDay
  fuelYesterday: FuelDay
  sleepLog: SleepEntry[] // full history
  goalMinutes: number
  gymDoneDates: string[] // ISO dates (this week)
  completedTodayWorkout: { date: string } | null
  sportSessions: { isoDate: string; time: string }[]
  runSessions: { date: string }[]
  activitiesToday: ActivityEntry[]
  activitiesYesterday: ActivityEntry[]
  checkinsToday: CheckinSlot[] // today only (hook is date-less)
  intentionToday: IntentionDay
  intentionYesterday: IntentionDay
  ritualYesterday: RitualDay
  habitsToday: HabitItem[]
  habitsYesterday: HabitItem[]
}

const emptyEvents = (): Record<NeedKey, NeedEvent[]> => ({
  energia: [], hidratacio: [], pihenes: [], mozgas: [], lelek: [], rend: [],
})

const atIso = (iso: string, hhmm: string): Date => new Date(`${iso}T${hhmm}:00`)
const addMinutes = (at: Date, minutes: number): Date => new Date(at.getTime() + minutes * 60_000)

// --- 🍽️ energia — meals (both days) ----------------------------------------

function mealEvents(meals: FuelMeal[]): NeedEvent[] {
  const { refill } = NEEDS_TUNING
  return meals.map((m) => ({
    at: new Date(m.loggedAt),
    kind: 'add',
    amount: m.slot.toLowerCase().includes('snack') ? refill.snack : refill.mainMeal,
    label: m.slot.split(' ')[0],
  }))
}

// --- 💧 hidratacio — synthetic water glasses, evenly spaced -----------------

/** N synthetic `add` events placed at `start + i×(span/(N+1))` for i=1..N — strictly inside
 *  the (start, end) span, never on a boundary instant. */
function spacedWaterEvents(count: number, start: Date, end: Date): NeedEvent[] {
  if (count <= 0) return []
  const { refill } = NEEDS_TUNING
  const span = end.getTime() - start.getTime()
  const events: NeedEvent[] = []
  for (let i = 1; i <= count; i++) {
    events.push({
      at: new Date(start.getTime() + (i * span) / (count + 1)),
      kind: 'add',
      amount: refill.waterGlass,
      label: '+250 ml',
    })
  }
  return events
}

function waterEvents(raw: RawNeedsData): NeedEvent[] {
  const { refill } = NEEDS_TUNING
  const todayGlasses = Math.floor(raw.fuelToday.consumed.water / refill.waterGlassMl)
  const yesterdayGlasses = Math.floor(raw.fuelYesterday.consumed.water / refill.waterGlassMl)
  return [
    ...spacedWaterEvents(todayGlasses, atIso(raw.todayIso, raw.wakeTime), raw.now),
    ...spacedWaterEvents(yesterdayGlasses, atIso(raw.yesterdayIso, raw.wakeTime), atIso(raw.yesterdayIso, raw.bedTime)),
  ]
}

// --- 😴 pihenes — last night's sleep -----------------------------------------

function sleepEvent(raw: RawNeedsData): NeedEvent[] {
  const candidates = raw.sleepLog.filter((e) => e.date === raw.todayIso || e.date === raw.yesterdayIso)
  if (candidates.length === 0) return []
  const lastNight = candidates.reduce((latest, entry) => (entry.date >= latest.date ? entry : latest))
  const targetHours = raw.goalMinutes / 60
  if (!(targetHours > 0)) return [] // malformed goal — never divide by 0/negative
  const amount = Math.min(100, Math.round((lastNight.duration / targetHours) * 100))
  const label = `${lastNight.duration.toFixed(1).replace('.', ',')} óra alvás`
  return [{ at: atIso(raw.todayIso, raw.wakeTime), kind: 'set', amount, label }]
}

// --- 💪 mozgas — gym / running / sport / activities --------------------------

function workoutEvents(raw: RawNeedsData): NeedEvent[] {
  const relevantDays = new Set([raw.todayIso, raw.yesterdayIso])

  const gymDates = new Set(raw.gymDoneDates)
  if (raw.completedTodayWorkout?.date) gymDates.add(raw.completedTodayWorkout.date)
  const gym: NeedEvent[] = [...gymDates]
    .filter((d) => relevantDays.has(d))
    .map((d) => ({ at: new Date(`${d}T12:00:00`), kind: 'set', amount: 100, label: 'Edzés' }))

  const runDates = new Set(raw.runSessions.map((r) => r.date))
  const run: NeedEvent[] = [...runDates]
    .filter((d) => relevantDays.has(d))
    .map((d) => ({ at: new Date(`${d}T12:00:00`), kind: 'set', amount: 100, label: 'Futás' }))

  const sport: NeedEvent[] = raw.sportSessions.map((s) => ({
    at: new Date(`${s.isoDate}T${s.time}:00`),
    kind: 'set',
    amount: 100,
    label: 'Sport',
  }))

  const { refill } = NEEDS_TUNING
  const activities: NeedEvent[] = [...raw.activitiesToday, ...raw.activitiesYesterday].map((a) => ({
    at: new Date(a.createdAt ?? `${a.occurredOn}T12:00:00`),
    kind: 'add',
    amount: refill.activity,
    label: 'Aktivitás',
  }))

  return [...gym, ...run, ...sport, ...activities]
}

// --- 💗 lélek — check-ins, intention, evening ritual -------------------------

function intentionEvents(intention: IntentionDay, dayIso: string, wakeTime: string): NeedEvent[] {
  const { refill } = NEEDS_TUNING
  const events: NeedEvent[] = []
  if (intention.foci.length > 0) {
    events.push({ at: addMinutes(atIso(dayIso, wakeTime), 15), kind: 'add', amount: refill.intention, label: 'Szándék' })
  }
  if (intention.reflection !== null) {
    events.push({ at: atIso(dayIso, '21:00'), kind: 'add', amount: refill.reflection, label: 'Reflexió' })
  }
  return events
}

function lelekEvents(raw: RawNeedsData): NeedEvent[] {
  const { refill } = NEEDS_TUNING
  const checkins: NeedEvent[] = raw.checkinsToday
    .filter((slot) => slot.state === 'done')
    .map((slot) => ({
      at: new Date(slot.savedAt ?? `${raw.todayIso}T${slot.time}:00`),
      kind: 'add',
      amount: refill.checkin,
      label: 'Check-in',
    }))

  const today = intentionEvents(raw.intentionToday, raw.todayIso, raw.wakeTime)
  const yesterday = intentionEvents(raw.intentionYesterday, raw.yesterdayIso, raw.wakeTime)

  const ritual: NeedEvent[] = raw.ritualYesterday.closed && raw.ritualYesterday.closedAt
    ? [{ at: new Date(raw.ritualYesterday.closedAt), kind: 'add', amount: refill.reflection, label: 'Napzárás' }]
    : []

  return [...checkins, ...today, ...yesterday, ...ritual]
}

// --- ⚡ rend — habit ticks (both days) ----------------------------------------

function habitEvents(habits: HabitItem[], dayIso: string): NeedEvent[] {
  const { refill } = NEEDS_TUNING
  return habits
    .filter((h) => h.status === 'done')
    .map((h) => ({
      at: new Date(h.doneAt ?? `${dayIso}T12:00:00`),
      kind: 'add',
      amount: refill.habitTick,
      label: h.title,
    }))
}

function rendEvents(raw: RawNeedsData): NeedEvent[] {
  return [...habitEvents(raw.habitsToday, raw.todayIso), ...habitEvents(raw.habitsYesterday, raw.yesterdayIso)]
}

// -----------------------------------------------------------------------------

export function buildNeedsEvents(raw: RawNeedsData): Record<NeedKey, NeedEvent[]> {
  const events = emptyEvents()
  events.energia = [...mealEvents(raw.fuelToday.meals), ...mealEvents(raw.fuelYesterday.meals)]
  events.hidratacio = waterEvents(raw)
  events.pihenes = sleepEvent(raw)
  events.mozgas = workoutEvents(raw)
  events.lelek = lelekEvents(raw)
  events.rend = rendEvents(raw)
  return events
}
