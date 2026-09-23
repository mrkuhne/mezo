// ============================================================
// Mezo · RecipeOverrideRow (one editable recipe-ingredient line — mezo-ormb)
// Presentational: name + MÓD chip + struck-through original + stepper with a tap-to-type
// amount + this line's kcal + a per-row reset. Amounts are in the RECIPE's own unit, with
// decimals (a half banana is 0,5 db); 0 means "left it out". The parent owns the value.
// ============================================================
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'

/** ±10 for mass/volume (matching the pantry stepper), ±0,5 for discrete units. */
export function stepFor(unit: string): number {
  return ['g', 'ml'].includes(unit.trim().toLowerCase()) ? 10 : 0.5
}

/** Hungarian decimal comma → number; null when the text is blank or not a non-negative number.
 *  Blank must be IGNORED, not read as 0 — `Number('')` is 0, which would silently log "left it
 *  out" for anyone who clears the field to retype and then loses focus. Typing an explicit `0`
 *  is still the way to say "left it out". */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** 0.5 → "0,5", 60 → "60" — no trailing zeros, Hungarian separator. */
export function formatAmount(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace('.', ',')
}

interface Props {
  name: string
  unit: string
  originalAmount: number
  amount: number
  kcal: number
  onChange: (amount: number) => void
  onReset: () => void
}

export function RecipeOverrideRow({ name, unit, originalAmount, amount, kcal, onChange, onReset }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const changed = amount !== originalAmount
  const step = stepFor(unit)

  const commit = () => {
    const parsed = parseAmount(draft)
    setEditing(false)
    if (parsed !== null && parsed !== amount) onChange(parsed)
  }

  // Üveg (mezo-me75u.2): a sor a composer üveg sor-kártyáján BELÜL ül, tehát lapos — a
  // módosított sor egy borostyán-árnyalatú cella, a léptető egy lapos kapszula.
  return (
    <div className={`flp-ovr${changed ? ' is-changed' : ''}`}>
      <span className="flp-ovr-name">
        {name}
        {changed && (
          <>
            <span className="flp-ovr-mod">MÓD</span>
            <span className="flp-ovr-was">{formatAmount(originalAmount)} {unit}</span>
          </>
        )}
      </span>

      <div className="flp-ovr-step">
        <button onClick={() => onChange(Math.max(0, Math.round((amount - step) * 1000) / 1000))}
          aria-label={`${name} csökkentés`}>−</button>
        {editing ? (
          <input
            autoFocus type="text" inputMode="decimal" value={draft}
            aria-label={`${name} mennyiség`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
          />
        ) : (
          <button className="flp-ovr-amt"
            onClick={() => { setDraft(formatAmount(amount)); setEditing(true) }}
            aria-label={`${name} mennyiség szerkesztése`}>
            {formatAmount(amount)}
          </button>
        )}
        <button onClick={() => onChange(Math.round((amount + step) * 1000) / 1000)}
          aria-label={`${name} növelés`}>+</button>
        <span className="flp-ovr-unit">{unit}</span>
      </div>

      <span className="flp-ovr-kcal">{kcal}</span>

      {changed && (
        <button className="flp-ovr-reset" onClick={onReset} aria-label={`${name} visszaállítás`}>
          <Icon name="x" size={10} />
        </button>
      )}
    </div>
  )
}
