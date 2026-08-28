import { Markdown } from '@/shared/lib/markdown'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { ClaySpot } from '@/shared/ui/clay'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { RecalledMemoriesRow } from '@/features/insights/components/RecalledMemoriesRow'
import { chatRefDisplay } from '@/features/insights/logic/chatRefs'
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
// white 4/16-radius bubble with the "Hivatkozott · L3" human-label refs footer;
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
      {m.tools && <ToolChipRow tools={m.tools} className="mzc-tools" />}
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
        {m.refs && (
          <div className="mzc-reffoot">
            <span className="mzc-refeb">Hivatkozott · L3</span>
            <div className="mzc-refrow">
              {m.refs.map((r, i) => {
                // Gap-7 fix: human labels where the data provides them, raw id otherwise.
                const d = chatRefDisplay(r)
                return (
                  <span key={i} className="mzc-refch">
                    <b className="mzc-refk">{d.kind}</b>
                    {d.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
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
