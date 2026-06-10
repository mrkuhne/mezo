import type { KnowledgeFact } from '@/data/types'
import { factCategoryColor } from '@/data/knowledge'

export function KnowledgeFactCard({ fact }: { fact: KnowledgeFact }) {
  const color = factCategoryColor(fact.category)
  return (
    <div
      data-fact-card
      className="card notch-4"
      style={{ padding: 10, position: 'relative', overflow: 'hidden', opacity: fact.active ? 1 : 0.55 }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: color }} />
      <div className="row" style={{ paddingLeft: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{fact.text}</span>
        <div className="row gap-sm" style={{ alignItems: 'center', marginLeft: 10, flexShrink: 0 }}>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            ×{fact.reinforced}
          </span>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: fact.active ? color : 'var(--text-quaternary)',
              boxShadow: fact.active ? `0 0 6px ${color}` : 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}
