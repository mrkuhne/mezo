import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
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

  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="card notch-12" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
        <div className="accent-strip" />
        <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow brand>{briefing.eyebrow || 'Reggeli briefing'}</Eyebrow>
          {expanded && (demo ? (
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Demo tartalom</span>
          ) : briefing.confidence != null ? (
            <span className="label-mono" style={{ fontSize: 9 }}>Confidence {Math.round(briefing.confidence * 100)}%</span>
          ) : null)}
        </div>
        {expanded ? (
          <>
            <div className="col gap-md mt-md briefing-body">
              {briefing.body.map((p, i) => (
                <p key={i} style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-primary)' }}>
                  <SafeMarkdown text={p.text} />
                </p>
              ))}
            </div>
            <div className="row gap-sm flex-wrap mt-lg" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <span className="eyebrow text-tertiary" style={{ fontSize: 9 }}>Hivatkozott</span>
              {briefing.refs.map((r, i) => (
                <RefTag key={i} kind={r.kind} label={r.label} />
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="brief-more" onClick={() => setExpanded(false)}>összecsuk</button>
            </div>
          </>
        ) : (
          <div className="brief">
            <span aria-hidden="true">✨</span>
            <div className="brief-clamp">
              <SafeMarkdown text={briefing.body[0]?.text ?? ''} />
            </div>
            <button type="button" className="brief-more" onClick={() => setExpanded(true)}>bővebben</button>
          </div>
        )}
      </div>
    </div>
  )
}
