// ============================================================
// Mezo · RecipeOverrideRow (one editable recipe-ingredient line — mezo-ormb)
// Presentational: name + this line's kcal (+ „eredetileg N" when changed) + stepper with a tap-to-type
// amount + a per-row reset. Amounts are in the RECIPE's own unit, with decimals (a half banana is
// 0,5 db); 0 means "left it out". The parent owns the value.
// Folyadék (mezo-n4wf5.5, prototype fuel.js `.fu-tur`): a hairline row inside the line's tuning box; a
// changed row's name takes the domain colour.
// ============================================================
import { useState } from 'react'
import { getLang, useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { Lk } from '@/shared/ui/folyadek'

/** ±10 for mass/volume (matching the pantry stepper), ±0,5 for discrete units. */
export function stepFor(unit: string): number {
  return ['g', 'ml'].includes(unit.trim().toLowerCase()) ? 10 : 0.5
}

/** Decimal comma or point → number; null when the text is blank or not a non-negative number.
 *  Blank must be IGNORED, not read as 0 — `Number('')` is 0, which would silently log "left it
 *  out" for anyone who clears the field to retype and then loses focus. Typing an explicit `0`
 *  is still the way to say "left it out". */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** 0.5 → "0,5" (English "0.5"), 60 → "60" — up to three decimals, no trailing zeros. `format.ts` has no
 *  free-precision style (its `fmtNum` stops at two fixed digits), so the mark is set here. */
export function formatAmount(n: number): string {
  const text = String(Math.round(n * 1000) / 1000)
  return getLang() === 'hu' ? text.split('.').join(',') : text
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
  const M = useM()
  const L = M.fuelLog.override
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const changed = amount !== originalAmount
  const step = stepFor(unit)

  const commit = () => {
    const parsed = parseAmount(draft)
    setEditing(false)
    if (parsed !== null && parsed !== amount) onChange(parsed)
  }

  return (
    <div className={`fg-tur${changed ? ' ch' : ''}`}>
      <span className="g">
        <strong>{name}</strong>
        <small>{changed ? L.kcalWas(fmtGrouped(kcal), formatAmount(originalAmount), unit) : L.kcal(fmtGrouped(kcal))}</small>
      </span>

      <span className="fg-stp">
        <button type="button" onClick={() => onChange(Math.max(0, Math.round((amount - step) * 1000) / 1000))}
          aria-label={L.less(name)}>−</button>
        {editing ? (
          <input
            autoFocus type="text" inputMode="decimal" value={draft}
            aria-label={L.amount(name)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
          />
        ) : (
          <button type="button" className="fg-stp-v"
            onClick={() => { setDraft(formatAmount(amount)); setEditing(true) }}
            aria-label={L.editAmount(name)}>
            {formatAmount(amount)}
          </button>
        )}
        <button type="button" onClick={() => onChange(Math.round((amount + step) * 1000) / 1000)}
          aria-label={L.more(name)}>+</button>
        <small>{unit}</small>
      </span>

      {changed && <Lk onClick={onReset} aria-label={L.reset(name)}>↺</Lk>}
    </div>
  )
}
