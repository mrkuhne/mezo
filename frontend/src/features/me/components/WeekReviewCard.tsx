// Weekly review (mezo-p2tr) — the AI-generated week summary card: the prose Mezo writes about
// the completed week, plus 👍/👎 feedback on it (the review row IS the weekly_review feedback
// artifact) and a "Frissítsd az elemzést" affordance when the underlying data outran the review.
import { useFeedback } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import type { WeeklyReview } from '@/data/me/weeklyReviewHooks'

export function WeekReviewCard({
  review,
  regenerate,
  regenerating,
}: {
  review: WeeklyReview | null
  regenerate: () => Promise<void>
  regenerating: boolean
}) {
  // Nothing to vote on while the ghost placeholder is up — no id ⇒ no request (the
  // weekly_suggestion card's precedent, WeeklyPage.tsx).
  const feedback = useFeedback('weekly_review', review ? [review.id] : [])

  return (
    <div className="card" style={{ padding: 18, margin: '0 24px 16px' }}>
      <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo · heti elemzés</span>
      {review != null ? (
        <>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {review.summary}
          </p>
          {review.stale && (
            <button
              type="button"
              className="chip"
              style={{ marginTop: 10 }}
              disabled={regenerating}
              onClick={() => void regenerate()}
            >
              {regenerating ? 'Frissítés…' : 'Frissítsd az elemzést'}
            </button>
          )}
          <div className="mt-md">
            <FeedbackChips
              key={review.id}
              value={feedback.get(review.id)}
              onVote={(verdict, reason) => feedback.vote(review.id, verdict, reason)}
              label="a heti elemzésről"
            />
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg.
        </p>
      )}
    </div>
  )
}
