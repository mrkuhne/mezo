import type { PantrySuggestion } from '@/data/types'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { Icon } from '@/components/ui/Icon'

export function SuggestionCard({ sug }: { sug: PantrySuggestion }) {
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
          <button className="chip brand" style={{ fontSize: 9, padding: '4px 8px', marginTop: 6 }}>
            <Icon name="plus" size={9} /> Polcra
          </button>
        </div>
      </div>
    </div>
  )
}
