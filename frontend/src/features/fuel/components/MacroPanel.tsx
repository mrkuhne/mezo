// ============================================================
// Mezo · MacroPanel (MacroScoreSheet dimension)
// Stacked P/C/F ratio bar + legend + kcal-share note (+ optional warning)
// ============================================================
import type { MacroDimension } from '@/data/types'

function MacroLegend({ dot, name, value, target }: { dot: string; name: string; value: string; target: string }) {
  return (
    <div className="col flex-1" style={{ gap: 2 }}>
      <div className="row gap-xs" style={{ alignItems: 'center' }}>
        <span style={{ width: 6, height: 6, borderRadius: 1, background: dot }} />
        <span style={{ color: 'var(--text-primary)' }}>{name} {value}</span>
      </div>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 9, paddingLeft: 10 }}>cél {target}</span>
    </div>
  )
}

export function MacroPanel({ dim }: { dim: MacroDimension }) {
  const m = dim.macroRatio
  const t = dim.macroTargets
  return (
    <div className="col gap-sm mt-md">
      {/* Stacked bar */}
      <div style={{
        display: 'flex', height: 8, borderRadius: 2, overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ width: m.p + '%', background: 'var(--coral)', boxShadow: 'inset 0 0 4px color-mix(in srgb, var(--coral) 30%, transparent)' }} />
        <div style={{ width: m.c + '%', background: 'var(--warning)' }} />
        <div style={{ width: m.f + '%', background: 'var(--cat-preference)' }} />
      </div>
      {/* Legend */}
      <div className="row gap-md" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
        <MacroLegend dot="var(--coral)" name="P" value={m.p + '%'} target={t.p} />
        <MacroLegend dot="var(--warning)" name="C" value={m.c + '%'} target={t.c} />
        <MacroLegend dot="var(--cat-preference)" name="F" value={m.f + '%'} target={t.f} />
      </div>
      <div className="col gap-xs" style={{ marginTop: 4 }}>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          Kcal a napi {dim.kcalShareOfDay}%-a
        </span>
        {dim.notes && (
          <span style={{
            fontFamily: 'var(--ff-mono)', fontSize: 10, lineHeight: 1.4,
            color: 'var(--warning)',
            letterSpacing: '0.04em',
          }}>
            ⚠ {dim.notes}
          </span>
        )}
      </div>
    </div>
  )
}
