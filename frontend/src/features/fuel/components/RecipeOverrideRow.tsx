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

  return (
    <div className="row" style={{ alignItems: 'center', gap: 7, padding: '7px 0',
      borderTop: '1px solid var(--border-subtle)',
      background: changed ? 'color-mix(in srgb, var(--coral) 9%, transparent)' : undefined }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5,
        color: changed ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: changed ? 600 : 400 }}>
        {name}
        {changed && (
          <>
            <span className="label-mono" style={{ fontSize: 7, marginLeft: 5, padding: '2px 4px',
              color: 'var(--coral)', background: 'color-mix(in srgb, var(--coral) 14%, transparent)' }}>MÓD</span>
            <span style={{ fontSize: 9.5, marginLeft: 5, color: 'var(--text-tertiary)',
              textDecoration: 'line-through' }}>{formatAmount(originalAmount)} {unit}</span>
          </>
        )}
      </span>

      <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', display: 'inline-flex' }}>
        <button onClick={() => onChange(Math.max(0, Math.round((amount - step) * 1000) / 1000))}
          aria-label={`${name} csökkentés`}
          style={{ width: 19, height: 22, display: 'grid', placeItems: 'center', color: 'var(--coral)' }}>−</button>
        {editing ? (
          <input
            autoFocus type="text" inputMode="decimal" value={draft}
            aria-label={`${name} mennyiség`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
            style={{ width: 40, textAlign: 'center', fontSize: 10.5, fontWeight: 600,
              background: 'var(--surface-1)', border: '1px solid var(--coral)',
              color: 'var(--text-primary)' }}
          />
        ) : (
          <button
            onClick={() => { setDraft(formatAmount(amount)); setEditing(true) }}
            aria-label={`${name} mennyiség szerkesztése`}
            style={{ minWidth: 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
              fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatAmount(amount)}
          </button>
        )}
        <button onClick={() => onChange(Math.round((amount + step) * 1000) / 1000)}
          aria-label={`${name} növelés`}
          style={{ width: 19, height: 22, display: 'grid', placeItems: 'center', color: 'var(--coral)' }}>+</button>
        <span className="label-mono" style={{ fontSize: 7.5, color: 'var(--text-tertiary)', padding: '0 5px 0 1px' }}>{unit}</span>
      </div>

      <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)',
        minWidth: 34, textAlign: 'right' }}>{kcal}</span>

      {changed && (
        <button onClick={onReset} aria-label={`${name} visszaállítás`}
          style={{ padding: 2, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          <Icon name="x" size={10} />
        </button>
      )}
    </div>
  )
}
