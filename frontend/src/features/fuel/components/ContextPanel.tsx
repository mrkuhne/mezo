// ============================================================
// Mezo · ContextPanel (időzítés & kontextus dimension)
// Label/value rows for the meal's contextual factors
// ============================================================
import type { ContextDimension } from '@/data/types'

export function ContextPanel({ dim }: { dim: ContextDimension }) {
  return (
    <div className="col gap-xs mt-md" style={{
      paddingTop: 10,
      borderTop: '1px solid var(--border-subtle)',
    }}>
      {dim.context.map((c, i) => (
        <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{c.label}</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-primary)' }}>{c.value}</span>
        </div>
      ))}
    </div>
  )
}
