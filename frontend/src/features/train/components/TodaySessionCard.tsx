// ============================================================
// Mezo · TodaySessionCard — one scheduled session of the selected day on
// Mai (sport: röpi/cross/TRX · prescribed run). Napiv `.todaycard` in the
// K3 language (mezo-9bbc): modality-gradient surface + 44px icon shield,
// eyebrow (tag · time), display title, `.metapill` facts, then a
// full-width CTA — or, once logged, a `DoneBar` and a check-swapped
// shield. Without `ctaLabel` the card is read-only (a future day).
// ============================================================
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { DoneBar } from '@/features/train/components/DoneBar'
import type { SessionTone } from '@/features/train/logic/sportKinds'

interface TodaySessionCardProps {
  /** Modality tone — drives `--tc-accent`/`--tc-wash` and the type-tag variant. */
  tone: SessionTone
  /** Icon-shield glyph (from `SPORT_EMOJI`, or 🏃/🏋️). */
  emoji: string
  /** Uppercase type word shown in the eyebrow tag (`FUTÁS`, `RÖPI`…). */
  tag: string
  /** Session time; omitted from the eyebrow when absent. */
  time?: string | null
  title: string
  /** One `.metapill` per fact; falsy entries drop out. */
  facts: readonly (string | null | undefined | false)[]
  logged: boolean
  /** `DoneBar` summary of the logged effort. */
  loggedSummary?: string
  /** `DoneBar` detail line (logged-at); omitted when unknown. */
  loggedDetail?: string | null
  /** `MOST`/`MA`/`ELMARADT`/`TERVEZETT`; suppressed while logged. */
  stateLabel?: string | null
  /** Not-yet-logged CTA copy. Absent ⇒ read-only card. */
  ctaLabel?: string
  /** Opens the log sheet (from the CTA, or from the DoneBar once logged). */
  onLog?: () => void
}

export function TodaySessionCard({
  tone, emoji, tag, time, title, facts,
  logged, loggedSummary, loggedDetail, stateLabel, ctaLabel, onLog,
}: TodaySessionCardProps) {
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
