// ============================================================
// Mezo · ScoreBreakdownBody (shared score-breakdown sections)
// Dimension cards + „Lehetne jobb" + „Hogyan számoltam" — used by
// MealScoreSheet (meal score) and RecipeDetailPage „Pontszám"
// (template breakdown, mezo-bw3y). Extracted verbatim from the
// sheet so the two surfaces stay pixel-identical.
// ============================================================
import type { MealBreakdown } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { DimensionCard } from '@/features/fuel/components/DimensionCard'

export function ScoreBreakdownBody({ breakdown }: { breakdown: MealBreakdown }) {
  const b = breakdown
  return (
    <>
      {/* Dimension cards */}
      <div className="col gap-md">
        {b.dimensions.map(d => <DimensionCard key={d.id} dim={d} />)}
      </div>

      {/* Improve */}
      {b.improve && b.improve.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', margin: '22px 0 10px' }}>
            <Eyebrow className="text-warning">Lehetne jobb</Eyebrow>
            <Eyebrow className="text-tertiary">{b.improve.length}</Eyebrow>
          </div>
          <div className="card" style={{ padding: 4 }}>
            {b.improve.map((it, i) => (
              <div key={i} className="row gap-sm" style={{
                padding: '10px 12px',
                borderBottom: i < b.improve.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                alignItems: 'flex-start',
              }}>
                <span style={{
                  width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontVariantNumeric: 'tabular-nums', fontSize: 9, color: 'var(--warning)',
                  background: 'color-mix(in srgb, var(--warning) 12%, transparent)', borderRadius: 4, flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.45, flex: 1 }}>
                  <SafeMarkdown text={it.text} />
                </span>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--warning)', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {it.impact}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tool transparency */}
      {b.tools && b.tools.length > 0 && (
        <>
          <div className="row" style={{ margin: '22px 0 10px' }}>
            <Eyebrow>Hogyan számoltam</Eyebrow>
          </div>
          <ToolChipRow tools={b.tools} />
        </>
      )}
    </>
  )
}
