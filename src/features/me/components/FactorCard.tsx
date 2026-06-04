import type { Factor } from '@/data/types'
import { Display } from '@/components/ui/Display'
import { ConfidenceBar } from './ConfidenceBar'

const KIND_COLOR: Record<Factor['kind'], string> = {
  positive: 'var(--brand-glow)',
  negative: 'var(--error)',
  watch: 'var(--warning)',
  neutral: 'var(--text-secondary)',
}

export function FactorCard({ factor }: { factor: Factor }) {
  const color = KIND_COLOR[factor.kind]
  return (
    <div
      className="card notch-4"
      style={{
        padding: 12,
        position: 'relative',
        overflow: 'hidden',
        background: factor.warning ? 'rgba(245, 158, 11, 0.04)' : 'var(--surface-1)',
        borderColor: factor.warning ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-subtle)',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: color }} />
      <div style={{ paddingLeft: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col flex-1">
            <Display size="sm">{factor.title}</Display>
            <span
              className="text-tertiary"
              style={{ fontSize: 10, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}
            >
              {factor.evidence}
            </span>
          </div>
          <span className="label-mono" style={{ fontSize: 10, color, marginLeft: 10, whiteSpace: 'nowrap' }}>
            {factor.impact}
          </span>
        </div>
        <ConfidenceBar color={color} confidence={factor.confidence} />
      </div>
    </div>
  )
}
