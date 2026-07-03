import { Icon } from '@/shared/ui/Icon'
import { usePatterns, usePatternActions } from '@/data/hooks'
import { MIN_PATTERN_CONFIDENCE } from '@/data/insights/insights'
import { PatternCard } from '@/features/insights/components/PatternCard'

export function PatternsPage() {
  const { patterns: all, recentlyConfirmed, degraded, isPending } = usePatterns()
  const { decide } = usePatternActions()
  // statistical rows carry no confidence (honest small-n) — they passed the n-gate server-side
  const patterns = all.filter((p) => p.confidence == null || p.confidence >= MIN_PATTERN_CONFIDENCE)

  if (degraded) {
    return (
      <div className="card notch-8" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          A minta-motor most nem elérhető — a felismert minták itt jelennek majd meg.
        </p>
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Új minták · {patterns.length}</span>
        <span className="eyebrow text-tertiary">min. {(MIN_PATTERN_CONFIDENCE * 100).toFixed(0)}% conf</span>
      </div>

      {patterns.map((p) => (
        <PatternCard key={p.id} pattern={p} onDecide={(decision) => decide(p.id, decision)} />
      ))}

      {patterns.length === 0 && !isPending && (
        <div className="card notch-8" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            Még nincs felismert minta — az éjszakai elemzés magától tölti, ahogy gyűlnek a napok.
          </p>
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
          {recentlyConfirmed.length === 0 && (
            <span className="text-tertiary" style={{ fontSize: 12 }}>Még nincs megerősített minta.</span>
          )}
        </div>
      </div>
    </div>
  )
}
