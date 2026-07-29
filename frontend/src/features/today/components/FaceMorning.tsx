// ============================================================
// Mezo · FaceMorning — the 🌅 face (mezo-j7u4): the morning chain hero, the
// companion's briefing, the creed chip, the day's remaining todos, and a
// preview of what the later faces hold (the screen's actual guidance).
// ============================================================
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { DoneFold } from '@/features/today/components/DoneFold'
import { FaceHeroCard } from '@/features/today/components/FaceHeroCard'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { TodoCard } from '@/features/today/components/TodoCard'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { Briefing } from '@/data/types'
import type { DayFace } from '@/features/today/logic/dayFace'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceMorning({
  open, done, doneXp, chain, briefing, briefingDemo, briefingFacts, later, growth, fuelNote,
  onAct, onFace,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  chain: { done: number; total: number; next: TodayItem | null; rest: string[] }
  briefing: Briefing
  briefingDemo?: boolean
  briefingFacts: string[]
  /** Items belonging to the later faces, previewed as compact rows. */
  later: TodayItem[]
  /** Quest summary + the route into quest management (TodoCard's header). */
  growth?: GrowthTodaySummary | null
  /** The fuel plan's companion line — only shown when this face has fuel rows. */
  fuelNote?: { time: string; text: string } | null
  onAct: (item: TodayItem) => void
  onFace: (face: DayFace) => void
}) {
  const todo = open.filter((i) => i.source !== 'habit' || i.face !== 'reggel')
  return (
    <>
      <FaceHeroCard
        tone="body" emoji="🌅" tag="REGGELI RUTIN"
        title={chain.next ? 'Indul a lánc' : 'Megvan a reggeled'}
        done={chain.done} total={chain.total} next={chain.next} rest={chain.rest} onAct={onAct}
      />
      <BriefingCard briefing={briefing} demo={briefingDemo} facts={briefingFacts} />
      <IntentionBanner variant="chip" />
      <TodoCard
        items={todo} doneCount={done.length} xp={doneXp} growth={growth}
        note={todo.some((i) => i.source === 'fuel') ? fuelNote : null}
        onAct={onAct}
      />
      {later.length > 0 && (
        <>
          <div className="zoneline"><span>Ma még vár rád</span><i /></div>
          {later.map((it) => (
            <ItemRow
              key={it.id} tone={it.tone} emoji={it.emoji} title={it.title}
              subtitle={it.subtitle} time={it.time}
              onAction={() => onFace(it.face === 'all' ? 'nap' : it.face)}
              ariaLabel={`${it.title} — ugrás a napszakára`}
            />
          ))}
        </>
      )}
      <DoneFold items={done} xp={doneXp} />
    </>
  )
}
