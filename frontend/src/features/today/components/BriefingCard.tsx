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
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="card notch-12" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
        <div className="accent-strip" />
        <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow brand>{briefing.eyebrow || 'Reggeli briefing'}</Eyebrow>
          {demo ? (
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Demo tartalom</span>
          ) : (
            <span className="label-mono" style={{ fontSize: 9 }}>Confidence {Math.round((briefing.confidence ?? 0) * 100)}%</span>
          )}
        </div>
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
      </div>
    </div>
  )
}
