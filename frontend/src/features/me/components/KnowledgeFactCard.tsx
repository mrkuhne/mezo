import type { KnowledgeFact } from '@/data/types'
import { factCategoryColor } from '@/data/insights/knowledge'

/** One knowledge fact — Napiv row-card idiom (mezo-8141 Task 7), no left accent bar. */
export function KnowledgeFactCard({ fact }: { fact: KnowledgeFact }) {
  const color = factCategoryColor(fact.category)
  return (
    <div
      data-fact-card
      style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--np-shadow-row)', padding: 10, opacity: fact.active ? 1 : 0.55 }}
    >
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{fact.text}</span>
        <div className="row gap-sm" style={{ alignItems: 'center', marginLeft: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)' }}>
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
