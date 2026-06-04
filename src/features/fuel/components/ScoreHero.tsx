// ============================================================
// Mezo · ScoreHero (MealScoreSheet header block)
// Big score ring + macro line + item chips + confidence bar
// ============================================================
import type { FuelMeal } from '@/data/types'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ProgressBar } from '@/components/ui/ProgressBar'

export function ScoreHero({ meal, scorePct, confidence }: { meal: FuelMeal; scorePct: number; confidence: number }) {
  return (
    <div className="card notch-12" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 16, alignItems: 'center' }}>
        {/* Ring */}
        <div style={{ flexShrink: 0 }}>
          <ScoreRing pct={meal.score ?? 0} size={96} stroke={5} label={scorePct.toFixed(0)} />
        </div>

        {/* Meta */}
        <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
          <div className="row gap-xs flex-wrap" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
            <span><span style={{ color: 'var(--text-tertiary)' }}>kcal</span> <span style={{ color: 'var(--text-primary)' }}>{meal.kcal}</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
            <span><span style={{ color: 'var(--text-tertiary)' }}>P</span> <span style={{ color: 'var(--text-primary)' }}>{meal.p}</span></span>
            <span><span style={{ color: 'var(--text-tertiary)' }}>C</span> <span style={{ color: 'var(--text-primary)' }}>{meal.c}</span></span>
            <span><span style={{ color: 'var(--text-tertiary)' }}>F</span> <span style={{ color: 'var(--text-primary)' }}>{meal.f}</span></span>
          </div>
          <div className="row gap-xs flex-wrap mt-sm">
            {meal.items.map((it, i) => (
              <span key={i} className="chip" style={{ fontSize: 9, padding: '3px 6px' }}>{it}</span>
            ))}
          </div>
          <div className="row gap-sm" style={{ marginTop: 8, alignItems: 'center' }}>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Confidence</span>
            <div className="flex-1" style={{ maxWidth: 80 }}>
              <ProgressBar value={confidence * 100} />
            </div>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
