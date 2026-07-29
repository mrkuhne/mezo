// ============================================================
// Mezo · FaceHeroCard — a face's chain hero (mezo-j7u4): the shared `ItemCard`
// carrying a progress bar and the chain's NEXT step promoted into its own row
// with that step's action. The remaining steps stay as quiet `.metapill`s, so
// the card answers „mi a következő" without hiding what comes after.
// ============================================================
import { ItemCard, type ItemTone } from '@/shared/ui/ItemCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceHeroCard({
  tone, emoji, tag, title, done, total, next, rest, onAct,
}: {
  tone: ItemTone
  emoji: string
  tag: string
  title: string
  done: number
  total: number
  /** The chain's first open step, promoted; null when the chain is finished. */
  next: TodayItem | null
  /** Titles of the steps after `next`. */
  rest: string[]
  onAct: (item: TodayItem) => void
}) {
  const pct = total === 0 ? 0 : (done / total) * 100
  return (
    <ItemCard
      tone={tone} emoji={emoji} tag={tag} title={title}
      stateLabel={`${done} / ${total}`}
      facts={rest}
      logged={false}
    >
      <div className="fhc-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {next && (
        <div className="fhc-next">
          <span className="fhc-next-tx">
            <b>{next.title}</b>
            <s>{[next.subtitle, next.xp ? `+${next.xp} XP` : null].filter(Boolean).join(' · ')}</s>
          </span>
          {next.action && (
            <button type="button" className="fhc-next-go np-press" onClick={() => onAct(next)}>
              {next.action.label}
            </button>
          )}
        </div>
      )}
    </ItemCard>
  )
}
