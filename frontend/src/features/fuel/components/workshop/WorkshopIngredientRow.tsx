// ============================================================
// Mezo · WorkshopIngredientRow (Receptműhely vászon — hozzávaló-sor, mezo-92pb)
// The prototype's `.ing` row: name + source tag, a typeable amount with ±10 steppers,
// and the line's own kcal on the right.
//
// Three honesty rules ride in this file:
//  1. the tag is the MealComposer idiom (`.logflow-lntag`) — a pantry line is `kamra`,
//     an AI line with no pantry cover is `✨ becslés`;
//  2. the kcal cell prints an em dash when `macros` is null (an unresolvable pantry ref):
//     never a fabricated 0 — the caller passes `lineMacros(line, pool)` straight through;
//  3. an estimate line carries its OWN exits (Csere → kamra-picker, Törlés), because it
//     is exactly what blocks the save gate (`draftToInput` returns null while one remains).
// `flash` paints the gold diff highlight for one turn (CSS `.wsh-ing.diff`, reduced-motion
// guarded in prototype.css).
// ============================================================
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import type { WorkshopLine } from '@/data/types'

export interface WorkshopIngredientRowProps {
  line: WorkshopLine
  /** lineMacros(line, pool) — null when the pantry ref cannot be resolved (honest dash) */
  macros: { kcal: number; p: number; c: number; f: number } | null
  flash?: boolean
  onAmount: (n: number) => void
  onRemove: () => void
  /** estimate lines only — hand the row to the kamra picker */
  onReplace: () => void
}

const STEP = 10

// Typeable amount, ported from RecipeEditorPage's AmountField: a local string keeps
// decimals and mid-typing states, and an OUTSIDE change (± buttons, a turn's patch,
// serving-scaling) re-syncs through the render-time prev-prop pattern — no useEffect,
// so no keystroke-reset race.
function AmountField({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(() => String(value))
  const [prev, setPrev] = useState(value)
  const parsed = text === '' || text === '.' ? 0 : parseFloat(text)
  if (value !== prev) {
    setPrev(value)
    if (parsed !== value) setText(String(value))
  }
  const commit = (raw: string) => {
    const cleaned = raw.replace(',', '.')
    if (cleaned !== '' && !/^\d*\.?\d*$/.test(cleaned)) return
    setText(cleaned)
    const n = cleaned === '' || cleaned === '.' ? 0 : parseFloat(cleaned)
    onChange(Number.isFinite(n) ? n : 0)
  }
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={e => commit(e.target.value)}
      aria-label={label}
      className="logflow-amtinput"
      style={{ width: 46 }}
    />
  )
}

export function WorkshopIngredientRow({ line, macros, flash, onAmount, onRemove, onReplace }: WorkshopIngredientRowProps) {
  const estimate = line.source === 'estimate'
  const tag = estimate ? 'becslés' : 'kamra'
  return (
    <div className={'mz-qcard wsh-ing' + (flash ? ' diff' : '')} style={{ marginBottom: 0, padding: '9px 11px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 9 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{line.name}</span>
            <span className="logflow-lntag" data-tag={tag}>{estimate ? '✨ becslés' : 'kamra'}</span>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: macros ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {macros ? macros.kcal : '—'}
          </span>
          <span className="label-mono" style={{ fontSize: 7.5, color: 'var(--text-tertiary)' }}>kcal</span>
        </div>
        <button type="button" onClick={onRemove} aria-label={`${line.name} eltávolítása`} style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          <Icon name="x" size={12} />
        </button>
      </div>

      <div className="row" style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
        <button type="button" className="logflow-stepbtn" aria-label={`${line.name} csökkentés`} onClick={() => onAmount(Math.max(0, line.amount - STEP))}>−</button>
        <AmountField value={line.amount} onChange={onAmount} label={`${line.name} mennyisége`} />
        <button type="button" className="logflow-stepbtn" aria-label={`${line.name} növelés`} onClick={() => onAmount(line.amount + STEP)}>+</button>
        <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{line.unit}</span>
        {estimate && (
          <button
            type="button"
            className="chip"
            onClick={onReplace}
            style={{ marginLeft: 'auto', fontSize: 9, padding: '5px 10px', color: 'var(--lav-deep)' }}
          >
            Csere kamra-itemre
          </button>
        )}
      </div>
    </div>
  )
}
