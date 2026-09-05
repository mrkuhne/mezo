// ============================================================
// Napi értékelés · a Mezo szöveges értékelése (mezo-jcpt.4)
// Source: the approved day-evaluation prototype's lavender `.revcard`
// (screen 1): breathing orb + eyebrow, the cross-context narrative
// paragraphs, the `.hlch` highlight chips, the ±5 AI adjustment on its own
// separated row, and the day chat handoff.
//
// The adjustment is DELIBERATELY a separate row rather than folded into the
// score: the deterministic base and the Mezo's ±5 contextual correction are
// two different claims, and the reason is always shown next to the delta
// (constraints.md — a delta with no justification is dropped upstream).
// ============================================================
import type { CSSProperties, ReactNode } from 'react'
import { useFeedback } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { ClaySpot } from '@/shared/ui/clay'
import type { HighlightKind, NormalizedDayEvaluation } from '@/data/me/dayEvaluation'

/** `kind` → the chip's eyebrow word. The COLOUR is the `is-<kind>` CSS class. */
const HIGHLIGHT_EYEBROW: Record<HighlightKind, string> = {
  key: 'A nap kulcsa',
  pattern: 'Felismert minta',
  win: 'Jó irány',
}

/** The prototype's reading order — the day's KEY leads, the recognised pattern follows, the
 *  win closes. The wire order is the backend's own and carries no meaning, so the card sorts
 *  rather than inheriting it. */
const HIGHLIGHT_ORDER: HighlightKind[] = ['key', 'pattern', 'win']

/** `+3` / `−2` — U+2212 for the minus, as every other HU numeral in the app. */
function fmtDelta(delta: number): string {
  return delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`
}

export function DayReviewCard({ evaluation, delayMs, children }: {
  evaluation: Pick<NormalizedDayEvaluation, 'narrative' | 'highlights' | 'adjustment' | 'reviewId'>
  delayMs: number
  /** The chat handoff button — kept owned by the page, which holds `useChatHandoff`. */
  children?: ReactNode
}) {
  const { narrative, highlights, adjustment, reviewId } = evaluation
  // No `reviewId` ⇒ no prose behind this day (Task 1 makes that unreachable while `reviewId` is
  // present) ⇒ nothing to vote on — the `weekly_review` card's precedent (`WeekReviewCard.tsx`):
  // no id, no request, no chip row at all.
  const feedback = useFeedback('day_review', reviewId ? [reviewId] : [])
  return (
    <section className="dayev-revcard rise" style={{ '--d': `${delayMs}ms` } as CSSProperties}>
      <div className="dayev-revhead">
        <ClaySpot name="s-orb" size={28} className="dayev-orbb" />
        <span className="mz-eyebrow dayev-revlabel">Mezo · a napodról</span>
      </div>
      {narrative.map((p) => <p key={p} className="dayev-prose">{p}</p>)}
      {highlights.length > 0 && (
        <div className="dayev-hlrow">
          {[...highlights]
            .sort((a, b) => HIGHLIGHT_ORDER.indexOf(a.kind) - HIGHLIGHT_ORDER.indexOf(b.kind))
            .map((h) => (
              <span key={`${h.kind}·${h.label}`} className={`dayev-hlch is-${h.kind}`}>
                <em>{HIGHLIGHT_EYEBROW[h.kind]}</em>
                <span>{h.label}</span>
              </span>
            ))}
        </div>
      )}
      {adjustment && (
        <div className="dayev-adj">
          <b>{fmtDelta(adjustment.delta)}</b>
          <span>{adjustment.reason}</span>
        </div>
      )}
      {reviewId && (
        <div className="mt-md">
          <FeedbackChips
            key={reviewId}
            value={feedback.get(reviewId)}
            onVote={(verdict, reason) => feedback.vote(reviewId, verdict, reason)}
            label="a napodról"
          />
        </div>
      )}
      {children}
    </section>
  )
}
