import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import type { ArtifactFeedback, FeedbackReason, FeedbackVerdict } from '@/data/feedback/feedbackTypes'

const REASONS: { value: FeedbackReason; label: string }[] = [
  { value: 'inaccurate', label: 'pontatlan' },
  { value: 'too_much', label: 'túl sok' },
  { value: 'bad_timing', label: 'rossz időzítés' },
  { value: 'not_about_me', label: 'nem rólam szól' },
]

/**
 * Shared 👍/👎 feedback chips for AI-produced artifacts (CompanionFeedback, mezo-b3pp.15).
 * Presentational only — the mounting page owns `useFeedback` and passes `value`/`onVote`.
 *
 * Vote semantics live in the `useFeedback` hook, not here: this component just decides WHEN
 * to call `onVote` and with what args.
 * - 👍 always calls `onVote('up')` — the hook turns a repeat tap into a retraction.
 * - 👎 when not already the current verdict reveals a four-chip reason row instead of voting
 *   immediately; picking a reason calls `onVote('down', reason)` and closes the row.
 * - 👎 when ALREADY `down` calls `onVote('down')` with no reason — a retraction — and closes
 *   the row.
 *
 * The reason row's initial visibility mirrors the incoming `value` (open when already `down`,
 * so the current reason renders selected and the user can tap a different one to change it —
 * the hook upserts on any `onVote('down', reason)` even while already down). It is otherwise
 * plain `useState`, not re-derived from props on every render: once open or closed by a click
 * in this session, it stays that way until the next click changes it.
 */
export function FeedbackChips({
  value,
  onVote,
  label,
}: {
  value: ArtifactFeedback | undefined
  onVote: (verdict: FeedbackVerdict, reason?: FeedbackReason) => void
  /** Screen-reader context, e.g. 'a heti tervjavaslatról'. */
  label: string
}) {
  const [reasonsOpen, setReasonsOpen] = useState(value?.verdict === 'down')

  const isUp = value?.verdict === 'up'
  const isDown = value?.verdict === 'down'

  function handleDown() {
    if (isDown) {
      onVote('down')
      setReasonsOpen(false)
    } else {
      setReasonsOpen(true)
    }
  }

  function handleReason(reason: FeedbackReason) {
    onVote('down', reason)
    setReasonsOpen(false)
  }

  return (
    <div className="col gap-xs">
      <div className="row gap-sm" role="group" aria-label={`Visszajelzés ${label}`}>
        <button
          type="button"
          onClick={() => onVote('up')}
          className={cn('chip', isUp && 'brand')}
          aria-pressed={isUp}
          style={{ padding: '6px 12px' }}
        >
          👍 Segített
        </button>
        <button
          type="button"
          onClick={handleDown}
          className={cn('chip', isDown && 'brand')}
          aria-pressed={isDown}
          style={{ padding: '6px 12px' }}
        >
          👎 Nem talált
        </button>
      </div>
      {reasonsOpen && (
        <div className="row gap-xs flex-wrap">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => handleReason(r.value)}
              className={cn('chip', value?.reason === r.value && 'brand')}
              aria-pressed={value?.reason === r.value}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
