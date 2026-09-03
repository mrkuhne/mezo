import { Markdown } from '@/shared/lib/markdown'
import { ClaySpot } from '@/shared/ui/clay'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { RecalledMemoriesRow } from '@/features/insights/components/RecalledMemoriesRow'
import { ToolWorkStrip } from '@/features/insights/components/ToolWorkStrip'
import { RefChips } from '@/features/insights/components/RefChips'
import type { ChatMessage as ChatMessageT } from '@/data/types'
import type { ArtifactFeedback, FeedbackReason, FeedbackVerdict } from '@/data/feedback/feedbackTypes'

/** The card's slice of the page-level `useFeedback` handle (mezo-b3pp.15). Absent when the
 *  message is not votable — a user bubble, or an answer still streaming (no persisted id yet). */
export interface ChatMessageFeedback {
  value: ArtifactFeedback | undefined
  onVote: (verdict: FeedbackVerdict, reason?: FeedbackReason) => void
}

// Design 2.0 face (mezo-d20.5.2) — prototype mezo-body.html #page-chat anatomy:
// assistant = orb + Mezo eyebrow + timestamp meta row, tool chips ABOVE the answer,
// white 4/16-radius bubble with the "Amire épült · L3" human-label refs footer;
// user = warm-washed 16/4-radius bubble, timestamp below right. The behavioral
// contracts (blank-answer naming, degraded badge, votable-only-persisted,
// hidden-when-empty sections) are unchanged — this is a re-face, not a rewrite.
export function ChatMessage({ m, feedback }: { m: ChatMessageT; feedback?: ChatMessageFeedback }) {
  if (m.role === 'user') {
    return (
      <div className="mzc-msg-u">
        <div className="mzc-bub-u">
          <p>{m.text}</p>
        </div>
        <time>{m.ts}</time>
      </div>
    )
  }
  // mezo-b3pp.29: drop a Memory chip ONLY when the Emlékek row below actually carries that same
  // day. Two backend paths emit kind="Memory" and only one feeds `recalled`: ambient recall
  // (PromptMemoryAssembler) builds its refs and the disclosure envelope from the SAME items, so
  // they always agree — but the find_similar_past_days tool (MemoryTools) adds refs that are never
  // in `recalled`. Filtering by kind alone would hide the very day a tool-driven answer was built
  // from, which is information loss rather than dedupe.
  const recalledDays = new Set((m.recalled ?? []).map((x) => x.occurredOn))
  const visibleRefs = (m.refs ?? []).filter((r) => r.kind !== 'Memory' || !recalledDays.has(r.id))
  return (
    <div className="mzc-msg-a col gap-sm">
      <div className="mzc-meta">
        <ClaySpot name="s-orb" size={18} />
        <span className="mzc-eb">Mezo</span>
        <time>{m.ts}</time>
        {m.degraded && (
          <span
            className="mzc-warn"
            title="Ez a válasz nem ment át az önellenőrzésen — kezeld fenntartással."
          >
            nem ellenőrzött
          </span>
        )}
      </div>
      {m.tools && <ToolWorkStrip tools={m.tools} />}
      <div className="mzc-bub-a">
        {/* mezo-8z79: a blank answer can no longer be persisted, but rows written BEFORE the guard
            are still in history — and an empty card reads as a rendering bug. Name what happened
            instead of showing nothing. Gated on `m.id` (i.e. PERSISTED): the in-flight streaming
            bubble is legitimately empty while its tool chips run, and must not say this. */}
        {m.text.trim() || !m.id ? (
          /* Model prose — blocks, not one <p>: the answer carries real markdown (mezo-at8x.1). */
          <div className="md-prose"><Markdown text={m.text} /></div>
        ) : (
          <p className="mzc-noanswer">Erre a körre nem érkezett válasz.</p>
        )}
        {/* length, not truthiness: an empty array is truthy, and the filter above can now turn a
            non-empty refs list into an empty one — without this the eyebrow would render alone. */}
        {visibleRefs.length > 0 && <RefChips refs={visibleRefs} eyebrow="Amire épült · L3" />}
      </div>
      {/* W3.1b: the answer's ambient-recall provenance, collapsed (mezo-b3pp.28). */}
      {m.recalled && <RecalledMemoriesRow items={m.recalled} />}
      {/* Under the card, assistant rows only — and only once the answer is persisted, i.e. has
          an artifactId to vote on. The parent keys this row by that id, so React never reuses
          one FeedbackChips instance (whose reason-row state is session-local) across two
          different answers — advisory since the row derives from the verdict, not load-bearing. */}
      {feedback && (
        <FeedbackChips value={feedback.value} onVote={feedback.onVote} label="a válaszról" />
      )}
    </div>
  )
}
