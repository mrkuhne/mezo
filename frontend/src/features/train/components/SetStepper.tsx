import { useState } from 'react'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'

/**
 * Napív giant stepper (spec §4.5 mockup .stepper) — the active-workout logging pair.
 * Deviates from the mockup's side-flanking ± buttons: the value line sits ABOVE a
 * centered button row, because at real phone widths (two tiles in a ~330px card)
 * a flanking layout cannot fit a "107,5 kg" value without squashing the 40px
 * round buttons into ovals (mezo-eerq overflow fix).
 * The value line is tap-to-edit (mezo-o7ds): tapping it swaps in an input backed
 * by useEditableNumber, so exact non-±step values (microplates, odd dumbbells —
 * weightKg has no multipleOf in the contract) stay reachable; commit on blur/Enter.
 */
export function SetStepper({ label, value, step, onChange, unit, integer, min = 0, max = 999 }: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  unit?: string
  integer?: boolean
  min?: number
  max?: number
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const [editing, setEditing] = useState(false)
  const editable = useEditableNumber({ value, onChange, min, max, integer })
  const display = integer ? String(value) : value.toLocaleString('hu-HU')
  return (
    <div className="stepper">
      <div className="k">{label}</div>
      {editing ? (
        <div className="n">
          <input
            {...editable}
            autoFocus
            aria-label={label}
            style={{ width: `${Math.max(editable.value.length, 1)}ch` }}
            onBlur={() => {
              editable.onBlur()
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          {unit && <small> {unit}</small>}
        </div>
      ) : (
        <button type="button" className="n" aria-label={`${label} pontos megadása`} onClick={() => setEditing(true)}>
          {display}
          {unit && <small> {unit}</small>}
        </button>
      )}
      <div className="row">
        <button type="button" className="b np-press" aria-label={`${label} csökkentése`} onClick={() => onChange(clamp(value - step))}>−</button>
        <button type="button" className="b np-press" aria-label={`${label} növelése`} onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    </div>
  )
}
