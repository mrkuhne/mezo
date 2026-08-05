// ============================================================
// Mezo · FaceEvening — the 🌙 face (mezo-j7u4): the Napzárás hero (with the
// wind-down card above it inside the dim/winddown window), the evening todos,
// the intention reflection, and the day's retrospective — the completed items
// with their DoneBar summaries plus the day's XP.
// The retrospective list IS this face's done surface, so — unlike the morning
// and day faces — no `DoneFold` is mounted here (it would repeat the same rows).
// ============================================================
import { ChainCelebrations, type ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { RitualCard } from '@/features/today/components/RitualCard'
import { TodoCard } from '@/features/today/components/TodoCard'
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { CompanionNote } from '@/data/types'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { useWindDownPhase } from '@/features/today/logic/useWindDownPhase'

/** The two rows the `RitualCard` hero above the list already owns — showing either of
 *  them again is the exact duplication this redesign exists to remove. The `evening_ritual`
 *  habit and the `ritual:day` item describe the same act with a weaker affordance (a row
 *  pill vs. the hero's window-aware CTA), so the hero wins. Filtered HERE rather than in
 *  `todayItems.ts`: other surfaces (Growth's chain view) legitimately want those rows. */
const OWNED_BY_RITUAL_HERO = new Set(['habit:evening_ritual'])

/** The same rule, one card up and phase-dependent (mezo-mvb4.1): inside the **winddown** phase
 *  the `WindDownBanner` renders this habit's own row — title, anchor cue, `+N XP` and a `Pipa` —
 *  so a second `Pipa` in the `TodoCard` would offer one act twice, from two `useHabitActions`
 *  instances with independent `pending` state. It is filtered ONLY while the banner shows it:
 *  in `dim` (and outside the windows entirely) the banner draws no row, so the `TodoCard`'s is
 *  the only affordance and must stay — the habit's anchor („napzárás után") has not come due
 *  yet, exactly as before the re-dress. Once the habit is `done` it is not in `open` at all. */
const OWNED_BY_WIND_DOWN_BANNER = 'habit:wind_down'

export function FaceEvening({
  open, done, doneXp, dayXp, celebrations, note, growth, fuelNote, habitPending, onAct,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  /** Total XP earned today across every source — the retrospective's headline. */
  dayXp: number
  /** Every ACTIVE EVENING-daypart chain's progress (mezo-n5e9.4) — this face owns them, so it
   *  fires their completion toasts. Unlike the morning face there is no chain hero: every
   *  evening step already renders as an actionable `TodoCard` row, so nothing needs promoting
   *  or de-duplicating. */
  celebrations: ChainCelebrationInput[]
  note: CompanionNote | null
  /** Quest summary + the route into quest management (TodoCard's header). */
  growth?: GrowthTodaySummary | null
  /** The fuel plan's companion line — only shown when this face has fuel rows. */
  fuelNote?: { time: string; text: string } | null
  /** A habit write is in flight — withdraws habit controls on this face. */
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}) {
  // The same 30 s-ticking derivation the banner renders from, so „is the banner showing the
  // wind-down row right now?" is answered by ONE clock and one formula.
  const { phase } = useWindDownPhase()
  const bannerOwnsWindDown = phase === 'winddown'
  const todo = open.filter((i) =>
    i.source !== 'ritual'
    && !OWNED_BY_RITUAL_HERO.has(i.id)
    && !(bannerOwnsWindDown && i.id === OWNED_BY_WIND_DOWN_BANNER))
  return (
    <>
      <ChainCelebrations chains={celebrations} />
      <WindDownBanner />
      <RitualCard />
      <TodoCard
        items={todo} doneCount={done.length} xp={doneXp} growth={growth}
        note={todo.some((i) => i.source === 'fuel') ? fuelNote : null}
        habitPending={habitPending} onAct={onAct}
      />
      <IntentionBanner variant="reflect" />
      {note && <CompanionNoteCard note={note} />}
      {done.length > 0 && (
        <>
          <div className="zoneline"><span>Ahogy a nap telt</span><i /></div>
          {done.map((it) => (
            <ItemRow key={it.id} tone={it.tone} emoji={it.emoji} title={it.title} subtitle={it.subtitle} done />
          ))}
          <div className="dayxp">Ma összesen <b>+{dayXp} XP</b></div>
        </>
      )}
    </>
  )
}
