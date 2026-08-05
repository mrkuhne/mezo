// ============================================================
// Mezo · FaceMorning — the 🌅 face (mezo-j7u4): the morning chain hero, the
// day's numbers as a DS StatStrip, the companion's briefing as a CoachBubble,
// the creed chip, the day's remaining todos, and a preview of what the later
// faces hold (the screen's actual guidance).
// ============================================================
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { ChainCelebrations, type ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { DoneFold } from '@/features/today/components/DoneFold'
import { FaceHeroCard } from '@/features/today/components/FaceHeroCard'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { TodoCard } from '@/features/today/components/TodoCard'
import { ItemRow } from '@/shared/ui/ItemRow'
import { StatStrip, type StatStripCell } from '@/shared/ui/StatStrip'
import type { Briefing } from '@/data/types'
import type { DayFace } from '@/features/today/logic/dayFace'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceMorning({
  open, done, doneXp, chain, celebrations, briefing, briefingDemo, stats, later, growth, fuelNote,
  habitPending, onAct, onFace,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  chain: { done: number; total: number; next: TodayItem | null }
  /** Every ACTIVE MORNING-daypart chain's progress (mezo-n5e9.4) — not just the hero's: a
   *  second morning chain (or a custom one) still gets its own completion toast even though
   *  only the first-by-position chain is promoted to the hero above. */
  celebrations: ChainCelebrationInput[]
  briefing: Briefing
  briefingDemo?: boolean
  /** The day's glance numbers („Ma eddig") — rendered as the DS StatStrip, morning face only. */
  stats: StatStripCell[]
  /** Items belonging to the later faces, previewed as compact rows. Day-wide (`face: 'all'`)
   *  items are excluded by the caller's narrowing filter, so every row here has a real face
   *  to jump to — the `'all' ? 'nap'` fallback this used to carry was unreachable. */
  later: (TodayItem & { face: DayFace })[]
  /** Quest summary + the route into quest management (TodoCard's header). */
  growth?: GrowthTodaySummary | null
  /** The fuel plan's companion line — only shown when this face has fuel rows. */
  fuelNote?: { time: string; text: string } | null
  /** A habit write is in flight — withdraws habit controls on this face. */
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onFace: (face: DayFace) => void
}) {
  // Each chain step appears EXACTLY ONCE and is actionable: the hero promotes `next`, and
  // steps 2..n stay in the TodoCard under „Reggeli rutin" — so a skipped middle step can
  // still be ticked (the retired RoutineCard let any pending row be checked).
  const todo = open.filter((i) => i.id !== chain.next?.id)
  return (
    <>
      <ChainCelebrations chains={celebrations} />
      <FaceHeroCard
        tone="body" emoji="🌅" tag="REGGELI RUTIN"
        title={chain.next ? 'Indul a lánc' : 'Megvan a reggeled'}
        done={chain.done} total={chain.total} next={chain.next} disabled={habitPending} onAct={onAct}
      />
      <StatStrip cells={stats} className="today-stats" />
      <BriefingCard briefing={briefing} demo={briefingDemo} />
      <IntentionBanner variant="chip" />
      <TodoCard
        items={todo} doneCount={done.length} xp={doneXp} growth={growth}
        note={todo.some((i) => i.source === 'fuel') ? fuelNote : null}
        habitPending={habitPending} onAct={onAct}
      />
      {later.length > 0 && (
        <>
          <div className="zoneline"><span>Ma még vár rád</span><i /></div>
          {later.map((it) => (
            <ItemRow
              key={it.id} tone={it.tone} emoji={it.emoji} title={it.title}
              subtitle={it.subtitle} time={it.time}
              onAction={() => onFace(it.face)}
              ariaLabel={`${it.title} — ugrás a napszakára`}
            />
          ))}
        </>
      )}
      <DoneFold items={done} xp={doneXp} />
    </>
  )
}
