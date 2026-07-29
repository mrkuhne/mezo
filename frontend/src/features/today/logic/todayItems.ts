// ============================================================
// Mezo · todayItems — the single normalizer behind Today's faces (mezo-ly8c).
// Six sources (daily quests, habit chains, check-ins, fuel slots, train
// sessions, ritual/wind-down) collapse onto ONE `TodayItem` shape, get bucketed
// by daypart face, deduplicated and partitioned into open/done. This is what
// kills the duplication the old screen had — the morning weigh-in was a quest
// AND a habit row, the workout was a hero AND a quest AND a habit row.
// Pure: no React, no hooks, no `@/data/hooks`, no side effects. Quest and habit
// actions deliberately carry the raw domain object, so `TodayPage` can dispatch
// them through the existing questAction/habitAction mappings without this
// module knowing about sheets. It reads `questAction` for ONE thing — the CTA's
// **label**, which is that mapping's own copy and must not be re-invented here
// (a flat „Naplózz" turned the water quest's instant 250 ml write into a pill
// that read like a navigation). Sources with no domain-level action of their own
// (fuel, ritual) carry a plain route string on a `nav` action instead — the
// same convention `questAction.ts` already uses — the one place a route
// legitimately appears here.
// ============================================================
import { faceOf, type DayFace, DAY_FACES } from '@/features/today/logic/dayFace'
import { questAction } from '@/features/today/logic/questAction'
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
  /** The item's own external content (a habit's `linkUrl` — e.g. the daily video). Rendered
   *  as `ItemRow`'s trailing link, ALONGSIDE the action, never instead of it. */
  linkUrl: string | null
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
/**
 * `skipped` is OPEN, not `missed` (mezo-mvb4.1). A check-in slot whose window has passed with
 * nothing recorded is the ONE passed state the user can still act on: `CheckInSheet` posts
 * `state: 'done'`, so backfilling works end to end — exactly what the retired `CheckInStrip`
 * allowed by making all four slots tappable unconditionally. Mapping it to `missed` made it
 * invisible: nothing renders a `missed` item (not the open list, not `DoneFold`, not the
 * „Ahogy a nap telt" retrospective), so from 10:00 onward every unfilled morning slot became
 * unreachable and the `bio_checkin_full` quest (threshold 4) unwinnable for the rest of the day.
 * The honesty the `missed` mapping was reaching for is carried by the row's COPY instead (past
 * tense + „elmaradt" + a `Pótold` pill), never by hiding the action.
 */
const CHECKIN_STATUS: Record<string, ItemStatus> = { done: 'done', skipped: 'open', now: 'open', pending: 'open' }
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
      time: s.time, xp: null, group: 'Edzés', action: null, linkUrl: null,
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
      linkUrl: h.linkUrl ?? null,
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
      // The CTA says what it will DO — `questAction`'s own per-metric label (`+250 ml`,
      // `Check-in`, `Mérés`, `Alvás`, `Fuel`, `Főzés`, `Edzés`), the labels the retired
      // TodayQuestsCard rendered. A flat „Naplózz" made the `water_target` pill a mutation
      // disguised as a navigation: it commits an immediate 250 ml write with no sheet, while
      // „Naplózz" everywhere else on this screen means „open a log surface". The `??` is the
      // unmapped case, which `servableAction` strips of its action anyway.
      action: { kind: 'quest', quest: q, label: questAction(q)?.label ?? 'Naplózz' }, linkUrl: null,
    })
  }

  // ── check-ins: one row per canonical slot, bucketed by its own clock time. The
  //    array index is carried onto the action — CheckInSheet is opened by index.
  input.checkins.forEach((c, slotIdx) => {
    // A passed, unrecorded slot stays actionable (see CHECKIN_STATUS) but its copy never
    // pretends it was on time: past tense, an „elmaradt" subtitle, and a pill that offers to
    // make it up rather than to tap now. This is the `—` the retired strip drew on a skipped
    // slot, said in words on a row that still opens the sheet.
    const late = c.state === 'skipped'
    items.push({
      id: `checkin:${c.time}`,
      source: 'checkin',
      face: faceOf(c.time, input.goal),
      status: CHECKIN_STATUS[c.state] ?? 'open',
      tone: 'mind', emoji: '💗', tag: 'CHECK-IN',
      title: late ? 'Hogy voltál?' : 'Hogy vagy?',
      subtitle: late ? `${c.time} · elmaradt` : c.time,
      time: c.time,
      xp: null,
      group: 'Check-in',
      action: { kind: 'checkin', slotIdx, label: late ? 'Pótold' : 'Koppints' }, linkUrl: null,
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
      // The live slot keeps the retired timeline's `MOST` marker. `FUEL_STATUS` folds `now`
      // into `open`, so without this the active slot is indistinguishable from a later one.
      // Carried in the row's own copy rather than as a new `ItemStatus` — `now` is a
      // presentation nuance of an OPEN item, not a completion state.
      subtitle: [f.state === 'now' ? 'MOST' : null, f.mealName ? f.label : null]
        .filter(Boolean).join(' · ') || null,
      time: f.time,
      xp: null,
      group: 'Fuel',
      action: { kind: 'nav', to: '/fuel', label: 'Logold' }, linkUrl: null,
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
      action: { kind: 'nav', to: '/ritual', label: 'Zárjuk le' }, linkUrl: null,
    })
  }

  return items
}

/** A check-in slot the user can still fill — anything not already recorded. `skipped` counts:
 *  its window has passed, but `CheckInSheet` posts `state: 'done'`, so a backfill lands. The one
 *  predicate behind both the quest CTA's servability and the index `act()` opens for it, so the
 *  two can never disagree about what „a slot is available" means (mezo-mvb4.1). */
export const isFillableSlot = (c: CheckinSlot): boolean => c.state !== 'done'

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
