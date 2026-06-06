import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { patternCategoryColor } from '@/data/insights'
import type { Pattern, PatternCritique, PatternStatus } from '@/data/types'

const CRITIQUE_ROWS: Array<{ lbl: string; key: keyof PatternCritique }> = [
  { lbl: 'Statistical', key: 'statistical' },
  { lbl: 'Confounders', key: 'confounders' },
  { lbl: 'L3 align', key: 'l3align' },
  { lbl: 'Actionability', key: 'actionability' },
]

function statusLabel(s: PatternStatus): string {
  return s === 'confirm' ? '✓ Megerősítve' : s === 'monitor' ? '◐ Megfigyelve' : '✗ Elutasítva'
}

function critiqueColor(v: number): string {
  return v > 0.8 ? 'var(--success)' : v > 0.7 ? 'var(--brand-primary)' : 'var(--warning)'
}

export function PatternCard({ pattern }: { pattern: Pattern }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<PatternStatus | null>(null)
  const catColor = patternCategoryColor(pattern.category)

  return (
    <div className="card notch-12" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: catColor }} />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row gap-sm">
          <span
            className="chip"
            style={{ fontSize: 9, padding: '3px 8px', color: catColor, borderColor: `${catColor}59`, background: 'rgba(255,255,255,0.02)' }}
          >
            {pattern.categoryLabel}
          </span>
          <span className="eyebrow text-tertiary">conf {(pattern.confidence * 100).toFixed(0)}%</span>
        </div>
        {status && <span className="chip brand" style={{ fontSize: 9 }}>{statusLabel(status)}</span>}
      </div>

      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 17, marginTop: 10, lineHeight: 1.2, color: 'var(--text-primary)' }}>
        {pattern.title}
      </div>

      <p className="text-secondary mt-md" style={{ fontSize: 13, lineHeight: 1.5 }}>{pattern.mechanism}</p>

      <div className="critique-grid">
        {CRITIQUE_ROWS.map((c) => {
          const val = pattern.critique[c.key]
          return (
            <div key={c.key} className="col gap-xs">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="lbl">{c.lbl}</span>
                <span className="lbl" style={{ color: 'var(--text-primary)' }}>{val.toFixed(2)}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${val * 100}%`, background: critiqueColor(val) }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="row gap-xs flex-wrap mt-md">
        {pattern.evidence.map((e, i) => (
          <span key={i} className="chip" style={{ fontSize: 9 }}>{e}</span>
        ))}
      </div>

      {pattern.thinking && (
        <>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="row gap-sm mt-md" style={{ color: 'var(--brand-glow)' }}>
            <span className="label-mono" style={{ fontSize: 10 }}>AI gondolatmenete</span>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color="var(--brand-glow)" />
          </button>
          {expanded && (
            <p
              className="text-secondary mt-sm"
              style={{ fontSize: 12, lineHeight: 1.5, padding: '10px 12px', background: 'var(--surface-2)', borderLeft: '2px solid var(--brand-glow)' }}
            >
              {pattern.thinking}
            </p>
          )}
        </>
      )}

      <div className="row gap-sm mt-lg" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => setStatus('confirm')}
          className="cta-ghost notch-4 flex-1"
          style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: 10, background: status === 'confirm' ? 'rgba(52, 211, 153, 0.1)' : 'transparent', borderColor: status === 'confirm' ? 'var(--success)' : 'var(--border-strong)' }}
        >
          <Icon name="check" size={12} color={status === 'confirm' ? 'var(--success)' : undefined} /> Confirm
        </button>
        <button
          type="button"
          onClick={() => setStatus('monitor')}
          className="cta-ghost notch-4 flex-1"
          style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: 10, background: status === 'monitor' ? 'rgba(245, 158, 11, 0.1)' : 'transparent', borderColor: status === 'monitor' ? 'var(--warning)' : 'var(--border-strong)' }}
        >
          Monitor
        </button>
        <button
          type="button"
          onClick={() => setStatus('reject')}
          className="cta-ghost notch-4 flex-1"
          style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: 10, background: status === 'reject' ? 'rgba(244, 63, 94, 0.1)' : 'transparent', borderColor: status === 'reject' ? 'var(--error)' : 'var(--border-strong)' }}
        >
          Reject
        </button>
      </div>
    </div>
  )
}
