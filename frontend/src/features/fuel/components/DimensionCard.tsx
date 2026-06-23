// ============================================================
// Mezo · DimensionCard (one weighted score dimension, expanded)
// Header (score + weight contribution + mini bar) + detail prose
// + per-dimension visual panel (used by the meal-score panels).
// ============================================================
import type { MealDimension } from '@/data/types'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SafeMarkdown } from '@/lib/safeMarkdown'
import { MacroPanel } from './MacroPanel'
import { MicroPanel } from './MicroPanel'
import { NovaPanel } from './NovaPanel'
import { ContextPanel } from './ContextPanel'

export function DimensionCard({ dim }: { dim: MealDimension }) {
  const subPct = (dim.score * 100).toFixed(0)
  const contribution = (dim.score * dim.weight * 100).toFixed(1)

  return (
    <div className="card notch-12" style={{ padding: 14 }}>
      {/* Header row */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div className="col flex-1">
          <span className="label-mono" style={{ fontSize: 9, color: dim.color }}>
            {dim.label}
          </span>
          <div className="row gap-sm" style={{ alignItems: 'baseline', marginTop: 4 }}>
            <span style={{
              fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600,
              color: dim.color, lineHeight: 1,
            }}>
              {subPct}
            </span>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              × súly {(dim.weight * 100).toFixed(0)}% = {contribution} pt
            </span>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', minWidth: 80 }}>
          <div style={{ width: 80 }}>
            <ProgressBar value={dim.score * 100} color={dim.color} glow />
          </div>
        </div>
      </div>

      {/* Detail prose */}
      <p style={{
        fontSize: 12.5, lineHeight: 1.5, marginTop: 12,
        color: 'var(--text-primary)',
      }}>
        <SafeMarkdown text={dim.detail} />
      </p>

      {/* Per-dimension visual */}
      {dim.id === 'macro' && <MacroPanel dim={dim} />}
      {dim.id === 'micro' && <MicroPanel dim={dim} />}
      {dim.id === 'nova' && <NovaPanel dim={dim} />}
      {dim.id === 'context' && <ContextPanel dim={dim} />}
    </div>
  )
}
