// ============================================================
// Mezo · MacroPanel (a makró-dimenzió csempe-grafikája)
// Mozaik 2.0 (mezo-jcpt.1): the stacked P/C/F strip became three `.sb-tgrow` cél-sávok —
// the prototype's makró-anatomy, one row per macro, each with the meal's OWN share and the
// rubric band it is measured against.
//
// READ THIS BEFORE "FIXING" THE „cél" SUBLINES AWAY: mezo-tjua deliberately RETIRED the
// per-macro target sublines from this panel (the day's keret framing is the KeretHero rings'
// and the planned windows' job, not this sheet's). mezo-jcpt.1 deliberately REINSTATES them,
// per the approved 2026-09-03 daily-score-redesign prototype ("A javított meal-oldal"), and
// the human confirmed the ruling: these are the DIMENSION's own rubric band — the range the
// macro is being scored against right here — not the day's budget, which is what mezo-tjua
// removed. Both decisions stand; they are about different numbers. Do not revert.
// The three macro hues are the app's existing macro language (coral/amber/lav), not new
// literals — the same trio MacroCells uses.
// ============================================================
import type { MacroDimension } from '@/data/types'
import { hu1 } from '@/shared/lib/huNum'

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
        {/* Honnan a cél (mezo-mxmh). Az 1. körben ez a `detail` mondat végén állt, ahol az
            összecsukott kártya kétsoros vágása pont ezt ette meg — saját mezőként mindig látszik. */}
        {dim.targetOrigin && (
          <div className="sb-fchips" style={{ marginTop: 2 }}>
            <span className="sb-fchip" style={{ maxWidth: '100%' }}>
              <em>Honnan a cél</em>
              <span style={{ whiteSpace: 'normal' }}>{dim.targetOrigin}</span>
            </span>
          </div>
        )}
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Az étel makró-felépítése · a napi keret {hu1(dim.kcalShareOfDay)}%-a
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
