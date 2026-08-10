// ============================================================
// Mezo · MezoMessage — the companion's standing word on the Mai
// screen (mezo-puci), the BriefingCard's successor. Three deliberate
// differences from the card it replaces: it is a FULL-BLEED band (no
// side margin, no left border, no radius), it carries NO avatar (the
// eyebrow is the identity), and it is NEVER clamped — there is no
// `bővebben`, because nothing is hidden. It renders above the daypart
// views and does not change with the selected tab.
// ============================================================
import { CoachBubble } from '@/shared/ui/CoachBubble'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import type { Briefing } from '@/data/types'

export function MezoMessage({
  briefing,
  /** True in real mode — the prose is static demo copy, so the fabricated confidence % is replaced. */
  demo,
}: {
  briefing: Briefing
  demo?: boolean
}) {
  const [lead, ...rest] = briefing.body
  const meta = demo ? (
    <span className="brief-meta">Demo tartalom</span>
  ) : briefing.confidence != null ? (
    <span className="brief-meta">Confidence {Math.round(briefing.confidence * 100)}%</span>
  ) : null

  return (
    <CoachBubble eyebrow={briefing.eyebrow || 'Mezo · reggeli briefing'} avatar={false} className="cb-band">
      <div className="briefing-body">
        <p className="brief-lead"><SafeMarkdown text={lead?.text ?? ''} /></p>
        {rest.map((p, i) => (
          <p key={i} className="brief-rest"><SafeMarkdown text={p.text} /></p>
        ))}
      </div>
      {briefing.refs.length > 0 && (
        <div className="brief-refs">
          <span className="brief-refs-l">Hivatkozott</span>
          {briefing.refs.map((r, i) => <RefTag key={i} kind={r.kind} label={r.label} />)}
        </div>
      )}
      {meta && <div className="brief-foot">{meta}</div>}
    </CoachBubble>
  )
}
