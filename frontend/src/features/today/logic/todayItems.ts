// ============================================================
// Mezo · todayItems — the single normalizer behind Today's faces (mezo-ly8c).
// Six sources (daily quests, habit chains, check-ins, fuel slots, train
// sessions, ritual/wind-down) collapse onto ONE `TodayItem` shape, get bucketed
// by daypart face, deduplicated and partitioned into open/done. This is what
// kills the duplication the old screen had — the morning weigh-in was a quest
// AND a habit row, the workout was a hero AND a quest AND a habit row.
// Pure: no hooks, no navigation. The action union carries the raw domain object
// so `TodayPage` can dispatch it through the existing questAction/habitAction
// mappings without this module knowing about routes or sheets.
// ============================================================
import { faceOf, type DayFace, DAY_FACES } from '@/features/today/logic/dayFace'
import type { AnchorTimes } from '@/features/today/logic/windDown'
import type { CheckinSlot, DailyQuest, FuelSlot, HabitItem, RitualDay } from '@/data/types'
import type { ItemTone } from '@/shared/ui/ItemCard'

export type ItemStatus = 'open' | 'done' | 'missed'
export type ItemSource = 'quest' | 'habit' | 'checkin' | 'fuel' | 'session' | 'ritual'

export type ItemAction =
  | { kind: 'quest'; quest: DailyQuest; label: string }
  | { kind: 'habit'; habit: HabitItem; label: string }
  | { kind: 'checkin'; slotIdx: number; label: string }
  | { kind: 'nav'; to: string; label: string }

export interface TodayItem {
  /** Stable within a day: `${source}:${naturalKey}`. */
  id: string
  source: ItemSource
  /** `'all'` = day-wide (open quests) — rendered on every face. */
  face: DayFace | 'all'
  status: ItemStatus
  tone: ItemTone
  emoji: string
  /** Uppercase eyebrow word for `ItemCard`; unused by `ItemRow`. */
  tag: string
  title: string
  subtitle: string | null
  /** HH:mm when clock-anchored. */
  time: string | null
  /** Total XP the row is worth (a deduped row sums both rewards). */
  xp: number | null
  /** Group heading inside `TodoCard`. */
  group: string
  action: ItemAction | null
}

/** A train session already shaped for `ItemCard` by the caller (TodayPage reads
 *  `useToday()`); kept structural so this module never imports Train types. */
