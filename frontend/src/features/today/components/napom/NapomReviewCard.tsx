// A napom · „Mezo a napodról" — the overnight note about a closed, scored day (Folyadék
// prototype `ndDayBody`, vilagos/nap.js). One white card: the Mezo's message with the narrative
// paragraphs, the highlights as rows (the day's key, the recognised pattern, the good direction)
// and the feedback chips. The chips mount off `reviewId`, never off `state` — no artifact,
// nothing to vote on (mezo-jcpt.9). The day chat hand-off is the hero tank's CTA on the page, so
// this card does not draw it a second time.
import { useFeedback } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import type { Icon3DName } from '@/shared/ui/clay'
import { Card, Msg, Row, Section } from '@/shared/ui/folyadek'
import type { HighlightKind, NormalizedDayEvaluation } from '@/data/me/dayEvaluation'

const HIGHLIGHT: Record<HighlightKind, { sub: string; icon: Icon3DName }> = {
  key: { sub: 'A nap kulcsa', icon: 't-key' },
  pattern: { sub: 'Felismert minta', icon: 't-pattern' },
  win: { sub: 'Jó irány', icon: 't-up' },
}
/** The reading order: the key leads, the pattern follows, the win closes (wire order means nothing). */
const HIGHLIGHT_ORDER: HighlightKind[] = ['key', 'pattern', 'win']

export function NapomReviewCard({ evaluation, n }: {
  evaluation: Pick<NormalizedDayEvaluation, 'narrative' | 'highlights' | 'reviewId'>
  /** Section number. */
  n: number
}) {
  const { narrative, highlights, reviewId } = evaluation
  const feedback = useFeedback('day_review', reviewId ? [reviewId] : [])
  return (
    <>
      <Section n={n} title="Mezo a napodról" />
      <Card className="nn-note">
        <Msg member="mezo" meta="a napodról">
          {narrative.map((p) => <p key={p}>{p}</p>)}
        </Msg>
        {highlights.length > 0 && (
          <div className="nn-rows nn-hls">
            {[...highlights]
              .sort((a, b) => HIGHLIGHT_ORDER.indexOf(a.kind) - HIGHLIGHT_ORDER.indexOf(b.kind))
              .map((h) => (
                <Row key={`${h.kind}·${h.label}`} icon={HIGHLIGHT[h.kind].icon} title={h.label} sub={HIGHLIGHT[h.kind].sub} />
              ))}
          </div>
        )}
        {reviewId && (
          <div className="nn-fb">
            <FeedbackChips
              key={reviewId}
              value={feedback.get(reviewId)}
              onVote={(verdict, reason) => feedback.vote(reviewId, verdict, reason)}
              label="a napodról"
            />
          </div>
        )}
      </Card>
    </>
  )
}
