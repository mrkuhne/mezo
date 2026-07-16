import type { StackRecommendation } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'

// fuel-stack.jsx RecommendationCard (330–362)
export function RecommendationCard({ rec }: { rec: StackRecommendation }) {
  return (
    <div
      className="card notch-4"
      style={{
        padding: 12,
        borderColor: 'var(--border-subtle)',
        borderStyle: 'dashed',
        background: 'var(--surface-1)',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {rec.name}
            </span>
            {rec.inStash && (
              <span className="chip brand" style={{ fontSize: 8, padding: '1px 5px' }}>
                polcon
              </span>
            )}
            {!rec.inStash && (
              <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--text-tertiary)' }}>
                új
              </span>
            )}
            <SourceBadge source={rec.source} />
          </div>
          <p className="text-secondary mt-sm" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            {rec.reason}
          </p>
          <div
            className="row gap-md mt-sm"
            style={{ alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}
          >
            <span className="label-mono" style={{ fontSize: 9 }}>
              <Icon name="sparkle" size={9} /> {rec.metric}
            </span>
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
              · conf {(rec.confidence * 100).toFixed(0)}%
            </span>
            <span className="label-mono text-tertiary" style={{ fontSize: 9, marginLeft: 'auto' }}>
              {rec.price}
            </span>
          </div>
        </div>
      </div>
      <div className="row gap-sm mt-md">
        <button className="cta-ghost notch-4 flex-1" style={{ fontSize: 11, padding: '6px 10px' }}>
          <Icon name="plus" size={10} /> Stack-be
        </button>
        <button className="cta-ghost notch-4 flex-1" style={{ fontSize: 11, padding: '6px 10px' }}>
          <Icon name="tool" size={10} /> Részletek
        </button>
      </div>
    </div>
  )
}