export interface SessionItemInput {
  id: string
  tone: ItemTone
  emoji: string
  tag: string
  title: string
  time: string | null
  facts: (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
}

export interface TodayItemsInput {
  quests: DailyQuest[]
  habits: HabitItem[]
  checkins: CheckinSlot[]
  fuelSlots: FuelSlot[]
  sessions: SessionItemInput[]
  ritual: RitualDay | null
  goal: AnchorTimes
}

/** Habit key ↔ quest metric pairs describing the SAME act. The habit row wins (it
 *  carries the anchor copy and the chain position) and absorbs the quest's XP; the
 *  quest still completes through its own server-side evaluation. */
const DEDUP_PAIRS: Record<string, string> = {
  morning_weigh_in: 'weight_logged',
  morning_workout: 'gym_session_done',
  wake_on_time: 'sleep_target',
  protein_breakfast: 'protein_target',
}

const QUEST_STATUS: Record<string, ItemStatus> = { offered: 'open', completed: 'done', expired: 'missed' }
const HABIT_STATUS: Record<string, ItemStatus> = { pending: 'open', done: 'done', missed: 'missed' }
const CHECKIN_STATUS: Record<string, ItemStatus> = { done: 'done', skipped: 'missed', now: 'open', pending: 'open' }
const FUEL_STATUS: Record<string, ItemStatus> = { done: 'done', missed: 'missed', now: 'open', pending: 'open' }

const CHAIN_GROUP = { MORNING: 'Reggeli rutin', EVENING: 'Esti rutin' } as const
const CHAIN_FACE: Record<'MORNING' | 'EVENING', DayFace> = { MORNING: 'reggel', EVENING: 'este' }

export function buildTodayItems(input: TodayItemsInput): TodayItem[] {
  const { quests, habits, sessions } = input
  const items: TodayItem[] = []

  // ── sessions first: they own the face hero, and a quest describing the same
  //    workout must not repeat it as a row.
  for (const s of sessions) {
    items.push({
      id: `session:${s.id}`,
      source: 'session',
      face: s.time ? faceOf(s.time, input.goal) : 'nap',
      status: s.logged ? 'done' : 'open',
      tone: s.tone, emoji: s.emoji, tag: s.tag, title: s.title,
      subtitle: s.facts.filter(Boolean).join(' · ') || null,
      time: s.time, xp: null, group: 'Edzés', action: null,
    })
  }
  const hasSession = sessions.length > 0

  // ── habits: chain-bucketed, and the absorbing side of every dedup pair.
  const absorbedMetrics = new Set<string>()
  for (const h of habits) {
    const paired = DEDUP_PAIRS[h.key]
    const twin = paired ? quests.find((q) => q.metric === paired) : undefined
    if (twin) absorbedMetrics.add(paired)
    items.push({
      id: `habit:${h.key}`,
      source: 'habit',
      face: CHAIN_FACE[h.chain],
      status: HABIT_STATUS[h.status] ?? 'open',
      tone: h.chain === 'MORNING' ? 'body' : 'mind',
      emoji: h.chain === 'MORNING' ? '🌅' : '🌙',
      tag: CHAIN_GROUP[h.chain].toUpperCase(),
      title: h.title,
      subtitle: h.anchorCopy || null,
      time: null,
      xp: h.xp + (twin?.xp ?? 0),
      group: CHAIN_GROUP[h.chain],
      action: { kind: 'habit', habit: h, label: h.mode === 'MANUAL' ? 'Pipa' : 'Logolás' },
    })
  }

  // ── quests: day-wide, minus the ones absorbed above or already shown as a session.
  for (const q of quests) {
    if (absorbedMetrics.has(q.metric)) continue
    if (hasSession && q.metric === 'gym_session_done') continue
    items.push({
      id: `quest:${q.id}`,
      source: 'quest',
      face: 'all',
      status: QUEST_STATUS[q.status] ?? 'open',
      tone: 'mind', emoji: '⚡', tag: 'KÜLDETÉS',
      title: q.title,
      subtitle: q.targetLabel || null,
      time: null,
      xp: q.xp,
      group: 'Napi küldetések',
      action: { kind: 'quest', quest: q, label: 'Naplózz' },
    })
  }

  // ── check-ins: one row per canonical slot, bucketed by its own clock time. The
  //    array index is carried onto the action — CheckInSheet is opened by index.
  input.checkins.forEach((c, slotIdx) => {
    items.push({
      id: `checkin:${c.time}`,
      source: 'checkin',
      face: faceOf(c.time, input.goal),
      status: CHECKIN_STATUS[c.state] ?? 'open',
      tone: 'mind', emoji: '💗', tag: 'CHECK-IN',
      title: 'Hogy vagy?',
      subtitle: c.time,
      time: c.time,
      xp: null,
      group: 'Check-in',
      action: { kind: 'checkin', slotIdx, label: 'Koppints' },
    })
  })

  // ── fuel: the day's plan slots, each on its own face.
  for (const f of input.fuelSlots) {
    items.push({
      id: `fuel:${f.time}`,
      source: 'fuel',
      face: faceOf(f.time, input.goal),
      status: FUEL_STATUS[f.state] ?? 'open',
      tone: 'fuel', emoji: '🍶', tag: 'FUEL',
      title: f.mealName || f.label,
      subtitle: f.mealName ? f.label : null,
      time: f.time,
      xp: null,
      group: 'Fuel',
      action: { kind: 'nav', to: '/fuel', label: 'Logold' },
    })
  }

  // ── ritual: the evening close, anchored to its own window opening.
  if (input.ritual) {
    items.push({
      id: 'ritual:day',
      source: 'ritual',
      face: 'este',
      status: input.ritual.closed ? 'done' : 'open',
      tone: 'mind', emoji: '🌙', tag: 'NAPZÁRÁS',
      title: 'Napzárás',
      subtitle: `villanyoltás ${input.ritual.window.bedTime}`,
      time: input.ritual.window.opensAt,
      xp: null,
      group: 'Napzárás',
      action: { kind: 'nav', to: '/ritual', label: 'Zárjuk le' },
    })
  }

  return items
}

export function itemsForFace(items: TodayItem[], face: DayFace): { open: TodayItem[]; done: TodayItem[] } {
  const mine = items.filter((i) => i.face === face || i.face === 'all')
  return {
    open: mine.filter((i) => i.status === 'open'),
    done: mine.filter((i) => i.status === 'done'),
  }
}

export function openCountByFace(items: TodayItem[]): Record<DayFace, number> {
  const out = { reggel: 0, nap: 0, este: 0 } as Record<DayFace, number>
  for (const f of DAY_FACES) out[f] = itemsForFace(items, f).open.length
  return out
}
