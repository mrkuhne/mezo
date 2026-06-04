import { affectColor } from '@/data/people'
import type { PersonEntry, RelationPattern } from '@/data/types'
import { ConfidenceBar } from './ConfidenceBar'

export function RelationPatternCard({ pattern, people }: { pattern: RelationPattern; people: PersonEntry[] }) {
  const color =
    pattern.kind === 'positive'
      ? 'var(--brand-glow)'
      : pattern.kind === 'watch'
        ? 'var(--warning)'
        : 'var(--cat-tendency)'
  const involved = pattern.involves
    .map(id => people.find(p => p.id === id))
    .filter((p): p is PersonEntry => Boolean(p))

  return (
    <div className="card notch-4" style={{ padding: 12, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: color }} />
      <div style={{ paddingLeft: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col flex-1">
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--ff-display)', fontWeight: 500, lineHeight: 1.3 }}>
              {pattern.title}
            </span>
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 5, lineHeight: 1.5, fontStyle: 'italic' }}>
              {pattern.evidence}
            </span>
          </div>
        </div>
        <div className="row mt-sm" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="row gap-xs" style={{ alignItems: 'center' }}>
            {involved.map((p, i) => (
              <div
                key={p.id}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  border: '1px solid ' + affectColor(p.affect_baseline),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--ff-display)',
                  fontSize: 9,
                  fontWeight: 600,
                  color: affectColor(p.affect_baseline),
                  marginLeft: i === 0 ? 0 : -6,
                }}
              >
                {p.initial}
              </div>
            ))}
          </div>
          <div style={{ width: 120 }}>
            <ConfidenceBar confidence={pattern.confidence} color={color} />
          </div>
        </div>
      </div>
    </div>
  )
}
