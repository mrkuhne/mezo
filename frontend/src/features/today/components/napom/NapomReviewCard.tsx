// A napom · the Mezo's overnight note about a closed, scored day (prototype uveg-napod-body.html
// `.mnote`, owner OK 2026-09-24). One lavender glass card: the scroll icon + eyebrow, the
// narrative in upright Geist (owner 2026-09-24: no italic serif), the highlights as FLAT cells
// (the day's key across the full width, pattern and win side by side), the feedback chips and
// the day chat handoff. Took over `DayReviewCard`'s feedback + chat wiring (mezo-jcpt.9): the
// chips mount off `reviewId`, never off `state` — no artifact, nothing to vote on.
import type { CSSProperties } from 'react'
import { useFeedback } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useChatHandoff } from '@/features/me/logic/useChatHandoff'
import { Icon3D } from '@/shared/ui/clay'
import { Spinner } from '@/shared/ui/Spinner'
import type { HighlightKind, NormalizedDayEvaluation } from '@/data/me/dayEvaluation'

const HIGHLIGHT_EYEBROW: Record<HighlightKind, string> = {
  key: 'A NAP KULCSA',
  pattern: 'FELISMERT MINTA',
  win: 'JÓ IRÁNY',
}
/** The reading order: the key leads, the pattern follows, the win closes (wire order means nothing). */
const HIGHLIGHT_ORDER: HighlightKind[] = ['key', 'pattern', 'win']

export function NapomReviewCard({ evaluation, date, i }: {
  evaluation: Pick<NormalizedDayEvaluation, 'narrative' | 'highlights' | 'reviewId'>
  date: string
  /** Entrance stagger index. */
  i: number
}) {
  const { narrative, highlights, reviewId } = evaluation
  const feedback = useFeedback('day_review', reviewId ? [reviewId] : [])
  const chat = useChatHandoff()
  return (
    <section className="napom-note glass rise" style={{ '--c': 'var(--dv-lav)', '--i': i } as CSSProperties}>
      <div className="napom-note-head">
        <Icon3D name="t-scroll" size={34} />
        <span className="uv-eyebrow">MEZO · A NAPODRÓL</span>
      </div>
      {narrative.map((p) => <p key={p}>{p}</p>)}
      {highlights.length > 0 && (
        <div className="napom-hls">
          {[...highlights]
            .sort((a, b) => HIGHLIGHT_ORDER.indexOf(a.kind) - HIGHLIGHT_ORDER.indexOf(b.kind))
            .map((h) => (
              <div key={`${h.kind}·${h.label}`} className={`napom-hl uv-flat is-${h.kind}`}>
                <span className="uv-eyebrow">{HIGHLIGHT_EYEBROW[h.kind]}</span>
                <strong>{h.label}</strong>
              </div>
            ))}
        </div>
      )}
      {reviewId && (
        <div className="napom-fb">
          <FeedbackChips
            key={reviewId}
            value={feedback.get(reviewId)}
            onVote={(verdict, reason) => feedback.vote(reviewId, verdict, reason)}
            label="a napodról"
          />
        </div>
      )}
      <button type="button" className="napom-talk" disabled={chat.pending} onClick={() => chat.open({ kind: 'day', date })}>
        {chat.pending ? <Spinner size="sm" label="" /> : <Icon3D name="t-chat" size={26} />}
        <span>{chat.pending ? 'Indítás…' : 'Beszélgess a napról'}</span>
        <b aria-hidden="true">›</b>
      </button>
    </section>
  )
}
