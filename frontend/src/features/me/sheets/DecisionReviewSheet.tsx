import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useDecisionActions } from '@/data/hooks'
import { dayLabel } from '@/features/me/logic/growthJournal'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

const RATINGS = [1, 2, 3, 4, 5] as const

interface DecisionReviewSheetProps {
  decision: DecisionEntry
  /** The caller's already-computed "today" ISO string (one `localDateString()` call per render,
   * shared with JournalPage's own `dayLabel` calls — see JournalPage.tsx's `today`). */
  today: string
  onClose: () => void
}

// The review half of the decision journal (mezo-b3pp.4): re-reads the decision as it was written,
// then records how it turned out (1-5 + optional prose).
//
// Host (restored mezo-d20.11): `JournalPage`'s gold decision card gives the RATING inline (the
// prototype's own #page-naplo .decrow, one tap, no sheet). This sheet is the second step: the
// sage "✓ Visszanézve" acknowledgement's „Mi lett belőle?" button opens it prefilled with that
// rating so the OUTCOME PROSE can still be recorded. Between mezo-d20.6.6 and mezo-d20.11 nothing
// mounted it, which silently removed `DecisionReviewRequest.outcome` from the product even though
// the column and the embedding path that reads it stayed live. The PUT it wraps is re-runnable,
// so re-saving an already-rated decision with text attached is the intended use.
export function DecisionReviewSheet({ decision, today, onClose }: DecisionReviewSheetProps) {
  const { reviewDecision, pending } = useDecisionActions()
  const [rating, setRating] = useState<number | null>(decision.outcomeRating)
  const [outcome, setOutcome] = useState(decision.outcomeText ?? '')

  const save = (close: () => void) => {
    if (rating === null || pending) return
    void reviewDecision(decision.id, rating, outcome.trim() || undefined).then(close)
  }

  return (
    <Sheet onClose={onClose} labelledBy="decision-review-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow">Döntés · {dayLabel(decision.decidedOn, today)}</span>
              <div id="decision-review-title" className="h-display size-md" style={{ marginTop: 4 }}>
                Hogyan sült el?
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)' }}>{decision.decisionText}</p>
          </div>

          <div className="col gap-sm mt-lg">
            <span className="eyebrow text-tertiary">Mennyire vált be? (1–5)</span>
            <div className="row gap-sm" role="group" aria-label="Értékelés">
              {RATINGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip flex-1"
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="card" style={{ padding: 10, marginTop: 8 }}>
              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                aria-label="Hogyan sült el — részletek"
                placeholder="Mi lett belőle? (nem kötelező)"
                style={{ width: '100%', minHeight: 90, resize: 'none', fontSize: 15, lineHeight: 1.45 }}
              />
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
            <button
              className="cta-primary flex-1"
              onClick={() => save(close)}
              disabled={rating === null || pending}
            >
              Mentem
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
