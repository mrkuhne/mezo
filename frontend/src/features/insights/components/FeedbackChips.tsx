import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import type { ArtifactFeedback, FeedbackReason, FeedbackVerdict } from '@/data/feedback/feedbackTypes'

const REASONS: { value: FeedbackReason; label: string }[] = [
  { value: 'inaccurate', label: 'pontatlan' },
  { value: 'too_much', label: 'túl sok' },
  { value: 'bad_timing', label: 'rossz időzítés' },
  { value: 'not_about_me', label: 'nem rólam szól' },
]

/**
 * Shared thumb-up/thumb-down feedback chips for AI-produced artifacts (CompanionFeedback,
 * mezo-b3pp.15). Presentational only — the mounting page owns `useFeedback` and passes
 * `value`/`onVote`.
 *
 * Vote semantics live in the `useFeedback` hook, not here: this component just decides WHEN
 * to call `onVote` and with what args.
 * - thumb-up always calls `onVote('up')` — the hook turns a repeat tap into a retraction.
 * - thumb-down when not already the current verdict reveals a four-chip reason row instead of
 *   voting immediately; picking a reason calls `onVote('down', reason)`.
 * - thumb-down when ALREADY `down` calls `onVote('down')` with no reason — a retraction.
 *
 * The reason row is DERIVED, not seeded: it shows whenever the verdict is `down` (`isDown`), or
 * when this session's thumb-down opened it on a card that has no verdict yet (`reasonsOpen`). Seeding
 * `useState` from `value` on mount was a bug (mezo-b3pp.15 review): in real mode `useDualQuery`
 * serves `realEmpty` until the batch GET resolves, so `value` is `undefined` at mount on every
 * cold load and — since all five mount sites key the instance by artifact id, so the arriving
 * value never remounts it — a stored `down` could NEVER show its reason row. Deriving it means a
 * stored `down` always renders its reason selected and a different reason is one tap away (the
 * hook upserts on any `onVote('down', reason)`, even while already down), and the render no
 * longer depends on whether the query cache happened to be warm on the first paint.
 *
 * The row therefore closes when the verdict stops being `down` — which is exactly what the
 * retraction the thumb-down re-tap fires does (the hook writes the cleared row optimistically).
 * The thumb-up handler additionally clears the session flag, or an `up` card opened by an
 * earlier thumb-down in this session would keep the four NEGATIVE reason chips on screen under
 * a positive verdict.
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
  // Only the "opened by thumb-down before any vote exists" case needs state; a stored `down` speaks for
  // itself through `isDown` below.
  const [reasonsOpen, setReasonsOpen] = useState(false)

  const isUp = value?.verdict === 'up'
  const isDown = value?.verdict === 'down'
  const showReasons = reasonsOpen || isDown

  function handleUp() {
    // Clearing the flag matters even though thumb-up never sets it: an `up` verdict must never
    // sit above a row of NEGATIVE reason chips left open by a thumb-down earlier in this session.
    onVote('up')
    setReasonsOpen(false)
  }

  function handleDown() {
    if (isDown) {
      onVote('down')
      setReasonsOpen(false)
    } else {
      setReasonsOpen(true)
    }
  }

  function handleReason(reason: FeedbackReason) {
    // No close here: the vote makes the card `down`, and a `down` card SHOWS its reason row —
    // that is where the selected reason renders and where changing it stays one tap away.
    onVote('down', reason)
  }

  return (
    <div className="col gap-xs">
      <div className="row gap-sm" role="group" aria-label={`Visszajelzés ${label}`}>
        <button
          type="button"
          onClick={handleUp}
          className={cn('chip', isUp && 'brand')}
          aria-pressed={isUp}
          style={{ padding: '6px 12px' }}
        >
          <Icon name="thumb-up" size={13} /> Segített
        </button>
        <button
          type="button"
          onClick={handleDown}
          className={cn('chip', isDown && 'brand')}
          aria-pressed={isDown}
          style={{ padding: '6px 12px' }}
        >
          <Icon name="thumb-down" size={13} /> Nem talált
        </button>
      </div>
      {showReasons && (
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
