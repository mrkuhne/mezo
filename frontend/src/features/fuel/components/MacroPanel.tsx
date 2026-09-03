// ============================================================
// Mezo · MacroPanel (MacroScoreSheet dimension)
// Stacked P/C/F ratio bar + legend (+ optional warning). The legend prints the meal's OWN
// composition — what the plate is made of — and no longer the day's keret framing (the per-macro
// „cél" sublines and the „Kcal a napi X%-a" note are retired, mezo-tjua): the daily budget is the
// KeretHero rings' and the planned windows' job, this sheet is about this one logged meal.
// ============================================================
import type { MacroDimension } from '@/data/types'

function MacroLegend({ dot, name, value }: { dot: string; name: string; value: string }) {
  return (
    <div className="row gap-xs flex-1" style={{ alignItems: 'center' }}>
      <span style={{ width: 6, height: 6, borderRadius: 1, background: dot }} />
      <span style={{ color: 'var(--text-primary)' }}>{name} {value}</span>
    </div>
  )
}

export function MacroPanel({ dim }: { dim: MacroDimension }) {
  const m = dim.macroRatio
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
      <div className="row gap-md" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
        <MacroLegend dot="var(--coral)" name="P" value={m.p + '%'} />
        <MacroLegend dot="var(--warning)" name="C" value={m.c + '%'} />
        <MacroLegend dot="var(--cat-preference)" name="F" value={m.f + '%'} />
      </div>
      <div className="col gap-xs" style={{ marginTop: 4 }}>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          Az étel makró-felépítése
        </span>
        {dim.notes && (
          <span style={{
            fontSize: 10, lineHeight: 1.4,
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
