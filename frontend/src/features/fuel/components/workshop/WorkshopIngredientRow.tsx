// ============================================================
// Mezo · WorkshopIngredientRow (Receptműhely vászon — hozzávaló-sor, mezo-92pb)
// The prototype's `.ing` row: name + source tag, a typeable amount with ±10 steppers,
// and the line's own kcal on the right.
//
// Three honesty rules ride in this file:
//  1. the tag names the source — a pantry line is `kamra` (the 3D stack), an AI line with no
//     pantry cover is `becslés` (the 3D score icon; Üveg U2 retired the ✨ emoji);
//  2. the kcal cell prints an em dash when `macros` is null (an unresolvable pantry ref):
//     never a fabricated 0 — the caller passes `lineMacros(line, pool)` straight through;
//  3. an estimate line carries its OWN exits (Csere → kamra-picker, Törlés), because it
//     is exactly what blocks the save gate (`draftToInput` returns null while one remains).
// `flash` paints the gold diff highlight for one turn (CSS `.wsh-ing.diff`, reduced-motion
// guarded in prototype.css).
// Üveg U2 (mezo-me75u.2, prototype `muhely()` `.lcard`): the row is a glass card in its dominant
// macro's hue (grey-sky when the macros are unknown); tag, stepper and Csere chip are flat.
// ============================================================
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { ContentIcon } from '@/shared/ui/clay'
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

/** The card's hue: the macro that carries most of the line's energy — a visual cue only. */
function lineHue(m: WorkshopIngredientRowProps['macros']): string {
  if (!m) return 'var(--dv-sky)'
  const p = m.p * 4, c = m.c * 4, f = m.f * 9
  if (p + c + f <= 0) return 'var(--dv-sky)'
  if (p >= c && p >= f) return 'var(--macro-protein)'
  return c >= f ? 'var(--macro-carbs)' : 'var(--macro-fat)'
}

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
      className="fkx-amt"
    />
  )
}

export function WorkshopIngredientRow({ line, macros, flash, onAmount, onRemove, onReplace }: WorkshopIngredientRowProps) {
  const estimate = line.source === 'estimate'
  const tag = estimate ? 'becslés' : 'kamra'
  return (
    <div className={'fkx-lcard wsh-ing glass' + (flash ? ' diff' : '')}
      style={{ '--c': lineHue(macros) } as React.CSSProperties}>
      <div className="fkx-lcard-top">
        <span className="fkx-lcard-name">
          <strong>{line.name}</strong>
          <span className="fkx-tagf" data-tag={tag}>
            <ContentIcon name={estimate ? 't-score' : 't-stack'} size={15} />{tag}
          </span>
        </span>
        <span className={'fkx-lcard-kcal' + (macros ? '' : ' is-null')}>
          <b>{macros ? macros.kcal : '—'}</b><small>kcal</small>
        </span>
        <button type="button" className="fkx-x" onClick={onRemove} aria-label={`${line.name} eltávolítása`}>
          <Icon name="x" size={12} />
        </button>
      </div>

      <div className="fkx-lcard-line">
        <div className="fkx-step is-amount">
          <button type="button" aria-label={`${line.name} csökkentés`} onClick={() => onAmount(Math.max(0, line.amount - STEP))}>−</button>
          <AmountField value={line.amount} onChange={onAmount} label={`${line.name} mennyisége`} />
          <small>{line.unit}</small>
          <button type="button" aria-label={`${line.name} növelés`} onClick={() => onAmount(line.amount + STEP)}>+</button>
        </div>
        {estimate && (
          <button type="button" className="fkx-chip is-swap" onClick={onReplace}>
            Csere kamra-itemre
          </button>
        )}
      </div>
    </div>
  )
}
