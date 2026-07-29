// ============================================================
// Mezo · FaceHeroCard — a face's chain hero (mezo-j7u4): the shared `ItemCard`
// carrying a progress bar and the chain's NEXT step promoted into its own row
// with that step's action (and its external link, if it has one).
// The remaining steps are NOT repeated here: they render as ordinary, ACTIONABLE
// rows in the face's `TodoCard` under their chain's group, so a skipped middle
// step can still be ticked. The `rest` metapills this card used to carry were the
// read-only half of that pair, and became duplication once the rows appeared.
// ============================================================
import { ItemCard, type ItemTone } from '@/shared/ui/ItemCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceHeroCard({
  tone, emoji, tag, title, done, total, next, disabled, onAct,
}: {
  tone: ItemTone
  emoji: string
  tag: string
  title: string
  done: number
  total: number
  /** The chain's first open step, promoted; null when the chain is finished. */
  next: TodayItem | null
  /** An in-flight write — withdraws the CTA so a double-tap cannot fire twice (ItemRow's rule). */
  disabled?: boolean
  onAct: (item: TodayItem) => void
}) {
  const pct = total === 0 ? 0 : (done / total) * 100
  return (
    <ItemCard
      tone={tone} emoji={emoji} tag={tag} title={title}
      stateLabel={`${done} / ${total}`}
      facts={[]}
      logged={false}
    >
      <div className="fhc-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {next && (
        <div className="fhc-next">
          <span className="fhc-next-tx">
            <b>{next.title}</b>
            <s>{[next.subtitle, next.xp ? `+${next.xp} XP` : null].filter(Boolean).join(' · ')}</s>
          </span>
          {next.linkUrl && (
            <a
              className="fhc-next-link np-press"
              href={next.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${next.title} megnyitása`}
            >
              ↗
            </a>
          )}
          {next.action && (
            disabled ? (
              <span className="fhc-next-go is-inert">{next.action.label}</span>
            ) : (
              <button type="button" className="fhc-next-go np-press" onClick={() => onAct(next)}>
                {next.action.label}
              </button>
            )
          )}
        </div>
      )}
    </ItemCard>
  )
}
