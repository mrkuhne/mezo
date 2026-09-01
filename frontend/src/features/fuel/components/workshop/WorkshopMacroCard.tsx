// ============================================================
// Mezo · WorkshopMacroCard (Receptműhely vászon — makró-összkép, mezo-92pb)
// The canvas's headline card from docs/design_2.0/prototypes/receptmuhely.html
// (`.macrocard` + `.servrow`): big kcal number, the shared MacroCells strip, the
// existing ServingToggle (/adag ↔ egész) and the kcal-source bar (P·4 / C·4 / F·9).
//
// The numbers arrive ALREADY computed by `draftTotals` (the pantry-resolved,
// null-preserving formula) — this component never derives a macro of its own; the
// only arithmetic here is the kcal-source SPLIT, which is presentation, not a fact.
// The serving stepper lives here because it is the one control that changes every
// number in the card (`scaleServings`), so it belongs next to what it moves.
// ============================================================
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'

export interface WorkshopMacroCardProps {
  /** whole-recipe totals (draftTotals over every line) */
  totals: { kcal: number; p: number; c: number; f: number }
  servings: number
  basis: ServingBasis
  onBasis: (b: ServingBasis) => void
  onServings: (n: number) => void
}

const MIN_SERVINGS = 1
const MAX_SERVINGS = 12

const round = (n: number) => Math.round(n)

/** kcal-forrás split — Atwater factors, the prototype's `.kbar`. Percentages of the
 *  MACRO-derived energy, so a rounding gap against the shown kcal never distorts the bar. */
function energyShares(m: { p: number; c: number; f: number }) {
  const p = m.p * 4
  const c = m.c * 4
  const f = m.f * 9
  const sum = p + c + f
  if (sum <= 0) return { p: 0, c: 0, f: 0 }
  return { p: (p / sum) * 100, c: (c / sum) * 100, f: (f / sum) * 100 }
}

export function WorkshopMacroCard({ totals, servings, basis, onBasis, onServings }: WorkshopMacroCardProps) {
  const perServing = {
    kcal: round(totals.kcal / Math.max(1, servings)),
    p: round(totals.p / Math.max(1, servings)),
    c: round(totals.c / Math.max(1, servings)),
    f: round(totals.f / Math.max(1, servings)),
  }
  const whole = { kcal: round(totals.kcal), p: round(totals.p), c: round(totals.c), f: round(totals.f) }
  const shown = basis === 'whole' ? whole : perServing
  const shares = energyShares(shown)

  return (
    <div className="mz-qcard" style={{ padding: '11px 12px 12px', marginBottom: 9 }}>
      <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
          {shown.kcal}
        </span>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          kcal · {basis === 'whole' ? 'egész recept' : 'egy adag'}
        </span>
      </div>

      <div style={{ marginTop: 8 }}>
        <MacroCells macros={shown} />
      </div>

      <div className="wsh-kbar" aria-hidden="true">
        <i className="kp" style={{ width: `${shares.p}%` }} />
        <i className="kc" style={{ width: `${shares.c}%` }} />
        <i className="kf" style={{ width: `${shares.f}%` }} />
      </div>
      <div className="wsh-klegend">
        <span><span className="sw" style={{ background: 'var(--coral)' }} />fehérje <b>{Math.round(shares.p)}%</b></span>
        <span><span className="sw" style={{ background: 'var(--dv-amber)' }} />szénhidrát <b>{Math.round(shares.c)}%</b></span>
        <span><span className="sw" style={{ background: 'var(--lav)' }} />zsír <b>{Math.round(shares.f)}%</b></span>
      </div>

      <div style={{ marginTop: 10 }}>
        <ServingToggle value={basis} servings={servings} onChange={onBasis} />
      </div>

      <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border-subtle)' }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Adag</span>
          <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)' }}>a mennyiségek arányosan skálázódnak</span>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 9 }}>
          <button
            type="button"
            className="logflow-stepbtn"
            aria-label="Adag csökkentése"
            disabled={servings <= MIN_SERVINGS}
            onClick={() => onServings(servings - 1)}
          >−</button>
          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 16, textAlign: 'center', color: 'var(--text-primary)' }}>
            {servings}
          </span>
          <button
            type="button"
            className="logflow-stepbtn"
            aria-label="Adag növelése"
            disabled={servings >= MAX_SERVINGS}
            onClick={() => onServings(servings + 1)}
          >+</button>
        </div>
      </div>
    </div>
  )
}
