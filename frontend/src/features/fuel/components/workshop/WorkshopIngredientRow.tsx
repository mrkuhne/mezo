// ============================================================
// Mezo · WorkshopIngredientRow (Receptműhely vászon — hozzávaló-sor, mezo-92pb)
// One editable line of the draft: name + source tag, a typeable amount with ±10 steppers, the
// line's own kcal and its three macros.
//
// Three honesty rules ride in this file:
//  1. the tag names the source — a pantry line is `kamra`, a Mezo line with no pantry cover is
//     `becslés` (amber);
//  2. the kcal cell prints an em dash when `macros` is null (an unresolvable pantry ref):
//     never a fabricated 0 — the caller passes `lineMacros(line, pool)` straight through;
//  3. an estimate line carries its OWN exits (Csere → kamra-picker, × → remove), because it
//     is exactly what blocks the save gate (`draftToInput` returns null while one remains).
// `flash` marks the lines a turn has just changed (`.fc-wl.diff`; the wash runs only without
// reduced motion — folyadek-fuel-recept.css).
// Folyadék (mezo-n4wf5.5, fuel.js `cLine`): the Fuel-shared `EditLine`.
// ============================================================
import { useState, type InputHTMLAttributes } from 'react'
import type { WorkshopLine } from '@/data/types'
import { useM } from '@/shared/i18n'
import { Acts, Lk } from '@/shared/ui/folyadek'
import { EditLine, LineTags } from '@/features/fuel/components/folyadek'
import { ingredientStyle } from '@/features/fuel/components/FuelQualityBlocks'

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

/** The text state of a typeable amount (mezo-2567): a local string keeps decimals ("12.5") and
 *  mid-typing states, coercing to a number on every change. An OUTSIDE change (± buttons, a
 *  turn's patch, serving-scaling) re-syncs through the render-time prev-prop pattern — no
 *  useEffect, so no keystroke-reset race. Returns the props of the amount `<input>`. */
export function useAmountText(value: number, onChange: (n: number) => void): Pick<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> {
  const [text, setText] = useState(() => String(value))
  const [prev, setPrev] = useState(value)
  // What the current text represents numerically ("" and "." both mean 0, matching commit()).
  const parsed = text === '' || text === '.' ? 0 : parseFloat(text)
  if (value !== prev) {
    setPrev(value)
    if (parsed !== value) setText(String(value)) // external change → resync
  }
  const commit = (raw: string) => {
    const cleaned = raw.replace(',', '.')
    if (cleaned !== '' && !/^\d*\.?\d*$/.test(cleaned)) return // ignore non-numeric input
    setText(cleaned)
    const n = cleaned === '' || cleaned === '.' ? 0 : parseFloat(cleaned)
    onChange(Number.isFinite(n) ? n : 0)
  }
  return { inputMode: 'decimal', value: text, onChange: e => commit(e.target.value) }
}

export function WorkshopIngredientRow({ line, macros, flash, onAmount, onRemove, onReplace }: WorkshopIngredientRowProps) {
  const M = useM()
  const estimate = line.source === 'estimate'
  const amount = useAmountText(line.amount, onAmount)
  return (
    <div className={'fc-wl' + (flash ? ' diff' : '')} data-source={estimate ? 'estimate' : 'pantry'}>
      <EditLine
        icon={ingredientStyle(line.name).icon}
        name={line.name}
        tags={<LineTags source={estimate ? 'estimate' : 'pantry'} warnSource={estimate} />}
        onRemove={onRemove}
        amount={amount}
        unit={line.unit}
        onDec={() => onAmount(Math.max(0, line.amount - STEP))}
        onInc={() => onAmount(line.amount + STEP)}
        kcal={macros ? macros.kcal : null}
        macros={macros}
      >
        {estimate && <Acts><Lk onClick={onReplace}>{M.fuelRecept.workshop.swap}</Lk></Acts>}
      </EditLine>
    </div>
  )
}
