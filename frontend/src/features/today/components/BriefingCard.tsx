// ============================================================
// Mezo · BriefingCard — the day's narrative in the DS CoachBubble idiom
// (ds-migration P4, mezo-setx.5.1; previously an ItemCard re-dress, mezo-j7u4).
// The companion SPEAKS the briefing, so the card is the Coach voice bubble:
// coral-tinted surface, 2px primary left border, the lead paragraph in Geist 200
// ultralight (never italic — Fraunces stays reserved for narrative meta-text).
// Behaviour is unchanged: collapsed → the lead clamped (`.brief-clamp`) +
// `bővebben`; expanded → the lead in full, the remaining paragraphs at body
// size, the „Hivatkozott" refs row, the honest „Demo tartalom" label (real
// mode) or the confidence %, and `összecsuk`. The day's numbers moved OFF this
// card into FaceMorning's StatStrip (the DS idiom for glance metrics).
// ============================================================
import { useState } from 'react'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { CoachBubble } from '@/shared/ui/CoachBubble'
import type { Briefing } from '@/data/types'

export function BriefingCard({
  briefing,
  demo,
}: {
  briefing: Briefing
  /** True in real mode — the prose is static demo copy, so the fabricated confidence % is replaced by an honest label. */
  demo?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const [lead, ...rest] = briefing.body

  // Same conditional as before: the demo label wins, then the confidence %,
  // and either only ever shows while expanded.
  const meta = demo ? (
    <span className="brief-meta">Demo tartalom</span>
  ) : briefing.confidence != null ? (
    <span className="brief-meta">Confidence {Math.round(briefing.confidence * 100)}%</span>
  ) : null

  return (
    <CoachBubble eyebrow={briefing.eyebrow || 'Mezo · reggeli briefing'} className="brief-bubble">
      {expanded ? (
        <>
          <div className="briefing-body">
            <p className="brief-lead"><SafeMarkdown text={lead?.text ?? ''} /></p>
            {rest.map((p, i) => (
              <p key={i} className="brief-rest"><SafeMarkdown text={p.text} /></p>
            ))}
          </div>
          <div className="brief-refs">
            <span className="brief-refs-l">Hivatkozott</span>
            {briefing.refs.map((r, i) => (
              <RefTag key={i} kind={r.kind} label={r.label} />
            ))}
          </div>
          <div className="brief-foot">
            {meta}
            <button type="button" className="brief-more" onClick={() => setExpanded(false)}>összecsuk</button>
          </div>
        </>
      ) : (
        <div className="brief">
          <div className="brief-clamp brief-lead">
            <SafeMarkdown text={lead?.text ?? ''} />
          </div>
          <button type="button" className="brief-more" onClick={() => setExpanded(true)}>bővebben</button>
        </div>
      )}
    </CoachBubble>
  )
}
