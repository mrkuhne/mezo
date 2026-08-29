// ============================================================
// Mezo · WeekLessonCard — one weekly knowledge candidate (mezo-d20.6.10)
// Source of truth: en-body.html `.lesst` (#page-hless), ×1.18.
// Three states, verbatim: OPEN (gold wash + the two-button decision row) ·
// ACCEPTED (`.ok`, sage wash + "✓ Bekerült a Tudástárba · aktív a promptban") ·
// REJECTED (`.no`, dashed + muted + "elvetve · nem kérdezi újra").
//
// TWO buttons, not three (handoff §6.2/8 — the decision this slice had to make):
// the contract knows accept | reject | refine, and the Tudástár's FactCandidateCard
// offers all three because it owns the inline refine editor. Here the page is a
// weekly TRIAGE surface — the reader is deciding about a handful of one-line
// propositions, not editing text — so the prototype's two buttons stand and the
// page FOOTNOTE names where refining lives. Nothing is lost: `refine` is still a
// first-class decision, just on the surface that already has the editor for it.
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import type { WeekLesson } from '@/data/me/weekLessons'

export interface WeekLessonCardProps {
  lesson: WeekLesson
  delayMs: number
  /** Disabled while a decision is in flight — a candidate is decided exactly once. */
  busy?: boolean
  onAccept: () => void
  onReject: () => void
}

export function WeekLessonCard({ lesson, delayMs, busy, onAccept, onReject }: WeekLessonCardProps) {
  // `refine` is a Tudástár decision; on this surface it reads as accepted knowledge,
  // which is exactly what it is (the candidate was promoted, with edited text).
  const accepted = lesson.decision === 'accept' || lesson.decision === 'refine'
  const rejected = lesson.decision === 'reject'
  return (
    <div
      className={cn('wkl-tile rise', accepted && 'ok', rejected && 'no')}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
    >
      <div className="wkl-row">
        <span className="wkl-pic"><ClayIcon name="i-kristaly" size={20} /></span>
        <div className="wkl-grow">
          <div className="wkl-tx">{lesson.text}</div>
          {/* Honest: no evidence line is rendered when the generator did not name one. */}
          {lesson.evidence && <div className="wkl-ev">{lesson.evidence}</div>}
        </div>
      </div>
      {accepted && <div className="wkl-done">✓ Bekerült a Tudástárba · aktív a promptban</div>}
      {rejected && <div className="wkl-off">elvetve · nem kérdezi újra</div>}
      {!accepted && !rejected && (
        <div className="wkl-dec">
          <button type="button" className="wkl-btn" disabled={busy} onClick={onReject}>
            Nem rólam szól
          </button>
          <button type="button" className="wkl-btn primary" disabled={busy} onClick={onAccept}>
            ✓ Tanuld meg
          </button>
        </div>
      )}
    </div>
  )
}
