// ============================================================
// Mezo · FaceDay — the ☀️ face (mezo-j7u4): the day's session as the hero with
// its real start CTA, the remaining todos, the companion's midday note, and a
// preview of the evening.
// ============================================================
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { DoneFold } from '@/features/today/components/DoneFold'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { TodoCard } from '@/features/today/components/TodoCard'
import { ItemCard, type ItemTone } from '@/shared/ui/ItemCard'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { CompanionNote } from '@/data/types'
import type { DayFace } from '@/features/today/logic/dayFace'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface DayHero {
  tone: ItemTone; emoji: string; tag: string; time: string | null; title: string
  facts: (string | null | undefined | false)[]
  logged: boolean; loggedSummary?: string; ctaLabel?: string; onLog?: () => void
}

export function FaceDay({
  open, done, doneXp, hero, note, later, onAct, onFace, onCustom,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  /** null on a rest day. */
  hero: DayHero | null
  note: CompanionNote | null
  later: TodayItem[]
  onAct: (item: TodayItem) => void
  onFace: (face: DayFace) => void
  onCustom: () => void
}) {
  const todo = open.filter((i) => i.source !== 'session')
  return (
    <>
      {hero ? (
        <ItemCard {...hero} />
      ) : (
        <ItemCard
          tone="gym" emoji="🌤️" tag="PIHENŐ" title="Ma pihenőnap"
          facts={['a heti rended a Heti fülön']} logged={false}
          ctaLabel="Saját edzés" onLog={onCustom}
        />
      )}
      <IntentionBanner variant="chip" />
      <TodoCard items={todo} doneCount={done.length} xp={doneXp} onAct={onAct} />
      {note && <CompanionNoteCard note={note} />}
      {later.length > 0 && (
        <>
          <div className="zoneline"><span>Este vár rád</span><i /></div>
          {later.map((it) => (
            <ItemRow
              key={it.id} tone={it.tone} emoji={it.emoji} title={it.title}
              subtitle={it.subtitle} time={it.time}
              onAction={() => onFace('este')}
              ariaLabel={`${it.title} — ugrás az esti napszakra`}
            />
          ))}
        </>
      )}
      <DoneFold items={done} xp={doneXp} />
    </>
  )
}
