// Weekly review (mezo-p2tr) — the next-week plan card, unchanged data source (weeklySuggestionApi,
// the W1 proactive suggestion) reused verbatim under the review's new "heti" framing. Copy/idiom
// mirrors the retired WeeklyPage.tsx (its 👍/👎 + honest placeholder), keyed by the suggestion's
// own artifactId so a browsed-week remount never carries the previous week's feedback state.
import { useFeedback } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import type { WeeklySuggestion } from '@/data/insights/weeklySuggestionApi'

export function WeekNextCard({ suggestion }: { suggestion: WeeklySuggestion | null }) {
  const feedbackIds = suggestion ? [suggestion.id] : []
  const feedback = useFeedback('weekly_suggestion', feedbackIds)

  // The 0/24/24 margin this card used to carry belonged to the retired long-scroll page,
  // which had no page padding of its own. Inside the Heti hub's PageBody it made the card
  // narrower than every sibling AND doubled the panel's rhythm (mezo-d20.11.2).
  return (
    <div className="card" style={{ padding: 18 }}>
      <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo · a következő heted</span>
      {suggestion != null ? (
        <>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {suggestion.prose}
          </p>
          <div className="mt-md">
            <FeedbackChips
              key={suggestion.id}
              value={feedback.get(suggestion.id)}
              onVote={(verdict, reason) => feedback.vote(suggestion.id, verdict, reason)}
              label="a heti tervjavaslatról"
            />
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          A társ heti tervjavaslata hamarosan.
        </p>
      )}
    </div>
  )
}
