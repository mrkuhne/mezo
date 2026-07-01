import { Icon } from '@/shared/ui/Icon'
import { useInsights } from '@/data/hooks'
import { MIN_PATTERN_CONFIDENCE } from '@/data/insights/insights'
import { PatternCard } from '@/features/insights/components/PatternCard'

export function PatternsView() {
  const { patterns: all, recentlyConfirmed } = useInsights()
  const patterns = all.filter((p) => p.confidence >= MIN_PATTERN_CONFIDENCE)

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Új minták · {patterns.length}</span>
        <span className="eyebrow text-tertiary">min. {(MIN_PATTERN_CONFIDENCE * 100).toFixed(0)}% conf</span>
      </div>

      {patterns.map((p) => (
        <PatternCard key={p.id} pattern={p} />
      ))}

      {patterns.length === 0 && (
        <div className="card notch-8" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>Csak alacsonyabb confidence minták vannak.</p>
        </div>
      )}

      <div className="card notch-4 mt-md" style={{ padding: 14, background: 'rgba(94, 234, 212, 0.03)' }}>
        <div className="eyebrow brand">Recently confirmed · L3</div>
        <div className="col gap-sm mt-md">
          {recentlyConfirmed.map((t, i) => (
            <div key={i} className="row gap-sm">
              <Icon name="check" size={14} color="var(--brand-glow)" />
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
