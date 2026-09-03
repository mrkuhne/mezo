// ============================================================
// Mezo · MacroPanel (a makró-dimenzió csempe-grafikája)
// Mozaik 2.0 (mezo-jcpt.1): the stacked P/C/F strip became three `.sb-tgrow` cél-sávok —
// the prototype's makró-anatomy, one row per macro, each with the meal's OWN share and the
// rubric band it is measured against. The legend prints what the plate is made of; the day's
// keret framing stays the KeretHero rings' job (mezo-tjua).
// The three macro hues are the app's existing macro language (coral/amber/lav), not new
// literals — the same trio MacroCells uses.
// ============================================================
import type { MacroDimension } from '@/data/types'

const ROWS = [
  { key: 'p', nm: 'fehérje', color: 'var(--coral)' },
  { key: 'c', nm: 'szénh.', color: 'var(--warning)' },
  { key: 'f', nm: 'zsír', color: 'var(--cat-preference)' },
] as const

export function MacroPanel({ dim }: { dim: MacroDimension }) {
  const m = dim.macroRatio
  return (
    <div className="col mt-md">
      {ROWS.map(r => (
        <div key={r.key} className="sb-tgrow">
          <span className="nm">{r.nm}</span>
          <div className="sb-gbar"><i style={{ width: `${Math.min(100, m[r.key])}%`, background: r.color }} /></div>
          <span className="vl">{m[r.key]}% · cél {dim.macroTargets[r.key]}</span>
        </div>
      ))}
      <div className="col gap-xs" style={{ marginTop: 6 }}>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          Az étel makró-felépítése
        </span>
        {dim.notes && (
          <span style={{ fontSize: 10, lineHeight: 1.4, color: 'var(--warning)', letterSpacing: '0.04em' }}>
            ⚠ {dim.notes}
          </span>
        )}
      </div>
    </div>
  )
}
