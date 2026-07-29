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
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'

/** Exactly `ItemCard`'s prop bag, so the hero is spread straight onto it. */
export interface DayHero {
  tone: ItemTone; emoji: string; tag: string; time: string | null; title: string
  facts: (string | null | undefined | false)[]
  logged: boolean; loggedSummary?: string; ctaLabel?: string; onLog?: () => void
}

export function FaceDay({
  open, done, doneXp, hero, heroWarn, heroNote, note, later, growth, fuelNote,
  habitPending, onAct, onFace, onCustom,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  /** null on a rest day. */
  hero: DayHero | null
  /** The session's niggle warning — kept OUT of `hero` so the bag stays ItemCard-shaped. */
  heroWarn?: string | null
  /** Companion note about the day's load (a workout + a sport session stacked). */
  heroNote?: string | null
  note: CompanionNote | null
  later: TodayItem[]
  /** Quest summary + the route into quest management (TodoCard's header). */
  growth?: GrowthTodaySummary | null
  /** The fuel plan's companion line — only shown when this face has fuel rows. */
  fuelNote?: { time: string; text: string } | null
  /** A habit write is in flight — withdraws habit controls on this face. */
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onFace: (face: DayFace) => void
  onCustom: () => void
}) {
  // `open` already excludes the item this face's hero renders (TodayPage filters it by id), so
  // there is nothing to strip here. Filtering `source !== 'session'` — as this line used to —
  // also removed the sessions that are NOT the hero: on a stacked day the second session
  // (a 17:00 sport session next to the gym) had no surface anywhere on its own face.
  return (
    <>
      {hero ? (
        <ItemCard {...hero}>
          {heroWarn && <div className="warmstrip">⚠️ {heroWarn}</div>}
          {heroNote && <div className="todaycard-note">{heroNote}</div>}
        </ItemCard>
      ) : (
        <ItemCard
          tone="gym" emoji="🌤️" tag="PIHENŐ" title="Ma pihenőnap"
          facts={['a heti rended a Heti fülön']} logged={false}
          ctaLabel="Saját edzés" onLog={onCustom}
        />
      )}
      <IntentionBanner variant="chip" />
      <TodoCard
        items={open} doneCount={done.length} xp={doneXp} growth={growth}
        note={open.some((i) => i.source === 'fuel') ? fuelNote : null}
        habitPending={habitPending} onAct={onAct}
      />
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
