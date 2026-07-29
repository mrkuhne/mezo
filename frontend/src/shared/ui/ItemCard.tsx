// ============================================================
// Mezo · ItemCard — the app's one full-size item card (mezo-jyua).
// Extracted verbatim from the Train `TodaySessionCard` (mezo-9bbc) so Today
// and Train render the SAME card, not two similar ones: modality-gradient
// surface + 44px icon shield, eyebrow (tag · time), display title, `.metapill`
// facts, then a full-width CTA — or, once logged, a `DoneBar` and a
// check-swapped shield. Without `ctaLabel` the card is read-only.
// Domain-free by house rule: presentation props only, no `@/data/*` import.
// The `.todaycard*` class family is intentionally kept under its original
// names — the extraction is a pure move, proven by the unchanged Train goldens.
// ============================================================
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { DoneBar } from '@/features/train/components/DoneBar'

/** Modality tones. The first five mirror Train's `SessionTone`; the last three are
 *  the Today domains (habit chain / mind & ritual / fuel). */
export type ItemTone = 'gym' | 'sport' | 'cross' | 'trx' | 'run' | 'body' | 'mind' | 'fuel'

export interface ItemCardProps {
  /** Drives `--tc-accent`/`--tc-wash` and the type-tag variant. */
  tone: ItemTone
  /** Icon-shield glyph. */
  emoji: string
  /** Uppercase type word shown in the eyebrow tag (`FUTÁS`, `RÖPI`…). */
  tag: string
  /** Item time; omitted from the eyebrow when absent. */
  time?: string | null
  title: string
  /** One `.metapill` per fact; falsy entries drop out. */
  facts: readonly (string | null | undefined | false)[]
  logged: boolean
  /** `DoneBar` summary of the logged effort. */
  loggedSummary?: string
  /** `DoneBar` detail line; omitted when unknown. */
  loggedDetail?: string | null
  /** `MOST`/`MA`/`ELMARADT`/`TERVEZETT`; suppressed while logged. */
  stateLabel?: string | null
  /** Not-yet-logged CTA copy. Absent ⇒ read-only card. */
  ctaLabel?: string
  /** Opens the log surface (from the CTA, or from the DoneBar once logged). */
  onLog?: () => void
  /** Extra content rendered between the head and the pills (e.g. a hero's progress bar). */
  children?: React.ReactNode
}

export function ItemCard({
  tone, emoji, tag, time, title, facts,
  logged, loggedSummary, loggedDetail, stateLabel, ctaLabel, onLog, children,
}: ItemCardProps) {
  const pills = facts.filter(Boolean) as string[]
  const interactive = Boolean(ctaLabel && onLog)
  return (
    <section className={cn('todaycard', `todaycard-${tone}`, logged && 'logged')}>
      <div className="todaycard-top">
        <span className="todaycard-icon" aria-hidden="true">
          {logged ? <Icon name="check" size={20} /> : emoji}
        </span>
        <div className="todaycard-head">
          <span className={cn('typetag', `typetag-${tone}`)}>
            {tag}{logged ? ' · MEGVAN' : null}
          </span>
          {!logged && time ? <span className="todaycard-time">{time}</span> : null}
          <h3 className="todaycard-title">{title}</h3>
        </div>
        {!logged && stateLabel ? <span className="todaycard-state">{stateLabel}</span> : null}
      </div>

      {children}

      {logged ? (
        <DoneBar
          summary={loggedSummary ?? ''}
          detail={loggedDetail}
          onClick={interactive ? onLog : undefined}
          ariaLabel={interactive ? `${title} — logolt session megnyitása` : undefined}
        />
      ) : (
        <>
          {pills.length > 0 && (
            <div className="todaycard-pills">
              {pills.map((p) => <span key={p} className="metapill">{p}</span>)}
            </div>
          )}
          {interactive && (
            <button type="button" className="todaycard-cta np-press" onClick={onLog}>
              <Icon name="plus" size={12} /><span>{ctaLabel}</span>
            </button>
          )}
        </>
      )}
    </section>
  )
}
