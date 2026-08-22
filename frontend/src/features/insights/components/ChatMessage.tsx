import { Markdown } from '@/shared/lib/markdown'
import { RefTag } from '@/shared/ui/RefTag'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { RecalledMemoriesRow } from '@/features/insights/components/RecalledMemoriesRow'
import type { ChatMessage as ChatMessageT } from '@/data/types'
import type { ArtifactFeedback, FeedbackReason, FeedbackVerdict } from '@/data/feedback/feedbackTypes'

/** The card's slice of the page-level `useFeedback` handle (mezo-b3pp.15). Absent when the
 *  message is not votable — a user bubble, or an answer still streaming (no persisted id yet). */
export interface ChatMessageFeedback {
  value: ArtifactFeedback | undefined
  onVote: (verdict: FeedbackVerdict, reason?: FeedbackReason) => void
}

export function ChatMessage({ m, feedback }: { m: ChatMessageT; feedback?: ChatMessageFeedback }) {
  if (m.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <div
          className="card"
          style={{ padding: '10px 14px', background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{m.text}</p>
        </div>
        <span
          style={{
            fontSize: 9,
            fontVariantNumeric: 'tabular-nums',
            display: 'block',
            textAlign: 'right',
            marginTop: 4,
            color: 'var(--text-tertiary)',
          }}
        >
          {m.ts}
        </span>
      </div>
    )
  }
  return (
    <div className="col gap-sm" style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '92%' }}>
      <div className="row gap-sm">
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo</span>
        <span className="text-tertiary" style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>
          {m.ts}
        </span>
        {m.degraded && (
          <span
            className="eyebrow"
            style={{ fontSize: 9, color: 'var(--color-warning)' }}
            title="Ez a válasz nem ment át az önellenőrzésen — kezeld fenntartással."
          >
            nem ellenőrzött
          </span>
        )}
      </div>
      {m.tools && <ToolChipRow tools={m.tools} />}
      <div className="card" style={{ padding: 14 }}>
        {/* Model prose — blocks, not one <p>: the answer carries real markdown (mezo-at8x.1). */}
        <div className="md-prose"><Markdown text={m.text} /></div>
        {m.refs && (
          <div
            className="row gap-xs flex-wrap mt-md"
            style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}
          >
            <span className="eyebrow text-tertiary" style={{ fontSize: 9 }}>
              Hivatkozott · L3
            </span>
            {m.refs.map((r, i) => (
              <RefTag key={i} kind={r.kind} label={r.id} />
            ))}
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
