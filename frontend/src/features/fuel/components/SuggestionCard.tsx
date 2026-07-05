import type { PantrySuggestion } from '@/data/types'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { Icon } from '@/shared/ui/Icon'

// onAdd is optional on purpose (P6, mezo-bka): the deterministic swap suggestions reference
// items already on the shelf, so v1 renders no CTA — an inert "Polcra" would be a false
// affordance. Wire onAdd when a real add-flow exists (P8 reasoned suggestions).
export function SuggestionCard({ sug, onAdd }: { sug: PantrySuggestion; onAdd?: () => void }) {
  return (
    <div
      className="card notch-4"
      style={{
        padding: 12,
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
        borderStyle: 'dashed',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{sug.name}</span>
            <SourceBadge source={sug.source} />
          </div>
          <span className="text-secondary mt-xs" style={{ fontSize: 11, lineHeight: 1.4, display: 'block' }}>
            <Icon name="sparkle" size={9} color="var(--brand-glow)" /> {sug.reason}
          </span>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{sug.price}</span>
          {onAdd && (
            <button className="chip brand" onClick={onAdd} style={{ fontSize: 9, padding: '4px 8px', marginTop: 6 }}>
              <Icon name="plus" size={9} /> Polcra
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
