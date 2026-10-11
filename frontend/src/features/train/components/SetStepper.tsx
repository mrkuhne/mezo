import { useLayoutEffect, useRef, useState } from 'react'
import { Stepper } from '@/shared/ui/folyadek'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'

/**
 * The set editor's − value + line (Folyadék F4, mezo-n4wf5.4): the kit's `Stepper` as a whole row — the label
 * (with its unit, „Súly · kg") on the left, the control on the right. The value itself is a text field
 * (mezo-o7ds): exact non-±step values (microplates, odd dumbbells — weightKg has no multipleOf in the
 * contract) stay reachable; `useEditableNumber` commits and clamps on blur / Enter. At rest the field reads the
 * value the Hungarian way („107,5"); while typing it shows the raw draft. The field carries the label as its
 * name; the buttons are „<label> csökkentése / növelése".
 */
export function SetStepper({ label, value, step, onChange, unit, integer, min = 0, max = 999, disabled = false }: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  unit?: string
  integer?: boolean
  min?: number
  max?: number
  disabled?: boolean
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const [editing, setEditing] = useState(false)
  // The resting text („107,5") is swapped for the raw draft on focus; select it AFTER that swap, so typing replaces it.
  const field = useRef<HTMLInputElement | null>(null)
  useLayoutEffect(() => {
    if (editing) field.current?.select()
  }, [editing])
  const editable = useEditableNumber({ value, onChange, min, max, integer })
  const display = integer ? String(value) : value.toLocaleString('hu-HU')
  return (
    <Stepper
      label={unit ? `${label} · ${unit}` : label} name={label}
      onDec={() => onChange(clamp(value - step))} onInc={() => onChange(clamp(value + step))}
      decDisabled={disabled} incDisabled={disabled}
      input={{
        ...editable,
        value: editing ? editable.value : display,
        disabled,
        autoComplete: 'off',
        onFocus: (e) => {
          field.current = e.currentTarget
          setEditing(true)
          editable.onFocus(e)
        },
        onBlur: () => {
          editable.onBlur()
          setEditing(false)
        },
        onKeyDown: (e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        },
      }}
    />
  )
}
